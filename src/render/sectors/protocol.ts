import type { TypedArray } from 'three';
import type { Bounds, Layers, RoofTones, Terrain } from '../../data/types.ts';
import type { cityMaterials } from '../city-materials.ts';

export interface WorkerConfig {
  terrain: Terrain;
  compact: boolean;
  neutral: boolean;
  tones: RoofTones | null;
}

export type WorkerRequest = {config: WorkerConfig} | {layers: Layers};
export interface AttributeData {
  array: TypedArray;
  size: number;
  normalized: boolean;
}
export interface GeometryData {
  index: AttributeData | null;
  attributes: Record<string, AttributeData>;
}
export interface MeshData {
  geo: number;
  material: keyof ReturnType<typeof cityMaterials>;
  matrix: AttributeData | null;
  color: AttributeData | null;
  cast: boolean;
  receive: boolean;
}

export type WorkerResult = {geometries: GeometryData[]; meshes: MeshData[]} &
  ({image: ImageBitmap; bounds: Bounds} | {image: null});
export type WorkerReply = WorkerResult | {error: string};
