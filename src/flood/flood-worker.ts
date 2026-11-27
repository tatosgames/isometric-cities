import type { FloodOptions } from './flood-solver.ts';
import { eventLength, makeFloodSim, type FloodSampleRaw, type FloodScenario, type FloodStats, type FloodView } from './flood-sim.ts';

/** Messages to the flood worker. */
export type FloodRequest =
  | {type: 'init'; w: number; h: number; dx: number; dy: number; z: Float32Array; wall: Uint8Array; sea: Uint8Array;
    owner: Int32Array; buildings: number; sources: Int32Array; scenario: FloodScenario; options: FloodOptions;
    /** Buildings reported one by one, and cells read as gauges. */
    watch: Int32Array; gauges: number[]}
  | {type: 'scenario'; scenario: FloodScenario; options: FloodOptions}
  /** Run at `speed` times real time, or hold; draw as `view`. */
  | {type: 'control'; playing: boolean; speed: number; view: FloodView}
  /** The cells read as gauges from now on. */
  | {type: 'gauges'; cells: number[]}
  /** A frame's buffer, back from the page once uploaded: the next state can go. */
  | {type: 'buffer'; buffer: ArrayBuffer};

export interface FloodFrame {
  type: 'frame';
  /**
   * Four half floats a cell (see `pack`), valid on the rows the water spans: the only ones to upload and draw. Null
   * when only the statistics are new.
   */
  state: Uint16Array<ArrayBuffer> | null;
  rows: [number, number];
  /** Null when only the state is new. */
  stats: FloodStats | null;
  /** One sample a simulated minute since the last frame, for the charts. */
  samples: FloodSampleRaw[];
  /** Simulated seconds per real second over the last frames: below `speed` when the solver cannot keep up. */
  rate: number;
  /** Compute time of the steps since the last frame (ms). */
  cost: number;
  /** The event is over (`eventLength`): the worker holds until it is told to play again. */
  ended: boolean;
}

/**
 * The flood runs here on its own clock, not at the page's frame rate: it owes `speed` simulated seconds for every
 * real one and works them off in slices of `SLICE` ms. When it cannot keep up it drops what it owes beyond a quarter
 * of a second. The water goes to the page at most every `STATE_GAP` ms, once the page has handed the last buffer
 * back, and the statistics every `STATS_GAP` ms (the report redraws four times a second): packing them every 40 ms
 * took as long as the hydraulics. Nothing is sent, and nothing runs, while the water is still.
 * At the end of the event (`eventLength`) the worker holds: playing again goes on past it.
 *
 * When the solver cannot keep up with `speed` (a wide flood at ×300), it works at most `DUTY` of the time and rests
 * for the rest, rather than holding a core flat out for a speed it will not reach: the flood then runs at about
 * `DUTY` of what the core could give, and the rate shown says so. When it keeps up it sleeps `IDLE` ms between slices.
 */
const SLICE = 20, STATE_GAP = 100, STATS_GAP = 250, DUTY = .65, IDLE = 10;
const scope = self as DedicatedWorkerGlobalScope;
let sim: ReturnType<typeof makeFloodSim> | null = null;
let control: Omit<Extract<FloodRequest, {type: 'control'}>, 'type'> = {playing: false, speed: 60, view: 'depth'};
const spare: ArrayBuffer[] = [];
let out = 0, lastTick = 0, lastState = 0, lastStats = 0, owed = 0, drawn: FloodView | null = null;
let packedTime = -1, statsTime = -1, statsDirty = true;
let end = Infinity, beyond = false, cost = 0, rateFrom = 0, rateTime = 0, timer = 0;

function tick() {
  timer = 0;
  if (!sim) return;
  const now = performance.now(), {ledger} = sim.flood;
  const ended = ledger.time >= end;
  if (control.playing && !ended) owed = Math.min(owed + (now - lastTick) / 1000 * control.speed, control.speed * .25);
  else owed = 0;
  lastTick = now;
  if (owed > 0) {
    const start = performance.now();
    owed -= sim.advance(Math.min(owed, end - ledger.time), SLICE);
    if (ledger.time >= end) owed = 0;
    cost += performance.now() - start;
  }
  const time = ledger.time;
  const stateDue = !out && (drawn !== control.view || (time !== packedTime && now - lastState >= STATE_GAP));
  const statsDue = (statsDirty || time !== statsTime) && now - lastStats >= STATS_GAP;
  if (stateDue || statsDue) {
    let state: Uint16Array<ArrayBuffer> | null = null;
    if (stateDue) {
      const n = sim.flood.grid.w * sim.flood.grid.h, buffer = spare.pop();
      state = sim.pack(control.view, buffer && buffer.byteLength === n * 8 ? new Uint16Array(buffer) : undefined);
      out++; lastState = now; packedTime = time; drawn = control.view;
    }
    const stats = statsDue ? sim.stats() : null;
    if (statsDue) { lastStats = now; statsTime = time; statsDirty = false; }
    const seconds = (now - rateFrom) / 1000, rate = seconds > 0 ? (time - rateTime) / seconds : 0;
    if (seconds > 1) { rateFrom = now; rateTime = time; }
    const frame: FloodFrame = {type: 'frame', state, rows: sim.rows(), stats, samples: sim.takeSamples(), rate, cost,
      ended: time >= end};
    scope.postMessage(frame, state ? [state.buffer] : []);
    cost = 0;
  }
  // Keep going while there is work, come back for what is still to send, otherwise sleep until a message.
  const running = control.playing && ledger.time < end;
  const pending = statsDirty || ledger.time !== statsTime || (!out && (drawn !== control.view || ledger.time !== packedTime));
  const worked = performance.now() - now;
  if (owed > 0) schedule(worked * (1 - DUTY) / DUTY);
  else if (running) schedule(IDLE);
  else if (pending) schedule(Math.max(0, Math.min(STATE_GAP - (now - lastState), STATS_GAP - (now - lastStats))));
}
function schedule(delay: number) {
  if (!timer) timer = setTimeout(tick, delay) as unknown as number;
}

scope.onmessage = ({data}: MessageEvent<FloodRequest>) => {
  if (data.type === 'init') {
    const {type: _, buildings, sources, scenario, options, watch, gauges, ...grid} = data;
    sim = makeFloodSim(grid, buildings, sources, {...scenario}, options, watch, gauges.slice());
    owed = 0; drawn = null; packedTime = statsTime = -1; statsDirty = true; end = eventLength(sim.scenario); beyond = false;
    lastTick = rateFrom = performance.now(); rateTime = 0;
  } else if (!sim) throw new Error('Flood worker is not initialized');
  else if (data.type === 'scenario') {
    Object.assign(sim.scenario, data.scenario);
    Object.assign(sim.flood.settings, data.options);
    // The event takes its new length, unless it was played on past its end.
    if (!beyond) end = eventLength(sim.scenario);
    statsDirty = true;
  } else if (data.type === 'gauges') {
    sim.gauges.splice(0, sim.gauges.length, ...data.cells);
    statsDirty = true;
  } else if (data.type === 'control') {
    if (data.playing && !control.playing) {
      lastTick = performance.now();
      // Played again after the end: the user wants to see what comes next.
      if (sim.flood.ledger.time >= end) { end = Infinity; beyond = true; }
    }
    const {type: _, ...next} = data;
    control = next;
  } else {
    spare.push(data.buffer); out = Math.max(0, out - 1);
  }
  schedule(0);
};
