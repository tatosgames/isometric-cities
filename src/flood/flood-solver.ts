/**
 * Surface flooding on the terrain grid with the local inertial form of the shallow water equations, as in
 * LISFLOOD-FP: Bates, Horritt & Fewtrell (2010), "A simple inertial formulation of the shallow water equations for
 * efficient two-dimensional flood inundation modelling", J. Hydrology 387; with the θ weighting of de Almeida, Bates,
 * Freer & Souvignet (2012), Water Resources Research 48, that damps the checkerboard oscillations of the original.
 *
 * Unknowns are the depth of each cell and the discharge per unit width across each face, staggered between cells.
 * Buildings are walls (no flux in or out), sea cells drain whatever reaches them, the edges of the window let water
 * leave at normal depth on the local slope. Every m³ is booked in `ledger`, so the balance can be checked.
 * Pure and allocation-free per step: it runs in a worker and in the Node checks alike.
 */

export const GRAVITY = 9.81;
/** Below this depth (m) a face carries nothing: the wet/dry front. */
const DRY = 1e-4;

export interface FloodGrid {
  /** Cells across (west to east) and down (north to south); row 0 is the northern edge. */
  w: number;
  h: number;
  /** Cell size (m) east-west and north-south. */
  dx: number;
  dy: number;
  /** Ground elevation of each cell (m), row after row. */
  z: Float32Array;
  /** 1 where a building stands: a wall to the water. */
  wall: Uint8Array;
  /** 1 for open sea: water that reaches it is gone. */
  sea: Uint8Array;
}

export interface FloodOptions {
  /** Manning's roughness (s/m^⅓): 0.013 smooth concrete, 0.02–0.03 streets with kerbs and cars, 0.035+ fields. */
  manning?: number;
  /** de Almeida's weighting: 1 is the plain Bates scheme, 0.7 a stable default. */
  theta?: number;
  /** Courant number of the adaptive time step, below 1. */
  courant?: number;
  /** Longest step (s), for dry or very shallow grids. */
  maxStep?: number;
  /**
   * Highest Froude number a face may carry (LISFLOOD-FP's limiter): the inertial scheme is meant for subcritical
   * flood plains, and on the whole-metre steps of the DEM it would otherwise race. 1 lets flow go critical.
   */
  froude?: number;
}

export interface FloodForcing {
  /** Discharge entering through the source cells (m³/s). */
  inflow: number;
  /** Rain reaching the ground as runoff (m/s); roofs drain to the street. */
  rain: number;
}

/** Cumulated volumes (m³) and simulated time (s). Stored = inflow + rain − sea − edge. */
export interface FloodLedger {
  time: number;
  inflow: number;
  rain: number;
  sea: number;
  edge: number;
}

export type Flood = ReturnType<typeof makeFlood>;

