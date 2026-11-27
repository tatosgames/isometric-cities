import type { FloodOptions } from './flood-solver.ts';
import { makeFloodSim, type FloodScenario, type FloodStats, type FloodView } from './flood-sim.ts';

/** Messages to the flood worker. */
export type FloodRequest =
  | {type: 'init'; w: number; h: number; dx: number; dy: number; z: Float32Array; wall: Uint8Array; sea: Uint8Array;
    owner: Int32Array; buildings: number; sources: Int32Array; scenario: FloodScenario; options: FloodOptions}
  | {type: 'scenario'; scenario: FloodScenario; options: FloodOptions}
  /** Run at `speed` times real time, or hold; draw as `view`. */
  | {type: 'control'; playing: boolean; speed: number; view: FloodView}
  /** A frame's buffer, back from the page once drawn: the next frame can go. */
  | {type: 'buffer'; buffer: ArrayBuffer};

export interface FloodFrame {
  type: 'frame';
  state: Float32Array<ArrayBuffer>;
  stats: FloodStats;
  /** Simulated seconds per real second over the last frames: below `speed` when the solver cannot keep up. */
  rate: number;
  /** Compute time of the steps since the last frame (ms). */
  cost: number;
}

/**
 * The flood runs here on its own clock, not at the page's frame rate: it owes `speed` simulated seconds for every
 * real one, works them off in slices of `SLICE` ms, and sends a frame whenever the page has handed the last one back
 * and `GAP` ms have passed. When it cannot keep up it drops what it owes beyond a quarter of a second.
 */
const SLICE = 20, GAP = 40;
const scope = self as DedicatedWorkerGlobalScope;
let sim: ReturnType<typeof makeFloodSim> | null = null;
let control: Omit<Extract<FloodRequest, {type: 'control'}>, 'type'> = {playing: false, speed: 60, view: 'depth'};
const spare: ArrayBuffer[] = [];
let out = 0, lastTick = 0, lastFrame = 0, owed = 0, drawn: FloodView | null = null;
let cost = 0, rateFrom = 0, rateTime = 0, timer = 0;

function tick() {
  timer = 0;
  if (!sim) return;
  const now = performance.now();
  if (control.playing) owed = Math.min(owed + (now - lastTick) / 1000 * control.speed, control.speed * .25);
  lastTick = now;
  if (owed > 0) {
    const start = performance.now();
    owed -= sim.advance(owed, SLICE);
    cost += performance.now() - start;
  }
  if (!out && (now - lastFrame >= GAP || drawn !== control.view)) {
    const n = sim.flood.grid.w * sim.flood.grid.h;
    const buffer = spare.pop();
    const state = sim.pack(control.view, buffer && buffer.byteLength === n * 16 ? new Float32Array(buffer) : undefined);
    const time = sim.flood.ledger.time, seconds = (now - rateFrom) / 1000;
    const rate = seconds > 0 ? (time - rateTime) / seconds : 0;
    if (seconds > 1) { rateFrom = now; rateTime = time; }
    const frame: FloodFrame = {type: 'frame', state, stats: sim.stats(), rate, cost};
    scope.postMessage(frame, [state.buffer]);
    out++; lastFrame = now; drawn = control.view; cost = 0;
  }
  // Keep going while there is work; otherwise wait for the next frame's turn.
  schedule(control.playing || owed > 0 ? 0 : GAP);
}
function schedule(delay: number) {
  if (!timer) timer = setTimeout(tick, delay) as unknown as number;
}

scope.onmessage = ({data}: MessageEvent<FloodRequest>) => {
  if (data.type === 'init') {
    const {type: _, buildings, sources, scenario, options, ...grid} = data;
    sim = makeFloodSim(grid, buildings, sources, {...scenario}, options);
    owed = 0; drawn = null; lastTick = rateFrom = performance.now(); rateTime = 0;
  } else if (!sim) throw new Error('Flood worker is not initialized');
  else if (data.type === 'scenario') {
    Object.assign(sim.scenario, data.scenario);
    Object.assign(sim.flood.settings, data.options);
  } else if (data.type === 'control') {
    if (data.playing && !control.playing) lastTick = performance.now();
    const {type: _, ...next} = data;
    control = next;
  } else {
    spare.push(data.buffer); out = Math.max(0, out - 1);
  }
  schedule(0);
};
