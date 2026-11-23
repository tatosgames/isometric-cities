import type { Barrio, Bounds, Building, CityCore, CityData, FarBlock, FarZone, Layers, Place, Point, Prop, Ring, Road, RoofTones, Sea, Sector, SectorIndex, Surface, Terrain, ViewState, Zone, ZoneData } from './types.ts';

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
const road = (v: unknown): v is Road => record(v) && (v.id===undefined||string(v.id)) && string(v.kind) && list(v.line, point)
  && (v.name == null || string(v.name)) && (v.bridge===undefined||string(v.bridge)) && (v.layer===undefined||string(v.layer));
const barrio = (v: unknown): v is Barrio =>
  record(v) && string(v.name) && v.name.trim().length > 0 && list(v.polygons, rings) && v.polygons.length > 0;
export const isBarrios = (v: unknown): v is Barrio[] => list(v, barrio);
const surface = (v: unknown): v is Surface =>
  record(v) && string(v.id) && string(v.kind) && rings(v.rings)
  && (v.paved === undefined || boolean(v.paved));

function validCarriageway(v:unknown, b:unknown){
  if(!record(v) || !bounds(b) || !list(v.positions,number) || !Array.isArray(v.indices))return false;
  if(v.positions.length%3!==0 || v.indices.length%3!==0)return false;
  const p=v.positions;
  for(let i=0;i<p.length;i+=3){
    if(p[i]<b[0]||p[i]>b[2]||-p[i+2]<b[1]||-p[i+2]>b[3])return false;
  }
  return v.indices.every(i=>Number.isInteger(i)&&i>=0&&i<p.length/3)&&list(v.fallback,rings);
}
const prop = (v: unknown): v is Prop => Array.isArray(v) && v.length === 5 && string(v[0]) && v.slice(1).every(number);
const props = (v: unknown): boolean => v === undefined || list(v, prop);

export function isLayers(v: unknown): v is Layers {
  return record(v) && list(v.buildings, building) && (v.fused === undefined || list(v.fused, building))
    && list(v.trees, point) && props(v.props)
    && list(v.ground, ring) && list(v.roads, road) && list(v.surfaces, surface)
    && (v.carriageway===undefined||validCarriageway(v.carriageway,v.textureBounds))
    && (v.textureBounds === undefined || bounds(v.textureBounds));
}

