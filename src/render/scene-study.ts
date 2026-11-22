import type { Building, Road, Altitude } from '../data/types.ts';
import type { BufferGeometry, Material } from 'three';

// Optional authoring hooks. Games using the normal renderer supply none.
export interface SceneStudy {
  road?: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, road: Road) => void;
  foundation?: (b: Building, altitude: Altitude) => {base: number; walls: BufferGeometry} | undefined;
  roof?: (b: Building) => Material | undefined;
  furniture?: boolean;
  frontage?: (b: Building, edge: number) => number | undefined;
  covered?: (b: Building, edge: number, from: number, to: number, top: number) => boolean;
  tree?: (x: number,y: number) => {width: number;height: number;palm?: boolean} | undefined;
}
