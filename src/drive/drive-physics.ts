import type { Point } from '../data/types.ts';
import type { buildDriveWorld, Segment } from './drive-world.ts';
import type { TUNE } from './drive-tune.ts';
import type { makeRoadGrade } from './road-grade.ts';
import * as T from 'three';
import { wrapAngle as wrap } from '../geometry.ts';

export interface Body {
  x: number; y: number; h: number; vx: number; vy: number;
  wayHold: number; dive: number; hold: number; steer: number;
  slip: number; side: number; way: number; hitX: number; hitY: number;
  /** Handling state: steering wheel rate, top speed of the current gear, seconds spent sliding, extra grip after a slide. */
  wheel: number; gear: number; drifted: number; boost: number;
  slopeAccel?: number;
  scrape?: {x: number;y: number;nx: number;ny: number;vx: number;vy: number;closing: number};
}

type Profile = typeof TUNE.player;
type PhysicsTuning = Pick<typeof TUNE, 'player' | 'patrol' | 'brake' | 'deflect' | 'bounce' | 'treeRadius' | 'radius' | 'wallLoss' | 'scrapeRatio' | 'scrapeFriction' | 'slope'>;

/** A car at rest with its steering centred. */
export function restBody(): Body{
  return {x:0,y:0,h:0,vx:0,vy:0,wayHold:0,dive:0,hold:0,steer:0,slip:0,side:0,way:1,hitX:0,hitY:0,wheel:0,gear:0,drifted:0,boost:0};
}
export function resetSteering(b: Body){b.wheel=b.gear=b.drifted=b.boost=0;}

