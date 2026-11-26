import * as T from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { isLayers, loadData } from '../data/load.ts';
import type { Building, Point } from '../data/types.ts';
import { ringCenter } from '../data/sector-index.ts';
import { DEBRIS_TUNE, type Blast } from '../demolition/debris.ts';
import { makeDemolisher } from '../demolition/demolish.ts';
import { rayPrism } from '../demolition/ray.ts';
import { makeShake } from '../demolition/shake.ts';
import { TUNE } from '../drive/drive-tune.ts';
import { aimShot, makeSlug, shotBlast, type Shot } from '../drive/drive-weapon.ts';
import { nearestOnRing, pointInRing } from '../geometry.ts';
import { CAMERA_DISTANCE, GroundControls, fitPixels, mapViewDirection } from '../render/map-camera.ts';
import { labCity } from './lab-city.ts';

/**
 * Demolition lab (`lab.html?lab=demolizione`): a wrecking ball that hangs under the mouse, dynamite placed with a
 * click and the drive's gun fired at a clicked wall, all breaking the city's own buildings into the 2.5D pieces of `demolition/fracture.ts`. Debris is visual only.
 * Monuments (`landmark`) are drawn by their own models and stay standing. A reload brings the city back.
 */
interface Target {
  building: Building;
  ring: Point[];
  base: number;
  top: number;
  /** Last `near` query that listed it: a query never lists a building twice, and allocates nothing. */
  seen: number;
}
type Tool = 'ball' | 'dynamite' | 'gun';
const TOOLS: Record<string, Tool> = {palla: 'ball', dinamite: 'dynamite', sparo: 'gun'};
const KEYS: Record<string, Tool> = {1: 'ball', 2: 'dynamite', 3: 'gun'};

const GRID = 32;
/** A numeric key for a grid cell: no string per lookup. */
const key = (i: number, j: number) => (i + 32768) * 65536 + j + 32768;

