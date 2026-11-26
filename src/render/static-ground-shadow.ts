import {sunOffset} from './city-light.ts';
import * as T from 'three';
import type { Building, Ring } from '../data/types.ts';

type ShadowBuilding = Pick<Building, 'rings' | 'height' | 'heightOverride'>;
type BuildingSource = () => Iterable<ShadowBuilding>;

const PIXELS_PER_METRE = .65;
const MAX_SIZE = 768;
const SLICE_MS = 3;
const SHADOW_AMOUNT = .28;
const SHADOW_X = -sunOffset.x / sunOffset.y;
const SHADOW_NORTH = sunOffset.z / sunOffset.y;
const KEY = 'static-ground-shadow:v2';

/** Shared by every mask: the Matcap look scales the shadow and tints it (black is the plain darkening). */
export const staticShadowStyle = {
  strength: { value: 1 },
  tint: { value: new T.Vector3(0, 0, 0) }
};

interface MaskUniforms {
  map: { value: T.Texture | null };
  bounds: { value: T.Vector4 };
  amount: { value: number };
}

interface Mask {
  readonly bounds: T.Vector4;
  readonly width: number;
  readonly height: number;
  readonly source: BuildingSource;
  readonly refresh: () => void;
  readonly uniforms: MaskUniforms;
  enabled: boolean;
  canvas: HTMLCanvasElement | OffscreenCanvas | null;
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  texture: T.CanvasTexture<HTMLCanvasElement | OffscreenCanvas> | null;
  job: ShadowJob | null;
  disposed: boolean;
}

interface ShadowJob {
  readonly mask: Mask;
  readonly buildings: Iterator<ShadowBuilding>;
  cancelled: boolean;
  done: boolean;
}

const queue: ShadowJob[] = [];
let queueScheduled = false;

function scheduleQueue() {
  if (queueScheduled) return;
  queueScheduled = true;
  setTimeout(runQueue, 0);
}

function runQueue() {
  queueScheduled = false;
  const deadline = performance.now() + SLICE_MS;
  while (queue.length && performance.now() < deadline) {
    const job = queue.shift();
    if (!job || job.cancelled || job.done || job.mask.disposed || !job.mask.enabled) continue;
    const next = job.buildings.next();
    if (next.done) {
      finish(job);
      continue;
    }
    paintBuilding(job.mask, next.value);
    if (!job.cancelled && !job.mask.disposed && job.mask.enabled) queue.push(job);
  }
  if (queue.length) scheduleQueue();
}

function finish(job: ShadowJob) {
  if (job.done || job.cancelled || job.mask.disposed || !job.mask.enabled) return;
  job.done = true;
  job.mask.job = null;
  const texture = job.mask.texture;
  if (texture) texture.needsUpdate = true;
  job.mask.uniforms.amount.value = SHADOW_AMOUNT;
  job.mask.refresh();
}

function validRing(ring: Ring) {
  return ring.length >= 3 && ring.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}

function canvasPoint(mask: Mask, x: number, north: number): [number, number] {
  return [
    (x - mask.bounds.x) * mask.width / mask.bounds.z,
    (mask.bounds.y + mask.bounds.w - north) * mask.height / mask.bounds.w,
  ];
}

function trace(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, points: Array<[number, number]>) {
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

function paintBuilding(mask: Mask, building: ShadowBuilding) {
  const ctx = mask.context;
  if (!ctx || !building || !Array.isArray(building.rings) || !building.rings.every(validRing)) return;
  const height = building.heightOverride ?? building.height;
  if (!Number.isFinite(height) || height <= 0) return;
  const shiftX = height * SHADOW_X;
  const shiftNorth = height * SHADOW_NORTH;
  const ring=building.rings[0];
  if(!ring?.length)return;
  // Neighbouring zones contribute only buildings whose projected extent reaches this tile.
  if(ring.every(([x])=>x+shiftX<mask.bounds.x) || ring.every(([x])=>x>mask.bounds.x+mask.bounds.z) ||
     ring.every(([,y])=>y<mask.bounds.y) || ring.every(([,y])=>y+shiftNorth>mask.bounds.y+mask.bounds.w))return;

  // The roof is filled with even-odd winding, preserving courtyard holes.
  ctx.beginPath();
  for (const ring of building.rings) {
    trace(ctx, ring.map(([x, north]) => canvasPoint(mask, x + shiftX, north + shiftNorth)));
  }
  ctx.fillStyle = '#000';
  ctx.fill('evenodd');

  // The vertical walls sweep each edge from the footprint to the shifted roof.
  // There is intentionally no per-building blur. The canvas texture supplies
  // one stable mask that is filtered once by the terrain shader.
  for (const ring of building.rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      ctx.beginPath();
      trace(ctx, [
        canvasPoint(mask, a[0], a[1]),
        canvasPoint(mask, b[0], b[1]),
        canvasPoint(mask, b[0] + shiftX, b[1] + shiftNorth),
        canvasPoint(mask, a[0] + shiftX, a[1] + shiftNorth),
      ]);
      ctx.fillStyle = '#000';
      ctx.fill();
    }
  }
}

function cancelJob(mask: Mask) {
  if (!mask.job) return;
  mask.job.cancelled = true;
  mask.job = null;
}

