import * as T from 'three';
import type { Building, Point, Terrain } from '../data/types.ts';
import { matchFacilities, type Facility, type Watched } from './flood-facilities.ts';
import { channelCells, floodArea, type Box, type FloodArea } from './flood-grid.ts';
import { makeFloodMarkers } from './flood-markers.ts';
import type { FloodScenario, FloodStats, FloodView } from './flood-sim.ts';
import type { FloodOptions } from './flood-solver.ts';
import { makeFloodWater } from './flood-water.ts';
import type { FloodFrame, FloodRequest } from './flood-worker.ts';

export interface FloodSetup {
  terrain: Terrain;
  buildings: readonly Building[];
  /** Open water polygons (`sea.json`): the outlet. */
  sea: readonly (readonly (readonly Point[])[])[];
  /** West, south, east, north of the grid (m). */
  box: Box;
  /** Where a hydrograph enters, if any, and over how many metres of channel bed. */
  source?: readonly [number, number] | null;
  sourceRadius?: number;
  scenario: FloodScenario;
  options?: FloodOptions;
  /** Critical facilities to watch; those outside the grid are left out. */
  facilities?: readonly Facility[];
}

/** One sample of the event, kept for the charts: time (s), surface inflow and outflow to the sea (m³/s), gauges (m). */
export interface FloodSample { time: number; inflow: number; outflow: number; gauges: number[] }

const MAX_GAUGES = 4;

/**
 * The flood module behind one object, for the lab today and the map later: it builds the grid, runs the solver
 * in its worker, draws the water and the markers of the watched buildings, keeps the event's history and reports.
 * Nothing outside `src/flood/` is needed but the terrain, the buildings and the sea; removing the module means
 * removing its callers (see docs/FLOOD.md).
 */
export function createFlood(setup: FloodSetup) {
  const area: FloodArea = floodArea(setup.terrain, setup.box, setup.buildings, setup.sea);
  const sources = setup.source ? channelCells(area, setup.source[0], setup.source[1], setup.sourceRadius ?? 25) : new Int32Array();
  const watched: Watched[] = setup.facilities ? matchFacilities(area, setup.facilities) : [];
  const scenario = {...setup.scenario};
  const options: Required<FloodOptions> = {manning: .03, theta: .7, courant: .7, maxStep: 5, froude: 1, ...setup.options};
  const group = new T.Group();
  const water = makeFloodWater(area);
  const markers = makeFloodMarkers(watched.map(({facility, building}) => {
    const b = area.buildings[building], [x, y] = b.rings[0][0];
    return {x: facility.x, y: facility.y, top: groundAt(x, y) + (b.heightOverride ?? b.height)};
  }));
  group.add(water.mesh, markers.mesh);

  /** Ground height (m) at a point of the grid, nearest cell. */
  function groundAt(x: number, y: number) {
    const i = cellAt(x, y);
    return i < 0 ? 0 : area.z[i];
  }
  /** The cell under a point, or −1 off the grid. */
  function cellAt(x: number, y: number) {
    const c = Math.round((x - area.west) / area.dx), r = Math.round((area.north - y) / area.dy);
    return c < 0 || r < 0 || c >= area.w || r >= area.h ? -1 : r * area.w + c;
  }

  const worker = new Worker(new URL('./flood-worker.ts', import.meta.url), {type: 'module'});
  const send = (message: FloodRequest, transfer: Transferable[] = []) => worker.postMessage(message, transfer);
  const gauges: {x: number; y: number; cell: number}[] = [];
  const history: FloodSample[] = [];
  const listeners = new Set<(stats: FloodStats) => void>();
  let stats: FloodStats | null = null, cost = 0, rate = 0, view: FloodView = 'depth', control = '';
  let lastSea = 0, lastTime = 0;

  worker.onmessage = ({data}: MessageEvent<FloodFrame>) => {
    water.show(data.state, view);
    stats = data.stats; cost = data.cost; rate = data.rate;
    send({type: 'buffer', buffer: data.state.buffer}, [data.state.buffer]);
    markers.show(stats.watched.map(w => w.state));
    // One sample a simulated minute is plenty for a chart of hours.
    if (stats.time - lastTime >= 60 || !history.length) {
      const dt = stats.time - lastTime;
      history.push({time: stats.time, inflow: stats.inflow, outflow: dt > 0 ? (stats.toSea - lastSea) / dt : 0,
        gauges: stats.gauges.map(g => g.depth)});
      lastSea = stats.toSea; lastTime = stats.time;
    }
    for (const listener of listeners) listener(stats);
  };

  function restart() {
    // Copies, not transfers: the page keeps the grid for the next restart.
    send({type: 'init', w: area.w, h: area.h, dx: area.dx, dy: area.dy, z: area.z, wall: area.wall, sea: area.sea,
      owner: area.owner, buildings: area.buildings.length, sources, scenario, options,
      watch: Int32Array.from(watched, w => w.building), gauges: gauges.map(g => g.cell)});
    stats = null; history.length = 0; lastSea = lastTime = 0; control = '';
  }
  restart();

  return {
    area, group, watched, gauges, history, scenario, options,
    get stats() { return stats; },
    /** Solver milliseconds since the last frame, and simulated seconds per real second. */
    get cost() { return cost; },
    get rate() { return rate; },
    /** Run at `speed` × real time or hold, drawn as `view`. Cheap to call every frame: only changes are sent. */
    control(next: {playing: boolean; speed: number; view: FloodView}) {
      view = next.view;
      const key = next.playing + ' ' + next.speed + ' ' + next.view;
      if (key !== control) { send({type: 'control', ...next}); control = key; }
    },
    /** Applies `scenario` and `options` as they are now. */
    retune() { send({type: 'scenario', scenario, options}); },
    restart,
    /** Adds a gauge at a point of the grid (up to four; the oldest goes); false off the grid. */
    addGauge(x: number, y: number) {
      const cell = cellAt(x, y);
      if (cell < 0 || area.wall[cell]) return false;
      if (gauges.length >= MAX_GAUGES) gauges.shift();
      gauges.push({x, y, cell});
      send({type: 'gauges', cells: gauges.map(g => g.cell)});
      // Earlier samples belong to other gauges.
      for (const sample of history) sample.gauges = [];
      return true;
    },
    cellAt, groundAt,
    /** Called with every frame's statistics. */
    onFrame(listener: (stats: FloodStats) => void) { listeners.add(listener); return () => listeners.delete(listener); },
    /** Moves the water's swell and swirls (real seconds). */
    tick(seconds: number) { water.tick(seconds); },
    dispose() { worker.terminate(); water.dispose(); markers.dispose(); group.removeFromParent(); listeners.clear(); }
  };
}
export type Flood = ReturnType<typeof createFlood>;
