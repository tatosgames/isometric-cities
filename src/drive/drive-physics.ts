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
  slopeAccel?: number;
  scrape?: {x: number;y: number;nx: number;ny: number;vx: number;vy: number;closing: number};
}


type Handling = Pick<typeof TUNE.player, 'maxSpeed' | 'cruiseAccel' | 'gripReleaseRate' | 'driftDrag'> & {releaseGrip?: number;brakeGrip?: number;turnFade?: number};
type PhysicsTuning = Pick<typeof TUNE, 'player' | 'patrol' | 'accel' | 'accelTaperStart' | 'accelTaperEnd' | 'brake' | 'turn' | 'grip' | 'driftGrip' | 'deflect' | 'bounce' | 'treeRadius' | 'radius' | 'wallLoss' | 'scrapeRatio' | 'scrapeFriction' | 'slope' | 'drift'>;
export type DriveHandling = 'standard' | 'drift';

export function makeDrivePhysics(tune: PhysicsTuning,gradeAt?: ReturnType<typeof makeRoadGrade>,handling: DriveHandling='standard'){
  let steerTime=0,steerDirection=0;
  // Drift profile: steering wheel rate, top speed of the current gear, time spent sliding, extra grip after a drift.
  let wheel=0,gear=tune.drift.baseSpeed,drifted=0,boost=0;

  function slopeAccel(b: Body,speed: number,dt: number){
    if(!gradeAt)return 0;
    const dx=speed>=2?b.vx/speed:Math.cos(b.h),dy=speed>=2?b.vy/speed:Math.sin(b.h);
    const grade=gradeAt(b.x,b.y,dx,dy);
    if(grade===undefined)return b.slopeAccel=0;
    const {deadZone,gain,limit,response}=tune.slope;
    const target=Math.sign(grade)*Math.min(limit,Math.max(0,Math.abs(grade)-deadZone)*gain);
    return b.slopeAccel=T.MathUtils.lerp(b.slopeAccel??target,target,-Math.expm1(-dt/response));
  }
  function steerBody(b: Body,steer: number,brake: boolean,speed: number,dt: number,agility: number,handling: Handling,slope: number){
    const max=handling.maxSpeed;
    // Only above the launch phase: town-speed handling stays as it is, fast corners get wider.
    const fade=1-(handling.turnFade??0)*T.MathUtils.smoothstep(speed,tune.accelTaperStart,max);
    b.h+=steer*tune.turn*agility*Math.min(1,.35+speed/8)*fade*dt;
    const fx=Math.cos(b.h),fy=Math.sin(b.h);
    let forward=b.vx*fx+b.vy*fy,side=-b.vx*fy+b.vy*fx;
    // Braking slows a car rolling back from a wall too, instead of stopping it dead in one step.
    if(brake)forward=forward>0?Math.max(0,forward-(tune.brake+slope)*dt):Math.min(0,forward+tune.brake*dt);
    else if(forward>max)forward=Math.max(max,forward-(tune.brake+slope)*dt);
    else{
      const taper=T.MathUtils.smoothstep(forward,tune.accelTaperStart,tune.accelTaperEnd);
      forward=Math.min(max,forward+(T.MathUtils.lerp(tune.accel,handling.cruiseAccel,taper)-slope)*dt);
    }
    b.wayHold-=dt;b.dive+=((brake?1:0)-b.dive)*Math.min(1,dt*8);
    b.hold=steer?Math.min(1,b.hold+dt*2.2):Math.max(0,b.hold-dt*handling.gripReleaseRate);
    b.steer+=(steer-b.steer)*Math.min(1,dt*9);
    const baseGrip=steer?tune.grip:handling.releaseGrip??tune.grip;
    const cornering=T.MathUtils.lerp(baseGrip,tune.driftGrip,b.hold);
    const grip=brake?handling.brakeGrip??cornering:cornering;
    side*=Math.exp(-grip*dt);
    forward*=1-handling.driftDrag*Math.abs(side)*dt;
    b.slip=Math.abs(side);b.side=side;
    b.vx=fx*forward-fy*side;b.vy=fy*forward+fx*side;
    b.x+=b.vx*dt;b.y+=b.vy*dt;
  }
  function steerPlayer(b: Body,steer: number,brake: boolean,dt: number){
    if(steer!==steerDirection){steerTime=0;steerDirection=steer;}
    const handling=tune.player;
    if(steer)steerTime=Math.min(handling.turnRamp,steerTime+dt);
    const agility=T.MathUtils.lerp(handling.turnStart,1,steerTime/handling.turnRamp);
    const before=Math.hypot(b.vx,b.vy);
    steerBody(b,steer,brake,before,dt,agility,handling,slopeAccel(b,before,dt));
    const change=Math.hypot(b.vx,b.vy)-before;
    return T.MathUtils.clamp(change/((change>=0?tune.accel:tune.brake)*dt),-1,1);
  }
  // Drift-racer handling. The car has one speed and two angles: the nose turns with the wheel and the
  // direction of travel follows it at a fixed rate, so a slide changes direction without costing speed.
  // There is no handbrake: holding the wheel loosens the grip, letting go snaps the travel back to the nose.
  function steerDrift(b: Body,steer: number,brake: boolean,dt: number){
    const d=tune.drift,before=Math.hypot(b.vx,b.vy),slope=slopeAccel(b,before,dt);
    if(steer){
      if(steer*wheel<0)wheel=0;
      const limit=d.turn+d.turnLow*(1-Math.min(1,before/gear));
      wheel=T.MathUtils.clamp(wheel+steer*d.turnRamp*dt,-limit,limit);
      b.h+=wheel*Math.min(1,.35+before/8)*dt;
    }else wheel*=Math.exp(-d.turnRelease*dt);
    const fx=Math.cos(b.h),fy=Math.sin(b.h),forward=b.vx*fx+b.vy*fy;
    b.wayHold-=dt;b.dive+=((brake?1:0)-b.dive)*Math.min(1,dt*8);
    b.hold=steer?Math.min(1,b.hold+dt*2.2):Math.max(0,b.hold-dt*tune.player.gripReleaseRate);
    b.steer+=(steer-b.steer)*Math.min(1,dt*9);
    let speed=before,side: number;
    if(forward<0){
      // Rolling back from a wall: push or brake along the nose until the car moves forward again.
      const back=Math.min(0,forward+(brake?tune.brake:d.accel)*dt);
      side=(-b.vx*fy+b.vy*fx)*Math.exp(-tune.grip*dt);
      b.vx=fx*back-fy*side;b.vy=fy*back+fx*side;
      speed=Math.hypot(back,side);drifted=0;
    }else{
      let slip=before>.5?wrap(b.h-Math.atan2(b.vy,b.vx)):0;
      const recover=(steer?T.MathUtils.lerp(d.recover,d.driftRecover,b.hold):d.releaseRecover)+boost;
      slip-=Math.sign(slip)*Math.min(Math.abs(slip),recover*dt);
      slip=T.MathUtils.clamp(slip,-d.maxSlip,d.maxSlip);
      boost*=Math.exp(-d.boostFade*dt);
      if(steer){if(Math.abs(slip)>d.bonusSlip)drifted+=dt;}
      else{
        // A long slide pays back speed, up to the current gear, and extra grip to straighten out.
        if(drifted>=d.bonusLeast){
          const bonus=T.MathUtils.lerp(d.bonusMin,d.bonusMax,Math.min(1,drifted/d.bonusTime));
          speed=Math.max(speed,Math.min(gear,speed+bonus));boost=bonus*d.bonusRecover;
        }
        drifted=0;
      }
      if(brake){gear=d.baseSpeed;speed=Math.max(0,speed-(tune.brake+slope)*dt);}
      else{
        // Gears: the top speed creeps up on a straight at full speed and falls back while steering.
        if(steer)gear=Math.max(d.baseSpeed,gear-d.gearLoss*dt);
        else if(speed>=gear-.01)gear=Math.min(d.topSpeed,gear+d.gearAccel*dt);
        if(speed>gear)speed=Math.max(gear,speed-(d.coast+slope)*dt);
        else if(!steer || speed<d.baseSpeed*d.steerPush){
          speed=Math.min(gear,speed+((speed<d.baseSpeed/2?d.accel:d.accel*d.cruiseShare)-slope)*dt);
        }else speed=Math.max(0,speed-(d.coast+slope)*dt);
      }
      const travel=b.h-slip;
      b.vx=Math.cos(travel)*speed;b.vy=Math.sin(travel)*speed;
      side=-speed*Math.sin(slip);
    }
    b.slip=Math.abs(side);b.side=side;
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    const change=speed-before;
    return T.MathUtils.clamp(change/((change>=0?d.accel:tune.brake)*dt),-1,1);
  }
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
    steerBody(b,steer,brake,speed,dt,tune.patrol.turn,tune.patrol,slope);
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
  return {steerPatrol,steerPlayer:handling==='drift'?steerDrift:steerPlayer,collide,bump,
    resetPlayerSteering(){steerTime=steerDirection=wheel=drifted=boost=0;gear=tune.drift.baseSpeed;}};
}
