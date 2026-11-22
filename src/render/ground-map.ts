import type { CityData, Point } from '../data/types.ts';
import * as T from 'three';

export interface GroundMap {
  texture: T.Texture<HTMLCanvasElement | OffscreenCanvas | ImageBitmap>;
  bounds: T.Vector4;
  flatRoad?: { mask:T.Texture; color:T.Color };
}


// Ground features share the terrain triangles. Paint their plan-view coverage once.
export function makeGroundMap(data: CityData, decorate?: import('./scene-study.ts').SceneStudy['road'], pixelsPerMetre = data.textureBounds ? 2 : 3): GroundMap {
  const extent = new T.Box2();
  for (const [x, y] of data.boundary) extent.expandByPoint(new T.Vector2(x, y));
  if(data.textureBounds){
    extent.min.fromArray(data.textureBounds);extent.max.fromArray(data.textureBounds,2);
  }
  const size = extent.getSize(new T.Vector2());
  const scale = Math.min(pixelsPerMetre, 2048 / Math.max(size.x, size.y));
  const canvas = typeof document==='undefined'?new OffscreenCanvas(1,1):document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(size.x * scale));
  canvas.height = Math.max(1, Math.ceil(size.y * scale));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context || !('fillRect' in context)) throw new Error('Ground canvas requires a 2D context');
  const ctx = context;
  const sx = canvas.width / size.x, sy = canvas.height / size.y;
  ctx.fillStyle = '#c7bcb2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(sx, 0, 0, -sy, -extent.min.x * sx, extent.max.y * sy);

  function trace(points: Point[]) {
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  }
  for (const s of data.surfaces) {
    ctx.beginPath();
    for (const ring of s.rings) {
      trace(ring);
      ctx.closePath();
    }
    ctx.fillStyle = s.kind === 'park' && !s.paved ? '#728157' :
      s.id === '30801430' ? '#96948f' : '#c0b9af';
    ctx.fill('evenodd');
  }

  const footways = new Set(['steps', 'footway', 'path', 'pedestrian', 'cycleway']);
  const mainRoads = new Set(['primary', 'secondary', 'trunk']);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const pedestrian of [false, true]) {
    for (const road of data.roads) {
      if (footways.has(road.kind) !== pedestrian || road.line.length < 2) continue;
      ctx.lineWidth = pedestrian ? 2.2 : mainRoads.has(road.kind) ? 8 : 4.5;
      ctx.strokeStyle = pedestrian ? '#c6bdb6' : '#626575';
      ctx.beginPath();
      trace(road.line);
      ctx.stroke();
      decorate?.(ctx,road);
    }
  }

  // Contact shadow: the footprints are filled on a coarse mask (about 4 m per pixel) and multiplied back
  // with bilinear scaling, which spreads a soft dark rim a few metres out from every wall. Stroking wide
  // outlines instead costs seconds for the whole city.
  if (data.buildings.length) {
    const coarse = Math.min(1, .25 / Math.max(sx, sy));
    const mask = typeof document==='undefined'?new OffscreenCanvas(1,1):document.createElement('canvas');
    mask.width = Math.max(1, Math.ceil(canvas.width * coarse));
    mask.height = Math.max(1, Math.ceil(canvas.height * coarse));
    const shade = mask.getContext('2d', { alpha: false });
    if (!shade || !('fillRect' in shade)) throw new Error('Ground canvas requires a 2D context');
    shade.fillStyle = '#fff';
    shade.fillRect(0, 0, mask.width, mask.height);
    const mx = mask.width / size.x, my = mask.height / size.y;
    shade.setTransform(mx, 0, 0, -my, -extent.min.x * mx, extent.max.y * my);
    shade.fillStyle = '#8f8a9c';
    for (const b of data.buildings) {
      const outline = b.rings[0];
      shade.beginPath();
      shade.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i++) shade.lineTo(outline[i][0], outline[i][1]);
      shade.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return { texture, bounds: new T.Vector4(extent.min.x, extent.min.y, size.x, size.y) };
}
