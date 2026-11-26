import type { TypedArray } from 'three';
import type { Bounds, Layers, RoofTones, Terrain } from '../../data/types.ts';
import type { cityMaterials } from '../city-materials.ts';

export interface WorkerConfig {
  compact: boolean;
  neutral: boolean;
  tones: RoofTones | null;
  /** Report where each building lies in the merged meshes (demolition lab): see `WorkerResult.ranges`. */
  track?: boolean;
}

/** A build carries the heights under its own sector: the worker never holds the grid of the whole city. */
export type WorkerRequest = {config: WorkerConfig} | {layers: Layers; terrain: Terrain};
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

/** `ranges`: quadruples of building id, mesh index, first vertex and vertex count, when the worker tracks them. */
export type WorkerResult = {geometries: GeometryData[]; meshes: MeshData[]; ranges: Int32Array | null} &
  ({image: ImageBitmap; bounds: Bounds} | {image: null});
export type WorkerReply = WorkerResult | {error: string};
