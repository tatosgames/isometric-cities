import type * as T from 'three';
import type { Altitude, CityData, Place, ZoneData } from '../data/types.ts';
import type { Body } from './drive-physics.ts';
import type { routesFrom } from './road-routing.ts';
import type { Zoning } from './drive-world.ts';

export interface DriveOptions {
  scene: T.Scene;
  camera: T.OrthographicCamera;
  renderer: T.WebGLRenderer;
  host: HTMLElement;
  data: CityData;
  locations: Place[];
  altitude: Altitude;
  groundAt: Altitude;
  view: (target: T.Vector3, zoom: number, offset: T.Vector3) => void;
  mapDirection: T.Vector3;
  compact: boolean;
  onExit: () => void;
  /** Streamed city: footprints arrive per zone. `resident` holds the zones loaded right now. */
  zoning?: Zoning & {resident: ReadonlyMap<string,ZoneData>};
}

export interface Vehicle extends Body {
  mesh: T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
  blob: T.Mesh;
  hop: number;
  wreck: number;
  stuck: number;
  trail: [number,number,number][] | null;
  puff: number;
  node: number;
}

export interface Patrol extends Vehicle {
  light: T.Mesh<T.BoxGeometry,T.MeshBasicMaterial>;
}

export type DriveState = 'off' | 'ready' | 'playing' | 'caught';
export type RouteField = ReturnType<typeof routesFrom>;
