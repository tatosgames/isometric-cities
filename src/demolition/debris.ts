import * as T from 'three';
import type { Chunk } from './fracture.ts';

/**
 * The pieces of a demolished building, purely visual as the fragments of `smash-royale`: no rigid bodies, no
 * contact between pieces. Each burst is one merged mesh whose vertices the CPU moves (a hundred pieces are a few
 * thousand vertices), so it costs one draw call and uses the city's own building material. Pieces wait for the
 * shock to reach them, fly or drop, bounce once or twice and pile up on a coarse rubble grid, then sink into the
 * ground. Only moving pieces are rewritten and uploaded, and a burst at rest costs nothing. The footprints keep
 * their rubble slabs, all in one mesh. `DEBRIS_TUNE` is edited live by the lab.
 */
export const DEBRIS_TUNE = {
  /** m/s²: a little above the real one, so that a 20 m fall reads as weight and not as slow motion. */
  gravity: 16,
  /** Speed of the shock through the building, m/s: far pieces start later. */
  shock: 70,
  /** Seconds a burst lasts before its pieces sink, and the time they take to sink. */
  life: 6, sink: 1.6,
  restitution: .3, friction: .55
};

interface Piece {
  chunk: Chunk;
  first: number;
  position: T.Vector3;
  quaternion: T.Quaternion;
  velocity: T.Vector3;
  spin: T.Vector3;
  delay: number;
  gravity: number;
  resting: boolean;
}
interface Burst {
  mesh: T.Mesh;
  pieces: Piece[];
  age: number;
}
export interface Blast {
  /** Where it struck, in world axes. */
  point: T.Vector3;
  /** A push along a direction (the ball's swing), in m/s at the point of contact. */
  push?: T.Vector3;
  /** Outward speed at the point, m/s, fading with distance over `reach` metres. */
  strength: number;
  reach: number;
}

const CELL = 1.5;
/** A numeric key for the cell of (x, z): no string per lookup. Good for ±49 km at 1.5 m. */
const cell = (x: number, z: number) => (Math.floor(x / CELL) + 32768) * 65536 + Math.floor(z / CELL) + 32768;
const turn = new T.Quaternion(), axis = new T.Vector3(), matrix = new T.Matrix4(), unit = new T.Vector3(1, 1, 1);

