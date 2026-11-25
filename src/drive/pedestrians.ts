import type { Road, Surface } from '../data/types.ts';
import { approach, pointInRing as inside, wrapAngle } from '../geometry.ts';

// Ambient pedestrians for the driving mode. Pure logic: positions in map metres, no rendering.
// They stroll along road edges, footways and squares near the car and jump aside when a vehicle
// comes at them. They are never hit: see `resolve` below.

export interface Threat {x: number; y: number; vx: number; vy: number}
export interface Walker {
  x: number; y: number; h: number;
  // Ends of the stretch it paces along, and which end it walks to.
  ax: number; ay: number; bx: number; by: number; forward: boolean;
  pace: number; phase: number; tint: number;
  alive: boolean;
  // Seconds of flight left, and its direction.
  alarm: number; fx: number; fy: number;
  // Seconds left in the air after vaulting a car it could not sidestep.
  air: number;
  stuck: number;
}
interface Stretch {ax: number; ay: number; bx: number; by: number; edge: number}
export interface PedestrianTune {
  // Walking and fleeing speed in m/s.
  walk: number; flee: number; fleeTime: number;
  // A vehicle alarms a walker inside `alarm + speed * alarmLead` metres when it is closing in.
  alarm: number; alarmLead: number;
  // Closest a walker on the ground may be to a vehicle's centre.
  clear: number;
  radius: number;
  // Ring around the car in which walkers appear, and the distance at which they are recycled.
  spawnNear: number; spawnFar: number; cull: number;
}
export const PEDESTRIANS: PedestrianTune={
  walk:1.35, flee:6.2, fleeTime:.9, alarm:6, alarmLead:.6, clear:2.3, radius:.45,
  spawnNear:42, spawnFar:82, cull:105
};

const CELL=40;
const footways=new Set(['steps','footway','path','pedestrian','cycleway']);
const mainRoads=new Set(['primary','secondary','trunk','motorway']);


