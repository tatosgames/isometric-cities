import type { FloodArea } from './flood-grid.ts';

/**
 * Critical facilities (`public/data/flood-facilities.json`, from OpenStreetMap by `scripts/flood_facilities.py`):
 * what a flood must not reach first. Each is matched to the building footprint under it on the flood grid.
 */
export type FacilityKind = 'hospital' | 'health' | 'school' | 'emergency' | 'care';
export interface Facility { id: string; kind: FacilityKind; name: string; x: number; y: number }
export interface Watched { facility: Facility; building: number }

const KINDS = new Set<string>(['hospital', 'health', 'school', 'emergency', 'care']);
export function isFacilities(v: unknown): v is {facilities: Facility[]} {
  if (!v || typeof v !== 'object' || !Array.isArray((v as {facilities?: unknown}).facilities)) return false;
  return (v as {facilities: unknown[]}).facilities.every(f => !!f && typeof f === 'object'
    && typeof (f as Facility).id === 'string' && KINDS.has((f as Facility).kind) && typeof (f as Facility).name === 'string'
    && Number.isFinite((f as Facility).x) && Number.isFinite((f as Facility).y));
}

/** Kinds in order of priority, for lists: what a civil protection plan would check first. */
export const FACILITY_ORDER: readonly FacilityKind[] = ['hospital', 'emergency', 'care', 'school', 'health'];

/**
 * The buildings of the grid under each facility: the cell under the point, or the nearest building cell within
 * `reach` metres (a point mapped at the entrance). One entry per building.
 */
export function matchFacilities(area: FloodArea, facilities: readonly Facility[], reach = 12): Watched[] {
  const {w, h, dx, dy, west, north, owner} = area, out: Watched[] = [], seen = new Set<number>();
  const steps = Math.ceil(reach / Math.min(dx, dy));
  for (const facility of facilities) {
    const c0 = Math.round((facility.x - west) / dx), r0 = Math.round((north - facility.y) / dy);
    if (c0 < -steps || r0 < -steps || c0 >= w + steps || r0 >= h + steps) continue;
    let best = -1, bestDistance = Infinity;
    for (let r = r0 - steps; r <= r0 + steps; r++) for (let c = c0 - steps; c <= c0 + steps; c++) {
      if (r < 0 || c < 0 || r >= h || c >= w) continue;
      const b = owner[r * w + c] - 1, d = Math.hypot((c - c0) * dx, (r - r0) * dy);
      if (b >= 0 && d < bestDistance && d <= reach) { best = b; bestDistance = d; }
    }
    if (best >= 0 && !seen.has(best)) { seen.add(best); out.push({facility, building: best}); }
  }
  return out.sort((a, b) => FACILITY_ORDER.indexOf(a.facility.kind) - FACILITY_ORDER.indexOf(b.facility.kind));
}
