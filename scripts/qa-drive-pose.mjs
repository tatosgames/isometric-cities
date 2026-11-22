import assert from 'node:assert/strict';
import {Euler,Vector3} from 'three';
import {TUNE} from '../src/drive/drive.ts';
import {makeDrivePhysics} from '../src/drive/drive-physics.ts';
import {makeDrivePose} from '../src/drive/drive-pose.ts';
import {carShellHeight,carShellParts,carShellPivot} from '../src/drive/car-model.ts';

const dt = 1/120;
const degrees = angle => angle * 180 / Math.PI;
const {steerPlayer,steerPatrol,collide} = makeDrivePhysics(TUNE);
const pose = makeDrivePose(TUNE);
const speed = car => Math.hypot(car.vx,car.vy);
const heading = car => degrees(Math.atan2(car.vy,car.vx));

function body(vx = 0) {
  return {x:0,y:0,h:0,vx,vy:0,wayHold:0,dive:0,hold:0,steer:0,slip:0,side:0,way:1,hitX:0,hitY:0};
}

const clear={near:()=>false};
const playerLaunch=(car)=>steerPlayer(car,0,false,dt);
const patrolLaunch=(car)=>steerPatrol(car,0,clear,dt);
function measureLaunch(step,limit){
  const straight=body();
  let steps=0,launchSteps=0;
  for(;speed(straight)<limit && steps<700;steps++){
    step(straight);
    if(!launchSteps && speed(straight)>=60/3.6)launchSteps=steps+1;
  }
  assert.equal(speed(straight),limit);
  assert.ok(Math.abs(launchSteps*dt-1.44)<=2*dt);
  assert.ok(Math.abs((steps-launchSteps)*dt-4)<=2*dt);
  return {launch:launchSteps*dt,top:steps*dt,distance:straight.x};
}
const playerRun=measureLaunch(playerLaunch,90/3.6);
const patrolRun=measureLaunch(patrolLaunch,94/3.6);
const braking=body(25);
let brakeSteps=0;
for(;speed(braking)>0 && brakeSteps<180;brakeSteps++)steerPlayer(braking,0,true,dt);
assert.equal(speed(braking),0);
assert.ok(Math.abs(brakeSteps*dt-.93)<=2*dt);
assert.ok(Math.abs(braking.x-11.6)<.2);

const patrolTop=94/3.6;
const sampleCar=body(patrolTop),probes=[];
steerPatrol(sampleCar,0,{near:(x)=>{probes.push(x);return false;}},dt);
assert.equal(probes[0],4);
assert.ok(Math.abs(probes.at(-1)-13.8)<.05);
assert.ok(probes.slice(1).every((x,i)=>x-probes[i]<=1.8));
for(const obstacle of [4,8,13.8]){
  const approaching=body(patrolTop);
  steerPatrol(approaching,0,{near:(x,_y,r)=>Math.abs(x-obstacle)<r},dt);
  assert.ok(Math.abs(approaching.vx-(patrolTop-27*dt))<1e-9,`Patrol missed an obstacle at ${obstacle} m`);
}
const slidingPlayer={...body(13),vy:4},slidingPatrol={...slidingPlayer};
steerPlayer(slidingPlayer,0,true,dt);
steerPatrol(slidingPatrol,0,{near:()=>true},dt);
const withoutDrag=13-27*dt;
assert.equal(slidingPatrol.slip,slidingPlayer.slip);
assert.ok(Math.abs((withoutDrag-slidingPatrol.vx)/(withoutDrag-slidingPlayer.vx)-1.5)<1e-9);