function makeCanvas(width: number, height: number) {
  const canvas = typeof document === 'undefined'
    ? new OffscreenCanvas(width, height)
    : document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context || !('fillRect' in context)) throw new Error('Static ground shadow requires a 2D canvas');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  return { canvas, context };
}

function enqueue(mask: Mask) {
  cancelJob(mask);
  if (!mask.enabled || mask.disposed || !mask.context) return;
  const buildings = mask.source();
  const iterator = buildings[Symbol.iterator]();
  const job: ShadowJob = { mask, buildings: iterator, cancelled: false, done: false };
  mask.job = job;
  queue.push(job);
  scheduleQueue();
}

function cancelAndDispose(mask: Mask) {
  cancelJob(mask);
  mask.uniforms.map.value = null;
  mask.uniforms.amount.value = 0;
  mask.texture?.dispose();
  mask.texture = null;
  mask.canvas = null;
  mask.context = null;
}

/**
 * Builds a shared, world-space static shadow mask for terrain materials.
 * Bounds are [worldX, worldNorth, width, height], matching GroundMap.bounds.
 */
export function makeStaticGroundShadow(bounds: T.Vector4, buildings: BuildingSource, refresh: () => void) {
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) || !Number.isFinite(bounds.z) || !Number.isFinite(bounds.w) || bounds.z <= 0 || bounds.w <= 0) {
    throw new RangeError('Static ground shadow bounds must be finite with positive size');
  }
  const safeBounds = bounds.clone();
  const width = Math.max(1, Math.min(MAX_SIZE, Math.ceil(safeBounds.z * PIXELS_PER_METRE)));
  const height = Math.max(1, Math.min(MAX_SIZE, Math.ceil(safeBounds.w * PIXELS_PER_METRE)));
  const uniforms: MaskUniforms = {
    map: { value: null },
    bounds: { value: safeBounds },
    amount: { value: 0 },
  };
  const mask: Mask = {
    bounds: safeBounds, width, height, source: buildings, refresh, uniforms,
    enabled: false, canvas: null, context: null, texture: null, job: null, disposed: false,
  };

  function setEnabled(enabled: boolean) {
    if (mask.disposed || mask.enabled === enabled) return;
    mask.enabled = enabled;
    if (!enabled) {
      cancelAndDispose(mask);
      refresh();
      return;
    }
    const created = makeCanvas(width, height);
    mask.canvas = created.canvas;
    mask.context = created.context;
    mask.texture = new T.CanvasTexture(created.canvas);
    mask.texture.name = 'static-ground-shadow';
    mask.texture.generateMipmaps = false;
    mask.texture.minFilter = T.LinearFilter;
    mask.texture.magFilter = T.LinearFilter;
    mask.texture.wrapS = mask.texture.wrapT = T.ClampToEdgeWrapping;
    mask.texture.colorSpace = T.NoColorSpace;
    mask.uniforms.map.value = mask.texture;
    mask.uniforms.amount.value = 0;
    enqueue(mask);
  }

  function invalidate() {
    if (mask.disposed || !mask.enabled || !mask.context) return;
    cancelJob(mask);
    mask.context.fillStyle = '#fff';
    mask.context.fillRect(0, 0, width, height);
    // The GPU keeps displaying the previous complete image until finish() uploads its replacement.
    enqueue(mask);
  }

  function attach(material: T.Material, terrainOnly = false) {
    const innerCompile = material.onBeforeCompile;
    const innerKey = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      innerCompile.call(material, shader, renderer);
      shader.uniforms.staticGroundShadowMap = uniforms.map;
      shader.uniforms.staticGroundShadowBounds = uniforms.bounds;
      shader.uniforms.staticGroundShadowAmount = uniforms.amount;
      shader.uniforms.staticGroundShadowStrength = staticShadowStyle.strength;
      shader.uniforms.staticGroundShadowTint = staticShadowStyle.tint;
      const condition=terrainOnly?'staticGroundShadowAmount>0. && vKind>5.5 && vKind<100.':'staticGroundShadowAmount>0.';
      const declarations='uniform sampler2D staticGroundShadowMap; uniform vec4 staticGroundShadowBounds; uniform float staticGroundShadowAmount;'
        +' uniform float staticGroundShadowStrength; uniform vec3 staticGroundShadowTint;';
      const sample=`if(${condition}){
        vec2 uv=(vec2(vWind.x,-vWind.y)-staticGroundShadowBounds.xy)/staticGroundShadowBounds.zw;
        float shadow=min(1.,(1.-texture2D(staticGroundShadowMap,uv).r)*staticGroundShadowAmount*staticGroundShadowStrength);
        diffuseColor.rgb*=mix(vec3(1.),staticGroundShadowTint,shadow);
      }`;
      const marker='#include <metalnessmap_fragment>';
      shader.fragmentShader=declarations+'\n'+shader.fragmentShader.replace(marker,sample+'\n'+marker);
    };
    material.customProgramCacheKey = () => `${innerKey}/${KEY}/${terrainOnly ? 'terrain' : 'all'}`;
  }

  return {
    textureBytes:width*height*4,
    get pending(){return mask.job!==null && mask.uniforms.amount.value===0;},
    setEnabled,
    invalidate,
    attach,
    dispose() {
      if (mask.disposed) return;
      mask.disposed = true;
      mask.enabled = false;
      cancelAndDispose(mask);
      refresh();
    },
  };
}
