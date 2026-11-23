import assert from 'node:assert/strict';
import {Euler,Vector3} from 'three';
import {TUNE} from '../src/drive/drive.ts';
import {makeDrivePhysics} from '../src/drive/drive-physics.ts';
import {makeDrivePose} from '../src/drive/drive-pose.ts';
import {makeRoadGrade} from '../src/drive/road-grade.ts';
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

for(const [grade,seconds,stopDistance] of [[-.08,3.39,11.73],[.01,4,11.57],[.08,4.88,11.42]]){
  const physics=makeDrivePhysics(TUNE,makeRoadGrade(x=>x*grade,[]));
  const launch=body(60/3.6),stop=body(25);
  let steps=0;
  for(;speed(launch)<25 && steps<720;steps++)physics.steerPlayer(launch,0,false,dt);
  assert.equal(speed(launch),25);
  assert.ok(Math.abs(steps*dt-seconds)<.02);
  for(let i=0;i<180;i++)physics.steerPlayer(stop,0,true,dt);
  assert.equal(speed(stop),0);
  assert.ok(Math.abs(stop.x-stopDistance)<.12);
}
const steep=makeDrivePhysics(TUNE,makeRoadGrade(x=>x*.3,[])),reverse=body(-20);
reverse.h=Math.PI;
steep.steerPlayer(reverse,0,false,dt);
assert.equal(reverse.slopeAccel,-.6);
const level={kind:'primary',layer:'1',line:[[0,-50],[0,50]]};
const bridge={kind:'primary',bridge:'yes',line:[[40,-50],[40,50]]};
const groundGrade=makeRoadGrade(x=>x*.08,[level,bridge]);
assert.equal(groundGrade(5,0,1,0),undefined);
assert.equal(groundGrade(40,2,1,0),undefined);
assert.ok(Math.abs(groundGrade(20,0,-1,0)+.08)<1e-9);
let grade=.08;
const transition=makeDrivePhysics(TUNE,()=>grade),crossing=body(20);
transition.steerPlayer(crossing,0,false,dt);
assert.ok(crossing.slopeAccel>.35);
grade=-.08;
transition.steerPlayer(crossing,0,false,dt);
assert.ok(crossing.slopeAccel>.3 && crossing.slopeAccel<.36);
grade=undefined;
transition.steerPlayer(crossing,0,false,dt);
assert.equal(crossing.slopeAccel,0);

const patrolTop=94/3.6;
const sampleCar=body(patrolTop),probes=[];
steerPatrol(sampleCar,0,{near:(x)=>{probes.push(x);return false;}},dt);
assert.equal(probes[0],4);
assert.ok(Math.abs(probes.at(-1)-13.8)<.05);
assert.ok(probes.slice(1).every((x,i)=>x-probes[i]<=1.8));
const downhill=makeDrivePhysics(TUNE,()=>-.08),downhillPatrol=body(patrolTop),downhillProbes=[];
downhill.steerPatrol(downhillPatrol,0,{near:x=>{downhillProbes.push(x);return false;}},dt);
assert.equal(downhillPatrol.vx,patrolTop,'The downhill bonus must respect the patrol speed cap');
assert.ok(downhillProbes.at(-1)>probes.at(-1),'Patrols look farther before braking downhill');
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
assert.ok(degrees(pose.roll)<-27,'The shell should clearly lean in a sustained turn');
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
  visitObstacles(b,r,contact) { return contact(b,[1,-5,1,5,true],r); }
});
assert.equal(hit,13);
pose.update(wall,-1,dt,0);
assert.equal(pose.yaw,0,'A rebound past the yaw limit should clear exaggeration towards the wall');
pose.reset();
assert.equal(pose.roll,0);

const scrapeWall={visitObstacles(b,r,contact){return contact(b,[-50,0,50,0,true],r);}};
for(const direction of [-1,1]){
  const scrape={
    ...body(direction*18),y:TUNE.radius-.03,h:Math.atan2(-4,direction*18),vy:-4,
    scrape:{x:0,y:0,nx:0,ny:0,vx:0,vy:0,closing:0}
  };
  const inward=Math.abs(Math.sin(scrape.h));
  assert.equal(collide(scrape,scrapeWall),0,'A side scrape is not a hard impact');
  assert.equal(scrape.vy,0,'Remove only the inward velocity, without bouncing');
  assert.equal(scrape.y,TUNE.radius,'Keep the vehicle outside the wall');
  assert.ok(Math.abs(scrape.vx-direction*17.52)<1e-9,'Remove 0.48 m/s from the tangent');
  assert.ok(Math.abs(Math.sin(scrape.h))<inward,'Turn the nose towards the tangent in both directions');
  assert.equal(scrape.scrape.closing,4);
  assert.equal(scrape.scrape.y,0);
  assert.equal(scrape.scrape.ny,1);
  assert.equal(scrape.hitY,0);
  const corridor={visitObstacles(b,r,contact){
    return Math.max(contact(b,[-50,0,50,0,true],r),contact(b,[-50,2.6,50,2.6,true],r));
  }};
  const {steerPlayer:steerAlongWall}=makeDrivePhysics(TUNE);
  for(let i=0;i<120;i++){
    steerAlongWall(scrape,-direction,false,dt);
    assert.equal(collide(scrape,corridor),0);
    assert.ok(scrape.y>=TUNE.radius-1e-9 && scrape.y<=2.6-TUNE.radius+1e-9,'Stay inside the alley');
    assert.ok(direction*scrape.vx>12,'Maintain momentum while holding steer towards the wall');
  }
  scrape.y=2.6/2;
  collide(scrape,corridor);
  assert.equal(scrape.scrape.closing,0,'No fresh scrape after clearing the wall');
}
const headOn={...body(),y:1,vy:-15,h:-Math.PI/2};
assert.equal(collide(headOn,scrapeWall),15);
assert.ok(headOn.vy>0,'A head-on hit still bounces');
const boundary={...body(18),y:1,vy:-4};
assert.equal(collide(boundary,{visitObstacles(b,r,contact){return contact(b,[-50,0,50,0,false],r);}}),4);
assert.ok(boundary.vy>0,'The map boundary keeps the usual impact response');
const tree={...body(18),y:1,vy:-4};
assert.equal(collide(tree,{visitObstacles(b,r,_wall,contact){return contact(b,[0,0],r);}}),4);
assert.ok(tree.vy>0,'Trees keep the usual impact response');
console.log(`Drive QA passed (60 km/h at ${playerRun.launch.toFixed(3)} s, 90 at ${playerRun.top.toFixed(3)} s / ${playerRun.distance.toFixed(1)} m, patrol 94 at ${patrolRun.top.toFixed(3)} s, brake ${(brakeSteps*dt).toFixed(3)} s / ${braking.x.toFixed(1)} m, grip recovery ${(releaseSteps*dt).toFixed(3)} s, short turn ${earlyHeading.toFixed(2)}°)`);