export function makePedestrians(roads: Road[],surfaces: Surface[],world: {free(x: number,y: number,r: number): boolean},
  count: number,tune=PEDESTRIANS,random=Math.random){
  const grid=new Map<string,Stretch[]>();
  function keep(s: Stretch){
    const key=Math.floor((s.ax+s.bx)/2/CELL)+','+Math.floor((s.ay+s.by)/2/CELL);
    const list=grid.get(key);
    if(list)list.push(s);else grid.set(key,[s]);
  }
  // Car roads are walked along their edge, footways along their middle.
  for(const road of roads)for(let i=1;i<road.line.length;i++){
    const [ax,ay]=road.line[i-1],[bx,by]=road.line[i];
    if(Math.hypot(bx-ax,by-ay)<4)continue;
    keep({ax,ay,bx,by,edge:footways.has(road.kind)?0:(mainRoads.has(road.kind)?4:2.25)+1.1});
  }
  // Squares and parks get a few chords between points inside their outline.
  for(const s of surfaces){
    if(s.kind==='water')continue;
    const ring=s.rings[0],xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
    const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    const wanted=Math.min(6,Math.max(1,Math.round((x1-x0)*(y1-y0)/900)));
    for(let made=0,tries=0;made<wanted && tries<40;tries++){
      const ax=x0+random()*(x1-x0),ay=y0+random()*(y1-y0),bx=x0+random()*(x1-x0),by=y0+random()*(y1-y0);
      const length=Math.hypot(bx-ax,by-ay);
      if(length<8 || length>70 || !inside(ring,ax,ay) || !inside(ring,bx,by))continue;
      keep({ax,ay,bx,by,edge:0});made++;
    }
  }

  const walkers: Walker[]=Array.from({length:count},(_,i)=>({
    x:0,y:0,h:0,ax:0,ay:0,bx:0,by:0,forward:true,pace:tune.walk,phase:i*1.7,tint:i,alive:false,
    alarm:0,fx:0,fy:0,air:0,stuck:0
  }));
  const open=(x: number,y: number)=>world.free(x,y,tune.radius);

  // Put a walker on a clear stretch between `near` and `far` metres from the car, ahead of it when it moves.
  function spawn(w: Walker,car: Threat,near: number,far: number){
    const speed=Math.hypot(car.vx,car.vy),course=Math.atan2(car.vy,car.vx);
    const angle=speed>3?course+(random()-.5)*3.6:random()*Math.PI*2,reach=near+random()*(far-near);
    const list=grid.get(Math.floor((car.x+Math.cos(angle)*reach)/CELL)+','+Math.floor((car.y+Math.sin(angle)*reach)/CELL));
    if(!list)return false;
    const s=list[Math.floor(random()*list.length)];
    const length=Math.hypot(s.bx-s.ax,s.by-s.ay),ux=(s.bx-s.ax)/length,uy=(s.by-s.ay)/length;
    const side=random()<.5?-1:1;
    // On a narrow street the full pavement offset lands inside a house: step in towards the road.
    for(const offset of s.edge?[s.edge,s.edge-.8,s.edge-1.6]:[(random()-.5)*1.4]){
      const ox=-uy*offset*side,oy=ux*offset*side;
      const ax=s.ax+ox,ay=s.ay+oy,bx=s.bx+ox,by=s.by+oy;
      if(![.08,.5,.92].every(t=>open(ax+(bx-ax)*t,ay+(by-ay)*t)))continue;
      const t=random(),x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
      if(Math.hypot(x-car.x,y-car.y)<near*.8)return false;
      Object.assign(w,{x,y,ax,ay,bx,by,forward:random()<.5,alive:true,alarm:0,air:0,stuck:0,
        pace:tune.walk*(.8+random()*.5),h:Math.atan2(uy,ux)});
      if(!w.forward)w.h+=Math.PI;
      return true;
    }
    return false;
  }

  // Take one step of `distance` along (dx,dy), turning aside when a wall is in the way.
  function move(w: Walker,dx: number,dy: number,distance: number,turns: number[]){
    for(const turn of turns){
      const c=Math.cos(turn),s=Math.sin(turn),nx=w.x+(dx*c-dy*s)*distance,ny=w.y+(dx*s+dy*c)*distance;
      if(!open(nx,ny))continue;
      w.x=nx;w.y=ny;
      return true;
    }
    return false;
  }

  // The rule that makes walkers impossible to run over. A walker inside a vehicle's clearance is moved
  // straight out of it; if a wall leaves no room, it vaults: it is in the air until the vehicle has gone.
  function resolve(w: Walker,threats: Threat[]){
    for(const t of threats){
      const dx=w.x-t.x,dy=w.y-t.y,d=Math.hypot(dx,dy);
      if(d>=tune.clear)continue;
      const nx=d>1e-4?dx/d:1,ny=d>1e-4?dy/d:0,x=t.x+nx*tune.clear,y=t.y+ny*tune.clear;
      if(open(x,y)){w.x=x;w.y=y;}
      else w.air=.45;
    }
  }

  function update(dt: number,car: Threat,threats: Threat[]){
    let attempts=8;
    for(const w of walkers){
      if(!w.alive){
        if(attempts>0){attempts--;spawn(w,car,tune.spawnNear,tune.spawnFar);}
        continue;
      }
      if(Math.hypot(w.x-car.x,w.y-car.y)>tune.cull){w.alive=false;continue;}
      w.air=Math.max(0,w.air-dt);
      // Flee from the nearest vehicle that is closing in, sideways out of its path.
      let danger: Threat | null=null,closest=Infinity;
      for(const t of threats){
        const dx=w.x-t.x,dy=w.y-t.y,d=Math.hypot(dx,dy),speed=Math.hypot(t.vx,t.vy);
        if(d<closest && (d<3 || speed>1.5 && d<tune.alarm+speed*tune.alarmLead && dx*t.vx+dy*t.vy>0)){danger=t;closest=d;}
      }
      if(danger){
        const dx=w.x-danger.x,dy=w.y-danger.y,d=Math.max(1e-4,closest),speed=Math.hypot(danger.vx,danger.vy);
        let fx=dx/d,fy=dy/d;
        if(speed>1){
          const px=-danger.vy/speed,py=danger.vx/speed,side=dx*px+dy*py<0?-1:1;
          fx=fx*.5+px*side*.85;fy=fy*.5+py*side*.85;
        }
        const length=Math.hypot(fx,fy)||1;
        w.fx=fx/length;w.fy=fy/length;w.alarm=tune.fleeTime;
      }
      let dx: number,dy: number,moved: boolean;
      if(w.alarm>0){
        w.alarm-=dt;dx=w.fx;dy=w.fy;
        moved=move(w,dx,dy,tune.flee*dt,[0,.7,-.7,1.4,-1.4]);
        w.phase+=dt*15;
      }else{
        const tx=w.forward?w.bx:w.ax,ty=w.forward?w.by:w.ay,gap=Math.hypot(tx-w.x,ty-w.y);
        if(gap<.6){w.forward=!w.forward;continue;}
        dx=(tx-w.x)/gap;dy=(ty-w.y)/gap;
        moved=move(w,dx,dy,Math.min(gap,w.pace*dt),[0,.6,-.6]);
        w.phase+=dt*7.5;
        // A walker that fled behind a corner may not find its way back: recycle it.
        w.stuck=moved?0:w.stuck+dt;
        if(w.stuck>1.5){w.alive=false;continue;}
      }
      if(moved){
        const turn=wrapAngle(Math.atan2(dy,dx)-w.h);
        w.h+=turn*approach(w.alarm>0?18:6,dt);
      }
      resolve(w,threats);
    }
  }
  // Populate the surroundings at once at the start of a run, close to the car included.
  function reset(car: Threat){
    for(const w of walkers)w.alive=false;
    for(let tries=count*12,i=0;tries>0 && i<count;tries--)if(spawn(walkers[i],car,12,tune.spawnFar))i++;
  }
  return {walkers,update,reset,tune};
}
