import { DataUtils } from 'three';
import { hydrograph, HYDROGRAPH_SHAPE } from './flood-hydrology.ts';
import { buildingState, damageShare, hazardClass, hazardRating, type BuildingState } from './flood-impact.ts';
import { makeFlood, type FloodForcing, type FloodGrid, type FloodOptions } from './flood-solver.ts';

/**
 * A flood scenario on one grid: the forcing in time, the solver, and what the page draws and reads.
 * The same code runs in the worker of the lab and in the Node checks.
 */

export interface FloodScenario {
  /** Peak of the flood hydrograph entering the channel (m³/s); 0 for none. */
  peak: number;
  /** Time from the start of the hydrograph to its peak (s). */
  rise: number;
  /** Where on the hydrograph the clock starts (s): skips the trickle of the rising limb. */
  start: number;
  /** Gamma shape of the hydrograph (3.7: the SCS dimensionless unit hydrograph). */
  shape?: number;
  /** What the covered channel still carries under the street (m³/s): only the rest overflows on the surface. */
  culvert: number;
  /** Rain intensity (mm/h) and how long it lasts (s). */
  rain: number;
  rainFor: number;
  /** Share of the rain that runs off rather than soaking in: 0.8–0.95 for paved city, 0.3 for fields. */
  runoff: number;
}

export function forcing(s: FloodScenario, t: number): FloodForcing {
  return {
    inflow: Math.max(0, hydrograph(t + s.start, s.peak, s.rise, s.shape ?? HYDROGRAPH_SHAPE) - s.culvert),
    rain: t < s.rainFor ? s.rain / 1000 / 3600 * s.runoff : 0
  };
}

/**
 * How long the event lasts (simulated s from the clock's start): the hydrograph down to a few per cent of its peak
 * (3.2 times its rise), or the rain and an hour and a half for the water to run off. The worker holds there.
 */
export function eventLength(s: FloodScenario) {
  return Math.max(s.peak > 0 ? 3.2 * s.rise - s.start : 0, s.rain > 0 ? s.rainFor + 5400 : 0) || Infinity;
}

/** A sample of the event for the charts: inflow (m³/s), m³ gone to the sea so far, depth at the gauges (m). */
export interface FloodSampleRaw { time: number; inflow: number; toSea: number; gauges: number[] }
/** Simulated seconds between samples, and between readings of the buildings' walls (Clausen & Clark). */
export const SAMPLE = 60;

export type FloodView = 'depth' | 'hazard' | 'peak';

export interface FloodStats {
  time: number;
  /** Time step the scheme allows now (s), and the cells it computes. */
  step: number;
  active: number;
  /** Highest Froude number v / √(g d) in water deeper than 5 cm: above 1 the flow is supercritical. */
  froude: number;
  /** Discharge overflowing on the surface now (m³/s). */
  inflow: number;
  /** m³ entered (hydrograph and rain), left (to the sea, past the edges) and stored. */
  entered: number;
  toSea: number;
  pastEdges: number;
  stored: number;
  /** (entered − left − stored) / entered: a few per mille at most. */
  balance: number;
  /** Area under more than 5 cm of water now, and ever (m²). */
  wet: number;
  reached: number;
  deepest: number;
  fastest: number;
  /** Area now in each hazard class 1–4 of FD2320 (m²). */
  hazard: [number, number, number, number];
  buildings: number;
  /** Buildings that had more than 10 cm, and more than 1 m, of water against their walls. */
  wetBuildings: number;
  deepBuildings: number;
  /** Share of the value of the buildings of the grid lost, weighted by footprint (JRC curve). */
  damage: number;
  /** Buildings past partial structural damage and collapse (Clausen & Clark 1990). */
  damagedBuildings: number;
  collapsedBuildings: number;
  /** Indices of the buildings collapsed so far, in order. */
  collapsed: number[];
  /** For each watched building: highest depth (m) and depth × velocity (m²/s) at its walls, and its state. */
  watched: {building: number; depth: number; force: number; state: BuildingState}[];
  /** For each gauge: depth (m), speed (m/s) and water surface (m). */
  gauges: {depth: number; speed: number; surface: number}[];
}

/**
 * `watch` lists buildings (indices into the grid's building list) reported one by one, such as hospitals and
 * schools; `gauges` lists cells read every frame, like stream gauges on the street.
 */
