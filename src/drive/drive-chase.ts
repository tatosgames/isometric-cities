import { MathUtils } from 'three';
import { wrapAngle as wrap } from '../geometry.ts';
import type { buildDriveWorld } from './drive-world.ts';
import type { TUNE } from './drive-tune.ts';

type World = Pick<ReturnType<typeof buildDriveWorld>, 'nodes' | 'nearestNode' | 'sight' | 'near'>;

/**
 * Where a patrol turns its wheel, from -1 to 1: at the player when it sees them, along the road graph
 * otherwise. `prev` is the route field towards the player. Null when the player is out of reach.
 */
export function chaseSteer(c: {x: number;y: number;h: number;node: number},player: {x: number;y: number;vx: number;vy: number},
  world: World,prev: ArrayLike<number>,tune: Pick<typeof TUNE, 'chaserLost' | 'chaserSight'>){
  let tx=player.x+player.vx*.4,ty=player.y+player.vy*.4;
  const gap=Math.hypot(player.x-c.x,player.y-c.y);
  if(gap>tune.chaserLost)return null;
  if(gap>tune.chaserSight || !world.sight(c.x,c.y,player.x,player.y)){
    // Follow the road graph node by node: straight lines between nodes stay clear of buildings.
    let n=world.nodes[c.node];
    if(!n || Math.hypot(n.x-c.x,n.y-c.y)>60){c.node=world.nearestNode(c.x,c.y);n=world.nodes[c.node];}
    for(let hop=0;hop<3 && prev[c.node]>=0 && Math.hypot(n.x-c.x,n.y-c.y)<5;hop++){c.node=prev[c.node];n=world.nodes[c.node];}
    tx=n.x;ty=n.y;
  }else c.node=-1;
  let turn=MathUtils.clamp(wrap(Math.atan2(ty-c.y,tx-c.x)-c.h)*2.5,-1,1);
  for(const side of [-1,1])if(world.near(c.x+Math.cos(c.h+side*.45)*6,c.y+Math.sin(c.h+side*.45)*6,1.2))turn-=side*.9;
  return MathUtils.clamp(turn,-1,1);
}
