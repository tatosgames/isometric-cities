import { damageShare, hazardClass, hazardRating } from './flood-impact.ts';
import { makeFlood, type FloodForcing, type FloodGrid, type FloodOptions } from './flood-solver.ts';

/**
 * A flood scenario on one grid: the forcing in time, the solver, and what the page draws and reads.
 * The same code runs in the worker of the lab and in the Node checks.
 */

export interface FloodScenario {
  /** Peak of the flood hydrograph entering the channel (m³/s); 0 for none. */
  peak: number;
  /** Time from the start to the peak (s). */
  rise: number;
  /** What the covered channel still carries under the street (m³/s): only the rest overflows on the surface. */
  culvert: number;
  /** Rain intensity (mm/h) and how long it lasts (s). */
  rain: number;
  rainFor: number;
  /** Share of the rain that runs off rather than soaking in: 0.8–0.95 for paved city, 0.3 for fields. */
  runoff: number;
}

/**
 * Discharge (m³/s) at time `t` (s) of a gamma-shaped flood hydrograph, Q = Qp (t/tp)^m e^{m(1 − t/tp)}, the form of
 * the synthetic unit hydrographs (SCS 1972, NEH-4). With m = 3 it is back under 1% of the peak after four rises.
 */
export function hydrograph(t: number, peak: number, rise: number, m = 3) {
  if (t <= 0 || peak <= 0 || rise <= 0) return 0;
  const k = t / rise;
  return peak * Math.pow(k, m) * Math.exp(m * (1 - k));
}

export function forcing(s: FloodScenario, t: number): FloodForcing {
  return {
    inflow: Math.max(0, hydrograph(t, s.peak, s.rise) - s.culvert),
    rain: t < s.rainFor ? s.rain / 1000 / 3600 * s.runoff : 0
  };
}

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
}

export function makeFloodSim(grid: FloodGrid & {owner: Int32Array}, buildings: number, sources: ArrayLike<number>,
  scenario: FloodScenario, options: FloodOptions = {}) {
  const flood = makeFlood(grid, sources, options);
  const {w, h, z, wall, owner} = grid, n = w * h;
  const {depth, peak, ledger} = flood;
  const now = (t: number) => forcing(scenario, t);
  const buildingPeak = new Float32Array(buildings), footprint = new Float32Array(buildings);
  for (let i = 0; i < n; i++) if (owner[i]) footprint[owner[i] - 1]++;

  /** The cell west, east, north or south of `i` (k = 0–3), or −1 off the grid. */
  function neighbour(i: number, k: number) {
    const c = i % w;
    if (k === 0) return c > 0 ? i - 1 : -1;
    if (k === 1) return c < w - 1 ? i + 1 : -1;
    if (k === 2) return i >= w ? i - w : -1;
    return i + w < n ? i + w : -1;
  }

  function advance(seconds: number, budget = Infinity) {
    return flood.advance(seconds, now, budget);
  }

  /**
   * The state to draw, two floats a cell: the height of the surface and the value shown (depth, hazard rating or
   * highest depth). A wall cell takes the wettest of its neighbours, so the surface runs on under the buildings
   * instead of dipping into them.
   */
  // The drawn state is kept here and refreshed only inside the solver's box: outside it the water never came, so the
  // surface is the ground and the value 0. A wall cell takes the wettest of its neighbours, so the surface runs on
  // under the buildings instead of dipping into them.
  const drawn = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) drawn[4 * i] = z[i];
  /** The rows and columns of the box with one more cell around it: the walls next to its water. */
  function around() {
    const {r0, r1, c0, c1} = flood.box;
    return {r0: Math.max(0, r0 - 1), r1: Math.min(h - 1, r1 + 1), c0: Math.max(0, c0 - 1), c1: Math.min(w - 1, c1 + 1)};
  }

  /**
   * The state to draw, four floats a cell: the height of the surface, the value shown (depth, hazard rating or
   * highest depth), and the velocity east and north (m/s) for foam and streaks; copied into `out`.
   */
  function pack(view: FloodView, out = new Float32Array(n * 4)) {
    const {r0, r1, c0, c1} = around();
    if (r0 <= r1) {
      for (let r = r0; r <= r1; r++) for (let c = c0, i = r * w + c0; c <= c1; c++, i++) {
        if (wall[i]) continue;
        const d = view === 'peak' ? peak[i] : depth[i];
        const flow = flood.flowAt(i), u = view === 'peak' ? 0 : flow.east, v = view === 'peak' ? 0 : flow.north;
        drawn[4 * i] = z[i] + d;
        drawn[4 * i + 1] = view === 'hazard' ? (d > 0 ? Math.max(.01, hazardRating(d, Math.hypot(u, v))) : 0) : d;
        drawn[4 * i + 2] = u; drawn[4 * i + 3] = v;
      }
      for (let r = r0; r <= r1; r++) for (let c = c0, i = r * w + c0; c <= c1; c++, i++) {
        if (!wall[i]) continue;
        let surface = z[i], value = 0, u = 0, v = 0;
        for (let k = 0; k < 4; k++) {
          const j = neighbour(i, k);
          if (j < 0 || wall[j] || drawn[4 * j + 1] <= 0) continue;
          if (drawn[4 * j] > surface) { surface = drawn[4 * j]; value = drawn[4 * j + 1]; u = drawn[4 * j + 2]; v = drawn[4 * j + 3]; }
        }
        drawn[4 * i] = surface; drawn[4 * i + 1] = value; drawn[4 * i + 2] = u; drawn[4 * i + 3] = v;
      }
    }
    out.set(drawn);
    return out;
  }

  function stats(): FloodStats {
    const cell = flood.area, hazard: [number, number, number, number] = [0, 0, 0, 0];
    let wet = 0, reached = 0, deepest = 0, fastest = 0, froude = 0, active = 0;
    const {r0, r1, c0, c1} = around();
    buildingPeak.fill(0);
    for (let r = r0; r <= r1; r++) for (let c = c0, i = r * w + c0; c <= c1; c++, i++) {
      const b = owner[i] - 1;
      if (b >= 0) {
        for (let k = 0; k < 4; k++) {
          const j = neighbour(i, k);
          if (j >= 0 && !wall[j] && peak[j] > buildingPeak[b]) buildingPeak[b] = peak[j];
        }
        continue;
      }
      const d = depth[i];
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
    let wetBuildings = 0, deepBuildings = 0, lost = 0, all = 0;
    for (let b = 0; b < buildings; b++) {
      const d = buildingPeak[b];
      if (d > .1) wetBuildings++;
      if (d > 1) deepBuildings++;
      lost += damageShare(d) * footprint[b]; all += footprint[b];
    }
    const entered = ledger.inflow + ledger.rain, stored = flood.volume();
    const left = ledger.sea + ledger.edge;
    for (let r = flood.box.r0, last = flood.box.r1; r <= last; r++) active += Math.max(0, flood.spans.to[r] - flood.spans.from[r] + 1);
    return {time: ledger.time, step: flood.stable(), active, froude, inflow: now(ledger.time).inflow, entered, toSea: ledger.sea, pastEdges: ledger.edge, stored,
      balance: entered > 0 ? (entered - left - stored) / entered : 0,
      wet, reached, deepest, fastest, hazard, buildings, wetBuildings, deepBuildings, damage: all ? lost / all : 0};
  }

  return {flood, scenario, advance, pack, stats};
}
