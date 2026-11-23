import { isBarrios, loadData } from '../data/load.ts';
import roadStyle from '../data/road-style.json' with {type:'json'};
import type { Barrio, Point, Road } from '../data/types.ts';
import { inRing } from './drive-world.ts';

export function indexStreets(roads: Road[]){
  const streets=roads.filter(road=>road.line.length>1 &&
    (!roadStyle.pedestrian.includes(road.kind) || road.kind==='pedestrian')).map(road=>{
    const xs=road.line.map(p=>p[0]),ys=road.line.map(p=>p[1]);
    const radius=roadStyle.main.includes(road.kind.replace(/_link$/,''))?7:4.5;
    return {line:road.line,name:road.name?.trim()||'',radius,
      west:Math.min(...xs)-radius,east:Math.max(...xs)+radius,
      south:Math.min(...ys)-radius,north:Math.max(...ys)+radius};
  });
  return (x: number,y: number,h: number)=>{
    const hx=Math.cos(h),hy=Math.sin(h);
    let name='',best=Infinity,other=Infinity;
    for(const street of streets){
      if(x<street.west || x>street.east || y<street.south || y>street.north)continue;
      for(let i=1;i<street.line.length;i++){
        const [ax,ay]=street.line[i-1],[bx,by]=street.line[i];
        const dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy);
        if(!length)continue;
        const t=Math.max(0,Math.min(length,((x-ax)*dx+(y-ay)*dy)/length));
        const distance=Math.hypot(x-ax-t*dx/length,y-ay-t*dy/length);
        if(distance>street.radius)continue;
        const score=distance+3*(1-Math.abs(hx*dx+hy*dy)/length);
        if(score<best){
          if(name!==street.name)other=best;
          best=score;name=street.name;
        }else if(name!==street.name)other=Math.min(other,score);
      }
    }
    return other-best<.75?'':name;
  };
}

export function barrioAt(barrios: Barrio[],x: number,y: number){
  return barrios.find(barrio=>barrio.polygons.some(([outer,...holes])=>
    inRing(outer,x,y) && !holes.some(hole=>inRing(hole,x,y))))?.name||'';
}

export function confirmedName(initial: string,delay: number){
  let current=initial,pending=initial,since=0;
  return (name: string,now: number)=>{
    if(name!==pending){pending=name;since=now;}
    if(pending===current || now-since<delay)return undefined;
    return current=pending;
  };
}

export function makeDriveLocation(roads: Road[],street: HTMLElement,barrio: HTMLElement){
  const streetAt=indexStreets(roads);
  let barrios: Barrio[] | undefined;
  void loadData('barrios.json',isBarrios).then(value=>{barrios=value;})
    .catch(error=>console.warn('Barrios:',error));
  let nextSample=0,streetName=confirmedName('',400);
  let barrioName=confirmedName('',700);
  let start: Point | undefined;
  let animation: Animation | undefined;
  let lastAnnounced='';
  function clearTitle(){
    animation?.cancel();animation=undefined;
    barrio.textContent='';
  }
  function showTitle(name: string){
    clearTitle();
    barrio.textContent=name;
    animation=barrio.animate([
      {opacity:0,easing:'ease-out'},
      {opacity:1,offset:.14},
      {opacity:1,offset:.72,easing:'ease-in'},
      {opacity:0}
    ],{duration:2800});
    animation.onfinish=clearTitle;
  }
  return {
    reset(origin?: Point){
      nextSample=0;streetName=confirmedName('',400);
      start=origin;lastAnnounced='';
      street.textContent='';clearTitle();
    },
    clearTitle,
    update(x: number,y: number,h: number,now: number){
      if(now<nextSample)return;
      nextSample=now+140;
      const knownStreet=streetName(streetAt(x,y,h),now);
      if(knownStreet!==undefined)street.textContent=knownStreet;
      if(!barrios)return;
      if(start){
        lastAnnounced=barrioAt(barrios,...start);
        barrioName=confirmedName(lastAnnounced,700);
        start=undefined;
        if(lastAnnounced)showTitle(lastAnnounced);
      }
      const name=barrioAt(barrios,x,y);
      const entered=barrioName(name,now);
      // Crossing an unmapped sliver and returning to the same barrio is silent.
      if(entered && entered!==lastAnnounced){lastAnnounced=entered;showTitle(entered);}
    }
  };
}
