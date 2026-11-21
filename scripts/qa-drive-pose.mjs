import assert from 'node:assert/strict';
import {TUNE} from '../src/drive/drive.ts';
import {makeDrivePhysics} from '../src/drive/drive-physics.ts';
import {makeDrivePose} from '../src/drive/drive-pose.ts';

const dt = 1/120;
const degrees = angle => angle * 180 / Math.PI;
const {steerBody,collide} = makeDrivePhysics(TUNE);
const pose = makeDrivePose(TUNE);

function body(vx = 0) {
  return {x:0,y:0,h:0,vx,vy:0,wayHold:0,dive:0,hold:0,steer:0,slip:0,side:0,way:1,hitX:0,hitY:0};
}

const straight = body();
for(let i=0;i<240;i++)steerBody(straight,0,false,TUNE.maxSpeed,dt);
assert.equal(straight.vx,16.5);
assert.equal(TUNE.turnRamp,.2);

const car = body(13), reference = body(13);
function advance(steer, steps, held = 0, brake = false) {
  for(let i=1;i<=steps;i++){
    const agility = Math.min(1,(held+i)*dt/TUNE.turnRamp);
    steerBody(car,steer,brake,TUNE.maxSpeed,dt,agility);
    steerBody(reference,steer,brake,TUNE.maxSpeed,dt,agility);
    pose.update(car,steer,dt);
    assert.deepEqual(car,reference,'Visual pose must not affect movement');
    assert.ok(Math.abs(pose.yaw)<=TUNE.poseYaw);
    assert.ok(Math.abs(pose.roll)<=TUNE.poseRoll);
    if(Math.hypot(car.vx,car.vy)>TUNE.poseMinSpeed){
      const slipAngle = car.h-Math.atan2(car.vy,car.vx);
      assert.ok(Math.abs(slipAngle+pose.yaw)<=Math.max(Math.abs(slipAngle),TUNE.poseYawLimit)+1e-9);
    }
  }
}

advance(1,12);
const earlyAngle = degrees(car.h+pose.yaw-Math.atan2(car.vy,car.vx));
assert.ok(earlyAngle>=10 && earlyAngle<=15,`Expected 10–15° at 100 ms, got ${earlyAngle}°`);
assert.ok(degrees(pose.roll)<-3,'The body should bank into the turn');
advance(1,36,12);
assert.ok(degrees(pose.roll)<-8);
advance(-1,6);
assert.ok(pose.yaw<0 && pose.roll>0,'Countersteer should be visible within 50 ms');
advance(-1,24,6);
const heldYaw = Math.abs(pose.yaw);
advance(0,21,0,true);
assert.ok(Math.abs(pose.yaw)<=heldYaw*.1,'Release should dissipate 90% of the added angle in 170 ms');
advance(0,120,0,true);
assert.ok(Math.hypot(car.vx,car.vy)<.2);
assert.ok(Math.abs(pose.roll)<1e-6);

pose.reset();
pose.update(body(2),1,dt);
assert.equal(pose.yaw,0);
assert.equal(pose.roll,0);

const wall = body(13);
wall.vy = 4;
for(let i=0;i<24;i++)pose.update(wall,-1,dt);
const hit = collide(wall,{
  visitObstacles(b,r,contact) { return contact(b,[1,-5,1,5],r); }
});
assert.equal(hit,13);
pose.update(wall,-1,dt);
assert.equal(pose.yaw,0,'A rebound past the yaw limit should clear exaggeration towards the wall');
pose.reset();
assert.equal(pose.roll,0);
console.log(`Drive pose QA passed (nose vs travel at 100 ms: ${earlyAngle.toFixed(1)}°)`);
