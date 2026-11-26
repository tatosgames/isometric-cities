import type {RoadNode} from './road-routing.ts';

type RoadWorld={
  nodes:RoadNode[];
  roadSegments(x:number,y:number):Set<number>;
  free(x:number,y:number,r:number):boolean;
  sight(ax:number,ay:number,bx:number,by:number,r:number):boolean;
};
type Entry={x:number;y:number;h:number;node:number};

// Index the pavement itself: a tree at an intersection can make its routing node unusable
// while hundreds of metres of the road are still clear. The geometry is static as zones stream.
export function indexPatrolSegments(nodes:RoadNode[],component:number){
  const size=96,cells=new Map<string,number[]>();
  nodes.forEach((a,id)=>{
    if(a.part!==component)return;
    for(const [next,length] of a.links){
      if(next<=id || !length)continue;
      const b=nodes[next],steps=Math.ceil(length/(size/2)),edge=id*nodes.length+next;
      let previous='';
      for(let i=0;i<=steps;i++){
        const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps;
        const key=Math.floor(x/size)+','+Math.floor(y/size);
        if(key===previous)continue;
        let bucket=cells.get(key);
        if(!bucket){bucket=[];cells.set(key,bucket);}
        bucket.push(edge);previous=key;
      }
    }
  });
  return (x:number,y:number)=>{
    const result=new Set<number>(),cx=Math.floor(x/size),cy=Math.floor(y/size);
    for(let i=cx-1;i<=cx+1;i++)for(let j=cy-1;j<=cy+1;j++){
      for(const edge of cells.get(i+','+j)??[])result.add(edge);
    }
    return result;
  };
}

/** Sample connected road segments ahead, including the middle of a long OSM edge. */
export function straightRoadEntry(world:RoadWorld,player:{x:number;y:number;h:number},
  radius:number,visibilityCost:(x:number,y:number,h:number,ahead:number)=>number):Entry|undefined{
  const fx=Math.cos(player.h),fy=Math.sin(player.h);
  let best:Entry|undefined,bestCost=Infinity;
  for(const edge of world.roadSegments(player.x+103*fx,player.y+103*fy)){
    const id=Math.floor(edge/world.nodes.length),next=edge%world.nodes.length;
    const a=world.nodes[id],b=world.nodes[next],length=Math.hypot(b.x-a.x,b.y-a.y);
    const dx=(b.x-a.x)/length,dy=(b.y-a.y)/length,along=dx*fx+dy*fy;
    if(Math.abs(along)<.85)continue;
    const direction=Math.sign(along),hx=dx*direction,hy=dy*direction,h=Math.atan2(hy,hx);
    for(let ahead=48;ahead<=158;ahead+=10){
      const t=((player.x-a.x)*fx+(player.y-a.y)*fy+ahead)/along;
      if(t<0 || t>length)continue;
      // Enter along the far side of the road in the same direction, leaving a passing lane.
      const cx=a.x+t*dx,cy=a.y+t*dy;
      const side=(cx-player.x)*fy-(cy-player.y)*fx;
      if(Math.abs(side)>14)continue;
      const cost=ahead+3*Math.abs(side)+30*(1-Math.abs(along));
      if(cost>=bestCost)continue;
      for(const offset of [radius*2,-radius*2,0,radius*3.5,-radius*3.5]){
        const x=cx-offset*hy,y=cy+offset*hx;
        if(!world.free(x,y,radius+.3) || !world.sight(x,y,x+10*hx,y+10*hy,radius))continue;
        // A tree between cars can interrupt a diagonal sight ray even on the same carriageway.
        // A parallel street behind a wall still needs an unobstructed connection.
        const gap=Math.abs(side);
        if(gap>5 && !world.sight(player.x,player.y,x,y,radius))continue;
        const score=cost+visibilityCost(x,y,h,ahead);
        if(score>=bestCost)continue;
        best={x,y,h,node:direction>0?next:id};bestCost=score;
        if(score===cost)break;
      }
    }
  }
  return best;
}
