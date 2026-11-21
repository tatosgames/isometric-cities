import type { CityData, Point, Ring, SectorIndex } from './types.ts';

export function sectorOwner(x: number, y: number, size: number): string {
  return Math.floor(x / size) + '_' + Math.floor(y / size);
}

export function ringCenter(ring: Ring): Point {
  const xs = ring.map(point => point[0]);
  const ys = ring.map(point => point[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

export function validateSectorIndex(city: CityData, index: SectorIndex): void {
  const {sectors, sectorSize, buildingOwners} = index;
  const ids = new Set(sectors.map(sector => sector.id));
  if (!ids.size || ids.size !== sectors.length) {
    throw new Error('City sector index must contain unique sector IDs');
  }
  if (buildingOwners.length !== city.buildings.length) {
    throw new Error('City sector index must assign one sector to each building');
  }
  function checkOwner(id: string) {
    if (!ids.has(id)) throw new Error('City sector index refers to unknown sector ' + id);
  }
  for (const id of buildingOwners) checkOwner(id);
  for (const point of city.trees) checkOwner(sectorOwner(...point, sectorSize));
  for (const ring of city.ground) checkOwner(sectorOwner(...ringCenter(ring), sectorSize));
}
