/** Small plane-geometry helpers shared by the map, the drive and the data checks. Pure, no three.js. */

/** The same angle in (-π, π]: the shortest turn to reach it. */
export const wrapAngle=(a: number)=>Math.atan2(Math.sin(a),Math.cos(a));

/**
 * Share of the remaining gap an exponential chase at `rate` per second closes in `dt` seconds.
 * Unlike `dt*rate` it gives the same motion at 30, 60 or 120 frames a second and never overshoots.
 */
export const approach=(rate: number,dt: number)=>-Math.expm1(-rate*dt);

/** Even-odd test of (x,y) against a polygon ring, closed or not. */
export function pointInRing(ring: readonly (readonly [number,number])[],x: number,y: number){
  let hit=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [ax,ay]=ring[i],[bx,by]=ring[j];
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax)hit=!hit;
  }
  return hit;
}

/** A height grid: dense, or in squares of `tile` cells found through `slots` (see `Terrain`). */
interface HeightGrid {
  origin: readonly [number,number];step: number;stepY?: number;w: number;h: number;
  values: ArrayLike<number>;scale?: number;tile?: number;slots?: ArrayLike<number>;
}
/** The stored value of one cell. A square the grid does not keep reads as sea level. */
function cellOf({w,values,tile,slots}: HeightGrid){
  if(!tile || !slots)return (col: number,row: number)=>values[row*w+col];
  const across=Math.ceil(w/tile);
  return (col: number,row: number)=>{
    const at=slots[Math.floor(row/tile)*across+Math.floor(col/tile)];
    return at<0?0:values[at+(row%tile)*tile+col%tile];
  };
}
/** Bilinear height in metres at a point of the map. */
export function heightAt(grid: HeightGrid){
  const {origin:[west,north],step,w,h}=grid,stepY=grid.stepY||step,scale=grid.scale??1,cell=cellOf(grid);
  const mix=(a: number,b: number,t: number)=>(1-t)*a+t*b;
  return (x: number,y: number)=>{
    const col=Math.min(Math.max((x-west)/step,0),w-1.001),row=Math.min(Math.max((north-y)/stepY,0),h-1.001);
    const c=Math.floor(col),r=Math.floor(row),u=col%1,t=row%1;
    return mix(mix(cell(c,r),cell(c+1,r),u),mix(cell(c,r+1),cell(c+1,r+1),u),t)*scale;
  };
}

/**
 * The part of a height grid under `bounds` (west, south, east, north) and `margin` metres around it, as a dense
 * grid of its own: what a worker needs to build one sector. Outside it the heights repeat the edge.
 */
export function heightWindow(grid: HeightGrid,[west,south,east,north]: readonly [number,number,number,number],margin: number){
  const {origin:[ox,oy],step,w,h}=grid,stepY=grid.stepY||step;
  const c0=Math.max(0,Math.floor((west-margin-ox)/step)),c1=Math.min(w-1,Math.ceil((east+margin-ox)/step));
  const r0=Math.max(0,Math.floor((oy-north-margin)/stepY)),r1=Math.min(h-1,Math.ceil((oy-south+margin)/stepY));
  const cols=Math.max(2,c1-c0+1),rows=Math.max(2,r1-r0+1),whole=grid.values instanceof Int16Array;
  const values=whole?new Int16Array(cols*rows):new Float32Array(cols*rows);
  const cell=cellOf(grid);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)values[r*cols+c]=cell(Math.min(c0+c,w-1),Math.min(r0+r,h-1));
  return {origin:[ox+c0*step,oy-r0*stepY] as [number,number],step,stepY,w:cols,h:rows,values,scale:grid.scale??1};
}
