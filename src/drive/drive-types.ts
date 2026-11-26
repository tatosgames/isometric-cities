import type * as T from 'three';
import type { Altitude, CityData, Place, Ring, RoofTones, ZoneData } from '../data/types.ts';
import type { Body } from './drive-physics.ts';
import type { routesFrom } from './road-routing.ts';
import type { Zoning } from './drive-world.ts';
import type { Thrown } from './drive-weapon.ts';

export interface DriveOptions {
  scene: T.Scene;
  camera: T.OrthographicCamera;
  renderer: T.WebGLRenderer;
  host: HTMLElement;
  data: CityData;
  locations: Place[];
  /** Carriageway coverage of the streamed city, for the surface under the wheels. */
  streets?: Ring[][];
  altitude: Altitude;
  groundAt: Altitude;
  view: (target: T.Vector3, zoom: number, offset: T.Vector3) => void;
  mapDirection: T.Vector3;
  compact: boolean;
  busArea: 'city' | 'pilot';
  buses: boolean;
  /** False leaves the streets without patrols: the run has no capture and goes on until the player leaves. */
  police?: boolean;
  /** True keeps the run going when a patrol reaches the player: for the lab. */
  endless?: boolean;
  flightArea: (x:number,y:number)=>boolean;
  flightGround: Altitude;
  flightTerrainCeiling:import('../flight/terrain-ceiling.ts').FlightCeiling;
  redraw: () => void;
  demandLanding: (x:number,y:number)=>boolean;
  releaseLanding: ()=>void;
  onExit: () => void;
  /** Takes a demolished building out of the city meshes, and out of everything loaded later. */
  hideBuilding: (id: number) => void;
  /** Puts it back; false while the city cannot rebuild it yet, to ask again later. */
  showBuilding: (id: number) => boolean;
  /** The city's building material and roof palette, for the pieces of a demolished building. */
  buildingMaterial: T.Material;
  tones: RoofTones | null;
  /** Streamed city: footprints arrive per zone. `resident` holds the zones loaded right now. */
  zoning?: Zoning & {resident: ReadonlyMap<string,ZoneData>};
}

export interface Vehicle extends Body, Thrown {
  mesh: T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
  blob: T.Mesh;
  hop: number;
  wreck: number;
  stuck: number;
  trail: [number,number,number][] | null;
  puff: number;
  /** Pitch shown for the slope of the road, eased. */
  tilt: number;
  /** Surface feel: metres rolled, rumble of the surface (eased) and its strength at this speed, off the road or not,
   * seconds to the next thrown particle and the wheel that throws it. */
  odo: number; rumble: number; shake: number; rough: boolean; debris: number; wheel2: number;
  node: number;
}

export interface Patrol extends Vehicle {
  id: number;
  interceptor: boolean;
  entryUntil?:number;entryPace?:number;
  visibleFor: number;
  role: 'support' | 'interceptor' | 'pursuer';
  target: number;
  hit: number;
  aimX?:number;aimY?:number;
  light: T.Mesh<T.BoxGeometry,T.MeshBasicMaterial>;
}

export type DriveState = 'off' | 'ready' | 'playing' | 'caught';
export type RouteField = ReturnType<typeof routesFrom>;