export async function demolitionLab() {
  const el = (id: string) => document.getElementById(id)!;
  const query = new URLSearchParams(location.search), host = el('view');
  el('tools').hidden = true;
  const lab = await labCity(host, query);
  const {city, renderer, scene, camera, tones} = lab;

  // Every building the streamed sectors bring, indexed on a 32 m grid for the ball, the picking and the blasts.
  // A building split in volumes shares its id: `targets` holds its parts, which come down together. A sector that
  // loads again brings the same parts again: `known` keeps one of each.
  const targets = new Map<number, Target[]>(), grid = new Map<number, Target[]>(), known = new Set<string>();
  let highest = 0, lookup = 0;
  function register(b: Building) {
    const ring = b.rings[0], part = b.id + ':' + ring[0][0] + ',' + ring[0][1];
    if (b.landmark || known.has(part) || demolished.has(b.id)) return;
    known.add(part);
    const base = stream.altitude(ring[0][0], ring[0][1]);
    const target = {building: b, ring, base, top: base + (b.heightOverride ?? b.height), seen: 0};
    const parts = targets.get(b.id);
    if (parts) parts.push(target); else targets.set(b.id, [target]);
    highest = Math.max(highest, target.top);
    const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
    for (let i = Math.floor(Math.min(...xs) / GRID); i <= Math.floor(Math.max(...xs) / GRID); i++)
      for (let j = Math.floor(Math.min(...ys) / GRID); j <= Math.floor(Math.max(...ys) / GRID); j++) {
        const list = grid.get(key(i, j));
        if (list) list.push(target); else grid.set(key(i, j), [target]);
      }
  }
  /** Standing buildings in the cells within `reach` of each point, added to `out` (cleared unless `keep`). */
  function near(east: number, north: number, reach: number, out: Target[] = [], keep = false) {
    if (!keep) { lookup++; out.length = 0; }
    for (let i = Math.floor((east - reach) / GRID); i <= Math.floor((east + reach) / GRID); i++)
      for (let j = Math.floor((north - reach) / GRID); j <= Math.floor((north + reach) / GRID); j++)
        for (const t of grid.get(key(i, j)) ?? []) {
          if (t.seen === lookup || demolished.has(t.building.id)) continue;
          t.seen = lookup; out.push(t);
        }
    return out;
  }

  const stream = lab.stream({
    trackBuildings: true,
    async loadLayers(s, signal) {
      const layers = await loadData('city-sectors/' + s.file, isLayers, signal);
      // The fused blocks of small screens join neighbours: here every building comes down on its own.
      delete layers.fused;
      for (const b of layers.buildings) register(b);
      return layers;
    },
    refresh() { renderer.shadowMap.needsUpdate = true; }
  });
  const altitude = stream.altitude;
  const debris = makeDemolisher({material: stream.materials.buildingMat, altitude, tones, hide: stream.hideBuilding});
  const demolished = debris.demolished;
  scene.add(debris.root);

  const settings = {
    tool: TOOLS[query.get('strumento') ?? ''] ?? 'ball',
    height: Number(query.get('quota')) || 9, rope: 24, radius: 2.4, threshold: 7,
    power: 24, blastRadius: 7, fuse: 1.1, standoff: Number(query.get('distanza')) || 25
  };

  /** The nearest point of a footprint's edge, and its distance, negative inside. */
  function edge(ring: Point[], x: number, y: number) {
    const e = nearestOnRing(ring, x, y);
    if (pointInRing(ring, x, y)) e.distance = -e.distance;
    return e;
  }

  // Pointer. The ray meets the terrain after a few fixed-point steps; with `buildings`, those in the cells it
  // crosses on the way down are met exactly, through their roof or a wall.
  const raycaster = new T.Raycaster(), ndc = new T.Vector2(), ground = new T.Vector3(), hit = new T.Vector3();
  const crossed: Target[] = [];
  function pick(clientX: number, clientY: number, buildings = true): Target | null {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const {origin: o, direction: d} = raycaster.ray;
    let tg = (controls.target.y - o.y) / d.y;
    for (let k = 0; k < 4; k++) tg = (altitude(o.x + tg * d.x, -(o.z + tg * d.z)) - o.y) / d.y;
    raycaster.ray.at(tg, ground);
    if (!buildings) return null;
    const t0 = Math.min(tg, (highest - o.y) / d.y), step = GRID / 4 / (Math.hypot(d.x, d.z) || 1);
    lookup++; crossed.length = 0;
    for (let t = t0; t <= tg + step; t += step) near(o.x + t * d.x, -(o.z + t * d.z), 0, crossed, true);
    let best = tg, found: Target | null = null;
    for (const target of crossed) {
      const t = rayPrism(o, d, target.ring, target.base - 1, target.top);
      if (t < best) { best = t; found = target; }
    }
    raycaster.ray.at(best, hit);
    return found;
  }

  const shake = makeShake();
  let freeze = 0, shadows = true;
  function demolish(target: Target, blast: Blast) {
    const parts = targets.get(target.building.id) ?? [target];
    if (!debris.demolish(target.building.id, parts.map(({building, base}) => ({building, base})), blast)) return;
    shake.add(blast.strength / 18 + (blast.push?.length() ?? 0) / 30);
    freeze = Math.max(freeze, .05);
  }

  // Wrecking ball: a Verlet pendulum whose anchor is the point under the mouse, `rope` metres above the ball.
  const ball = new T.Mesh(new T.IcosahedronGeometry(1, 2),
    new T.MeshStandardMaterial({color: '#3b3f44', roughness: .55, metalness: .3, flatShading: true}));
  ball.castShadow = true;
  const rope = new T.Line(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(new Float32Array(6), 3)),
    new T.LineBasicMaterial({color: '#2b2b2b'}));
  rope.frustumCulled = false;
  scene.add(ball, rope);
  const cursor = new T.Vector3(), anchor = new T.Vector3(), previous = new T.Vector3(), velocity = new T.Vector3();
  const offset = new T.Vector3(), shadowed = new T.Vector3(), nearby: Target[] = [];
  let hasCursor = false;

  function swing(dt: number) {
    anchor.set(cursor.x, altitude(cursor.x, -cursor.z) + settings.height + settings.rope, cursor.z);
    const steps = 4, h = dt / steps, r = settings.radius, p = ball.position;
    // One lookup a frame, wide enough for where the ball can get to by the last substep.
    near(p.x, -p.z, r + 1 + velocity.length() * dt, nearby);
    for (let s = 0; s < steps; s++) {
      velocity.subVectors(p, previous).multiplyScalar(.998);
      previous.copy(p);
      p.add(velocity).y -= 9.8 * h * h;
      offset.subVectors(p, anchor);
      if (offset.length() > settings.rope) p.copy(anchor).addScaledVector(offset, settings.rope / offset.length());
      velocity.subVectors(p, previous).divideScalar(h);
      for (const target of nearby) {
        if (demolished.has(target.building.id) || p.y - r > target.top || p.y + r < target.base) continue;
        const e = edge(target.ring, p.x, -p.z);
        if (e.distance >= r) continue;
        const speed = velocity.length();
        if (speed > settings.threshold) {
          demolish(target, {point: offset.set(e.x, T.MathUtils.clamp(p.y, target.base, target.top), -e.y),
            push: velocity.clone().multiplyScalar(.9), strength: speed * .35, reach: 9});
          previous.copy(p).addScaledVector(velocity, -h * .6);
          continue;
        }
        // Too slow to break: from above it rests on the roof, from the side it is pushed off the wall.
        if (previous.y - r >= target.top - .2) { p.y = target.top + r; previous.y = p.y; continue; }
        const nx = p.x - e.x, ny = -p.z - e.y, n = Math.hypot(nx, ny) || 1, sign = e.distance < 0 ? -1 : 1;
        p.x = e.x + sign * nx / n * r; p.z = -(e.y + sign * ny / n * r);
        previous.x = p.x; previous.z = p.z;
      }
      const floor = altitude(p.x, -p.z) + r;
      if (p.y < floor) { p.y = floor; previous.y = Math.max(previous.y, floor); }
    }
    ball.scale.setScalar(r);
    const line = rope.geometry.getAttribute('position') as T.BufferAttribute;
    line.setXYZ(0, anchor.x, anchor.y, anchor.z); line.setXYZ(1, p.x, p.y + r, p.z);
    line.needsUpdate = true;
    // The ball's shadow is redrawn only when it has moved a couple of centimetres.
    if (shadowed.distanceToSquared(p) > 4e-4) { shadowed.copy(p); shadows = true; }
  }

  // Dynamite: a red stick on the facade or roof that was clicked, a short fuse, then a blast that also takes what
  // stands within `blastRadius` of it. The preview stick shares the material of the charges: one shader program.
  const stickGeometry = new T.CylinderGeometry(.35, .35, 1.6, 8);
  const stickMaterial = new T.MeshStandardMaterial({color: '#c8321f', emissive: '#ff5a1f', emissiveIntensity: 0, flatShading: true});
  const ghost = new T.Mesh(stickGeometry, stickMaterial);
  ghost.scale.setScalar(.8);
  scene.add(ghost);
  const charges: {target: Target; point: T.Vector3; mesh: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>; fuse: number}[] = [];
  function detonate(dt: number) {
    for (let k = charges.length - 1; k >= 0; k--) {
      const c = charges[k];
      c.fuse -= dt;
      c.mesh.material.emissiveIntensity = Math.sin(c.fuse * 30) > 0 ? 1.2 : 0;
      c.mesh.scale.setScalar(1 + .25 * Math.max(0, 1 - c.fuse / settings.fuse));
      if (c.fuse > 0) continue;
      c.mesh.removeFromParent(); c.mesh.material.dispose(); charges.splice(k, 1);
      const blast = {point: c.point, strength: settings.power, reach: 12};
      demolish(c.target, blast);
      for (const t of near(c.point.x, -c.point.z, settings.blastRadius, nearby)) {
        if (edge(t.ring, c.point.x, -c.point.z).distance < settings.blastRadius) demolish(t, {...blast, strength: blast.strength * .5});
      }
    }
  }

  // Gun: the drive's slug (`drive/drive-weapon.ts`, values in `TUNE.weapon`, shared with the drive). There is no car
  // here, so it leaves the road `standoff` metres before the point clicked, on the viewer's side, out of any
  // footprint, and flies level 1.1 m above the ground as from the car's nose: the first wall in reach on that line
  // comes down with the drive's blast. One shot per cooldown.
  const W = TUNE.weapon, SHOT_HEIGHT = 1.1, slug = makeSlug(scene), along: Target[] = [];
  const rayFrom = new T.Vector3(), rayDir = new T.Vector3();
  let shot: Shot | null = null, cool = 0, shots = 0;
  /** Whether (x, y) stands inside a building's footprint. */
  const indoors = (x: number, y: number) => near(x, y, 0, along).some(t => pointInRing(t.ring, x, y));
  /** The first standing wall a level ray meets: its distance and building, Infinity and null when none does. */
  function levelHit(x: number, y: number, z: number, heading: number, range: number) {
    const c = Math.cos(heading), s = Math.sin(heading), step = GRID / 4;
    lookup++; along.length = 0;
    for (let t = 0; t <= range + step; t += step) near(x + c * t, y + s * t, step, along, true);
    rayFrom.set(x, z, -y); rayDir.set(c, 0, -s);
    let best = Infinity, building: Building | null = null;
    for (const target of along) {
      const t = rayPrism(rayFrom, rayDir, target.ring, target.base - 1, target.top);
      if (t < best) { best = t; building = target.building; }
    }
    return {t: best, building};
  }
  function fire(clientX: number, clientY: number) {
    if (cool > 0 || shot) return false;
    pick(clientX, clientY);
    const aimX = hit.x, aimY = -hit.z;
    // Back towards the camera along the ground, then further out while that point is inside a building.
    let bx = camera.position.x - controls.target.x, by = controls.target.z - camera.position.z;
    const n = Math.hypot(bx, by) || 1; bx /= n; by /= n;
    let back = settings.standoff;
    while (back < settings.standoff + 60 && indoors(aimX + bx * back, aimY + by * back)) back += 2;
    const x = aimX + bx * back, y = aimY + by * back, z = altitude(x, y) + SHOT_HEIGHT;
    const heading = Math.atan2(aimY - y, aimX - x), {t, building} = levelHit(x, y, z, heading, W.range);
    shot = aimShot(x, y, z, heading, t, building, W.range);
    cool = W.cooldown; shots++;
    shake.add(.25);
    return true;
  }
  /** Moves the slug one step; at its wall or its reach it stops, and the wall comes down. */
  function advanceShot(dt: number) {
    cool = Math.max(0, cool - dt);
    if (!shot) return;
    const step = Math.min(shot.left, W.speed * dt);
    shot.x += shot.dx * step; shot.y += shot.dy * step; shot.z = altitude(shot.x, shot.y) + SHOT_HEIGHT;
    shot.left -= step;
    if (shot.left > 1e-6) return;
    const target = shot.building && targets.get(shot.building.id)?.[0];
    if (target) demolish(target, shotBlast(shot, W));
    shot = null;
  }

  // Camera: the map's, panned with the right button or the arrows, zoomed with the wheel. The left button is the tool.
  const controls = new GroundControls(camera, renderer.domElement);
  controls.enableRotate = false; controls.zoomToCursor = true;
  controls.mouseButtons = {LEFT: null, MIDDLE: T.MOUSE.DOLLY, RIGHT: T.MOUSE.PAN};
  controls.minZoom = 1.5; controls.maxZoom = 40;
  controls.listenToKeyEvents(window);
  const road = city.roads.find(r => r.id === '30801332')?.line;
  const startX = Number(query.get('x')) || (road ? (road[0][0] + road[road.length - 1][0]) / 2 : 0);
  const startY = Number(query.get('y')) || (road ? (road[0][1] + road[road.length - 1][1]) / 2 : 0);
  controls.target.set(startX, altitude(startX, startY), -startY);
  camera.position.copy(controls.target).addScaledVector(mapViewDirection(), CAMERA_DISTANCE);
  camera.zoom = Number(query.get('zoom')) || Math.min(host.clientWidth, host.clientHeight) / 170;
  fitPixels(camera, host.clientWidth, host.clientHeight);
  controls.update();
  cursor.copy(controls.target);
  ball.position.set(cursor.x, altitude(cursor.x, -cursor.z) + settings.height, cursor.z);
  previous.copy(ball.position);
  // Build every program now (ball, rope, stick, dust) rather than on the first swing or blast.
  await renderer.compileAsync(scene, camera);
  ghost.visible = false;

  const canvas = renderer.domElement;
  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  // The pointer is read once a frame, however many events came: see `draw`.
  let pointer: {x: number; y: number} | null = null;
  canvas.addEventListener('pointermove', event => { pointer = {x: event.clientX, y: event.clientY}; });
  canvas.addEventListener('pointerleave', () => { ghost.visible = false; });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    if (settings.tool === 'gun') { fire(event.clientX, event.clientY); return; }
    if (settings.tool !== 'dynamite') return;
    const target = pick(event.clientX, event.clientY);
    if (!target) return;
    const mesh = new T.Mesh(stickGeometry, stickMaterial.clone());
    mesh.position.copy(hit).y += .8;
    scene.add(mesh);
    charges.push({target, point: hit.clone(), mesh, fuse: settings.fuse});
  });
  window.addEventListener('keydown', event => {
    if (!KEYS[event.key]) return;
    settings.tool = KEYS[event.key];
    gui.controllersRecursive().forEach(c => c.updateDisplay());
  });

  const gui = new GUI({container: el('gui'), title: 'Demolition'});
  gui.add(settings, 'tool', {'Wrecking ball (1)': 'ball', 'Dynamite (2)': 'dynamite', 'Gun (3)': 'gun'}).name('Tool');
  const ballFolder = gui.addFolder('Wrecking ball');
  ballFolder.add(settings, 'height', 1, 60, .5).name('Ball height (m)');
  ballFolder.add(settings, 'rope', 8, 60, 1).name('Rope (m)');
  ballFolder.add(settings, 'radius', 1, 5, .1).name('Radius (m)');
  ballFolder.add(settings, 'threshold', 2, 20, .5).name('Breaks above (m/s)');
  const dynamite = gui.addFolder('Dynamite');
  dynamite.add(settings, 'power', 5, 60, 1).name('Power (m/s)');
  dynamite.add(settings, 'blastRadius', 0, 25, .5).name('Blast radius (m)');
  dynamite.add(settings, 'fuse', .2, 4, .1).name('Fuse (s)');
  // The drive's own values: the drive lab's Gun folder edits the same `TUNE.weapon`.
  const gunFolder = gui.addFolder('Gun');
  gunFolder.add(W, 'cooldown', .2, 10, .1).name('Cooldown (s)');
  gunFolder.add(W, 'speed', 10, 200, 1).name('Slug speed (m/s)');
  gunFolder.add(W, 'range', 20, 300, 5).name('Range (m)');
  gunFolder.add(W, 'blast', 0, 60, 1).name('Blast (m/s)');
  gunFolder.add(W, 'blastReach', 2, 40, .5).name('Blast reach (m)');
  gunFolder.add(W, 'push', 0, 60, 1).name('Push (m/s)');
  gunFolder.add(settings, 'standoff', 4, 80, 1).name('Fired from (m)');
  const pieces = gui.addFolder('Debris');
  pieces.add(DEBRIS_TUNE, 'gravity', 4, 40, .5).name('Gravity (m/s²)');
  pieces.add(DEBRIS_TUNE, 'shock', 10, 300, 5).name('Shock speed (m/s)');
  pieces.add(DEBRIS_TUNE, 'life', 1, 30, .5).name('Lifetime (s)');
  pieces.add(DEBRIS_TUNE, 'restitution', 0, .8, .02).name('Bounce');
  gui.add({run() { location.reload(); }}, 'run').name('Rebuild the city');

  // The page reports to the checks and the panel only what changed.
  const metrics = el('metrics');
  function report(state: Record<string, string | number>, text: string) {
    for (const [key, value] of Object.entries(state)) if (host.dataset[key] !== String(value)) host.dataset[key] = String(value);
    if (metrics.textContent !== text) metrics.textContent = text;
  }

  function aim() {
    if (!pointer) return;
    const dynamite = settings.tool === 'dynamite', target = pick(pointer.x, pointer.y, dynamite);
    pointer = null;
    // The ball follows the ground under the mouse, not the roof it passes over.
    cursor.copy(ground); hasCursor = true;
    ghost.visible = dynamite && !!target;
    ghost.position.copy(hit).y += .8;
  }

  let last = performance.now(), frame = 0, usedBall = false;
  function draw(now: number) {
    frame = requestAnimationFrame(draw);
    let dt = Math.min(.05, (now - last) / 1000);
    last = now;
    if (freeze > 0) { freeze -= dt; dt = 0; }
    const w = host.clientWidth, h = host.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      lab.game.setSize(w, h); fitPixels(camera, w, h);
    }
    aim();
    const usesBall = settings.tool === 'ball';
    if (usesBall !== usedBall) { ball.visible = rope.visible = usedBall = usesBall; shadows = true; }
    if (usesBall && hasCursor && dt > 0) swing(dt);
    if (usesBall) ghost.visible = false;
    detonate(dt);
    advanceShot(dt);
    slug.show(shot);
    if (debris.update(dt)) shadows = true;
    if (shadows && renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true;
    shadows = false;
    controls.update();
    const {busy} = stream.update(camera, controls.target, false);
    // Shake in the plane of the screen.
    offset.set(Math.random() - .5, Math.random() - .5, 0).multiplyScalar(shake.offset(dt)).applyQuaternion(camera.quaternion);
    camera.position.add(offset); camera.updateMatrixWorld();
    lab.render(now, controls.target);
    camera.position.sub(offset);
    report({demolished: demolished.size, pieces: debris.pieces, buildings: known.size, busy: String(busy), tool: settings.tool, shots},
      demolished.size + ' demolished · ' + debris.pieces + ' pieces · ' + debris.dust + ' dust · ' + renderer.info.render.calls + ' draw calls' +
      (settings.tool === 'gun' ? ' · gun ' + (cool > 0 ? cool.toFixed(1) + ' s' : 'ready') : ''));
  }
  frame = requestAnimationFrame(draw);
  el('status').textContent = 'Left button: swing the ball, place dynamite or fire · right button: pan · wheel: zoom · 1/2/3: tool';

  // Checks (`scripts/qa-demolition.mjs`): the screen point of a building near the centre, and stopping the loop.
  const probe = new T.Vector3();
  Object.assign(window, {demolitionLab: {
    target() {
      let best: {id: number; x: number; y: number} | null = null, bestScore = Infinity;
      const rect = canvas.getBoundingClientRect();
      for (const t of near(controls.target.x, -controls.target.z, 60)) {
        const [cx, cy] = ringCenter(t.ring);
        if (!pointInRing(t.ring, cx, cy) || t.top - t.base < 6) continue;
        probe.set(cx, t.top, -cy).project(camera);
        const x = rect.left + (probe.x + 1) / 2 * rect.width, y = rect.top + (1 - probe.y) / 2 * rect.height;
        const score = Math.hypot(probe.x, probe.y);
        if (score < bestScore && pick(x, y) === t) { bestScore = score; best = {id: t.building.id, x, y}; }
      }
      return best;
    },
    gun() { return {cool, flying: !!shot, shots}; },
    stop() { cancelAnimationFrame(frame); }
  }});
  host.dataset.ready = 'true';
  return () => {
    const p = new URLSearchParams(query);
    p.set('x', controls.target.x.toFixed(1)); p.set('y', (-controls.target.z).toFixed(1)); p.set('zoom', camera.zoom.toFixed(2));
    p.set('strumento', Object.keys(TOOLS).find(k => TOOLS[k] === settings.tool) ?? 'palla'); p.set('quota', String(settings.height));
    p.set('distanza', String(settings.standoff));
    return p;
  };
}
