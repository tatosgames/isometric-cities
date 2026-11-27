import * as T from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { isLayers, isSea, loadData } from '../data/load.ts';
import type { Building } from '../data/types.ts';
import { makeDemolisher } from '../demolition/demolish.ts';
import {
  createFlood, designRain, GUINIGUADA, HISTORIC, hydrograph, isFacilities, makeFloodPanel, peakTime, rationalFlood, riseTo,
  type Box, type FloodScenario, type FloodView
} from '../flood/index.ts';
import { CAMERA_DISTANCE, GroundControls, fitPixels, mapViewDirection } from '../render/map-camera.ts';
import { makeSea } from '../render/sea.ts';
import { labCity } from './lab-city.ts';

/**
 * Flood lab (`lab.html?lab=inondazione`): the flood module (`src/flood/`, through its index only) on the streamed city.
 *
 * `scenario=guiniguada`: the design flood of the barranco Guiniguada for a return period (`ritorno=10…1000`) or an
 * observed rainfall (`ritorno=1954|1989`), by the rational method of Norma 5.2-IC, entering 2.3 km above the mouth
 * and overflowing on the surface where the covered channel cannot take it, down to Vegueta–Triana.
 * `scenario=pioggia`: one hour of rain of the same return period over the view, roofs draining to the street.
 *
 * Buildings past Clausen & Clark's collapse threshold come down with the demolition code. Shift + click places a
 * gauge. An estimate with the official method, not an official map: see docs/FLOOD.md.
 */

type ScenarioId = 'guiniguada' | 'pioggia';
const RETURN_PERIODS = [10, 25, 50, 100, 500, 1000] as const;
type EventId = typeof RETURN_PERIODS[number] | keyof typeof HISTORIC;
const VIEWS: Record<string, FloodView> = {profondita: 'depth', pericolo: 'hazard', massimo: 'peak'};
const GUINIGUADA_BOX: Box = [-2450, -1750, 500, 500];
/** On the barranco's OSM line, 2.3 km above its mouth: where the hydrograph enters the grid. */
const GUINIGUADA_SOURCE = [-2309, -1582] as const;
const RAIN_HALF = 640;
const GAUGE_TONES = ['#1d5c8e', '#c2571a', '#6a3d9a', '#2f7d3b'];

