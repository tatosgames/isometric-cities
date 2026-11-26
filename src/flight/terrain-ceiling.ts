import type { Ring, Terrain } from '../data/types.ts';
import { cellOf } from '../geometry.ts';

export type FlightCeiling=(west:number,south:number,east:number,north:number)=>number;

/** Every rendered ground triangle interpolates raster heights at the vertices of one ring.
 * A tile's ceiling includes the whole span of those rings and the bilinear raster neighbours.
 */
export function makeTerrainCeiling(grid:Terrain,seaLevel:number){
  const size=64,cache=new Map<string,number>(),read=cellOf(grid);
  let span=0;
  function include(rings:Ring[]){
    let widest=span;
    for(const ring of rings){
      let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
      for(const [px,py] of ring){
        const x=Math.fround(px),y=Math.fround(py);
        west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,y);north=Math.max(north,y);
      }
      widest=Math.max(widest,east-west,north-south);
    }
    if(widest>span){span=widest;cache.clear();}
  }
  const {origin:[ox,oy],step,w,h}=grid,stepY=grid.stepY||step,scale=grid.scale??1;
  const clamp=(i:number,n:number)=>Math.min(Math.max(0,i),n-1);
  function tile(cx:number,cy:number){
    const key=cx+','+cy,stored=cache.get(key);
    if(stored!==undefined)return stored;
    // heightAt clamps to the last interpolation interval even beyond the grid edge.
    const c0=Math.min(w-2,clamp(Math.floor((cx*size-span-ox)/step),w));
    const c1=Math.max(1,clamp(Math.ceil(((cx+1)*size+span-ox)/step),w));
    const r0=Math.min(h-2,clamp(Math.floor((oy-(cy+1)*size-span)/stepY),h));
    const r1=Math.max(1,clamp(Math.ceil((oy-cy*size+span)/stepY),h));
    let top=seaLevel;
    for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++)top=Math.max(top,read(col,row)*scale);
    // Rendered vertices use float32 and triangle sampling tolerates rounding at shared edges.
    top+=Math.max(.001,Math.abs(top)*1e-6);
    cache.set(key,top);return top;
  }
  const ceiling:FlightCeiling=(west,south,east,north)=>{
    let top=seaLevel;
    for(let cx=Math.floor(west/size);cx<=Math.floor(east/size);cx++)
      for(let cy=Math.floor(south/size);cy<=Math.floor(north/size);cy++)top=Math.max(top,tile(cx,cy));
    return top;
  };
  return {include,ceiling};
}
