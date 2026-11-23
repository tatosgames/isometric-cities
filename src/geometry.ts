/** Small plane-geometry helpers shared by the map, the drive and the data checks. Pure, no three.js. */

/** The same angle in (-π, π]: the shortest turn to reach it. */
export const wrapAngle=(a: number)=>Math.atan2(Math.sin(a),Math.cos(a));

/** Even-odd test of (x,y) against a polygon ring, closed or not. */
export function pointInRing(ring: readonly (readonly [number,number])[],x: number,y: number){
  let hit=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [ax,ay]=ring[i],[bx,by]=ring[j];
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax)hit=!hit;
  }
  return hit;
}
