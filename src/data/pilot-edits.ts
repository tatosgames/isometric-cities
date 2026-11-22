import { isCity } from './load.ts';
import type { CityData, Point, Ring } from './types.ts';

export const propKinds = { bench: 'Bench', bollard: 'Bollard', planter: 'Planter' } as const;
export type PropKind = keyof typeof propKinds;
export interface MapProp { id: string; kind: PropKind; position: Point; yaw: number }
interface FootprintEdit { part: number; id: number; rings: Ring[] }
export interface PilotEdits { version: 1; base: string; footprints: FootprintEdit[]; props: MapProp[] }
export interface PilotBase { data: CityData; hash: string }

export async function loadPilotBase(): Promise<PilotBase> {
  const response = await fetch('./data/pilot.json');
  if (!response.ok) throw new Error('Could not load pilot.json.');
  const bytes = await response.arrayBuffer();
  const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!isCity(data)) throw new Error('The pilot map data is invalid.');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
    byte => byte.toString(16).padStart(2, '0')).join('');
  return { data, hash };
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const point = (value: unknown): value is Point =>
  Array.isArray(value) && value.length === 2 && finite(value[0]) && finite(value[1]);
const same = (a: Point, b: Point) => a[0] === b[0] && a[1] === b[1];
const cross = (a: Point, b: Point, c: Point) => (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]);
const between = (p: number, a: number, b: number) => p >= Math.min(a,b) && p <= Math.max(a,b);
const onSegment = (p: Point, a: Point, b: Point) =>
  Math.abs(cross(a,b,p)) < 1e-8 && between(p[0],a[0],b[0]) && between(p[1],a[1],b[1]);

function edges(ring: Ring) {
  return ring.slice(1).map((p, index) => [ring[index], p] as const);
}

function intersects(a: Point, b: Point, c: Point, d: Point) {
  const opposite = (x: number, y: number) => (x > 0 && y < 0) || (x < 0 && y > 0);
  return (opposite(cross(a,b,c),cross(a,b,d)) && opposite(cross(c,d,a),cross(c,d,b)))
    || onSegment(c,a,b) || onSegment(d,a,b) || onSegment(a,c,d) || onSegment(b,c,d);
}

function inside(ring: Ring, [x,y]: Point) {
  let result = false;
  for (const [[ax,ay],[bx,by]] of edges(ring)) {
    if ((ay > y) !== (by > y) && x < ax + (bx-ax)*(y-ay)/(by-ay)) result = !result;
  }
  return result;
}

export function inPilot(data: CityData, [x,y]: Point) {
  // The pilot AOI is a rectangle in the local metric projection.
  const xs = data.boundary.map(p => p[0]), ys = data.boundary.map(p => p[1]);
  return between(x,Math.min(...xs),Math.max(...xs)) && between(y,Math.min(...ys),Math.max(...ys));
}

function validRing(data: CityData, ring: unknown): ring is Ring {
  if (!Array.isArray(ring) || ring.length < 4 || !ring.every(point)
    || !same(ring[0],ring[ring.length-1]) || !ring.every(p => inPilot(data,p))) return false;
  const segments = edges(ring);
  if (Math.abs(segments.reduce((area,[a,b]) => area + cross(ring[0],a,b),0)) < 1e-6) return false;
  return segments.every(([a,b],i) => {
    const next = segments[(i+1)%segments.length][1];
    if (same(a,b) || onSegment(next,a,b) || onSegment(a,b,next)) return false;
    return segments.slice(i+2).every(([c,d],offset) =>
      (i === 0 && offset === segments.length-3) || !intersects(a,b,c,d));
  });
}

function validFootprint(data: CityData, rings: unknown): rings is Ring[] {
  if (!Array.isArray(rings) || !rings.length || !rings.every(r => validRing(data,r))) return false;
  const [outer,...holes] = rings;
  const touches = (a: Ring,b: Ring) => {
    const other = edges(b);
    return edges(a).some(([p,q]) => other.some(([r,s]) => intersects(p,q,r,s)));
  };
  return holes.every((hole,i) => inside(outer,hole[0]) && !touches(outer,hole)
    && holes.slice(0,i).every(other => !touches(hole,other) && !inside(hole,other[0]) && !inside(other,hole[0])));
}

export function isFixedBuilding(data: CityData, part: number) {
  return data.buildings.some(building => building.id === data.buildings[part]?.id && building.landmark);
}

export function readPilotEdits(base: PilotBase, value: unknown): PilotEdits {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.footprints) || !Array.isArray(value.props)) {
    throw new Error('Invalid edits file.');
  }
  if (value.base !== base.hash) throw new Error('This file was saved for a different version of the pilot map.');
  const parts = new Set<number>();
  const footprints = value.footprints.map((edit: unknown): FootprintEdit => {
    if (!record(edit) || !finite(edit.part) || !Number.isInteger(edit.part) || !finite(edit.id)
      || base.data.buildings[edit.part]?.id !== edit.id || parts.has(edit.part) || isFixedBuilding(base.data,edit.part)) {
      throw new Error('The file contains an invalid building reference.');
    }
    if (!validFootprint(base.data,edit.rings)) throw new Error('The building footprint is invalid.');
    parts.add(edit.part);
    return { part: edit.part, id: edit.id, rings: edit.rings };
  });
  const ids = new Set<string>();
  const props = value.props.map((prop: unknown): MapProp => {
    if (!record(prop) || typeof prop.id !== 'string' || !prop.id || ids.has(prop.id)
      || typeof prop.kind !== 'string' || !Object.hasOwn(propKinds,prop.kind)
      || !point(prop.position) || !inPilot(base.data,prop.position) || !finite(prop.yaw)) {
      throw new Error('The file contains an invalid prop.');
    }
    ids.add(prop.id);
    return { id: prop.id, kind: prop.kind as PropKind, position: prop.position, yaw: prop.yaw };
  });
  return { version: 1, base: base.hash, footprints, props };
}

export async function readPilotFile(base: PilotBase, file: File) {
  let value: unknown;
  try { value = JSON.parse(await file.text()); }
  catch { throw new Error('The file does not contain valid JSON.'); }
  return readPilotEdits(base,value);
}

export function applyPilotEdits(base: CityData, edits: PilotEdits): CityData {
  const footprints = new Map(edits.footprints.map(edit => [edit.part,edit.rings]));
  return { ...base, buildings: base.buildings.map((building,part) => {
    const rings = footprints.get(part);
    return rings ? { ...building, rings } : building;
  }) };
}
