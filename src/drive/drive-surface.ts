import type { Point, Ring, Road, Surface } from '../data/types.ts';
import style from '../data/road-style.json';
import { ASPHALT, PAVING } from './drive-tune.ts';

// Tiles of 128 m at 2 pixels per metre, painted when first asked for and kept for the last 36 used.
const TILE=128,PER_METRE=2,PIXELS=TILE*PER_METRE,KEEP=36;
// The class is painted as a level of red this far apart. The soft edge between two classes is a level in between,
// which could read as a third: edge pixels take the class of a neighbour instead.
const LEVEL=60,NONE=255;

type Box=[number,number,number,number];
interface Shape {box: Box;draw: (ctx: Ctx,tile: Box)=>void}
type Ctx=OffscreenCanvasRenderingContext2D|CanvasRenderingContext2D;

function classOf(s: Surface){
  if(s.kind==='beach')return 4;
  if(s.ground==='earth')return 3;
  if(s.ground==='grass' || s.ground==='pitch' || (s.kind==='park' && !s.paved && !s.ground))return 2;
  return PAVING;
}
function boxOf(rings: Iterable<Point[]>,pad=0): Box{
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const ring of rings)for(const [x,y] of ring){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  return [x0-pad,y0-pad,x1+pad,y1+pad];
}
// A ring cut to a rectangle, one side at a time. Each ring of a shape is cut on its own: inside the rectangle
// the even-odd fill of the pieces is the fill of the whole, and the street coverage has rings of 30 000 points.
function clip(ring: Point[],[x0,y0,x1,y1]: Box){
  let points=ring;
  for(const [axis,limit,keepBelow] of [[0,x0,false],[0,x1,true],[1,y0,false],[1,y1,true]] as const){
    if(!points.length)break;
    const out: Point[]=[],inside=(p: Point)=>keepBelow?p[axis]<=limit:p[axis]>=limit;
    for(let k=0;k<points.length;k++){
      const a=points[k],b=points[(k+1)%points.length],inA=inside(a),inB=inside(b);
      if(inA)out.push(a);
      if(inA!==inB){
        const t=(limit-a[axis])/(b[axis]-a[axis]);
        out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);
      }
    }
    points=out;
  }
  return points;
}
function trace(ctx: Ctx,points: Point[]){
  ctx.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
}

/**
 * The surface under any point of the city, from the same sources as the painted ground: the carriageways
 * (`streets`, or the road lines at their drawn width), the pedestrian ways and the mapped surfaces.
 * Returns null where there is no canvas to paint with (the tests in Node), and every car then rolls on asphalt.
 */
