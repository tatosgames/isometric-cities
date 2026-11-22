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
  kind: string;
  line: Point[];
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
  values: number[] | Float32Array<ArrayBuffer>;
}

export interface Layers {
  buildings: Building[];
  trees: Point[];
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

// Real sea beside the model, from the OSM coastline. `shore` is the mapped coast, `edge` the cut side of the water.
export interface Sea {
  water: Ring[][];
  shore: Point[][];
  edge: Point[][];
}

export interface Sector {
  id: string;
  bounds: Bounds;
  vertical: [min: number, max: number];
  file: string;
}

export interface SectorIndex {
  sectors: Sector[];
  sectorSize: number;
  buildingOwners: string[];
}

export interface Place {
  properties: {
    id: string;
    name: string;
    areas: Area[];
    xy: Point;
    markerHeight: number;
  };
}

export interface ViewState {
  target: [number, number, number];
  zoom: number;
  selected?: string | number | null;
}
