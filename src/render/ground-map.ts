import type { CityData, Point, Ring } from '../data/types.ts';
import style from '../data/road-style.json';
import * as T from 'three';

export interface GroundMap {
  texture: T.Texture<HTMLCanvasElement | OffscreenCanvas | ImageBitmap>;
  bounds: T.Vector4;
  contactAt?: (x:number,y:number)=>number;
}


// Ground features share the terrain triangles. Paint their plan-view coverage once.
export function makeGroundMap(data: CityData, pixelsPerMetre = data.textureBounds ? 2 : 3, streetPriority=!!data.carriageway, fallback=data.carriageway?.fallback, coverage?:Ring[][]): GroundMap {
  const extent = new T.Box2();
  for (const [x, y] of data.boundary) extent.expandByPoint(new T.Vector2(x, y));
  if(data.textureBounds){
    extent.min.fromArray(data.textureBounds);extent.max.fromArray(data.textureBounds,2);
  }
  const size = extent.getSize(new T.Vector2());
  const scale = Math.min(pixelsPerMetre, 2048 / Math.max(size.x, size.y));
  function paintCanvas(width: number,height: number,background: string) {
    const canvas = typeof document==='undefined'?new OffscreenCanvas(1,1):document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(width));
    canvas.height = Math.max(1, Math.ceil(height));
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx || !('fillRect' in ctx)) throw new Error('Ground canvas requires a 2D context');
    const sx = canvas.width / size.x, sy = canvas.height / size.y;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(sx, 0, 0, -sy, -extent.min.x * sx, extent.max.y * sy);
    return {canvas,ctx,sx,sy};
  }
  const {canvas,ctx,sx,sy} = paintCanvas(size.x * scale,size.y * scale,'#c7bcb2');

  function trace(points: Point[],brush = ctx) {
    brush.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) brush.lineTo(points[i][0], points[i][1]);
  }
  for (const s of data.surfaces) {
    ctx.beginPath();
    for (const ring of s.rings) {
      trace(ring);
      ctx.closePath();
    }
    ctx.fillStyle = s.kind === 'beach' ? style.color.beach : s.kind === 'water' ? style.color.water : s.kind === 'park' && !s.paved ? '#728157' :
      s.id === '30801430' ? '#96948f' : '#c0b9af';
    ctx.fill('evenodd');
  }

  const footways = new Set(style.pedestrian);
  const mainRoads = new Set(style.main);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const passes = streetPriority ? [true,false,...(fallback?.length ? [true] : [])] : [false,true];
  for (const [pass,pedestrian] of passes.entries()) {
    ctx.save();
    if(!pedestrian && coverage){
      ctx.beginPath();
      for(const polygon of coverage)for(const ring of polygon){trace(ring);ctx.closePath();}
      ctx.fillStyle=style.color.street;
      ctx.fill('evenodd');
    }
    if((!pedestrian && (data.carriageway || coverage)) || pass===2){
      ctx.beginPath();
      for(const polygon of fallback ?? [])for(const ring of polygon){trace(ring);ctx.closePath();}
      ctx.clip('evenodd');
    }
    for (const road of data.roads) {
      if (footways.has(road.kind) !== pedestrian || road.line.length < 2) continue;
      ctx.lineWidth = pedestrian ? style.width.pedestrian : mainRoads.has(road.kind) ? style.width.main : style.width.street;
      ctx.strokeStyle = pedestrian ? style.color.pedestrian : style.color.street;
      ctx.lineCap = road.portal ? 'butt' : 'round';
      ctx.beginPath();
      trace(road.line);
      ctx.stroke();
    }
    ctx.restore();
  }
  // A named seafront promenade reads as one: its real width in terracotta paving, with the pale band down the middle.
  const promenades = new Set(style.promenade.names);
  for (const [width,colour] of [[style.promenade.width,style.promenade.color],[1.1,style.promenade.band]] as const) {
    ctx.lineWidth = width;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    for (const road of data.roads) if (road.name && promenades.has(road.name) && road.line.length > 1) trace(road.line);
    ctx.stroke();
  }

  let contactAt:GroundMap['contactAt'];
  // Contact shadow: the footprints are filled on a coarse mask (about 4 m per pixel) and multiplied back
  // with bilinear scaling, which spreads a soft dark rim a few metres out from every wall. Stroking wide
  // outlines instead costs seconds for the whole city.
  if (data.buildings.length) {
    const coarse = Math.min(1, .25 / Math.max(sx, sy));
    const {canvas:mask,ctx:shade,sx:mx,sy:my} = paintCanvas(canvas.width * coarse,canvas.height * coarse,'#fff');
    shade.fillStyle = '#8f8a9c';
    for (const b of data.buildings) {
      shade.beginPath();
      trace(b.rings[0],shade);
      shade.fill();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mask, 0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
    if(data.carriageway?.indices.length){
      const pixels=shade.getImageData(0,0,mask.width,mask.height).data,w=mask.width,h=mask.height;
      contactAt=(x,y)=>{
        const u=T.MathUtils.clamp((x-extent.min.x)*mx-.5,0,w-1),v=T.MathUtils.clamp((extent.max.y-y)*my-.5,0,h-1);
        const read=(i:number,j:number)=>pixels[(Math.min(j,h-1)*w+Math.min(i,w-1))*4]/255;
        const i=Math.floor(u),j=Math.floor(v);
        return T.MathUtils.lerp(T.MathUtils.lerp(read(i,j),read(i+1,j),u-i),T.MathUtils.lerp(read(i,j+1),read(i+1,j+1),u-i),v-j);
      };
    }
  }

  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return { texture,...(contactAt?{contactAt}:{}), bounds: new T.Vector4(extent.min.x, extent.min.y, size.x, size.y) };
}
