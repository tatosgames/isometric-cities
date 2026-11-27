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
/** Steps between two shrinks of the spans to the water as it drains. */
const SHRINK = 64;

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
   * water moves at most one cell a step. A face outside them reads 0 (`shrink` clears those it leaves behind), so
   * the loops can ignore it. They grow with the water and shrink back every `SHRINK` steps as it drains.
   */
  const from = new Int32Array(h).fill(w), to = new Int32Array(h).fill(-1);
  let top = h, bottom = -1;
  /** Everywhere the spans have ever reached, which only grows: where the page reads and draws. */
  let everTop = h, everBottom = -1, everLeft = w, everRight = -1;
  function include(r: number, c: number) {
    const c0 = Math.max(0, c - 1), c1 = Math.min(w - 1, c + 1);
    for (let k = Math.max(0, r - 1); k <= Math.min(h - 1, r + 1); k++) {
      if (c0 < from[k]) from[k] = c0;
      if (c1 > to[k]) to[k] = c1;
    }
    if (r - 1 < top) top = Math.max(0, r - 1);
    if (r + 1 > bottom) bottom = Math.min(h - 1, r + 1);
    if (top < everTop) everTop = top;
    if (bottom > everBottom) everBottom = bottom;
    if (c0 < everLeft) everLeft = c0;
    if (c1 > everRight) everRight = c1;
  }
  /**
   * Spans back to the cells with more than `DRY` of water and their ring. Water at or under `DRY` with no deeper
   * neighbour cannot move (every face of it is under `DRY`), so the cells left out lose nothing. The fluxes on the
   * faces of the cells left out, and on the faces from the new spans outwards, are set to 0: the loops take a face
   * outside the spans to carry nothing.
   */
  const oldFrom = new Int32Array(h), oldTo = new Int32Array(h);
  let steps = 0;
  function shrink() {
    const r0 = top, r1 = bottom;
    if (r0 > r1) return;
    oldFrom.set(from); oldTo.set(to);
    from.fill(w); to.fill(-1); top = h; bottom = -1;
    for (let r = r0; r <= r1; r++) for (let c = oldFrom[r], i = r * w + c; c <= oldTo[r]; c++, i++) if (depth[i] > DRY) include(r, c);
    for (const i of land) include(Math.floor(i / w), i % w);
    for (let r = r0; r <= r1; r++) {
      const row = r * w;
      for (let c = oldFrom[r]; c <= oldTo[r]; c++) {
        const i = row + c;
        if (c < from[r] || c > to[r]) { qx[i] = qy[i] = edgeOut[i] = 0; continue; }
        if (c === to[r]) qx[i] = 0;
        if (r === h - 1 || c < from[r + 1] || c > to[r + 1]) qy[i] = 0;
        if (c === from[r] && c > 0) qx[i - 1] = 0;
        if (r > 0 && (c < from[r - 1] || c > to[r - 1])) qy[i - w] = 0;
      }
    }
  }
  /** Whether the ring of cells around (r, c) is already inside the spans. */
  function covered(r: number, c: number) {
    const a = Math.max(0, c - 1), b = Math.min(w - 1, c + 1);
    for (let k = Math.max(0, r - 1); k <= Math.min(h - 1, r + 1); k++) if (from[k] > a || to[k] < b) return false;
    return true;
  }
  /** Rows and columns the water has ever reached, with its ring: what the page reads and redraws. */
  const box = {get r0() { return everTop; }, get r1() { return everBottom; },
    get c0() { return everLeft; }, get c1() { return everRight; }};

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
      for (let r = 0; r < h; r++) include(r, 0), include(r, w - 1);
      from.fill(0); to.fill(w - 1);
    } else if (++steps % SHRINK === 0) shrink();
    if (forcing.inflow > 0) for (const i of land) include(Math.floor(i / w), i % w);
    if (top > bottom) { ledger.time += dt; return dt; }
    const r0 = top, r1 = bottom;
    for (let r = r0; r <= r1; r++) {
      if (from[r] > to[r]) continue;
      const a = r * w + from[r], b = r * w + to[r] + 1;
      oldX.set(qx.subarray(a, b), a); oldY.set(qy.subarray(a, b), a);
    }
    // Pass 1, row by row: the fluxes from the previous ones and the water surface on the faces between two cells of
    // the spans, the outflow past the grid's edge, and the share of its outgoing fluxes each cell can afford, so
    // that none runs below zero. A row's afford needs its own faces and the north faces of the row before, both done.
    for (let r = r0; r <= r1; r++) {
      const row = r * w, c0 = from[r], c1 = to[r];
      if (c0 > c1) continue;
      for (let c = c0; c < c1; c++) {
        const i = row + c;
        qx[i] = face(oldX[i], i, i + 1, dx, c > 0 ? oldX[i - 1] : oldX[i], c < w - 2 ? oldX[i + 1] : oldX[i], dt);
      }
      if (r < h - 1) {
        const s0 = Math.max(c0, from[r + 1]), s1 = Math.min(c1, to[r + 1]);
        for (let c = s0; c <= s1; c++) {
          const i = row + c;
          qy[i] = face(oldY[i], i, i + w, dy, r > 0 ? oldY[i - w] : oldY[i], r < h - 2 ? oldY[i + w] : oldY[i], dt);
        }
      }
      if (r === 0 || r === h - 1) {
        for (let c = c0; c <= c1; c++) {
          const i = row + c;
          let out = 0;
          if (r === 0) out += leave(i, i + w, dy) * dx;
          if (r === h - 1) out += leave(i, i - w, dy) * dx;
          if (c === 0) out += leave(i, i + 1, dx) * dy;
          if (c === w - 1) out += leave(i, i - 1, dx) * dy;
          edgeOut[i] = out;
        }
      } else {
        if (c0 === 0) edgeOut[row] = leave(row, row + 1, dx) * dy;
        if (c1 === w - 1) edgeOut[row + w - 1] = leave(row + w - 1, row + w - 2, dx) * dy;
      }
      for (let c = c0, i = row + c0; c <= c1; c++, i++) {
        const east = qx[i], west = c > 0 ? qx[i - 1] : 0, south = qy[i], north = r > 0 ? qy[i - w] : 0;
        let out = edgeOut[i];
        if (east > 0) out += east * dy;
        if (west < 0) out -= west * dy;
        if (south > 0) out += south * dx;
        if (north < 0) out -= north * dx;
        const have = depth[i] * area;
        afford[i] = out * dt > have ? have / (out * dt) : 1;
      }
    }
    // Pass 2: what enters, from the hydrograph and the rain.
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
    // Pass 3, row by row: each cell scales its east and south faces by what their upstream cell affords (its west
    // and north faces are scaled already), takes its net flux, gives what reached the sea, and grows the spans
    // around new water.
    let edge = 0;
    deepest = 0;
    for (let r = r0; r <= r1; r++) {
      const row = r * w, c0 = from[r], c1 = to[r];
      for (let c = c0; c <= c1; c++) {
        const i = row + c;
        if (qx[i] !== 0) qx[i] *= afford[qx[i] > 0 ? i : i + 1];
        if (qy[i] !== 0) qy[i] *= afford[qy[i] > 0 ? i : i + w];
        edgeOut[i] *= afford[i];
        if (wall[i]) continue;
        const net = ((c > 0 ? qx[i - 1] : 0) - qx[i]) * dy + ((r > 0 ? qy[i - w] : 0) - qy[i]) * dx - edgeOut[i];
        edge += edgeOut[i] * dt;
        let d = depth[i] + net * dt / area;
        if (d <= 0) { depth[i] = 0; continue; }
        if (sea[i]) { ledger.sea += d * area; depth[i] = 0; continue; }
        depth[i] = d;
        if (d > deepest) deepest = d;
        if (d > peak[i]) peak[i] = d;
        // Grow the spans around new water only (inner cells are already covered).
        if (!covered(r, c)) include(r, c);
      }
    }
    ledger.edge += edge;
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
  /**
   * Depth-averaged velocity of a cell (m/s) towards the east and towards the north, from the fluxes across its four
   * faces, 0 in water under 1 cm. A face can run deeper than the cell beside a step of the DEM: the speed is held to
   * the same Froude number as the faces.
   */
  const velocity = {east: 0, north: 0};
  function flowAt(i: number) {
    const d = depth[i];
    velocity.east = velocity.north = 0;
    if (d < .01) return velocity;
    let u = ((i % w > 0 ? qx[i - 1] : 0) + qx[i]) * .5 / d;
    // Rows grow southwards, and so does qy.
    let v = -((i >= w ? qy[i - w] : 0) + (i + w < n ? qy[i] : 0)) * .5 / d;
    const most = settings.froude * Math.sqrt(GRAVITY * d), fast = Math.hypot(u, v);
    if (fast > most) { u *= most / fast; v *= most / fast; }
    velocity.east = u; velocity.north = v;
    return velocity;
  }
  function speed(i: number) {
    const {east, north} = flowAt(i);
    return Math.hypot(east, north);
  }

  return {grid, settings, depth, peak, qx, qy, ledger, step, advance, volume, speed, flowAt, stable, area, box, spans: {from, to}};
}
