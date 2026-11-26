import type { Altitude, Bounds, Ring, Sea } from '../data/types.ts';
import { ringIndex } from '../geometry.ts';

/** The visible land diorama and mapped open water use the same coordinate system.
 * The water mesh sits just below the cut edge of the land, including around the quays.
 * Build the polygon indices on the first flight query, after the player leaves the road.
 */
export function makeFlightArea(boundary:Ring,sea:Sea|null,bounds:Bounds,groundAt:Altitude,seaLevel:number){
  let land:ReturnType<typeof ringIndex>|undefined;
  type Contains=ReturnType<typeof ringIndex>;
  let water:{outer:Contains;holes:Contains[]}[]|undefined;
  function onLand(x:number,y:number){
    land??=ringIndex(boundary);
    return land(x,y);
  }
  function onWater(x:number,y:number){
    if(!sea)return false;
    water??=sea.water.map(([outer,...holes])=>({outer:ringIndex(outer),holes:holes.map(ring=>ringIndex(ring))}));
    return water.some(({outer,holes})=>outer(x,y) && !holes.some(hole=>hole(x,y)));
  }
  return {
    flightArea(x:number,y:number){
      return x>=bounds[0] && y>=bounds[1] && x<=bounds[2] && y<=bounds[3] &&
        (onLand(x,y) || onWater(x,y));
    },
    flightGround(x:number,y:number){
      // Outside the land outline the raster extrapolates land heights into the Atlantic.
      // Where land overlaps the sea mesh the higher rendered surface wins.
      if(!onLand(x,y) && onWater(x,y))return seaLevel;
      const height=groundAt(x,y);
      return height<seaLevel && onWater(x,y)?seaLevel:height;
    }
  };
}
