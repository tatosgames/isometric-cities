import {wrapAngle} from '../geometry.ts';
import type {RoadNode} from './road-routing.ts';

type Position = {x:number;y:number};
type Motion = Position & {vx:number;vy:number};
type World = {nodes:RoadNode[];nearestNode(x:number,y:number):number;free(x:number,y:number,radius:number):boolean};
type CandidateUnit = Motion & {id:number;visibleFor:number;wreck:number};
export type PoliceRole = 'pursuer'|'interceptor'|'support';
type PoliceUnit = {id:number;distance:number;wrecked?:boolean};
export type InterceptNode = {
  unitId:number;id:number;exitNode:number;distance:number;playerEta:number;unitEta:number;reactionSeconds:number;
};
export const POLICE={
  thresholds:[0,25,55,95,145], arrivalAdvance:10, promotionGap:15,
  unseenTime:3, escapeDistance:45, truceTime:6, commitment:2, cooldown:6, reaction:1.2
};
const distance=(a:Position,b:Position)=>Math.hypot(a.x-b.x,a.y-b.y);
const angle=(a:Position,b:Position)=>Math.atan2(b.y-a.y,b.x-a.x);

function corridor(world:World,a:Position,b:Position,r:number){
  const steps=Math.max(1,Math.ceil(distance(a,b)/2));
  for(let i=0;i<=steps;i++){
    const t=i/steps;
    if(!world.free(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,r))return false;
  }
  return true;
}

// Follow the plausible continuation from the car, through bends and intermediate OSM vertices.
export type Approach={unitId:number;node:number;junction:number};
type ApproachSearch={route:(node:number)=>{prev:ArrayLike<number>;dist:ArrayLike<number>};choices:Approach[]};
export function findInterceptCandidates(world:World,player:Motion & {h:number},patrols:readonly CandidateUnit[],stars:number,radius:number,staging?:ApproachSearch){
  const candidates:InterceptNode[]=[];
  const active=patrols.filter(p=>!p.wreck).sort((a,b)=>distance(a,player)-distance(b,player));
  const speed=Math.hypot(player.vx,player.vy);
  if(stars<2 || active.length<2 || speed<4)return candidates;
  let id=world.nearestNode(player.x,player.y),heading=Math.atan2(player.vy,player.vx);
  if(id<0)return candidates;
  let length=distance(player,world.nodes[id]),junctions=0;
  const visited=new Set<number>();
  for(let hop=0;hop<40 && length<110;hop++){
    visited.add(id);
    const n=world.nodes[id];
    const links=[...new Set(n.links.map(link=>link[0]))].filter(i=>world.nodes[i].ok);
    const onward=links.filter(i=>!visited.has(i)).sort((a,b)=>
      Math.abs(wrapAngle(angle(n,world.nodes[a])-heading))-Math.abs(wrapAngle(angle(n,world.nodes[b])-heading)));
    if(!onward.length)break;
    const next=world.nodes[onward[0]],outAngle=angle(n,next);
    if(Math.abs(wrapAngle(outAngle-heading))>1.45)break;
    if(links.length>=3 && length>6 && distance(player,n)>6 &&
      ((n.x-player.x)*player.vx+(n.y-player.y)*player.vy)>0){
      junctions++;
      // A swept, car-wide escape lane one car-width to either side of the player's line.
      const dx=Math.cos(heading),dy=Math.sin(heading),offset=radius*2.6;
      const escape=[-offset,offset].some(side=>{
        const x=n.x-dy*side,y=n.y+dx*side;
        return corridor(world,{x:x-6*dx,y:y-6*dy},{x:x+6*dx,y:y+6*dy},radius);
      });
      if(escape && staging && stars>=4 && junctions===2){
        // A spare unit may take a parallel street to the *side* of the second intersection.
        // Reject an approach which would first have to cross the player's own road.
        for(const entry of links){
          const side=world.nodes[entry],sideLength=distance(side,n);
          if(sideLength<8 || sideLength>42 || Math.abs(Math.sin(angle(n,side)-heading))<.65)continue;
          if(!corridor(world,side,n,radius))continue;
          const field=staging.route(entry);
          for(const unit of active.slice(1)){
            let at=world.nearestNode(unit.x,unit.y);
            if(at<0 || field.dist[at]/Math.max(10,Math.hypot(unit.vx,unit.vy))>length/speed+2)continue;
            for(let hops=0;at>=0 && at!==entry && at!==id && hops<80;hops++)at=field.prev[at];
            if(at===entry)staging.choices.push({unitId:unit.id,node:entry,junction:id});
          }
        }
      }
      if(escape)for(const unit of active.slice(1)){
        if(unit.visibleFor<POLICE.reaction)continue;
        const sideAngle=angle(unit,n);
        if(Math.abs(Math.sin(sideAngle-heading))<.6 || !corridor(world,unit,n,radius))continue;
        const exit=links.find(i=>distance(n,world.nodes[i])>=5 &&
          Math.abs(wrapAngle(angle(n,world.nodes[i])-sideAngle))<.95 && corridor(world,n,world.nodes[i],radius));
        if(exit===undefined)continue;
        const gap=distance(unit,n),unitSpeed=Math.hypot(unit.vx,unit.vy);
        if(unitSpeed<2 || Math.abs(wrapAngle(sideAngle-Math.atan2(unit.vy,unit.vx)))>1.45)continue;
        const playerEta=length/speed,unitEta=gap/unitSpeed;
        if(playerEta<.35 || playerEta>6 || unitEta-playerEta>.3 || playerEta-unitEta>1.5)continue;
        candidates.push({id,unitId:unit.id,exitNode:exit,distance:length,unitEta,playerEta,reactionSeconds:unit.visibleFor});
      }
      if(junctions>=(stars>=4?2:1))break;
    }
    if(!corridor(world,n,next,radius))break;
    length+=distance(n,next);heading=outAngle;id=onward[0];
  }
  return candidates;
}