export function makeFlood(grid: FloodGrid, sources: ArrayLike<number>, options: FloodOptions = {}) {
  const {w, h, dx, dy, z, wall, sea} = grid, n = w * h, area = dx * dy;
  const settings = {manning: options.manning ?? .03, theta: options.theta ?? .7,
    courant: options.courant ?? .7, maxStep: options.maxStep ?? 5, froude: options.froude ?? 1};
  if (z.length !== n || wall.length !== n || sea.length !== n) throw new Error('Flood grid arrays do not match its size');
  /** Depth of water (m). */
  const depth = new Float64Array(n);
  /** Highest depth each cell has seen (m): what damage depends on. */
  const peak = new Float32Array(n);
  /** Discharge per unit width (m²/s) across the east face of each cell (towards +col) and its south face (towards +row). */
  const qx = new Float64Array(n), qy = new Float64Array(n);
  const oldX = new Float64Array(n), oldY = new Float64Array(n);
  /** Share of its outgoing fluxes a cell can afford this step, so that no cell runs below zero. */
  const afford = new Float32Array(n);
  /** Outflow per unit width through the window edge, for the cells on it. */
  const edgeOut = new Float64Array(n);
  const ledger: FloodLedger = {time: 0, inflow: 0, rain: 0, sea: 0, edge: 0};
  const land = Array.from(sources).filter(i => !wall[i] && !sea[i]);
  let open = 0;
  for (let i = 0; i < n; i++) if (!wall[i] && !sea[i]) open++;
  // Rain on roofs is led to the street: the open cells take it all.
  const roofs = open ? n / open : 1;
  let deepest = 0;

  /**
   * The cells that hold water or may get it at the next step, row by row: from `from[r]` to `to[r]` inclusive (empty
   * while from > to). They cover the wet cells and a ring of one around them, since with a Courant number under 1
   * water moves at most one cell a step. Spans only grow, so a face outside them has never carried anything and
   * reads 0: the loops can ignore it.
   */
  const from = new Int32Array(h).fill(w), to = new Int32Array(h).fill(-1);
  let top = h, bottom = -1;
  function include(r: number, c: number) {
    for (let k = Math.max(0, r - 1); k <= Math.min(h - 1, r + 1); k++) {
      if (c - 1 < from[k]) from[k] = Math.max(0, c - 1);
      if (c + 1 > to[k]) to[k] = Math.min(w - 1, c + 1);
    }
    if (r - 1 < top) top = Math.max(0, r - 1);
    if (r + 1 > bottom) bottom = Math.min(h - 1, r + 1);
  }
  /** Whether the ring of cells around (r, c) is already inside the spans. */
  function covered(r: number, c: number) {
    const a = Math.max(0, c - 1), b = Math.min(w - 1, c + 1);
    for (let k = Math.max(0, r - 1); k <= Math.min(h - 1, r + 1); k++) if (from[k] > a || to[k] < b) return false;
    return true;
  }
  /** Rows top–bottom, columns the widest span: what the page has to redraw. */
  const box = {get r0() { return top; }, get r1() { return bottom; },
    get c0() { let c = w; for (let r = top; r <= bottom; r++) c = Math.min(c, from[r]); return c; },
    get c1() { let c = -1; for (let r = top; r <= bottom; r++) c = Math.max(c, to[r]); return c; }};

  /** Discharge across one face, from the cell `a` to the cell `b` `span` metres apart. */
  function face(q: number, a: number, b: number, span: number, before: number, after: number, dt: number) {
    if (wall[a] || wall[b]) return 0;
    const za = z[a], zb = z[b], ea = za + depth[a], eb = zb + depth[b];
    const flow = (ea > eb ? ea : eb) - (za > zb ? za : zb);
    if (flow <= DRY) return 0;
    const {theta, manning, froude} = settings;
    const drive = theta * q + (1 - theta) * .5 * (before + after) - GRAVITY * flow * dt * (eb - ea) / span;
    // flow^(7/3), without the cost of Math.pow.
    const next = q === 0 ? drive : drive / (1 + GRAVITY * dt * manning * manning * Math.abs(q) / (flow * flow * Math.cbrt(flow)));
    // The inertial scheme assumes slow, deep flow: on steep steps of the DEM it would race. Capped at Froude `froude`.
    const most = froude * flow * Math.sqrt(GRAVITY * flow);
    return next > most ? most : next < -most ? -most : next;
  }

  /** The step the scheme allows now: Courant on the deepest water. */
  function stable() {
    const {courant, maxStep} = settings;
    return deepest > DRY ? Math.min(maxStep, courant * Math.min(dx, dy) / Math.sqrt(GRAVITY * deepest)) : maxStep;
  }

  /** Normal-depth outflow (m³/s per m of edge) of an edge cell towards the outside: Manning's q = d^5/3 √S / n. */
  function leave(i: number, inner: number, span: number) {
    const d = depth[i];
    if (wall[i] || sea[i] || d <= DRY) return 0;
    const slope = Math.max(1e-3, (z[inner] - z[i]) / span);
    return Math.min(d * Math.cbrt(d * d) * Math.sqrt(slope) / settings.manning, settings.froude * d * Math.sqrt(GRAVITY * d));
  }

  /** Advances by one step no longer than `limit` seconds; returns the step taken. */
  function step(limit: number, forcing: FloodForcing) {
    const dt = Math.min(limit, stable());
    if (dt <= 0) return 0;
    // Water put in before the first step (a dam break, a lake) is found once by a scan of the whole grid.
    if (!ledger.time) for (let i = 0; i < n; i++) if (depth[i] > 0) include(Math.floor(i / w), i % w);
    if (forcing.rain > 0 && (top > 0 || bottom < h - 1 || from.some(c => c > 0) || to.some(c => c < w - 1))) {
      from.fill(0); to.fill(w - 1); top = 0; bottom = h - 1;
    }
    if (forcing.inflow > 0) for (const i of land) include(Math.floor(i / w), i % w);
    if (top > bottom) { ledger.time += dt; return dt; }
    for (let r = top; r <= bottom; r++) {
      if (from[r] > to[r]) continue;
      const a = r * w + from[r], b = r * w + to[r] + 1;
      oldX.set(qx.subarray(a, b), a); oldY.set(qy.subarray(a, b), a);
    }
    // Fluxes from the previous ones and the water surface, on the faces between two cells of the spans.
    for (let r = top; r <= bottom; r++) {
      const row = r * w;
      for (let c = from[r]; c < to[r]; c++) {
        const i = row + c;
        qx[i] = face(oldX[i], i, i + 1, dx, c > 0 ? oldX[i - 1] : oldX[i], c < w - 2 ? oldX[i + 1] : oldX[i], dt);
      }
      if (r === bottom || r === h - 1) continue;
      const c0 = Math.max(from[r], from[r + 1]), c1 = Math.min(to[r], to[r + 1]);
      for (let c = c0; c <= c1; c++) {
        const i = row + c;
        qy[i] = face(oldY[i], i, i + w, dy, r > 0 ? oldY[i - w] : oldY[i], r < h - 2 ? oldY[i + w] : oldY[i], dt);
      }
    }
    // Edges of the grid that the spans touch.
    const edges = (r: number) => {
      const row = r * w;
      for (let c = from[r]; c <= to[r]; c++) {
        const i = row + c;
        let out = 0;
        if (r === 0) out += leave(i, i + w, dy) * dx;
        if (r === h - 1) out += leave(i, i - w, dy) * dx;
        if (c === 0) out += leave(i, i + 1, dx) * dy;
        if (c === w - 1) out += leave(i, i - 1, dx) * dy;
        edgeOut[i] = out;
      }
    };
    for (let r = top; r <= bottom; r++) {
      if (r === 0 || r === h - 1) { edges(r); continue; }
      if (from[r] === 0) edgeOut[r * w] = leave(r * w, r * w + 1, dx) * dy;
      if (to[r] === w - 1) edgeOut[r * w + w - 1] = leave(r * w + w - 1, r * w + w - 2, dx) * dy;
    }
    // No cell may give more than it holds: its outgoing faces are scaled down together. Faces outside the spans,
    // and past the grid's edge, read 0.
    for (let r = top; r <= bottom; r++) {
      const row = r * w;
      for (let c = from[r]; c <= to[r]; c++) {
        const i = row + c, east = qx[i], west = c > 0 ? qx[i - 1] : 0, south = qy[i], north = r > 0 ? qy[i - w] : 0;
        let out = edgeOut[i];
        if (east > 0) out += east * dy;
        if (west < 0) out -= west * dy;
        if (south > 0) out += south * dx;
        if (north < 0) out -= north * dx;
        const have = depth[i] * area;
        afford[i] = out * dt > have ? have / (out * dt) : 1;
      }
    }
    for (let r = top; r <= bottom; r++) {
      const row = r * w;
      for (let c = from[r]; c <= to[r]; c++) {
        const i = row + c;
        if (qx[i] !== 0) qx[i] *= afford[qx[i] > 0 ? i : i + 1];
        if (qy[i] !== 0) qy[i] *= afford[qy[i] > 0 ? i : i + w];
        edgeOut[i] *= afford[i];
      }
    }
    // Continuity, then the sea.
    let edge = 0;
    for (let r = top; r <= bottom; r++) {
      const row = r * w;
      for (let c = from[r]; c <= to[r]; c++) {
        const i = row + c;
        if (wall[i]) continue;
        const net = ((c > 0 ? qx[i - 1] : 0) - qx[i]) * dy + ((r > 0 ? qy[i - w] : 0) - qy[i]) * dx - edgeOut[i];
        edge += edgeOut[i] * dt;
        const d = depth[i] + net * dt / area;
        depth[i] = d > 0 ? d : 0;
      }
    }
    ledger.edge += edge;
    if (forcing.inflow > 0 && land.length) {
      const add = forcing.inflow * dt / (land.length * area);
      for (const i of land) depth[i] += add;
      ledger.inflow += forcing.inflow * dt;
    }
    if (forcing.rain > 0) {
      const add = forcing.rain * roofs * dt;
      for (let i = 0; i < n; i++) if (!wall[i] && !sea[i]) depth[i] += add;
      ledger.rain += add * open * area;
    }
    deepest = 0;
    const r0 = top, r1 = bottom;
    for (let r = r0; r <= r1; r++) {
      const row = r * w, c0 = from[r], c1 = to[r];
      for (let c = c0; c <= c1; c++) {
        const i = row + c, d = depth[i];
        if (d <= 0) continue;
        if (sea[i]) { ledger.sea += d * area; depth[i] = 0; continue; }
        if (d > deepest) deepest = d;
        if (d > peak[i]) peak[i] = d;
        // Grow the spans around new water only (inner cells are already covered).
        if (!covered(r, c)) include(r, c);
      }
    }
    ledger.time += dt;
    return dt;
  }

  /** Runs until `seconds` more have passed, or `budget` ms of compute: returns the simulated seconds. */
  function advance(seconds: number, forcing: (time: number) => FloodForcing, budget = Infinity) {
    const start = performance.now(), end = ledger.time + seconds;
    while (ledger.time < end - 1e-9) {
      step(end - ledger.time, forcing(ledger.time));
      if (performance.now() - start > budget) break;
    }
    return ledger.time - (end - seconds);
  }

  /** Stored volume (m³). */
  function volume() {
    let v = 0;
    for (let i = 0; i < n; i++) v += depth[i];
    return v * area;
  }

  /** Depth-averaged speed (m/s) of a cell, from the fluxes across its four faces. */
  function speed(i: number) {
    const d = depth[i];
    if (d < .01) return 0;
    const c = i % w;
    const u = ((c > 0 ? qx[i - 1] : 0) + qx[i]) * .5, v = ((i >= w ? qy[i - w] : 0) + (i + w < n ? qy[i] : 0)) * .5;
    return Math.hypot(u, v) / d;
  }

  return {grid, settings, depth, peak, qx, qy, ledger, step, advance, volume, speed, stable, area, box};
}
