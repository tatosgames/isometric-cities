import * as T from 'three';
import type { Building, Point, Ring } from '../data/types.ts';
import { nearestOnRing, pointInRing } from '../geometry.ts';

/**
 * 2.5D fracture of a building. A building is its footprint pushed up to a height, so it breaks in plan: Voronoi
 * cells seeded inside the footprint (denser where it was hit) are cut by the footprint itself, and each column is
 * sliced into storeys with seams that do not line up from cell to cell. Every piece is a small prism; neighbours
 * share their faces, so the building first reads as one object coming apart, as the jigsaw of `smash-royale`.
 */
export interface Chunk {
  /** Vertices around `centre`, non-indexed triangles in world axes (x east, y up, z south). */
  positions: Float32Array;
  colors: Uint8Array;
  /** The `surface` attribute of the building material: 4 on a roof, 0 elsewhere. */
  surface: Uint8Array;
  centre: T.Vector3;
  /** Half the height of the piece, and the radius of its plan around `centre`. */
  half: number;
  radius: number;
}

export interface FractureInput {
  building: Building;
  /** Ground under the first corner of the footprint: where `makeCity` stands the walls. */
  base: number;
  /** The hit point in plan (east, north). */
  impact: Point;
  wall: T.ColorRepresentation;
  roof: T.ColorRepresentation;
}

/** The colour of the broken inside, bare concrete and brick dust; a storey; at most this many pieces a building. */
const CUT='#a59d90',STOREY=3.2,BUDGET=110;

/** The outline of a footprint, open and counter-clockwise. */
function footprint(b: Building){
  const ring=b.rings[0],last=ring[ring.length-1],closed=ring.length>1 && last[0]===ring[0][0] && last[1]===ring[0][1];
  const outer=closed?ring.slice(0,-1):ring.slice();
  return signedArea(outer)<0?outer.reverse():outer;
}

export function fractureBuilding({building,base,impact,wall,roof}: FractureInput): Chunk[] {
  const outer=footprint(building);
  const holes=building.rings.slice(1);
  const area=Math.abs(signedArea(outer));
  if(outer.length<3 || area<1)return [];
  const height=building.heightOverride??building.height;
  // Fewer, larger cells on a small house; the storeys take what the cells leave of the budget.
  const cells=Math.round(T.MathUtils.clamp(area/45,5,14));
  const seeds=seedPoints(outer,holes,cells,impact);
  const layers=Math.max(1,Math.min(Math.ceil(height/STOREY),Math.floor(BUDGET/Math.max(1,seeds.length))));
  const box=bounds(outer,2);
  const colours={wall:rgb(wall),roof:rgb(roof),cut:rgb(CUT)};
  const chunks: Chunk[]=[];
  for(let i=0;i<seeds.length;i++){
    let cell: Point[]=box;
    for(let j=0;j<seeds.length && cell.length;j++){
      if(i!==j)cell=clipHalfPlane(cell,seeds[i],seeds[j]);
    }
    if(cell.length<3)continue;
    const piece=clipPolygon(outer,cell);
    if(piece.length<3 || Math.abs(signedArea(piece))<.6)continue;
    const [cx,cy]=centroid(piece);
    if(holes.some(h=>pointInRing(h,cx,cy)))continue;
    // Seams of this column: storeys of the same height everywhere, each shifted by up to a third of a storey.
    const cuts=[base-.5];
    for(let k=1;k<layers;k++)cuts.push(base+height*k/layers+(Math.random()-.5)*.6*height/layers);
    cuts.push(base+height);
    for(let k=0;k<layers;k++)chunks.push(prism(piece,outer,cuts[k],cuts[k+1],k===layers-1,colours));
  }
  return chunks;
}

/** The rubble left on the footprint: one low prism, `height` metres above `base`, holes filled. */
export function rubbleSlab(building: Building,base: number,height: number,colour: T.ColorRepresentation): Chunk[] {
  const outer=footprint(building);
  if(outer.length<3)return [];
  const c=rgb(colour);
  return [prism(outer,outer,base-.5,base+height,false,{wall:c,roof:c,cut:c})];
}

type Rgb=[number,number,number];
function rgb(colour: T.ColorRepresentation): Rgb {
  const c=new T.Color(colour);
  return [Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255)];
}