const car = body(13);
function advance(steer, steps, brake = false) {
  for(let i=0;i<steps;i++){
    const load=steerPlayer(car,steer,brake,dt);
    const reference={...car};
    pose.update(car,steer,dt,load);
    assert.deepEqual(car,reference,'Visual pose must not affect movement');
    assert.ok(Math.abs(pose.yaw)<=TUNE.poseYaw);
    assert.ok(Math.abs(pose.roll)<=TUNE.poseRoll);
    if(speed(car)>TUNE.poseMinSpeed){
      const slipAngle = car.h-Math.atan2(car.vy,car.vx);
      assert.ok(Math.abs(slipAngle+pose.yaw)<=Math.max(Math.abs(slipAngle),TUNE.poseYawLimit)+1e-9);
    }
  }
}

advance(1,12);
const earlyAngle = degrees(car.h+pose.yaw-Math.atan2(car.vy,car.vx));
const earlyHeading=heading(car);
assert.ok(Math.abs(earlyHeading-2.6)<.2,`Expected about 2.6° of travel correction, got ${earlyHeading}°`);
assert.ok(degrees(pose.roll)<-8,'The body should bank into the turn');
advance(1,36);
assert.ok(degrees(pose.roll)<-16);
const settling={...car};
const {steerPlayer:releaseSteering}=makeDrivePhysics(TUNE);
let releaseSteps=0;
for(;settling.slip>=1.5 && releaseSteps<24;releaseSteps++)releaseSteering(settling,0,false,dt);
assert.ok(settling.slip<1.5 && releaseSteps*dt<=.19);
advance(-1,6);
assert.ok(pose.yaw<0 && pose.roll>0,'Countersteer should be visible within 50 ms');
advance(-1,24);
const heldYaw = Math.abs(pose.yaw);
advance(0,21,true);
assert.ok(Math.abs(pose.yaw)<=heldYaw*.1,'Release should dissipate 90% of the added angle in 170 ms');
assert.ok(degrees(pose.pitch)<-7,'Braking should lower the nose');
advance(0,180,true);
assert.ok(speed(car)<.2);
assert.ok(Math.abs(pose.roll)<1e-6);

pose.reset();
pose.update(body(2),1,dt,0);
assert.equal(pose.yaw,0);
assert.equal(pose.roll,0);
for(let i=0;i<12;i++)pose.update(body(13),0,dt,1);
assert.ok(degrees(pose.pitch)>5);
for(let i=0;i<36;i++)pose.update(body(16.5),0,dt,0);
assert.ok(Math.abs(degrees(pose.pitch))<.12,'Cruising should settle the shell back to neutral');
const shellParts=carShellParts('#fff','#fff').map(part=>part.translate(0,-carShellPivot,0));
const corner=new Vector3();
for(const roll of [-TUNE.poseRoll,TUNE.poseRoll])for(const pitch of [TUNE.poseLift,-TUNE.poseDive]){
  const rotation=new Euler(roll,0,pitch);
  for(const {attributes:{position}} of shellParts)for(let i=0;i<position.count;i++){
    corner.fromBufferAttribute(position,i).applyEuler(rotation);
    assert.ok(corner.y+carShellHeight(roll,pitch)>=.019,'Keep the tilted chassis above the bottom of the wheels');
  }
}

const wall = body(13);
wall.vy = 4;
for(let i=0;i<24;i++)pose.update(wall,-1,dt,0);
const hit = collide(wall,{
  visitObstacles(b,r,contact) { return contact(b,[1,-5,1,5],r); }
});
assert.equal(hit,13);
pose.update(wall,-1,dt,0);
assert.equal(pose.yaw,0,'A rebound past the yaw limit should clear exaggeration towards the wall');
pose.reset();
assert.equal(pose.roll,0);
console.log(`Drive QA passed (60 km/h at ${playerRun.launch.toFixed(3)} s, 90 at ${playerRun.top.toFixed(3)} s / ${playerRun.distance.toFixed(1)} m, patrol 94 at ${patrolRun.top.toFixed(3)} s, brake ${(brakeSteps*dt).toFixed(3)} s / ${braking.x.toFixed(1)} m, grip recovery ${(releaseSteps*dt).toFixed(3)} s, short turn ${earlyHeading.toFixed(2)}°)`);