export function makeFloodSim(grid: FloodGrid & {owner: Int32Array}, buildings: number, sources: ArrayLike<number>,
  scenario: FloodScenario, options: FloodOptions = {}, watch: ArrayLike<number> = [], gauges: number[] = []) {
  const flood = makeFlood(grid, sources, options);
  const {w, h, z, wall, owner} = grid, n = w * h;
  const {depth, peak, ledger} = flood;
  const now = (t: number) => forcing(scenario, t);
  const buildingPeak = new Float32Array(buildings), footprint = new Float32Array(buildings);
  /** Highest depth × velocity (m²/s) seen at each building's walls, and the speed with it: Clausen & Clark's terms. */
  const buildingForce = new Float32Array(buildings), buildingFlow = new Float32Array(buildings);
  const states = new Uint8Array(buildings), collapsed: number[] = [];
  for (let i = 0; i < n; i++) if (owner[i]) footprint[owner[i] - 1]++;
  /** What `impact` last found of the buildings, read by `stats`. */
  const impacts = {wet: 0, deep: 0, damaged: 0, damage: 0};
  /** Samples the page has not taken yet, and the time of the next one. */
  const samples: FloodSampleRaw[] = [];
  let nextSample = 0;

  /** The cell west, east, north or south of `i` (k = 0–3), or −1 off the grid. */
  function neighbour(i: number, k: number) {
    const c = i % w;
    if (k === 0) return c > 0 ? i - 1 : -1;
    if (k === 1) return c < w - 1 ? i + 1 : -1;
    if (k === 2) return i >= w ? i - w : -1;
    return i + w < n ? i + w : -1;
  }

  /** A building that has come down is no longer a wall: the water runs through its ruins. */
  function breach(b: number) {
    for (let i = 0; i < n; i++) if (owner[i] === b + 1) wall[i] = 0;
  }

  /**
   * Reads the water at every building's walls: highest depth, depth × velocity, damage and collapse. It runs on the
   * simulated clock, every `SAMPLE` seconds, so the outcome does not depend on how often the page asks for frames.
   */
  function impact() {
    const {r0, r1, c0, c1} = around();
    // The peak depth is read again from the cells' own peaks; the force is kept from reading to reading.
    buildingPeak.fill(0);
    for (let r = r0; r <= r1; r++) for (let c = c0, i = r * w + c0; c <= c1; c++, i++) {
      const b = owner[i] - 1;
      if (b < 0) continue;
      for (let k = 0; k < 4; k++) {
        const j = neighbour(i, k);
        if (j < 0 || wall[j]) continue;
        if (peak[j] > buildingPeak[b]) buildingPeak[b] = peak[j];
        const d = depth[j];
        if (d <= .05) continue;
        const v = flood.speed(j), force = d * v;
        if (force > buildingForce[b]) { buildingForce[b] = force; buildingFlow[b] = v; }
      }
    }
    let wet = 0, deep = 0, damaged = 0, lost = 0, all = 0;
    for (let b = 0; b < buildings; b++) {
      const d = buildingPeak[b];
      if (d > .1) wet++;
      if (d > 1) deep++;
      const state = buildingState(d, buildingForce[b], buildingFlow[b]);
      if (state === 'collapsed' && states[b] !== 4) { states[b] = 4; collapsed.push(b); breach(b); }
      else if (state === 'damaged') { states[b] = 3; damaged++; }
      // A building down is a total loss.
      lost += (states[b] === 4 ? 1 : damageShare(d)) * footprint[b]; all += footprint[b];
    }
    impacts.wet = wet; impacts.deep = deep; impacts.damaged = damaged; impacts.damage = all ? lost / all : 0;
  }

  /** Every simulated minute: a sample for the charts and a reading of the buildings. */
  function sample() {
    samples.push({time: ledger.time, inflow: now(ledger.time).inflow, toSea: ledger.sea, gauges: gauges.map(i => depth[i])});
    impact();
    nextSample = ledger.time + SAMPLE;
  }

  /** Runs `seconds` more, or `budget` ms of compute, stopping on each minute for `sample`: returns the seconds run. */
  function advance(seconds: number, budget = Infinity) {
    const start = performance.now(), from = ledger.time, end = from + seconds;
    if (ledger.time >= nextSample) sample();
    while (ledger.time < end - 1e-9) {
      const left = budget - (performance.now() - start);
      if (left <= 0) break;
      flood.advance(Math.min(end, nextSample) - ledger.time, now, left);
      if (ledger.time >= nextSample - 1e-9) sample();
    }
    return ledger.time - from;
  }

  /** The samples since the last call. */
  function takeSamples() {
    return samples.splice(0, samples.length);
  }

  // The drawn state is kept here and refreshed only inside the solver's box: outside it the water never came, so the
  // surface is the ground and the value 0. A wall cell takes the wettest of its neighbours, so the surface runs on
  // under the buildings instead of dipping into them.
  const drawn = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) drawn[4 * i] = z[i];
  /**
   * The same in half floats, as the GPU takes it, with the surface measured from the ground (the page has the
   * ground once): half the bytes to copy and upload, and centimetres of precision up to 32 m of water.
   */
  const half = new Uint16Array(n * 4);
  /** The rows and columns of the box with one more cell around it: the walls next to its water. */
  function around() {
    const {r0, r1, c0, c1} = flood.box;
    return {r0: Math.max(0, r0 - 1), r1: Math.min(h - 1, r1 + 1), c0: Math.max(0, c0 - 1), c1: Math.min(w - 1, c1 + 1)};
  }

  /**
   * The state to draw, four half floats a cell: the water surface above the ground, the value shown (depth, hazard
   * rating or highest depth), and the velocity east and north (m/s) for the swell. Only the rows of the box are
   * written into `out` (see `rows`): outside them the water never came, and the page uploads those rows only.
   */
  function pack(view: FloodView, out = new Uint16Array(n * 4)) {
    const {r0, r1, c0, c1} = around();
    if (r0 > r1) return out;
    const toHalf = DataUtils.toHalfFloat;
    for (let r = r0; r <= r1; r++) for (let c = c0, i = r * w + c0; c <= c1; c++, i++) {
      if (wall[i]) continue;
      const k = 4 * i, d = view === 'peak' ? peak[i] : depth[i];
      // A cell dry now and when last drawn has nothing new to say.
      if (d === 0 && drawn[k + 1] === 0 && drawn[k + 2] === 0 && drawn[k + 3] === 0) continue;
      let u = 0, v = 0;
      if (view !== 'peak') { const flow = flood.flowAt(i); u = flow.east; v = flow.north; }
      const value = view === 'hazard' ? (d > 0 ? Math.max(.01, hazardRating(d, Math.hypot(u, v))) : 0) : d;
      drawn[k] = z[i] + d; drawn[k + 1] = value; drawn[k + 2] = u; drawn[k + 3] = v;
      half[k] = toHalf(d); half[k + 1] = toHalf(value); half[k + 2] = toHalf(u); half[k + 3] = toHalf(v);
    }
    for (let r = r0; r <= r1; r++) for (let c = c0, i = r * w + c0; c <= c1; c++, i++) {
      if (!wall[i]) continue;
      const k = 4 * i;
      let surface = z[i], value = 0, u = 0, v = 0;
      for (let m = 0; m < 4; m++) {
        const j = neighbour(i, m);
        if (j < 0 || wall[j] || drawn[4 * j + 1] <= 0) continue;
        if (drawn[4 * j] > surface) { surface = drawn[4 * j]; value = drawn[4 * j + 1]; u = drawn[4 * j + 2]; v = drawn[4 * j + 3]; }
      }
      if (drawn[k] === surface && drawn[k + 1] === value && drawn[k + 2] === u && drawn[k + 3] === v) continue;
      drawn[k] = surface; drawn[k + 1] = value; drawn[k + 2] = u; drawn[k + 3] = v;
      half[k] = toHalf(surface - z[i]); half[k + 1] = toHalf(value); half[k + 2] = toHalf(u); half[k + 3] = toHalf(v);
    }
    out.set(half.subarray(4 * r0 * w, 4 * (r1 + 1) * w), 4 * r0 * w);
    return out;
  }

  function stats(): FloodStats {
    const cell = flood.area, hazard: [number, number, number, number] = [0, 0, 0, 0];
    let wet = 0, reached = 0, deepest = 0, fastest = 0, froude = 0, active = 0, stored = 0;
    const {r0, r1, c0, c1} = around();
    // Water is only ever inside the box: the stored volume is summed here, not over the whole grid.
    for (let r = r0; r <= r1; r++) for (let c = c0, i = r * w + c0; c <= c1; c++, i++) {
      if (wall[i]) continue;
      const d = depth[i];
      stored += d;
      if (peak[i] > .05) reached += cell;
      if (d <= .05) continue;
      wet += cell;
      deepest = Math.max(deepest, d);
      const v = flood.speed(i);
      fastest = Math.max(fastest, v);
      froude = Math.max(froude, v / Math.sqrt(9.81 * d));
      const k = hazardClass(hazardRating(d, v));
      if (k) hazard[k - 1] += cell;
    }
    stored *= cell;
    const entered = ledger.inflow + ledger.rain, left = ledger.sea + ledger.edge;
    for (let r = flood.box.r0, last = flood.box.r1; r <= last; r++) active += Math.max(0, flood.spans.to[r] - flood.spans.from[r] + 1);
    return {time: ledger.time, step: flood.stable(), active, froude, inflow: now(ledger.time).inflow, entered, toSea: ledger.sea, pastEdges: ledger.edge, stored,
      balance: entered > 0 ? (entered - left - stored) / entered : 0,
      wet, reached, deepest, fastest, hazard, buildings, wetBuildings: impacts.wet, deepBuildings: impacts.deep, damage: impacts.damage,
      damagedBuildings: impacts.damaged, collapsedBuildings: collapsed.length, collapsed: collapsed.slice(),
      watched: Array.from(watch, b => ({building: b, depth: buildingPeak[b], force: buildingForce[b],
        state: buildingState(buildingPeak[b], buildingForce[b], buildingFlow[b])})),
      gauges: gauges.map(i => ({depth: depth[i], speed: flood.speed(i), surface: z[i] + depth[i]}))};
  }

  return {flood, scenario, gauges, advance, pack, stats, takeSamples, impact,
    rows: () => { const {r0, r1} = around(); return [r0, r1] as [number, number]; }};
}