export function crossJunction(car:Position & {h:number;target:number},nodes:RoadNode[],order:InterceptNode){
  const junction=nodes[order.id];
  if(car.target!==order.exitNode)car.target=distance(car,junction)<5?order.exitNode:order.id;
  return Math.max(-1,Math.min(1,wrapAngle(angle(car,nodes[car.target])-car.h)*2.5));
}

export function createPoliceDirector(){
  let stars=1,elapsed=0,promotedAt=0,clock=0,unseen=0,truce=0,armed=false,cooldown=0;
  let units:readonly PoliceUnit[]=[];
  let active:(InterceptNode & {until:number})|undefined;
  function finish(){active=undefined;cooldown=POLICE.cooldown;}
  function reset(){
    stars=1;elapsed=promotedAt=clock=unseen=truce=cooldown=0;armed=false;units=[];active=undefined;
  }
  function update(input:{dt:number;closestDistance:number;anyVisible:boolean;arrived?:boolean;candidates?:readonly InterceptNode[]}){
    const dt=input.dt;clock+=dt;elapsed+=dt+(input.arrived?POLICE.arrivalAdvance:0);
    if(stars<POLICE.thresholds.length && elapsed>=POLICE.thresholds[stars] && clock-promotedAt>=POLICE.promotionGap){
      stars++;promotedAt=clock;
    }
    truce=Math.max(0,truce-dt);cooldown=Math.max(0,cooldown-dt);
    if(input.anyVisible)armed=true;
    unseen=input.anyVisible || input.closestDistance<=POLICE.escapeDistance?0:unseen+dt;
    if(armed && !truce && unseen>=POLICE.unseenTime){
      truce=POLICE.truceTime;armed=false;unseen=0;if(active)finish();
    }
    const live=units.filter(u=>!u.wrecked).sort((a,b)=>a.distance-b.distance || a.id-b.id);
    if(active && (active.until<=clock || !live.some(u=>u.id===active?.unitId)))finish();
    if(!truce && !active && !cooldown && stars>=2){
      const best=input.candidates?.filter(c=>c.reactionSeconds>=POLICE.reaction && live.slice(1).some(u=>u.id===c.unitId))
        .sort((a,b)=>Math.abs(a.unitEta-a.playerEta)-Math.abs(b.unitEta-b.playerEta))[0];
      if(best)active={...best,until:clock+Math.max(POLICE.commitment,best.unitEta+1.5)};
    }
    const lead=live.find(u=>u.id!==active?.unitId);
    return {stars,truce,units:live.map(u=>({...u,role:(u.id===active?.unitId?'interceptor':u===lead?'pursuer':'support') as PoliceRole}))};
  }
  return {update,reset,setUnits(next:readonly PoliceUnit[]){units=next;},
    assignment(id:number){return active?.unitId===id?active:undefined;},
    get canStage(){return !active && !cooldown && !truce;},
    get stars(){return stars;},get truce(){return truce;},get maxUnits(){return stars;}};
}
