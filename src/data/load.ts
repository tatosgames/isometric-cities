import type { Bounds, Building, CityData, Layers, Place, Point, Ring, Road, RoofTones, Sea, Sector, SectorIndex, Surface, Terrain, ViewState } from './types.ts';

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const number = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const string = (v: unknown): v is string => typeof v === 'string';
const boolean = (v: unknown): v is boolean => typeof v === 'boolean';

function list<T>(v: unknown, item: (v: unknown) => v is T): v is T[] {
  return Array.isArray(v) && v.every(item);
}

const point = (v: unknown): v is Point => list(v, number) && v.length === 2;
const bounds = (v: unknown): v is Bounds => list(v, number) && v.length === 4;
const ring = (v: unknown): v is Ring => list(v, point) && v.length >= 3;
const rings = (v: unknown): v is Ring[] => list(v, ring) && v.length > 0;

function building(v: unknown): v is Building {
  return record(v) && number(v.id) && rings(v.rings) && number(v.height)
    && (v.heightOverride === undefined || number(v.heightOverride))
    && (v.wallColor === undefined || string(v.wallColor))
    && (v.toneSuffix === undefined || string(v.toneSuffix))
    && (v.landmark === undefined || string(v.landmark))
    && (v.roofFurniture === undefined || boolean(v.roofFurniture))
    && (v.windows === undefined || boolean(v.windows));
}
const road = (v: unknown): v is Road => record(v) && string(v.kind) && list(v.line, point);
const surface = (v: unknown): v is Surface =>
  record(v) && string(v.id) && string(v.kind) && rings(v.rings)
  && (v.paved === undefined || boolean(v.paved));

export function isLayers(v: unknown): v is Layers {
  return record(v) && list(v.buildings, building) && list(v.trees, point)
    && list(v.ground, ring) && list(v.roads, road) && list(v.surfaces, surface)
    && (v.textureBounds === undefined || bounds(v.textureBounds));
}

function terrain(v: unknown): v is Terrain {
  return record(v) && point(v.origin) && number(v.step) && v.step > 0
    && (v.stepY === undefined || (number(v.stepY) && v.stepY > 0))
    && number(v.w) && Number.isInteger(v.w) && v.w >= 2
    && number(v.h) && Number.isInteger(v.h) && v.h >= 2
    && list(v.values, number) && v.values.length === v.w * v.h;
}

export function isCity(v: unknown): v is CityData {
  return record(v) && ring(v.boundary) && terrain(v.terrain)
    && (v.focus == null || string(v.focus)) && isLayers(v);
}

const line = (v: unknown): v is Point[] => list(v, point) && v.length >= 2;
export const isSea = (v: unknown): v is Sea =>
  record(v) && list(v.water, rings) && list(v.shore, line) && list(v.edge, line);

const sector = (v: unknown): v is Sector =>
  record(v) && string(v.id) && bounds(v.bounds) && point(v.vertical) && string(v.file);

export function isSectorIndex(v: unknown): v is SectorIndex {
  return record(v) && list(v.sectors, sector) && number(v.sectorSize)
    && v.sectorSize > 0 && list(v.buildingOwners, string);
}

const place = (v: unknown): v is Place => record(v) && record(v.properties)
  && string(v.properties.id) && string(v.properties.name) && point(v.properties.xy)
  && number(v.properties.markerHeight) && Array.isArray(v.properties.areas)
  && v.properties.areas.every(area => area === 'city' || area === 'pilot');

export const isPlaces = (v: unknown): v is {features: Place[]} =>
  record(v) && list(v.features, place);

export const isRoofPalette = (v: unknown): v is {tones: RoofTones} =>
  record(v) && record(v.tones) && Object.values(v.tones).every(string);

export async function loadData<T>(path: string, valid: (v: unknown) => v is T, signal?: AbortSignal): Promise<T> {
  const response = await fetch('./data/' + path, {signal: signal ?? null});
  if (!response.ok) throw new Error(path + ' HTTP ' + response.status);
  const payload: unknown = await response.json();
  if (!valid(payload)) throw new Error('Invalid map data: ' + path);
  return payload;
}

export function parseViewState(raw: string | null): (ViewState & {losses: number}) | null {
  if (raw === null) return null;
  const v: unknown = JSON.parse(raw);
  if (!record(v)) return null;
  const {target, zoom, selected, losses} = v;
  if (!list(target, number) || target.length !== 3 || !number(zoom) || zoom <= 0) return null;
  return {
    target: [target[0], target[1], target[2]], zoom,
    selected: string(selected) || number(selected) ? selected : null,
    losses: number(losses) ? losses : 0
  };
}
