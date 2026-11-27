import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { isSea, loadData } from '../data/load.ts';
import { channelCells, floodArea, type Box } from '../flood/flood-grid.ts';
import type { FloodScenario, FloodStats, FloodView } from '../flood/flood-sim.ts';
import type { FloodOptions } from '../flood/flood-solver.ts';
import { makeFloodWater } from '../flood/flood-water.ts';
import type { FloodFrame, FloodRequest } from '../flood/flood-worker.ts';
import { CAMERA_DISTANCE, GroundControls, fitPixels, mapViewDirection } from '../render/map-camera.ts';
import { makeSea } from '../render/sea.ts';
import { labCity } from './lab-city.ts';

/**
 * Flood lab (`lab.html?lab=inondazione`): water on the city's own terrain, run by the inertial shallow water solver of
 * `flood/flood-solver.ts` in a worker and drawn over the streamed sectors.
 *
 * `scenario=guiniguada`: a flood hydrograph comes down the barranco Guiniguada from above Tafira Baja and overflows
 * on the surface where the covered channel can no longer take it, down to its mouth between Vegueta and Triana.
 * `scenario=pioggia`: a cloudburst over the view, roofs draining to the street.
 *
 * The values are a scenario, not a forecast: the peak discharge of the official maps (SNCZI, PGRI of Gran Canaria)
 * has still to be compared. The DEM is in whole metres and buildings are solid, so streets narrower than a 5 m cell
 * may close.
 */

type ScenarioId = 'guiniguada' | 'pioggia';
interface Setup {
  title: string;
  /** Grid bounds, or a half-width around the view. */
  box: Box | number;
  /** Where the hydrograph enters (on the barranco's OSM line, 2.3 km above its mouth). */
  source?: [number, number];
  scenario: FloodScenario;
}
const SETUPS: Record<ScenarioId, Setup> = {
  guiniguada: {title: 'Barranco Guiniguada flood', box: [-2450, -1750, 500, 500], source: [-2309, -1582],
    scenario: {peak: 500, rise: 900, culvert: 0, rain: 0, rainFor: 0, runoff: .9}},
  pioggia: {title: 'Cloudburst over the view', box: 640,
    scenario: {peak: 0, rise: 900, culvert: 0, rain: 120, rainFor: 3600, runoff: .9}}
};
const VIEWS: Record<string, FloodView> = {profondita: 'depth', pericolo: 'hazard', massimo: 'peak'};

const clock = (s: number) => {
  const t = Math.floor(s);
  return Math.floor(t / 3600) + ':' + String(Math.floor(t / 60) % 60).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};
const hectares = (m2: number) => (m2 / 1e4).toFixed(1) + ' ha';

