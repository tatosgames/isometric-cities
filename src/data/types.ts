export type Point = [east: number, north: number];
export type Bounds = [west: number, south: number, east: number, north: number];
export type Ring = Point[];
export type Altitude = (east: number, north: number) => number;
export type Area = 'city' | 'pilot';
export type RoofTones = Record<string, string>;

export interface Building {
  id: number;
  rings: Ring[];
  height: number;
  heightOverride?: number;
  wallColor?: string;
  toneSuffix?: string;
  roofFurniture?: boolean;
  windows?: boolean;
  landmark?: string;
}

export interface Road {
  id?:string;
  name?: string | null;
  bridge?: string;
  layer?: string;
  kind: string;
  line: Point[];
}

export interface Barrio {
  name: string;
  polygons: Ring[][];
}

export interface Surface {
  id: string;
  kind: string;
  paved?: boolean;
  rings: Ring[];
}

export interface Terrain {
  origin: Point;
  step: number;
  stepY?: number;
  w: number;
  h: number;
  values: number[] | Float32Array<ArrayBuffer> | Int16Array<ArrayBuffer>;
  // Metres per stored unit: the city grid keeps its decimetres as 16-bit integers.
  scale?: number;
}

export interface Carriageway {
  positions:number[];
  indices:number[];
  fallback:Ring[][];
}
// A port object mapped in OpenStreetMap: kind, easting, northing, heading in radians and size.
export type Prop = [kind: string, x: number, y: number, angle: number, size: number];

export interface Layers {
  carriageway?:Carriageway;
  buildings: Building[];
  // Dense sectors only: the same buildings with similar neighbours joined, drawn by the small-screen profile.
  fused?: Building[];
  trees: Point[];
  props?: Prop[];
  ground: Ring[];
  roads: Road[];
  surfaces: Surface[];
  textureBounds?: Bounds;
}

export interface CityData extends Layers {
  boundary: Ring;
  terrain: Terrain;
  focus?: string | null;
}

// Open water and mapped coastline from OSM.
export interface Sea {
  water: Ring[][];
  shore: Point[][];
}

export interface Sector {
  id: string;
  bounds: Bounds;
  vertical: [min: number, max: number];
  file: string;
}

// One prism per city block, shown while the zone that holds its buildings is not loaded.
export interface FarBlock {
  ring: Ring;
  height: number;
  tone: string;
}

export interface FarZone {
  blocks: FarBlock[];
  ground: Ring[];
}

// Everything the city viewer needs before any zone arrives. Buildings, trees and ground stay empty.
export interface CityCore extends CityData {
  far: Record<string, FarZone>;
}

export interface Zone {
  id: string;
  bounds: Bounds;
  vertical: [min: number, max: number];
  file: string;
}

// Per-building overview and collision footprints of one zone. `owners` names the sector of each building.
export interface ZoneData {
  buildings: Building[];
  owners: string[];
  trees: Point[];
  props?: Prop[];
  // Street coverage clipped to the zone, for its ground texture.
  coverage?: Ring[][];
  ground: Ring[];
}

export interface SectorIndex {
  carriageways?: boolean;
  roadExceptions?:string[];
  roadCoverage?:Ring[][];
  roadFallback?:Ring[][];
  sectors: Sector[];
  sectorSize: number;
  zones: Zone[];
  zoneSize: number;
  buildingCount: number;
}

export interface Place {
  properties: {
    id: string;
    name: string;
    areas: Area[];
    xy: Point;
    markerHeight: number;
    card?: PlaceCard;
  };
}

/** What the place card shows beyond the name. The photo is a file in `public/photos`. */
export interface PlaceCard {
  /** Spanish, 400 to 600 characters: `check-data` enforces it. */
  text: string;
  link: string;
  photo?: {file: string; author: string; license: string; source: string};
}

export interface ViewState {
  target: [number, number, number];
  zoom: number;
  turn: number;
  selected?: string | number | null;
}