/** One mesh for all `chunks`, placed where they stand. */
function merge(chunks: Chunk[], material: T.Material) {
  let vertices = 0;
  for (const c of chunks) vertices += c.positions.length / 3;
  const positions = new Float32Array(vertices * 3), colors = new Uint8Array(vertices * 3), surface = new Uint8Array(vertices);
  let at = 0;
  for (const c of chunks) {
    for (let i = 0; i < c.positions.length; i += 3) {
      positions[at * 3 + i] = c.positions[i] + c.centre.x;
      positions[at * 3 + i + 1] = c.positions[i + 1] + c.centre.y;
      positions[at * 3 + i + 2] = c.positions[i + 2] + c.centre.z;
    }
    colors.set(c.colors, at * 3); surface.set(c.surface, at);
    at += c.positions.length / 3;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  // Flat shading takes the facet from screen derivatives: the normals only feed the shadow bias.
  geometry.setAttribute('normal', new T.BufferAttribute(new Float32Array(vertices * 3), 3));
  geometry.setAttribute('color', new T.BufferAttribute(colors, 3, true));
  geometry.setAttribute('surface', new T.BufferAttribute(surface, 1));
  const mesh = new T.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

export function makeDebris(material: T.Material, altitude: (east: number, north: number) => number) {
  const tune = DEBRIS_TUNE, root = new T.Group();
  const bursts: Burst[] = [];
  // Rubble height above the ground, per 1.5 m cell: a piece rests on what landed before it.
  const pile = new Map<number, number>();
  const dust = makeDust();
  root.add(dust.mesh);
  const landings: T.Vector3[] = [];

  /** Breaks `chunks` away from the building at `blast`. */
  function burst(chunks: Chunk[], blast: Blast) {
    if (!chunks.length) return;
    const mesh = merge(chunks, material);
    (mesh.geometry.getAttribute('position') as T.BufferAttribute).setUsage(T.DynamicDrawUsage);
    // The vertices move in world space: no bounds to keep up to date.
    mesh.frustumCulled = false;
    const pieces: Piece[] = [];
    let first = 0;
    for (const chunk of chunks) {
      const position = chunk.centre.clone(), distance = position.distanceTo(blast.point);
      const fall = Math.exp(-distance / blast.reach);
      const velocity = position.clone().sub(blast.point).setY(Math.max(0, position.y - blast.point.y) * .3).normalize()
        .multiplyScalar(blast.strength * fall * (.7 + Math.random() * .6));
      if (blast.push) velocity.addScaledVector(blast.push, fall * (.6 + Math.random() * .5));
      // Everything else falls: a little sideways spread and a lazy turn keep the storeys from dropping as a block.
      velocity.x += (Math.random() - .5) * 2.4; velocity.z += (Math.random() - .5) * 2.4;
      velocity.y += (Math.random() - .3) * 2 + blast.strength * fall * .35;
      const spin = .6 + fall * 6;
      pieces.push({
        chunk, first, position, quaternion: new T.Quaternion(), velocity,
        spin: new T.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(spin),
        delay: distance / tune.shock, gravity: .85 + Math.random() * .3, resting: false
      });
      first += chunk.positions.length;
    }
    bursts.push({mesh, pieces, age: 0});
    root.add(mesh);
    dust.puff(blast.point, 10, 3.5, 1.6);
  }

  // The rubble left on the footprints, which stays: one mesh rebuilt with each slab, so one draw call for all.
  const slabs: Chunk[] = [];
  let rubble: T.Mesh | null = null;
  function slab(chunks: Chunk[]) {
    if (!chunks.length) return;
    slabs.push(...chunks);
    if (rubble) { rubble.removeFromParent(); rubble.geometry.dispose(); }
    root.add(rubble = merge(slabs, material));
  }

  /** Writes the vertices of one piece where it now stands. */
  function write(p: Piece, out: Float32Array) {
    matrix.compose(p.position, p.quaternion, unit);
    const e = matrix.elements, src = p.chunk.positions;
    for (let i = 0, o = p.first; i < src.length; i += 3, o += 3) {
      const x = src[i], y = src[i + 1], z = src[i + 2];
      out[o] = e[0] * x + e[4] * y + e[8] * z + e[12];
      out[o + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
      out[o + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
    }
  }

  /** One step of a piece; false when it did not move. */
  function step(p: Piece, dt: number) {
    if (p.delay > 0) { p.delay -= dt; return false; }
    if (p.resting) return false;
    p.velocity.y -= tune.gravity * p.gravity * dt;
    p.position.addScaledVector(p.velocity, dt);
    const angle = p.spin.length() * dt;
    if (angle > 0) p.quaternion.premultiply(turn.setFromAxisAngle(axis.copy(p.spin).normalize(), angle));
    // Rest on the ground and on the rubble already there. A turned piece is about as tall as it is thick.
    const key = cell(p.position.x, p.position.z), size = Math.min(p.chunk.half, p.chunk.radius);
    const floor = altitude(p.position.x, -p.position.z) + (pile.get(key) ?? 0) + size * .8;
    if (p.position.y > floor || p.velocity.y > 0) return true;
    p.position.y = floor;
    const impact = -p.velocity.y;
    if (impact > 6 && landings.length < 6) landings.push(p.position.clone());
    if (impact < 2.2) {
      p.resting = true;
      pile.set(key, Math.min(6, (pile.get(key) ?? 0) + size * .7));
    } else {
      p.velocity.y = impact * tune.restitution;
      p.velocity.x *= tune.friction; p.velocity.z *= tune.friction;
      p.spin.multiplyScalar(tune.friction);
    }
    return true;
  }

  /** Moves the pieces; true when the shadow map has to follow. */
  function update(dt: number) {
    let changed = false;
    landings.length = 0;
    for (let k = bursts.length - 1; k >= 0; k--) {
      const b = bursts[k];
      const sinking = (b.age += dt) - tune.life;
      if (sinking > tune.sink) {
        b.mesh.removeFromParent(); b.mesh.geometry.dispose(); bursts.splice(k, 1);
        continue;
      }
      const position = b.mesh.geometry.getAttribute('position') as T.BufferAttribute;
      const out = position.array as Float32Array;
      // Pieces are contiguous: upload only the span from the first to the last one that moved.
      let from = Infinity, to = 0;
      for (const p of b.pieces) {
        // Sinking pieces no longer cast: the shadow map is redrawn once, as they start.
        if (sinking > 0) p.position.y -= dt * (p.chunk.half * 2 + 1) / tune.sink;
        else if (!step(p, dt)) continue;
        write(p, out);
        from = Math.min(from, p.first); to = p.first + p.chunk.positions.length;
      }
      if (sinking > 0 && b.mesh.castShadow) { b.mesh.castShadow = false; changed = true; }
      if (to > from) {
        position.clearUpdateRanges(); position.addUpdateRange(from, to - from); position.needsUpdate = true;
        changed = true;
      }
    }
    for (const at of landings) dust.puff(at, 2, 1.6, .9);
    dust.update(dt);
    return changed;
  }

  return {
    root, burst, slab, update,
    get pieces() { let n = 0; for (const b of bursts) n += b.pieces.length; return n; },
    get dust() { return dust.count; }
  };
}

/**
 * Dust as solid low-poly puffs, as the rest of the city is drawn: they swell, drift up and shrink away. No
 * transparency, so no sorting and no overdraw on a phone.
 */
function makeDust(size = 220) {
  const mesh = new T.InstancedMesh(new T.IcosahedronGeometry(1, 0),
    new T.MeshStandardMaterial({color: '#d8cdb8', flatShading: true, roughness: 1}), size);
  mesh.frustumCulled = false;
  mesh.count = 0;
  type Puff = {position: T.Vector3; velocity: T.Vector3; size: number; age: number; life: number; turn: number};
  const puffs: Puff[] = [];
  const m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), e = new T.Euler();
  function puff(at: T.Vector3, count: number, spread: number, scale: number) {
    for (let i = 0; i < count && puffs.length < size; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * spread, out = 1 + Math.random() * 2.5;
      puffs.push({
        position: at.clone().add(new T.Vector3(Math.cos(a) * r, Math.random() * spread * .4, Math.sin(a) * r)),
        velocity: new T.Vector3(Math.cos(a) * out, .6 + Math.random() * 1.4, Math.sin(a) * out),
        size: scale * (1.6 + Math.random() * 2.2), age: 0, life: 1.6 + Math.random() * 1.6, turn: Math.random() * 6
      });
    }
  }
  function update(dt: number) {
    if (!puffs.length && !mesh.count) return;
    let n = 0;
    for (const p of puffs) {
      if ((p.age += dt) >= p.life) continue;
      p.position.addScaledVector(p.velocity, dt);
      p.velocity.multiplyScalar(1 - Math.min(1, dt * 1.6));
      const t = p.age / p.life, grow = Math.min(1, t * 5) * (1 - t * t);
      m.compose(p.position, q.setFromEuler(e.set(p.turn, p.turn * .7 + t, 0)), s.setScalar(Math.max(.001, p.size * grow)));
      mesh.setMatrixAt(n, m);
      puffs[n++] = p;
    }
    puffs.length = mesh.count = n;
    mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, n * 16);
    mesh.instanceMatrix.needsUpdate = true;
  }
  return {mesh, puff, update, get count() { return puffs.length; }};
}
