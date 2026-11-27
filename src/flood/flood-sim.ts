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
    // The peak depth is read again from the cells' own peaks; the force is kept from frame to frame.
    buildingPeak.fill(0);
    for (let r = r0; r <= r1; r++) for (let c = c0, i = r * w + c0; c <= c1; c++, i++) {
      const b = owner[i] - 1;
      if (b >= 0) {
        for (let k = 0; k < 4; k++) {
          const j = neighbour(i, k);
          if (j < 0 || wall[j]) continue;
          if (peak[j] > buildingPeak[b]) buildingPeak[b] = peak[j];
          const d = depth[j];
          if (d <= .05) continue;
          const v = flood.speed(j), force = d * v;
          if (force > buildingForce[b]) { buildingForce[b] = force; buildingFlow[b] = v; }
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
    let wetBuildings = 0, deepBuildings = 0, damagedBuildings = 0, lost = 0, all = 0;
    for (let b = 0; b < buildings; b++) {
      const d = buildingPeak[b];
      if (d > .1) wetBuildings++;
      if (d > 1) deepBuildings++;
      const state = buildingState(d, buildingForce[b], buildingFlow[b]);
      if (state === 'collapsed' && states[b] !== 4) { states[b] = 4; collapsed.push(b); breach(b); }
      else if (state === 'damaged') { states[b] = 3; damagedBuildings++; }
      // A building down is a total loss.
      lost += (states[b] === 4 ? 1 : damageShare(d)) * footprint[b]; all += footprint[b];
    }
    const entered = ledger.inflow + ledger.rain, stored = flood.volume();
    const left = ledger.sea + ledger.edge;
    for (let r = flood.box.r0, last = flood.box.r1; r <= last; r++) active += Math.max(0, flood.spans.to[r] - flood.spans.from[r] + 1);
    return {time: ledger.time, step: flood.stable(), active, froude, inflow: now(ledger.time).inflow, entered, toSea: ledger.sea, pastEdges: ledger.edge, stored,
      balance: entered > 0 ? (entered - left - stored) / entered : 0,
      wet, reached, deepest, fastest, hazard, buildings, wetBuildings, deepBuildings, damage: all ? lost / all : 0,
      damagedBuildings, collapsedBuildings: collapsed.length, collapsed: collapsed.slice(),
      watched: Array.from(watch, b => ({building: b, depth: buildingPeak[b], force: buildingForce[b],
        state: buildingState(buildingPeak[b], buildingForce[b], buildingFlow[b])})),
      gauges: gauges.map(i => ({depth: depth[i], speed: flood.speed(i), surface: z[i] + depth[i]}))};
  }

  return {flood, scenario, gauges, advance, pack, stats};
}