export async function floodLab() {
  const el = (id: string) => document.getElementById(id)!;
  const query = new URLSearchParams(location.search), host = el('view');
  el('tools').hidden = true;
  const id: ScenarioId = query.get('scenario') === 'pioggia' ? 'pioggia' : 'guiniguada';
  const setup = SETUPS[id];
  const [lab, sea] = await Promise.all([labCity(host, query), loadData('sea.json', isSea)]);
  const {city, renderer, scene, camera} = lab;
  const stream = lab.stream({refresh() { renderer.shadowMap.needsUpdate = true; }});
  scene.add(makeSea(sea));

  // Camera: the map's, panned with the left button, zoomed with the wheel.
  const controls = new GroundControls(camera, renderer.domElement);
  controls.enableRotate = false; controls.zoomToCursor = true;
  controls.minZoom = .15; controls.maxZoom = 40;
  controls.listenToKeyEvents(window);
  const box = typeof setup.box === 'number' ? null : setup.box;
  const number = (key: string, fallback: number) => query.has(key) && Number.isFinite(Number(query.get(key))) ? Number(query.get(key)) : fallback;
  // By default the lower course and the mouth, where the water meets the city.
  const startX = number('x', box ? -650 : 0), startY = number('y', box ? -450 : 0);
  controls.target.set(startX, stream.altitude(startX, startY), -startY);
  camera.position.copy(controls.target).addScaledVector(mapViewDirection(), CAMERA_DISTANCE);
  camera.zoom = number('zoom', Math.min(host.clientWidth, host.clientHeight) / (box ? 1000 : 1100));
  fitPixels(camera, host.clientWidth, host.clientHeight);
  controls.update();

  // The grid: the scenario's box, or a square around where the view starts.
  const half = typeof setup.box === 'number' ? setup.box : 0;
  const bounds: Box = box ?? [startX - half, startY - half, startX + half, startY + half];
  const area = floodArea(city.terrain, bounds, city.buildings, sea.water);
  const sources = setup.source ? channelCells(area, setup.source[0], setup.source[1], 25) : new Int32Array();
  const water = makeFloodWater(area);
  scene.add(water.mesh);

  const scenario: FloodScenario = {
    peak: number('portata', setup.scenario.peak), rise: number('salita', setup.scenario.rise / 60) * 60,
    culvert: number('tombino', setup.scenario.culvert), rain: number('pioggia', setup.scenario.rain),
    rainFor: number('durata', setup.scenario.rainFor / 60) * 60, runoff: number('deflusso', setup.scenario.runoff)
  };
  const options: Required<Pick<FloodOptions, 'manning' | 'theta' | 'courant' | 'froude'>> = {manning: number('manning', .03),
    theta: number('theta', .7), courant: number('courant', .7), froude: number('froude', 1)};
  const settings = {
    playing: query.get('pausa') !== '1', speed: number('velocita', 90),
    view: VIEWS[query.get('vista') ?? ''] ?? 'depth' as FloodView,
    // The panel edits minutes; the scenario keeps seconds.
    riseMin: scenario.rise / 60, rainMin: scenario.rainFor / 60
  };

  const worker = new Worker(new URL('../flood/flood-worker.ts', import.meta.url), {type: 'module'});
  const send = (message: FloodRequest, transfer: Transferable[] = []) => worker.postMessage(message, transfer);
  let stats: FloodStats | null = null, cost = 0, rate = 0, sent = '';
  function restart() {
    // Copies, not transfers: the page keeps the grid for the next restart.
    send({type: 'init', w: area.w, h: area.h, dx: area.dx, dy: area.dy, z: area.z, wall: area.wall, sea: area.sea,
      owner: area.owner, buildings: area.buildings.length, sources, scenario, options});
    stats = null;
  }
  worker.onmessage = ({data}: MessageEvent<FloodFrame>) => {
    water.show(data.state, settings.view);
    stats = data.stats; cost = data.cost; rate = data.rate;
    send({type: 'buffer', buffer: data.state.buffer}, [data.state.buffer]);
  };
  worker.onerror = event => { el('status').textContent = 'Flood worker: ' + event.message; };
  restart();
  const retune = () => {
    scenario.rise = settings.riseMin * 60; scenario.rainFor = settings.rainMin * 60;
    send({type: 'scenario', scenario, options});
  };

  const gui = new GUI({container: el('gui'), title: 'Flood'});
  gui.add({id}, 'id', {[SETUPS.guiniguada.title]: 'guiniguada', [SETUPS.pioggia.title]: 'pioggia'}).name('Scenario')
    .onChange((next: string) => { const url = new URL(location.href); url.search = ''; url.searchParams.set('lab', 'inondazione'); url.searchParams.set('scenario', next); location.assign(url.href); });
  gui.add(settings, 'playing').name('Running');
  gui.add(settings, 'speed', 1, 600, 1).name('Speed (× real time)');
  gui.add(settings, 'view', {'Depth': 'depth', 'Hazard to people (FD2320)': 'hazard', 'Highest depth': 'peak'}).name('Colour');
  const flow = gui.addFolder('Flood wave');
  flow.add(scenario, 'peak', 0, 1000, 10).name('Peak discharge (m³/s)').onChange(retune);
  flow.add(settings, 'riseMin', 5, 180, 5).name('Time to peak (min)').onChange(retune);
  flow.add(scenario, 'culvert', 0, 300, 5).name('Covered channel takes (m³/s)').onChange(retune);
  const rain = gui.addFolder('Rain');
  rain.add(scenario, 'rain', 0, 200, 5).name('Intensity (mm/h)').onChange(retune);
  rain.add(settings, 'rainMin', 0, 360, 10).name('Duration (min)').onChange(retune);
  rain.add(scenario, 'runoff', .1, 1, .05).name('Runoff share').onChange(retune);
  // The scheme's own constants: Bates et al. 2010, de Almeida et al. 2012 (see docs/FLOOD.md).
  const solver = gui.addFolder('Solver (LISFLOOD-FP inertial)');
  solver.add(options, 'manning', .012, .08, .002).name('Manning n (s/m^⅓)').onChange(retune);
  solver.add(options, 'theta', .5, 1, .05).name('θ weighting (1 = Bates 2010)').onChange(retune);
  solver.add(options, 'courant', .2, .9, .05).name('Courant number').onChange(retune);
  solver.add(options, 'froude', .5, 3, .1).name('Froude limit').onChange(retune);
  solver.close();
  gui.add({restart}, 'restart').name('Start again');

  const metrics = el('metrics');
  function report(state: Record<string, string | number>, text: string) {
    for (const [key, value] of Object.entries(state)) if (host.dataset[key] !== String(value)) host.dataset[key] = String(value);
    if (metrics.textContent !== text) metrics.textContent = text;
  }

  await renderer.compileAsync(scene, camera);
  const canvas = renderer.domElement;
  let frame = 0;
  function draw(now: number) {
    frame = requestAnimationFrame(draw);
    const w = host.clientWidth, h = host.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      lab.game.setSize(w, h); fitPixels(camera, w, h);
    }
    // The worker keeps its own clock: it only hears what changed.
    const control = settings.playing + ' ' + settings.speed + ' ' + settings.view;
    if (control !== sent) { send({type: 'control', playing: settings.playing, speed: settings.speed, view: settings.view}); sent = control; }
    controls.update();
    const {busy} = stream.update(camera, controls.target, false);
    water.tick(now / 1000);
    lab.render(now, controls.target);
    if (!stats) return;
    const s = stats;
    report({time: s.time.toFixed(0), wet: s.wet.toFixed(0), reached: s.reached.toFixed(0), deepest: s.deepest.toFixed(2),
      balance: s.balance.toExponential(2), wetBuildings: s.wetBuildings, busy: String(busy), cells: area.w * area.h},
    [`${clock(s.time)} (×${rate.toFixed(0)}) · overflowing ${s.inflow.toFixed(0)} m³/s`,
      `under water ${hectares(s.wet)} (reached ${hectares(s.reached)}) · deepest ${s.deepest.toFixed(1)} m · fastest ${s.fastest.toFixed(1)} m/s`,
      `danger for some ${hectares(s.hazard[1])} · most ${hectares(s.hazard[2])} · all ${hectares(s.hazard[3])}`,
      `buildings with water at the walls ${s.wetBuildings} of ${s.buildings} · over 1 m ${s.deepBuildings} · value lost ${(s.damage * 100).toFixed(1)}%`,
      `entered ${(s.entered / 1e3).toFixed(0)}k m³ · to the sea ${(s.toSea / 1e3).toFixed(0)}k · stored ${(s.stored / 1e3).toFixed(0)}k · balance ${(s.balance * 100).toFixed(3)}%`,
      `Δt ${s.step.toFixed(2)} s · highest Froude ${s.froude.toFixed(2)} · ${(s.active / 1e3).toFixed(0)}k of ${(area.w * area.h / 1e3).toFixed(0)}k cells of ${area.dx.toFixed(0)} m computed`,
      `${cost.toFixed(1)} ms of solver a frame · ${renderer.info.render.calls} draw calls`].join('\n'));
  }
  frame = requestAnimationFrame(draw);
  el('status').textContent = setup.title + ' · drag to pan · wheel to zoom · the panel changes the scenario live';

  // Checks (`scripts/qa-flood.mjs`): read the state, change the speed, stop the loop.
  Object.assign(window, {floodLab: {
    stats: () => stats,
    set(values: Partial<typeof settings>) { Object.assign(settings, values); },
    stop() { cancelAnimationFrame(frame); worker.terminate(); }
  }});
  host.dataset.ready = 'true';
  return () => {
    const p = new URLSearchParams(query);
    p.set('x', controls.target.x.toFixed(1)); p.set('y', (-controls.target.z).toFixed(1)); p.set('zoom', camera.zoom.toFixed(2));
    p.set('scenario', id); p.set('portata', String(scenario.peak)); p.set('salita', String(settings.riseMin));
    p.set('tombino', String(scenario.culvert)); p.set('pioggia', String(scenario.rain)); p.set('durata', String(settings.rainMin));
    p.set('deflusso', String(scenario.runoff)); p.set('manning', String(options.manning));
    p.set('theta', String(options.theta)); p.set('courant', String(options.courant)); p.set('froude', String(options.froude)); p.set('velocita', String(settings.speed));
    p.set('vista', Object.keys(VIEWS).find(k => VIEWS[k] === settings.view) ?? 'profondita');
    return p;
  };
}
