import type { Point } from '../data/types.ts';
import type { buildDriveWorld, Segment } from './drive-world.ts';
import type { TUNE } from './drive.ts';
import * as T from 'three';

export interface Body {
  x: number; y: number; h: number; vx: number; vy: number;
  wayHold: number; dive: number; hold: number; steer: number;
  slip: number; side: number; way: number; hitX: number; hitY: number;
}


type Handling = Pick<typeof TUNE.player, 'maxSpeed' | 'cruiseAccel' | 'gripReleaseRate' | 'driftDrag'> & {releaseGrip?: number};
type PhysicsTuning = Pick<typeof TUNE, 'player' | 'patrol' | 'accel' | 'accelTaperStart' | 'accelTaperEnd' | 'brake' | 'turn' | 'brakeGrip' | 'grip' | 'driftGrip' | 'deflect' | 'bounce' | 'treeRadius' | 'radius' | 'wallLoss'>;

export function makeDrivePhysics(tune: PhysicsTuning){
  let steerTime=0,steerDirection=0;

  function steerBody(b: Body,steer: number,brake: boolean,dt: number,agility: number,handling: Handling){
    const speed=Math.hypot(b.vx,b.vy);
    b.h+=steer*tune.turn*agility*Math.min(1,.35+speed/8)*dt;
    const fx=Math.cos(b.h),fy=Math.sin(b.h);
    let forward=b.vx*fx+b.vy*fy,side=-b.vx*fy+b.vy*fx;
    const max=handling.maxSpeed;
    if(brake)forward=Math.max(0,forward-tune.brake*dt);
    else if(forward>max)forward=Math.max(max,forward-tune.brake*dt);
    else{
      const taper=T.MathUtils.smoothstep(forward,tune.accelTaperStart,tune.accelTaperEnd);
      forward=Math.min(max,forward+T.MathUtils.lerp(tune.accel,handling.cruiseAccel,taper)*dt);
    }
    b.wayHold-=dt;b.dive+=((brake?1:0)-b.dive)*Math.min(1,dt*8);
    b.hold=steer?Math.min(1,b.hold+dt*2.2):Math.max(0,b.hold-dt*handling.gripReleaseRate);
    b.steer+=(steer-b.steer)*Math.min(1,dt*9);
    const baseGrip=steer?tune.grip:handling.releaseGrip??tune.grip;
    const grip=brake?tune.brakeGrip:T.MathUtils.lerp(baseGrip,tune.driftGrip,b.hold);
    side*=Math.exp(-grip*dt);
    forward*=1-handling.driftDrag*Math.abs(side)*dt;
    b.slip=Math.abs(side);b.side=side;
    b.vx=fx*forward-fy*side;b.vy=fy*forward+fx*side;
    b.x+=b.vx*dt;b.y+=b.vy*dt;
    return speed;
  }
  function steerPlayer(b: Body,steer: number,brake: boolean,dt: number){
    if(steer!==steerDirection){steerTime=0;steerDirection=steer;}
    const handling=tune.player;
    if(steer)steerTime=Math.min(handling.turnRamp,steerTime+dt);
    const agility=T.MathUtils.lerp(handling.turnStart,1,steerTime/handling.turnRamp);
    const before=steerBody(b,steer,brake,dt,agility,handling);
    const change=Math.hypot(b.vx,b.vy)-before;
    return T.MathUtils.clamp(change/((change>=0?tune.accel:tune.brake)*dt),-1,1);
  }
  function steerPatrol(b: Body,steer: number,world: Pick<ReturnType<typeof buildDriveWorld>,'near'>,dt: number){
    const speed=Math.hypot(b.vx,b.vy);
    const lookAhead=Math.max(4,speed*speed/(2*tune.brake)+tune.radius);
    const samples=Math.ceil((lookAhead-4)/1.8);
    const fx=Math.cos(b.h),fy=Math.sin(b.h);
    let brake=false;
    for(let i=0;speed>8 && i<=samples;i++){
      const distance=4+(lookAhead-4)*i/Math.max(1,samples);
      if(world.near(b.x+fx*distance,b.y+fy*distance,1.1)){brake=true;break;}
    }
    steerBody(b,steer,brake,dt,tune.patrol.turn,tune.patrol);
  }
  function push(b: Body,px: number,py: number,r: number){
    let nx=b.x-px,ny=b.y-py;const d=Math.hypot(nx,ny);
    if(d>=r || d<1e-5)return 0;
    nx/=d;ny/=d;b.x=px+nx*r;b.y=py+ny*r;
    // Glance off: a nose pointing into the obstacle swings towards the wall line, so cars keep rolling.
    const fx=Math.cos(b.h),fy=Math.sin(b.h),into=fx*nx+fy*ny;
    if(into<0){
      const cross=fx*ny-fy*nx;
      if(b.wayHold<=0)b.way=Math.abs(cross)>.08?-Math.sign(cross):(b.steer<0?-1:1);
      b.wayHold=.5;const way=b.way;
      b.h+=way*Math.min(tune.deflect/120,Math.acos(Math.max(-1,into))-Math.PI/2+.02);
    }
    const vn=b.vx*nx+b.vy*ny;
    if(vn>=0)return 0;
    // Sum of the impacts, pointing into the obstacle: the camera kick reads it.
    b.hitX+=vn*nx;b.hitY+=vn*ny;
    b.vx-=(1+tune.bounce)*vn*nx;b.vy-=(1+tune.bounce)*vn*ny;
    return -vn;
  }
  function wallContact(b: Body,segment: Segment,r: number){
    const [ax,ay,bx,by]=segment,dx=bx-ax,dy=by-ay;
    const t=T.MathUtils.clamp(((b.x-ax)*dx+(b.y-ay)*dy)/(dx*dx+dy*dy),0,1);
    return push(b,ax+dx*t,ay+dy*t,r);
  }
  function treeContact(b: Body,tree: Point,r: number){
    return push(b,tree[0],tree[1],r+tune.treeRadius);
  }
  function collide(b: Body,world: Pick<ReturnType<typeof buildDriveWorld>, "visitObstacles">){
    b.hitX=b.hitY=0;
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
  return {steerPatrol,steerPlayer,collide,bump,resetPlayerSteering(){steerTime=steerDirection=0;}};
}
