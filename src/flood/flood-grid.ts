import type { Building, Point, Terrain } from '../data/types.ts';
import { heightWindow } from '../geometry.ts';
import type { FloodGrid } from './flood-solver.ts';

/** West, south, east, north (m on the map). */
export type Box = readonly [number, number, number, number];

/** A flood grid on the DEM nodes, with which building stands on each cell (index + 1, 0 for none). */
export interface FloodArea extends FloodGrid {
  /** Map position of the centre of cell (0, 0), the north-western one. */
  west: number;
  north: number;
  owner: Int32Array;
  buildings: Building[];
}

/**
 * Marks with `value` the cells whose centre lies inside the polygon `rings` (even-odd, so holes stay out): one scan
 * line per row through the cell centres.
 */
export function fillPolygon(rings: readonly (readonly Point[])[], area: Pick<FloodArea, 'w' | 'h' | 'dx' | 'dy' | 'west' | 'north'>,
  out: Uint8Array | Int32Array, value: number) {
  const {w, h, dx, dy, west, north} = area;
  let top = -Infinity, bottom = Infinity;
  for (const ring of rings) for (const p of ring) { top = Math.max(top, p[1]); bottom = Math.min(bottom, p[1]); }
  const r0 = Math.max(0, Math.ceil((north - top) / dy)), r1 = Math.min(h - 1, Math.floor((north - bottom) / dy));
  const cross: number[] = [];
  for (let r = r0; r <= r1; r++) {
    const y = north - r * dy;
    cross.length = 0;
    for (const ring of rings) {
      for (let k = 0, j = ring.length - 1; k < ring.length; j = k++) {
        const [ax, ay] = ring[j], [bx, by] = ring[k];
        if ((ay > y) !== (by > y)) cross.push(ax + (y - ay) * (bx - ax) / (by - ay));
      }
    }
    cross.sort((a, b) => a - b);
    for (let k = 0; k + 1 < cross.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((cross[k] - west) / dx)), c1 = Math.min(w - 1, Math.ceil((cross[k + 1] - west) / dx) - 1);
      for (let c = c0; c <= c1; c++) out[r * w + c] = value;
    }
  }
}

/** The flood grid of `box` on the terrain grid: ground, buildings as walls, and the open sea. */
export function floodArea(terrain: Terrain, box: Box, buildings: readonly Building[], sea: readonly (readonly (readonly Point[])[])[]): FloodArea {
  const ground = heightWindow(terrain, box, 0), scale = ground.scale;
  const w = ground.w, h = ground.h, n = w * h;
  const z = new Float32Array(n);
  for (let i = 0; i < n; i++) z[i] = ground.values[i] * scale;
  const area = {w, h, dx: ground.step, dy: ground.stepY, west: ground.origin[0], north: ground.origin[1]};
  const east = area.west + (w - 1) * area.dx, south = area.north - (h - 1) * area.dy;
  const owner = new Int32Array(n), wall = new Uint8Array(n), water = new Uint8Array(n);
  const inside: Building[] = [];
  for (const b of buildings) {
    const ring = b.rings[0];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    if (x1 < area.west || x0 > east || y1 < south || y0 > area.north) continue;
    inside.push(b);
    fillPolygon(b.rings, area, owner, inside.length);
  }
  for (let i = 0; i < n; i++) wall[i] = owner[i] ? 1 : 0;
  for (const polygon of sea) fillPolygon(polygon, area, water, 1);
  // A building drawn over the water (a pier shed) stays a wall; the sea under it does not drain.
  for (let i = 0; i < n; i++) if (wall[i]) water[i] = 0;
  return {...area, z, wall, sea: water, owner, buildings: inside};
}

/**
 * The cells of the channel bed around a point: those within `radius` metres no more than `band` metres above the
 * lowest of them. A flood hydrograph enters there, spread across the bed rather than poured into one cell.
 */
export function channelCells(area: FloodArea, x: number, y: number, radius: number, band = 1.5) {
  const {w, h, dx, dy, west, north, z, wall, sea} = area;
  const cc = Math.round((x - west) / dx), rc = Math.round((north - y) / dy);
  const reach = Math.ceil(radius / Math.min(dx, dy)), near: number[] = [];
  for (let r = Math.max(0, rc - reach); r <= Math.min(h - 1, rc + reach); r++)
    for (let c = Math.max(0, cc - reach); c <= Math.min(w - 1, cc + reach); c++) {
      const i = r * w + c;
      if (!wall[i] && !sea[i] && Math.hypot((c - cc) * dx, (r - rc) * dy) <= radius) near.push(i);
    }
  if (!near.length) throw new Error('No open ground around the flood source');
  const low = Math.min(...near.map(i => z[i]));
  return Int32Array.from(near.filter(i => z[i] <= low + band));
}
