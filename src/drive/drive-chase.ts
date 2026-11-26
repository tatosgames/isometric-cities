import {wrapAngle} from '../geometry.ts';
import type {buildDriveWorld} from './drive-world.ts';
import type {TUNE} from './drive-tune.ts';

type World=Pick<ReturnType<typeof buildDriveWorld>,'nodes'|'nearestNode'|'sight'|'near'>;
type Driver={x:number;y:number;h:number;vx:number;vy:number;node:number;cornerSpeed?:number;aimX?:number;aimY?:number};
type Target={x:number;y:number;vx:number;vy:number};

/** Track the furthest clear point along the road and brake for its outgoing tangent. */
export function chaseSteer(c:Driver,player:Target,world:World,prev:ArrayLike<number>,tune:Pick<typeof TUNE,'chaserLost'|'chaserSight'|'radius'>){
  const gap=Math.hypot(player.x-c.x,player.y-c.y);
  if(gap>tune.chaserLost)return null;
  const speed=Math.hypot(c.vx,c.vy);
  let tx=player.x+player.vx*.3,ty=player.y+player.vy*.3;
  let limit=Infinity;
  if(gap<=tune.chaserSight && !world.near(tx,ty,tune.radius) && world.sight(c.x,c.y,tx,ty,tune.radius) && world.sight(c.x,c.y,player.x,player.y)){
    c.node=-1;
  }else{
    let id=c.node;
    // A single OSM edge may be over 100 m. Keep its far endpoint until the car reaches the bend.
    if(!world.nodes[id])id=world.nearestNode(c.x,c.y);
    if(id<0)return null;
    let n=world.nodes[id];
    tx=n.x;ty=n.y;
    const look=Math.max(6,Math.min(16,speed*.55));
    for(let hop=0;hop<12 && prev[id]>=0;hop++){
      const next=world.nodes[prev[id]],d=Math.hypot(n.x-c.x,n.y-c.y);
      const length=Math.hypot(next.x-n.x,next.y-n.y);
      if(d>look || !length)break;
      const t=Math.min(1,Math.max(2,look-d)/length);
      const x=n.x+(next.x-n.x)*t,y=n.y+(next.y-n.y)*t;
      if(!world.sight(c.x,c.y,x,y,tune.radius))break;
      tx=x;ty=y;
      id=prev[id];n=next;
      if(t<1)break;
    }
    c.node=id;
    if(prev[id]>=0){
      const next=world.nodes[prev[id]],incoming=Math.atan2(n.y-c.y,n.x-c.x);
      const bend=Math.abs(wrapAngle(Math.atan2(next.y-n.y,next.x-n.x)-incoming));
      if(bend>.35)limit=Math.sqrt((4/bend)**2+14*Math.max(0,Math.hypot(n.x-c.x,n.y-c.y)-2));
    }
  }
  c.aimX=tx;c.aimY=ty;
  const error=wrapAngle(Math.atan2(ty-c.y,tx-c.x)-c.h);
  c.cornerSpeed=Math.min(limit,Math.max(3,6/Math.max(.01,Math.abs(error))));
  return Math.max(-1,Math.min(1,error*1.65));
}