export function makeSurfaceMap(roads: Road[],surfaces: Surface[],streets?: Ring[][]){
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(PIXELS,PIXELS)
    :typeof document!=='undefined'?Object.assign(document.createElement('canvas'),{width:PIXELS,height:PIXELS}):null;
  const ctx=canvas?.getContext('2d',{alpha:false,willReadFrequently:true}) as Ctx|null|undefined;
  if(!ctx)return null;
  // Painted in order, each layer over the previous one.
  const layers: Shape[][]=[];
  const fill=(level: number,rings: Ring[])=>(c: Ctx,tile: Box)=>{
    c.fillStyle=`rgb(${level*LEVEL},0,0)`;c.beginPath();
    for(const ring of rings){
      const points=ring.length>64?clip(ring,tile):ring;
      if(points.length>2){trace(c,points);c.closePath();}
    }
    c.fill('evenodd');
  };
  const stroke=(level: number,width: number,line: Point[])=>(c: Ctx)=>{
    c.strokeStyle=`rgb(${level*LEVEL},0,0)`;c.lineWidth=width;c.beginPath();trace(c,line);c.stroke();
  };
  layers.push(surfaces.filter(s=>s.kind!=='water').map(s=>({box:boxOf(s.rings),draw:fill(classOf(s),s.rings)})));
  const footways=new Set(style.pedestrian),main=new Set(style.main);
  const lines=(pedestrian: boolean)=>roads.filter(r=>footways.has(r.kind)===pedestrian && r.line.length>1).map(r=>{
    const width=pedestrian?style.width.pedestrian:main.has(r.kind)?style.width.main:style.width.street;
    return {box:boxOf([r.line],width/2),draw:stroke(pedestrian?PAVING:ASPHALT,width,r.line)};
  });
  layers.push(lines(true),lines(false));

  // Each shape is listed in the tiles its box touches, so a tile paints only what reaches it.
  const index=new Map<string,Shape[][]>();
  layers.forEach((shapes,layer)=>{
    for(const shape of shapes){
      const [x0,y0,x1,y1]=shape.box;
      for(let i=Math.floor(x0/TILE);i<=Math.floor(x1/TILE);i++)for(let j=Math.floor(y0/TILE);j<=Math.floor(y1/TILE);j++){
        const key=i+','+j;let list=index.get(key);
        if(!list){list=layers.map(()=>[]);index.set(key,list);}
        list[layer].push(shape);
      }
    }
  });
  // The street coverage is listed ring by ring and filled once per tile: its polygons never overlap, so the
  // even-odd fill of all the rings that reach a tile is the fill of the whole.
  const streetRings=new Map<string,Ring[]>();
  for(const ring of (streets??[]).flat()){
    const [x0,y0,x1,y1]=boxOf([ring]);
    for(let i=Math.floor(x0/TILE);i<=Math.floor(x1/TILE);i++)for(let j=Math.floor(y0/TILE);j<=Math.floor(y1/TILE);j++){
      const key=i+','+j,list=streetRings.get(key);
      if(list)list.push(ring);else streetRings.set(key,[ring]);
    }
  }
  const tiles=new Map<string,Uint8Array>();
  function paint(i: number,j: number){
    const key=i+','+j;
    const known=tiles.get(key);
    if(known){tiles.delete(key);tiles.set(key,known);return known;}
    const c=ctx as Ctx;
    c.setTransform(1,0,0,1,0,0);
    c.fillStyle=`rgb(${PAVING*LEVEL},0,0)`;c.fillRect(0,0,PIXELS,PIXELS);
    // North up: canvas rows run south from the top edge of the tile.
    c.setTransform(PER_METRE,0,0,-PER_METRE,-i*TILE*PER_METRE,(j+1)*TILE*PER_METRE);
    c.lineJoin='round';c.lineCap='round';
    // Cut a little outside the tile, so no cut edge is ever drawn inside it.
    const tile: Box=[i*TILE-2,j*TILE-2,(i+1)*TILE+2,(j+1)*TILE+2];
    for(const layer of index.get(key)??[])for(const shape of layer)shape.draw(c,tile);
    const rings=streetRings.get(key);
    if(rings)fill(ASPHALT,rings)(c,tile);
    const rgba=c.getImageData(0,0,PIXELS,PIXELS).data,classes=new Uint8Array(PIXELS*PIXELS);
    for(let k=0;k<classes.length;k++){
      const r=rgba[k*4],level=Math.round(r/LEVEL);
      classes[k]=Math.abs(r-level*LEVEL)<=4?level:NONE;
    }
    // Two passes, forwards and backwards, fill the edges (a pixel or two wide) from the pixels beside them.
    for(const forward of [true,false]){
      for(let n=0;n<classes.length;n++){
        const k=forward?n:classes.length-1-n;
        if(classes[k]!==NONE)continue;
        const x=k%PIXELS,side=forward?-1:1;
        const near=[x+side>=0 && x+side<PIXELS?k+side:-1,k+side*PIXELS];
        for(const m of near)if(m>=0 && m<classes.length && classes[m]!==NONE){classes[k]=classes[m];break;}
      }
    }
    for(let k=0;k<classes.length;k++)if(classes[k]===NONE)classes[k]=PAVING;
    tiles.set(key,classes);
    if(tiles.size>KEEP)tiles.delete(tiles.keys().next().value as string);
    return classes;
  }
  return {
    /** Surface class at a point: an index into SURFACES. */
    at(x: number,y: number){
      const i=Math.floor(x/TILE),j=Math.floor(y/TILE),classes=paint(i,j);
      const u=Math.min(PIXELS-1,Math.floor((x-i*TILE)*PER_METRE)),v=Math.min(PIXELS-1,Math.floor(((j+1)*TILE-y)*PER_METRE));
      return classes[v*PIXELS+u];
    },
    /** Paints, at most, the one missing tile the car is heading into, so the step that enters it does not. */
    prefetch(x: number,y: number,vx: number,vy: number){
      const ahead=Math.min(2,Math.hypot(vx,vy)*.08);
      for(const [px,py] of [[x,y],[x+vx*ahead+Math.sign(vx)*20,y+vy*ahead+Math.sign(vy)*20]]){
        const key=Math.floor(px/TILE)+','+Math.floor(py/TILE);
        if(!tiles.has(key)){paint(Math.floor(px/TILE),Math.floor(py/TILE));return;}
      }
    },
    tiles: ()=>tiles.size
  };
}
export type SurfaceMap=NonNullable<ReturnType<typeof makeSurfaceMap>>;