export function makeDrivePhysics(tune: PhysicsTuning,gradeAt?: ReturnType<typeof makeRoadGrade>){
  function slopeAccel(b: Body,speed: number,dt: number){
    if(!gradeAt)return 0;
    const dx=speed>=2?b.vx/speed:Math.cos(b.h),dy=speed>=2?b.vy/speed:Math.sin(b.h);
    const grade=gradeAt(b.x,b.y,dx,dy);
    if(grade===undefined)return b.slopeAccel=0;
    const {deadZone,gain,limit,response}=tune.slope;
    const target=Math.sign(grade)*Math.min(limit,Math.max(0,Math.abs(grade)-deadZone)*gain);
    return b.slopeAccel=T.MathUtils.lerp(b.slopeAccel??target,target,-Math.expm1(-dt/response));
  }
  // The wheel builds up while it is held and unwinds when it is free. The nose turns only while steering.
  function turnNose(b: Body,p: Profile,steer: number,speed: number,dt: number){
    if(!steer){b.wheel*=Math.exp(-p.turnRelease*dt);return;}
    if(steer*b.wheel<0)b.wheel=0;
    const limit=(p.turn+p.turnLow*(1-Math.min(1,speed/b.gear)))*Math.abs(steer);
    b.wheel=T.MathUtils.clamp(b.wheel+Math.sign(steer)*p.turnRamp*dt,-limit,limit);
    b.h+=b.wheel*Math.min(1,.35+speed/8)*dt;
  }
  // The travel follows the nose at a fixed rate: slowly while the wheel is held, fast once it is free.
  // Returns the angle left between the two and the speed a long slide pays back on release.
  // `loose` is the angle a contact left between the two: it is not cut back to the slide limit at once.
  function followNose(b: Body,p: Profile,turning: boolean,speed: number,loose: number,dt: number){
    let slip=speed>.5?wrap(b.h-Math.atan2(b.vy,b.vx)):0;
    const recover=(turning?T.MathUtils.lerp(p.recover,p.driftRecover,b.hold):p.releaseRecover)+b.boost;
    slip-=Math.sign(slip)*Math.min(Math.abs(slip),recover*dt);
    const limit=Math.max(p.maxSlip,loose-recover*dt);
    slip=T.MathUtils.clamp(slip,-limit,limit);
    b.boost*=Math.exp(-p.boostFade*dt);
    let bonus=0;
    if(turning){if(Math.abs(slip)>p.bonusSlip)b.drifted+=dt;}
    else{
      if(b.drifted>=p.bonusLeast){
        bonus=T.MathUtils.lerp(p.bonusMin,p.bonusMax,Math.min(1,b.drifted/p.bonusTime));
        b.boost=bonus*p.bonusRecover;
      }
      b.drifted=0;
    }
    return {slip,bonus};
  }
  // Gears: the top speed creeps up on a straight at full speed and falls back while steering or braking.
  function paceCar(b: Body,p: Profile,turning: boolean,brake: boolean,speed: number,slope: number,dt: number){
    if(brake){b.gear=p.baseSpeed;return Math.max(0,speed-(tune.brake+slope)*dt);}
    if(turning)b.gear=Math.max(p.baseSpeed,b.gear-p.gearLoss*dt);
    else if(speed>=b.gear-.01)b.gear=Math.min(p.topSpeed,b.gear+p.gearAccel*dt);
    if(speed>b.gear)return Math.max(b.gear,speed-(p.coast+slope)*dt);
    // A steering car pushes only at low speed; above that it coasts through the corner.
    if(turning && speed>=p.baseSpeed*p.steerPush)return Math.max(0,speed-(p.coast+slope)*dt);
    return Math.min(b.gear,speed+((speed<p.baseSpeed/2?p.accel:p.accel*p.cruiseShare)-slope)*dt);
  }
  // One speed and two angles: the nose turns with the wheel and the direction of travel follows it,
  // so a slide changes direction without costing speed. Returns the drive load, -1 braking to 1 pushing.
  function steerCar(b: Body,p: Profile,steer: number,brake: boolean,slope: number,dt: number){
    const before=Math.hypot(b.vx,b.vy);
    // Small corrections steer the nose without counting as a held wheel.
    const turning=Math.abs(steer)>p.steerDead;
    b.gear=T.MathUtils.clamp(b.gear,p.baseSpeed,p.topSpeed);
    const loose=before>.5?Math.abs(wrap(b.h-Math.atan2(b.vy,b.vx))):0;
    turnNose(b,p,steer,before,dt);
    const fx=Math.cos(b.h),fy=Math.sin(b.h),forward=b.vx*fx+b.vy*fy;
    b.wayHold-=dt;b.dive+=((brake?1:0)-b.dive)*Math.min(1,dt*8);
    b.hold=turning?Math.min(1,b.hold+dt*p.holdRate):Math.max(0,b.hold-dt*p.holdRelease);
    b.steer+=(steer-b.steer)*Math.min(1,dt*9);
    let speed: number,side: number;
    const push=(brake?tune.brake:p.accel)*dt;
    if(forward<-push){
      // Rolling back from a wall: push or brake along the nose until the car moves forward again.
      const back=forward+push;
      side=(-b.vx*fy+b.vy*fx)*Math.exp(-p.rollbackGrip*dt);
      b.vx=fx*back-fy*side;b.vy=fy*back+fx*side;
      speed=Math.hypot(back,side);b.drifted=0;
    }else{
      const {slip,bonus}=followNose(b,p,turning,before,loose,dt);
      speed=paceCar(b,p,turning,brake,bonus?Math.max(before,Math.min(b.gear,before+bonus)):before,slope,dt);
      const travel=b.h-slip;
      b.vx=Math.cos(travel)*speed;b.vy=Math.sin(travel)*speed;
      side=-speed*Math.sin(slip);
    }
    b.slip=Math.abs(side);b.side=side;
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    const change=speed-before;
    return T.MathUtils.clamp(change/((change>=0?p.accel:tune.brake)*dt),-1,1);
  }
  const steerPlayer=(b: Body,steer: number,brake: boolean,dt: number)=>
    steerCar(b,tune.player,steer,brake,slopeAccel(b,Math.hypot(b.vx,b.vy),dt),dt);
  function steerPatrol(b: Body,steer: number,world: Pick<ReturnType<typeof buildDriveWorld>,'near'>,dt: number){
    const speed=Math.hypot(b.vx,b.vy);
    const slope=slopeAccel(b,speed,dt);
    const lookAhead=Math.max(4,speed*speed/(2*(tune.brake+slope))+tune.radius);
    const samples=Math.ceil((lookAhead-4)/1.8);
    const fx=Math.cos(b.h),fy=Math.sin(b.h);
    let brake=false;
    for(let i=0;speed>8 && i<=samples;i++){
      const distance=4+(lookAhead-4)*i/Math.max(1,samples);
      if(world.near(b.x+fx*distance,b.y+fy*distance,1.1)){brake=true;break;}
    }
    steerCar(b,tune.patrol,steer,brake,slope,dt);
  }
  function push(b: Body,px: number,py: number,r: number,facade: boolean){
    let nx=b.x-px,ny=b.y-py;const d=Math.hypot(nx,ny);
    if(d>=r || d<1e-5)return 0;
    nx/=d;ny/=d;b.x=px+nx*r;b.y=py+ny*r;
    const vn=b.vx*nx+b.vy*ny;
    const tangent=Math.abs(b.vx*ny-b.vy*nx);
    const fx=Math.cos(b.h),fy=Math.sin(b.h),into=fx*nx+fy*ny;
    if(facade && vn<=0 && tangent>0 && -vn<=tangent*tune.scrapeRatio){
      // Cancel the inward motion. Friction removes only a fraction of the normal impulse from the slide.
      const vx=b.vx-vn*nx,vy=b.vy-vn*ny;
      const retain=1+tune.scrapeFriction*vn/tangent;
      b.vx=vx*retain;b.vy=vy*retain;
      if(into<0)b.h+=Math.sign(fx*ny-fy*nx)*Math.min(tune.deflect/120,Math.asin(Math.min(1,-into)));
      const scrape=b.scrape;
      if(scrape && -vn>scrape.closing)Object.assign(scrape,{x:px,y:py,nx,ny,vx,vy,closing:-vn});
      return 0;
    }
    if(into<0){
      const cross=fx*ny-fy*nx;
      if(b.wayHold<=0)b.way=Math.abs(cross)>.08?-Math.sign(cross):(b.steer<0?-1:1);
      b.wayHold=.5;const way=b.way;
      b.h+=way*Math.min(tune.deflect/120,Math.acos(Math.max(-1,into))-Math.PI/2+.02);
    }
    if(vn>=0)return 0;
    // Sum of the impacts, pointing into the obstacle: the camera kick reads it.
    b.hitX+=vn*nx;b.hitY+=vn*ny;
    b.vx-=(1+tune.bounce)*vn*nx;b.vy-=(1+tune.bounce)*vn*ny;
    return -vn;
  }
  function wallContact(b: Body,segment: Segment,r: number){
    const [ax,ay,bx,by,facade]=segment,dx=bx-ax,dy=by-ay;
    const t=T.MathUtils.clamp(((b.x-ax)*dx+(b.y-ay)*dy)/(dx*dx+dy*dy),0,1);
    return push(b,ax+dx*t,ay+dy*t,r,facade);
  }
  function treeContact(b: Body,tree: Point,r: number){
    return push(b,tree[0],tree[1],r+tune.treeRadius,false);
  }
  function collide(b: Body,world: Pick<ReturnType<typeof buildDriveWorld>, "visitObstacles">){
    b.hitX=b.hitY=0;
    if(b.scrape)b.scrape.closing=0;
    const hit=world.visitObstacles(b,tune.radius,wallContact,treeContact);
    if(hit){const k=1-tune.wallLoss*Math.min(1,hit/8);b.vx*=k;b.vy*=k;}
    return hit;
  }

  // Returns the closing speed, or -1 when the two cars do not touch.
  function bump(a: Body,b: Body){
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),reach=tune.radius*2;
    if(d>=reach || d<1e-5)return -1;
    const nx=dx/d,ny=dy/d,overlap=(reach-d)/2;
    a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
    const closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
    if(closing<=0)return 0;
    a.vx-=closing*nx*.6;a.vy-=closing*ny*.6;b.vx+=closing*nx*.6;b.vy+=closing*ny*.6;
    return closing;
  }
  return {steerPatrol,steerPlayer,collide,bump};
}
