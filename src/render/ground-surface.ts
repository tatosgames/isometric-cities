import * as T from 'three';
import type { Altitude, Ring } from '../data/types.ts';

export const GROUND_SURFACE = 6;

// Keep the ShapeGeometry triangulation used to bake the carriageways.
export function groundPatch(ring: Ring, altitude: Altitude) {
  const points = ring.filter(([x,y],i) => i===0 || x!==ring[i-1][0] || y!==ring[i-1][1])
    .map(([x,y]) => new T.Vector2(x,y));
  if (!T.ShapeUtils.isClockWise(points)) points.reverse();
  const faces = T.ShapeUtils.triangulateShape(points,[]);
  const positions = points.map(({x,y}) => {
    const east = Math.fround(x), north = Math.fround(y);
    return [east,altitude(east,north),-north];
  });
  return { faces, positions };
}

type Triangle = { position: T.BufferAttribute | T.InterleavedBufferAttribute; a: number; b: number; c: number };
const CELL = 15;
const cell = (value: number) => Math.floor(value / CELL);
const key = (x: number, y: number) => x + ',' + y;

function indexGround(geometries: Iterable<T.BufferGeometry>, surface?: number) {
  const cells = new Map<string, Triangle[]>();
  for (const { index, attributes } of geometries) {
    const { position } = attributes;
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const a = index?.getX(i) ?? i, b = index?.getX(i+1) ?? i+1, c = index?.getX(i+2) ?? i+2;
      if (surface !== undefined && attributes.surface.getX(a) !== surface) continue;
      const triangle = { position, a, b, c };
      const ax = position.getX(a), bx = position.getX(b), cx = position.getX(c);
      const ay = -position.getZ(a), by = -position.getZ(b), cy = -position.getZ(c);
      const maxX = cell(Math.max(ax,bx,cx)), maxY = cell(Math.max(ay,by,cy));
      for (let x = cell(Math.min(ax,bx,cx)); x <= maxX; x++) {
        for (let y = cell(Math.min(ay,by,cy)); y <= maxY; y++) {
          const id = key(x,y), bucket = cells.get(id);
          if (bucket) bucket.push(triangle);
          else cells.set(id,[triangle]);
        }
      }
    }
  }
  return cells;
}

export function groundSampler(geometries: () => Iterable<T.BufferGeometry>, surface?: number) {
  let cells: ReturnType<typeof indexGround> | undefined;
  return (x: number, y: number): number | undefined => {
    cells ??= indexGround(geometries(),surface);
    const candidates = cells.get(key(cell(x),cell(y)));
    if (!candidates) return undefined;
    for (const { position, a, b, c } of candidates) {
      const ax = position.getX(a), ay = -position.getZ(a);
      const bx = position.getX(b)-ax, by = -position.getZ(b)-ay;
      const cx = position.getX(c)-ax, cy = -position.getZ(c)-ay;
      const determinant = bx*cy-by*cx;
      if (determinant === 0) continue;
      const u = ((x-ax)*cy-(y-ay)*cx)/determinant;
      const v = (bx*(y-ay)-by*(x-ax))/determinant;
      // Include shared edges despite floating-point rounding.
      if (u < -1e-9 || v < -1e-9 || u+v > 1+1e-9) continue;
      const height = position.getY(a);
      return height + u*(position.getY(b)-height) + v*(position.getY(c)-height);
    }
    return undefined;
  };
}