export async function floodLab() {
  const el = (id: string) => document.getElementById(id)!;
  const query = new URLSearchParams(location.search), host = el('view');
  el('tools').hidden = true;
  document.body.classList.add('flood-lab');
  const id: ScenarioId = query.get('scenario') === 'pioggia' ? 'pioggia' : 'guiniguada';
  const asked = query.get('ritorno') ?? '100';
  const event: EventId = (asked in HISTORIC ? Number(asked) : RETURN_PERIODS.find(t => String(t) === asked) ?? 100) as EventId;
  const historic = event in HISTORIC ? HISTORIC[event as keyof typeof HISTORIC] : null;
  const [lab, sea, facilities] = await Promise.all([labCity(host, query), loadData('sea.json', isSea),
    loadData('flood-facilities.json', isFacilities)]);
  const {city, renderer, scene, camera} = lab;
  const stream = lab.stream({
    trackBuildings: true,
    async loadLayers(s, signal) {
      const layers = await loadData('city-sectors/' + s.file, isLayers, signal);
      // The fused blocks of small screens join neighbours: here every building comes down on its own.
      delete layers.fused;
      return layers;
    },
    refresh() { renderer.shadowMap.needsUpdate = true; }
  });
  scene.add(makeSea(sea));

  const number = (key: string, fallback: number) => query.has(key) && Number.isFinite(Number(query.get(key))) ? Number(query.get(key)) : fallback;
  const controls = new GroundControls(camera, renderer.domElement);
  controls.enableRotate = false; controls.zoomToCursor = true;
  controls.minZoom = .15; controls.maxZoom = 40;
  controls.listenToKeyEvents(window);
  // By default the lower course and the mouth, where the water meets the city.
  const startX = number('x', id === 'guiniguada' ? -650 : 0), startY = number('y', id === 'guiniguada' ? -450 : 0);
  controls.target.set(startX, stream.altitude(startX, startY), -startY);
  camera.position.copy(controls.target).addScaledVector(mapViewDirection(), CAMERA_DISTANCE);
  camera.zoom = number('zoom', Math.min(host.clientWidth, host.clientHeight) / (id === 'guiniguada' ? 1000 : 1100));
  fitPixels(camera, host.clientWidth, host.clientHeight);
  controls.update();

  // The event: daily rainfall of the return period (or observed), then the design flood or the design storm.
  const rainfall = historic ? historic.rainfall : GUINIGUADA.rainfall[event];
  const design = rationalFlood(GUINIGUADA, rainfall), rise = peakTime(design), start = riseTo(.1, rise);
  const until = 3.2 * rise - start;
  const box: Box = id === 'guiniguada' ? GUINIGUADA_BOX : [startX - RAIN_HALF, startY - RAIN_HALF, startX + RAIN_HALF, startY + RAIN_HALF];
  const rainKm2 = (2 * RAIN_HALF / 1000) ** 2, storm = designRain(GUINIGUADA, rainfall, 1, rainKm2);
  const scenario: FloodScenario = id === 'guiniguada'
    ? {peak: number('portata', design.peak), rise, start, culvert: number('tombino', 0), rain: 0, rainFor: 0, runoff: .9}
    : {peak: 0, rise, start: 0, culvert: 0, rain: number('pioggia', storm), rainFor: 3600, runoff: number('deflusso', .9)};
  const flood = createFlood({terrain: city.terrain, buildings: city.buildings, sea: sea.water, box,
    source: id === 'guiniguada' ? GUINIGUADA_SOURCE : null, scenario, facilities: facilities.facilities,
    options: {manning: number('manning', .03), theta: number('theta', .7), courant: number('courant', .7), froude: number('froude', 1)}});
  scene.add(flood.group);

  // Collapses: Clausen & Clark's threshold, brought down by the demolition code.
  const demolisher = makeDemolisher({material: stream.materials.buildingMat, altitude: stream.altitude, tones: lab.tones,
    hide: stream.hideBuilding});
  scene.add(demolisher.root);
  const volumes = new Map<number, Building[]>();
  for (const b of flood.area.buildings) volumes.set(b.id, [...(volumes.get(b.id) ?? []), b]);
  let felled = 0;
  flood.onFrame(stats => {
    for (; felled < stats.collapsed.length; felled++) {
      const b = flood.area.buildings[stats.collapsed[felled]], parts = volumes.get(b.id) ?? [b];
      const [x, y] = b.rings[0][0], base = stream.altitude(x, y);
      demolisher.demolish(b.id, parts.map(building => ({building, base: stream.altitude(building.rings[0][0][0], building.rings[0][0][1])})),
        {point: new T.Vector3(x, base + 2, -y), strength: 5, reach: 10});
    }
  });

  const label = historic ? historic.label : `T ${event}`;
  const models = 'LISFLOOD-FP 5 m · JRC · FD2320 · Clausen & Clark';
  const panel = makeFloodPanel(el('settings'), flood, id === 'guiniguada' ? {
    title: 'Guiniguada · ' + label, subtitle: `Qp ${design.peak.toFixed(0)} m³/s · Norma 5.2-IC`,
    design: t => hydrograph(t + start, design.peak, rise), until,
    method: [
      ['A', GUINIGUADA.area + ' km²'], ['Pd', rainfall.toFixed(1) + ' mm/24 h'], ['tc', design.concentration.toFixed(2) + ' h'],
      ['I(T, tc)', design.intensity.toFixed(1) + ' mm/h'], ['C · Kt', `${GUINIGUADA.runoff} · ${design.uniformity.toFixed(2)}`],
      ['Qp', design.peak.toFixed(0) + ' m³/s'], ['Models', models]],
    sources: [...Object.values(GUINIGUADA.sources), ...(historic ? [historic.source] : []),
      'Not an ARPSI: no official discharge', 'Facilities © OpenStreetMap']
  } : {
    title: 'Cloudburst · ' + label, subtitle: `${storm.toFixed(1)} mm/h for 1 h · Norma 5.2-IC`,
    design: null, until: 2.5 * 3600,
    method: [['Pd', rainfall.toFixed(1) + ' mm/24 h'], ['I(T, 1 h)', storm.toFixed(1) + ' mm/h'],
      ['Runoff', String(scenario.runoff)], ['Models', models]],
    sources: [GUINIGUADA.sources.rainfall, GUINIGUADA.sources.torrentiality, 'Facilities © OpenStreetMap']
  });

  const settings = {
    playing: query.get('pausa') !== '1', speed: number('velocita', 300),
    view: VIEWS[query.get('vista') ?? ''] ?? 'depth' as FloodView, event: String(event)
  };
  const navigate = (params: Record<string, string>) => {
    const url = new URL(location.href); url.search = '';
    url.searchParams.set('lab', 'inondazione');
    for (const [k, v] of Object.entries({scenario: id, ritorno: settings.event, ...params})) url.searchParams.set(k, v);
    location.assign(url.href);
  };
  const gui = new GUI({container: el('gui'), title: 'Flood'});
  gui.add({id}, 'id', {'Barranco Guiniguada flood': 'guiniguada', 'Cloudburst over the view': 'pioggia'}).name('Scenario')
    .onChange((next: string) => navigate({scenario: next}));
  gui.add(settings, 'event', {
    ...Object.fromEntries(RETURN_PERIODS.map(t => [`T ${t} years`, String(t)])),
    ...Object.fromEntries(Object.entries(HISTORIC).map(([k, v]) => [v.label, k]))
  }).name('Event').onChange(() => navigate({}));
  gui.add(settings, 'playing').name('Running');
  gui.add(settings, 'speed', 1, 1200, 1).name('Speed ×');
  gui.add(settings, 'view', {'Depth': 'depth', 'Hazard': 'hazard', 'Highest depth': 'peak'}).name('Colour');
  const retune = () => flood.retune();
  const manual = gui.addFolder('What if');
  if (id === 'guiniguada') {
    manual.add(flood.scenario, 'peak', 0, 1200, 5).name('Peak m³/s').onChange(retune);
    manual.add(flood.scenario, 'culvert', 0, 300, 5).name('Culvert m³/s').onChange(retune);
  } else {
    manual.add(flood.scenario, 'rain', 0, 200, 1).name('Rain mm/h').onChange(retune);
    manual.add(flood.scenario, 'runoff', .1, 1, .05).name('Runoff').onChange(retune);
  }
  manual.close();
  // The scheme's own constants: Bates et al. 2010, de Almeida et al. 2012 (see docs/FLOOD.md).
  const solver = gui.addFolder('Solver');
  solver.add(flood.options, 'manning', .012, .08, .002).name('Manning n').onChange(retune);
  solver.add(flood.options, 'theta', .5, 1, .05).name('θ').onChange(retune);
  solver.add(flood.options, 'courant', .2, .9, .05).name('Courant').onChange(retune);
  solver.add(flood.options, 'froude', .5, 3, .1).name('Froude limit').onChange(retune);
  solver.close();
  gui.add({restart() { location.reload(); }}, 'restart').name('Start again');

  // Gauges: shift + click on the ground. A thin post marks each.
  const raycaster = new T.Raycaster(), ndc = new T.Vector2(), ground = new T.Vector3();
  const postGeometry = new T.CylinderGeometry(.6, .6, 14, 6), posts: T.Mesh[] = [];
  function placeGauge(x: number, y: number) {
    if (!flood.addGauge(x, y)) return false;
    if (posts.length >= 4) posts.shift()?.removeFromParent();
    const post = new T.Mesh(postGeometry, new T.MeshBasicMaterial());
    post.position.set(x, stream.altitude(x, y) + 7, -y);
    scene.add(post); posts.push(post);
    posts.forEach((p, k) => (p.material as T.MeshBasicMaterial).color.set(GAUGE_TONES[k]));
    return true;
  }
  renderer.domElement.addEventListener('pointerdown', event => {
    if (!event.shiftKey || event.button !== 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const {origin: o, direction: d} = raycaster.ray;
    let t = (controls.target.y - o.y) / d.y;
    for (let k = 0; k < 4; k++) t = (stream.altitude(o.x + t * d.x, -(o.z + t * d.z)) - o.y) / d.y;
    raycaster.ray.at(t, ground);
    placeGauge(ground.x, -ground.z);
  }, {capture: true});
  // A first gauge where the barranco meets the city, so the chart has something to say from the start.
  if (id === 'guiniguada') placeGauge(-1010, -420);

  const metrics = el('metrics');
  function report(state: Record<string, string | number>, text: string) {
    for (const [key, value] of Object.entries(state)) if (host.dataset[key] !== String(value)) host.dataset[key] = String(value);
    if (metrics.textContent !== text) metrics.textContent = text;
  }

  await renderer.compileAsync(scene, camera);
  const canvas = renderer.domElement;
  let frame = 0, last = performance.now();
  function draw(now: number) {
    frame = requestAnimationFrame(draw);
    const dt = Math.min(.05, (now - last) / 1000);
    last = now;
    const w = host.clientWidth, h = host.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      lab.game.setSize(w, h); fitPixels(camera, w, h);
    }
    flood.control(settings);
    controls.update();
    const {busy} = stream.update(camera, controls.target, false);
    flood.tick(now / 1000);
    if (demolisher.update(dt) && renderer.shadowMap.enabled) renderer.shadowMap.needsUpdate = true;
    lab.render(now, controls.target);
    panel.update(now);
    const s = flood.stats;
    if (!s) return;
    report({time: s.time.toFixed(0), wet: s.wet.toFixed(0), reached: s.reached.toFixed(0), deepest: s.deepest.toFixed(2),
      balance: s.balance.toExponential(2), wetBuildings: s.wetBuildings, collapsed: s.collapsedBuildings, busy: String(busy),
      cells: flood.area.w * flood.area.h, watched: s.watched.length},
    // Only the solver's health: the event's figures are in the report.
    [`×${flood.rate.toFixed(0)} · Δt ${s.step.toFixed(2)} s · Fr ${s.froude.toFixed(2)} · ${(s.active / 1e3).toFixed(0)}k cells · ${flood.cost.toFixed(0)} ms`,
      `balance ${(s.balance * 100).toFixed(4)}% · ${renderer.info.render.calls} draw calls`].join('\n'));
  }
  frame = requestAnimationFrame(draw);
  el('status').textContent = 'Shift + click: gauge';

  // Checks (`scripts/qa-flood.mjs`): read the state, change the speed, place a gauge, stop the loop.
  Object.assign(window, {floodLab: {
    stats: () => flood.stats,
    set(values: Partial<typeof settings>) { Object.assign(settings, values); },
    gauge: placeGauge,
    design: () => ({...design, rise, start}),
    history: () => flood.history.length,
    collapsedAt: () => flood.stats?.collapsed.map(b => flood.area.buildings[b].rings[0][0]) ?? [],
    stop() { cancelAnimationFrame(frame); flood.dispose(); }
  }});
  host.dataset.ready = 'true';
  return () => {
    const p = new URLSearchParams(query);
    p.set('x', controls.target.x.toFixed(1)); p.set('y', (-controls.target.z).toFixed(1)); p.set('zoom', camera.zoom.toFixed(2));
    p.set('scenario', id); p.set('ritorno', settings.event); p.set('velocita', String(settings.speed));
    if (id === 'guiniguada') { p.set('portata', flood.scenario.peak.toFixed(0)); p.set('tombino', String(flood.scenario.culvert)); }
    else { p.set('pioggia', flood.scenario.rain.toFixed(1)); p.set('deflusso', String(flood.scenario.runoff)); }
    for (const k of ['manning', 'theta', 'courant', 'froude'] as const) p.set(k, String(flood.options[k]));
    p.set('vista', Object.keys(VIEWS).find(k => VIEWS[k] === settings.view) ?? 'profondita');
    return p;
  };
}
