import type { Ring } from '../data/types.ts';

export interface BuildingBlock {rings: Ring[]; base: number; top: number}

/** Intersect an upward camera ray with a building's extruded footprint, including courtyards.
 * Coordinates are east/north. dx and dy are horizontal metres per metre of elevation.
 */
export function blocksCamera({rings,base,top}: BuildingBlock,x: number,y: number,height: number,dx: number,dy: number){
  if(top<=height)return false;
  const start=Math.max(0,base-height),stop=top-height;
  const ax=x+dx*start,ay=y+dy*start,bx=x+dx*stop,by=y+dy*stop;
  const vx=bx-ax,vy=by-ay;
  let inside=false;
  for(const ring of rings){
    for(let i=1;i<ring.length;i++){
      const [px,py]=ring[i-1],[qx,qy]=ring[i];
      if((py>ay)!==(qy>ay) && ax<(qx-px)*(ay-py)/(qy-py)+px)inside=!inside;
      const ex=qx-px,ey=qy-py,det=vx*ey-vy*ex;
      if(Math.abs(det)<1e-9)continue;
      const t=((px-ax)*ey-(py-ay)*ex)/det;
      const u=((px-ax)*vy-(py-ay)*vx)/det;
      if(t>=0 && t<=1 && u>=0 && u<=1)return true;
    }
  }
  return inside;
}
