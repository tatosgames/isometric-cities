import type { CityCore, CityData, Point, Ring, SectorIndex, ZoneData } from './types.ts';

export function sectorOwner(x: number, y: number, size: number): string {
  return Math.floor(x / size) + '_' + Math.floor(y / size);
}

export function ringCenter(ring: Ring): Point {
  const xs = ring.map(point => point[0]);
  const ys = ring.map(point => point[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}

/** Zone that holds a sector: zones are whole multiples of the sector size. */
export function zoneOfSector(id: string, index: {sectorSize: number; zoneSize: number}): string {
  const [x, y] = id.split('_').map(Number), n = index.zoneSize / index.sectorSize;
  return Math.floor(x / n) + '_' + Math.floor(y / n);
}

export function validateSectorIndex(index: SectorIndex): void {
  const {sectors, zones} = index;
  const ids = new Set(sectors.map(sector => sector.id)), zoneIds = new Set(zones.map(zone => zone.id));
  if (!ids.size || ids.size !== sectors.length) {
    throw new Error('City sector index must contain unique sector IDs');
  }
  if (!zoneIds.size || zoneIds.size !== zones.length || !Number.isInteger(index.zoneSize / index.sectorSize)) {
    throw new Error('City sector index must contain unique zones made of whole sectors');
  }
  for (const id of ids) {
    if (!zoneIds.has(zoneOfSector(id, index))) throw new Error('Sector ' + id + ' has no zone');
  }
}

/** Every object of a zone must belong to one of its sectors. Returns the number of buildings. */
export function validateZone(zone: ZoneData, id: string, index: SectorIndex): number {
  const ids = new Set(index.sectors.map(sector => sector.id));
  function checkOwner(owner: string) {
    if (!ids.has(owner) || zoneOfSector(owner, index) !== id) throw new Error('Zone ' + id + ' refers to foreign sector ' + owner);
  }
  if (zone.owners.length !== zone.buildings.length) throw new Error('Zone ' + id + ' must assign one sector to each building');
  for (const owner of zone.owners) checkOwner(owner);
  for (const point of zone.trees) checkOwner(sectorOwner(...point, index.sectorSize));
  for (const ring of zone.ground) checkOwner(sectorOwner(...ringCenter(ring), index.sectorSize));
  return zone.buildings.length;
}

/** Split a whole city in memory, for tools that already hold it. The far level reuses each footprint as a block. */
export function zonesFromCity(city: CityData, index: SectorIndex, keep: (sector: string) => boolean = () => true) {
  const zones = new Map<string, ZoneData>(), far: CityCore['far'] = {};
  const zone = (sector: string) => {
    const id = zoneOfSector(sector, index);
    let entry = zones.get(id);
    if (!entry) { entry = {buildings: [], owners: [], trees: [], ground: []}; zones.set(id, entry); far[id] = {blocks: [], ground: []}; }
    return entry;
  };
  for (const sector of index.sectors) if (keep(sector.id)) zone(sector.id);
  for (const building of city.buildings) {
    const owner = sectorOwner(...ringCenter(building.rings[0]), index.sectorSize);
    if (!keep(owner)) continue;
    const entry = zone(owner);
    entry.buildings.push(building); entry.owners.push(owner);
    far[zoneOfSector(owner, index)].blocks.push({ring: building.rings[0], height: building.heightOverride ?? building.height, tone: '#d4c8b6'});
  }
  for (const tree of city.trees) {
    const owner = sectorOwner(...tree, index.sectorSize);
    if (keep(owner)) zone(owner).trees.push(tree);
  }
  for (const ring of city.ground) {
    const owner = sectorOwner(...ringCenter(ring), index.sectorSize);
    if (!keep(owner)) continue;
    zone(owner).ground.push(ring); far[zoneOfSector(owner, index)].ground.push(ring);
  }
  const core: CityCore = {...city, buildings: [], trees: [], ground: [], far};
  return {core, zones, index: {...index, sectors: index.sectors.filter(s => keep(s.id)), zones: index.zones.filter(z => zones.has(z.id))}};
}