function terrainGrid(v: Record<string, unknown>): v is Record<string, unknown> & Omit<Terrain, 'values'> {
  return point(v.origin) && number(v.step) && v.step > 0
    && (v.stepY === undefined || (number(v.stepY) && v.stepY > 0))
    && number(v.w) && Number.isInteger(v.w) && v.w >= 2
    && number(v.h) && Number.isInteger(v.h) && v.h >= 2;
}
function terrain(v: unknown): v is Terrain {
  return record(v) && terrainGrid(v) && list(v.values, number) && v.values.length === v.w * v.h;
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

const farBlock = (v: unknown): v is FarBlock => record(v) && ring(v.ring) && number(v.height) && string(v.tone);
const farZone = (v: unknown): v is FarZone => record(v) && list(v.blocks, farBlock) && list(v.ground, ring);

export function isZone(v: unknown): v is ZoneData {
  return record(v) && list(v.buildings, building) && list(v.owners, string)
    && list(v.trees, point) && list(v.ground, ring) && props(v.props)
    && (v.coverage === undefined || list(v.coverage, rings));
}

type CoreFile = Omit<CityCore, 'terrain' | 'buildings' | 'trees' | 'ground'> & {terrain: Omit<Terrain, 'values'> & {file: string}};
export function isCoreFile(v: unknown): v is CoreFile {
  return record(v) && ring(v.boundary) && list(v.roads, road) && list(v.surfaces, surface)
    && (v.focus == null || string(v.focus)) && record(v.terrain) && terrainGrid(v.terrain) && string(v.terrain.file)
    && record(v.far) && Object.values(v.far).every(farZone);
}

/** Terrain heights are little-endian Int16 decimetres on the grid named by the core. */
export function coreWithTerrain(core: CoreFile, heights: ArrayBuffer): CityCore {
  const {w, h} = core.terrain;
  if (heights.byteLength !== w * h * 2) throw new Error('Terrain size does not match its grid');
  // Kept as stored: a quarter of the memory of floats, on the main thread and again in the worker.
  let values = new Int16Array(heights);
  if (new Uint8Array(new Uint16Array([1]).buffer)[0] !== 1) {
    const view = new DataView(heights);
    values = Int16Array.from({length: w * h}, (_, i) => view.getInt16(i * 2, true));
  }
  return {...core, terrain: {...core.terrain, values, scale: .1}, buildings: [], trees: [], ground: []};
}

export async function loadCore(stage: string, signal?: AbortSignal): Promise<CityCore> {
  const file = stage + '-terrain.bin';
  const [core, heights] = await Promise.all([
    loadData(stage + '-core.json', isCoreFile, signal, true),
    readMapFile(file, response=>response.arrayBuffer(), signal, true)
  ]);
  if (core.terrain.file !== file) throw new Error('Unexpected terrain file: ' + core.terrain.file);
  return coreWithTerrain(core, heights);
}

const zone = (v: unknown): v is Zone =>
  record(v) && string(v.id) && bounds(v.bounds) && point(v.vertical) && string(v.file);

export function isSectorIndex(v: unknown): v is SectorIndex {
  return record(v) && list(v.sectors, sector) && number(v.sectorSize)
    && v.sectorSize > 0 && list(v.zones, zone) && number(v.zoneSize) && v.zoneSize > 0 && number(v.buildingCount)
    && (v.carriageways===undefined||boolean(v.carriageways)) && (v.roadCoverage===undefined||list(v.roadCoverage,rings)) && (v.roadFallback===undefined||list(v.roadFallback,rings)) && (v.roadExceptions===undefined||list(v.roadExceptions,string));
}

const place = (v: unknown): v is Place => record(v) && record(v.properties)
  && string(v.properties.id) && string(v.properties.name) && point(v.properties.xy)
  && number(v.properties.markerHeight) && Array.isArray(v.properties.areas)
  && v.properties.areas.every(area => area === 'city' || area === 'pilot');

export const isPlaces = (v: unknown): v is {features: Place[]} =>
  record(v) && list(v.features, place);

export const isRoofPalette = (v: unknown): v is {tones: RoofTones} =>
  record(v) && record(v.tones) && Object.values(v.tones).every(string);

const transientStatus = new Set([408,500,502,503,504]);

async function readMapFile<T>(path: string, read: (response: Response) => Promise<T>, signal?: AbortSignal, retry = false): Promise<T> {
  async function attempt(second: boolean): Promise<T> {
    let response: Response | undefined;
    try {
      response = await fetch('./data/' + path, {signal: signal ?? null, ...(second?{cache:'reload'}:{})});
      if (!response.ok) throw new Error(path + ' HTTP ' + response.status);
      return await read(response);
    } catch (error) {
      if (second || !retry || signal?.aborted || !(error instanceof TypeError || (response && transientStatus.has(response.status)))) throw error;
    }
    await new Promise(resolve=>setTimeout(resolve,200));
    signal?.throwIfAborted();
    return attempt(true);
  }
  return attempt(false);
}

export async function loadData<T>(path: string, valid: (v: unknown) => v is T, signal?: AbortSignal, retry = false): Promise<T> {
  const payload: unknown = await readMapFile(path, response=>response.json(), signal, retry);
  if (!valid(payload)) throw new Error('Invalid map data: ' + path);
  return payload;
}

export function parseViewState(raw: string | null): (ViewState & {losses: number}) | null {
  if (raw === null) return null;
  const v: unknown = JSON.parse(raw);
  if (!record(v)) return null;
  const {target, zoom, turn, selected, losses} = v;
  if (!list(target, number) || target.length !== 3 || !number(zoom) || zoom <= 0) return null;
  return {
    target: [target[0], target[1], target[2]], zoom, turn: number(turn) && turn >= 0 && turn < 4 ? turn : 0,
    selected: string(selected) || number(selected) ? selected : null,
    losses: number(losses) ? losses : 0
  };
}