/** One piece: walls from `y0` to `y1` round the plan `piece`, the outer ones painted as the building. */
function prism(piece: Point[],outer: Point[],y0: number,y1: number,top: boolean,colours: {wall: Rgb;roof: Rgb;cut: Rgb}): Chunk {
  const [cx,cy]=centroid(piece),cyMid=(y0+y1)/2;
  const positions: number[]=[],colors: number[]=[],surface: number[]=[];
  const vertex=([e,n]: Point,y: number,colour: Rgb,kind: number)=>{
    positions.push(e-cx,y-cyMid,-(n-cy));colors.push(...colour);surface.push(kind);
  };
  let radius=0;
  for(let i=0;i<piece.length;i++){
    const a=piece[i],b=piece[(i+1)%piece.length];
    radius=Math.max(radius,Math.hypot(a[0]-cx,a[1]-cy));
    // A side on the footprint's edge is the old facade; one along a Voronoi seam is the broken inside.
    const colour=nearestOnRing(outer,(a[0]+b[0])/2,(a[1]+b[1])/2).distance<.02?colours.wall:colours.cut;
    vertex(a,y0,colour,0);vertex(b,y0,colour,0);vertex(b,y1,colour,0);
    vertex(a,y0,colour,0);vertex(b,y1,colour,0);vertex(a,y1,colour,0);
  }
  const lid=top?colours.roof:colours.cut,kind=top?4:0;
  for(const [a,b,c] of T.ShapeUtils.triangulateShape(piece.map(([e,n])=>new T.Vector2(e,n)),[])){
    vertex(piece[a],y1,lid,kind);vertex(piece[b],y1,lid,kind);vertex(piece[c],y1,lid,kind);
    vertex(piece[a],y0,colours.cut,0);vertex(piece[c],y0,colours.cut,0);vertex(piece[b],y0,colours.cut,0);
  }
  return {positions:Float32Array.from(positions),colors:Uint8Array.from(colors),surface:Uint8Array.from(surface),
    centre:new T.Vector3(cx,cyMid,-cy),half:(y1-y0)/2,radius};
}

/** Half of the seeds anywhere in the footprint, half gathered round the hit: smaller pieces where it struck. */
function seedPoints(outer: Point[],holes: Ring[],count: number,[ix,iy]: Point): Point[] {
  const [[west,south],,[east,north]]=bounds(outer,0);
  const spread=Math.max(3,Math.min(east-west,north-south)*.3);
  const inside=(x: number,y: number)=>pointInRing(outer,x,y) && !holes.some(h=>pointInRing(h,x,y));
  const seeds: Point[]=[];
  for(let tries=0;seeds.length<count && tries<count*40;tries++){
    const near=seeds.length%2===1;
    const x=near?ix+(Math.random()-.5)*2*spread:west+Math.random()*(east-west);
    const y=near?iy+(Math.random()-.5)*2*spread:south+Math.random()*(north-south);
    if(inside(x,y) && seeds.every(([sx,sy])=>Math.hypot(sx-x,sy-y)>1.2))seeds.push([x,y]);
  }
  return seeds;
}

function signedArea(p: Point[]){
  let a=0;
  for(let i=0;i<p.length;i++){const [x0,y0]=p[i],[x1,y1]=p[(i+1)%p.length];a+=x0*y1-x1*y0;}
  return a/2;
}
function centroid(p: Point[]): Point {
  let x=0,y=0,a=0;
  for(let i=0;i<p.length;i++){
    const [x0,y0]=p[i],[x1,y1]=p[(i+1)%p.length],k=x0*y1-x1*y0;
    a+=k;x+=(x0+x1)*k;y+=(y0+y1)*k;
  }
  if(Math.abs(a)<1e-9)return [p.reduce((s,q)=>s+q[0],0)/p.length,p.reduce((s,q)=>s+q[1],0)/p.length];
  return [x/(3*a),y/(3*a)];
}
function bounds(p: Point[],margin: number): Point[] {
  let w=Infinity,s=Infinity,e=-Infinity,n=-Infinity;
  for(const [x,y] of p){w=Math.min(w,x);s=Math.min(s,y);e=Math.max(e,x);n=Math.max(n,y);}
  return [[w-margin,s-margin],[e+margin,s-margin],[e+margin,n+margin],[w-margin,n+margin]];
}

/** The part of `poly` nearer to `own` than to `other`: one Voronoi bisector. */
function clipHalfPlane(poly: Point[],own: Point,other: Point): Point[] {
  const nx=other[0]-own[0],ny=other[1]-own[1];
  const d=(nx*(own[0]+other[0])+ny*(own[1]+other[1]))/2;
  return clipBy(poly,([x,y])=>d-(nx*x+ny*y));
}
/** Sutherland–Hodgman: `subject` (a simple polygon) cut by `clip`, a convex Voronoi cell, counter-clockwise. */
function clipPolygon(subject: Point[],clip: Point[]): Point[] {
  let out=subject;
  for(let i=0;i<clip.length && out.length;i++){
    const [ax,ay]=clip[i],[bx,by]=clip[(i+1)%clip.length];
    out=clipBy(out,([x,y])=>(bx-ax)*(y-ay)-(by-ay)*(x-ax));
  }
  return out;
}
/** Keeps the side of `poly` where `side` is not negative. */
function clipBy(poly: Point[],side: (p: Point) => number): Point[] {
  const out: Point[]=[];
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length],sa=side(a),sb=side(b);
    if(sa>=0)out.push(a);
    if((sa>=0)!==(sb>=0)){const t=sa/(sa-sb);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
  }
  return out;
}
