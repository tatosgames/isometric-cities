import type { Point } from '../data/types.ts';
import { pointInRing } from '../geometry.ts';

type Vec = {x: number; y: number; z: number};

/**
 * Where a ray first enters a building, through its roof or a wall: the ray parameter, Infinity when it misses.
 * World axes (x east, y up, z south); the footprint is in plan (east, north); walls stand from `base` to `top`.
 */
export function rayPrism(o: Vec, d: Vec, ring: readonly Point[], base: number, top: number) {
  let best = Infinity;
  if (d.y) {
    const roof = (top - o.y) / d.y;
    if (roof >= 0 && pointInRing(ring, o.x + roof * d.x, -(o.z + roof * d.z))) best = roof;
  }
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j], [bx, by] = ring[i];
    const ex = bx - ax, ey = by - ay, wx = ax - o.x, wy = ay + o.z, denom = d.x * ey + d.z * ex;
    if (Math.abs(denom) < 1e-9) continue;
    const t = (wx * ey - wy * ex) / denom, s = (wx * -d.z - wy * d.x) / denom, y = o.y + t * d.y;
    if (t >= 0 && t < best && s >= 0 && s <= 1 && y >= base && y <= top) best = t;
  }
  return best;
}
