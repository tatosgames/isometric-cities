// Drift-racer handling (`?handling=drift`): launch, gears, slide without speed loss, release, bonus, cadence.
import assert from 'node:assert/strict';
import {TUNE} from '../src/drive/drive-tune.ts';
import {makeDrivePhysics} from '../src/drive/drive-physics.ts';

const d=TUNE.drift;
const degrees=angle=>angle*180/Math.PI;
const speed=car=>Math.hypot(car.vx,car.vy);
const slip=car=>degrees(Math.atan2(Math.sin(car.h-Math.atan2(car.vy,car.vx)),Math.cos(car.h-Math.atan2(car.vy,car.vx))));
const body=(vx=0)=>({x:0,y:0,h:0,vx,vy:0,wayHold:0,dive:0,hold:0,steer:0,slip:0,side:0,way:1,hitX:0,hitY:0});
const drift=()=>makeDrivePhysics(TUNE,undefined,'drift');
function run(physics,car,steer,seconds,dt=1/120,brake=false){
  for(let i=0,n=Math.round(seconds/dt);i<n;i++)physics.steerPlayer(car,steer,brake,dt);
  return car;
}

// Launch and gears: base speed first, then the top speed creeps up on a straight.
const launch=body(),engine=drift();
let seconds=0;
for(;speed(launch)<d.baseSpeed-1e-9 && seconds<10;seconds+=1/120)engine.steerPlayer(launch,0,false,1/120);
assert.ok(Math.abs(seconds-4.57)<.05,`Base speed after ${seconds.toFixed(2)} s`);
run(engine,launch,0,13);
assert.ok(Math.abs(speed(launch)-d.topSpeed)<.05,'A long straight reaches the top gear');
run(engine,launch,0,.93,1/120,true);
assert.ok(speed(launch)<8,'Braking sheds speed at the usual rate');
run(engine,launch,0,4);
assert.ok(speed(launch)>d.baseSpeed-.1 && speed(launch)<d.baseSpeed+1,'Braking drops back to the base gear');

// A held wheel slides: the nose leads the travel up to the limit, and the slide costs almost no speed.
const slide=body(d.baseSpeed),slider=drift();
run(slider,slide,1,.1);
const tap={heading:degrees(slide.h),slip:slip(slide)};
assert.ok(tap.heading>2 && tap.heading<6,`A 100 ms tap turns the nose ${tap.heading.toFixed(1)} degrees`);
run(slider,slide,1,.9);
assert.ok(Math.abs(slip(slide)-degrees(d.maxSlip))<.01,'One second of wheel reaches the slide limit');
assert.ok(speed(slide)>d.baseSpeed-1,'The slide keeps its speed');
assert.ok(slide.slip>TUNE.skidSpeed,'The slide leaves skid marks');
const nose=slide.h;
// Letting go: the travel snaps to the nose, the nose stays put, and the slide pays its speed back.
run(slider,slide,0,.35);
assert.equal(slide.h,nose,'The nose holds its direction with the wheel free');
assert.ok(Math.abs(slip(slide))<.01,`Straight again 350 ms after the release, slip ${slip(slide).toFixed(2)}`);
assert.ok(speed(slide)>=d.baseSpeed-.05,'The drift bonus returns the speed lost in the slide');

// No bonus without a slide.
const short=body(d.baseSpeed),shorter=drift();
run(shorter,short,1,.1);run(shorter,short,0,1/120);
assert.ok(speed(short)<=d.baseSpeed,'A tap earns no bonus');

// Same result at 60 and 120 steps per second.
const fast=run(drift(),body(d.baseSpeed),1,1,1/120),slow=run(drift(),body(d.baseSpeed),1,1,1/60);
assert.ok(Math.abs(degrees(fast.h-slow.h))<3,`Cadence changes the turn by ${degrees(fast.h-slow.h).toFixed(2)} degrees`);
assert.ok(Math.abs(speed(fast)-speed(slow))<.05);

// Rolling back from a wall: the car pushes forward again instead of stopping dead or spinning.
const back=body(-3),reverser=drift();
reverser.steerPlayer(back,0,false,1/120);
assert.ok(Math.abs(back.vx-(-3+d.accel/120))<1e-9);
run(reverser,back,0,1);
assert.ok(back.vx>4 && Math.abs(back.vy)<1e-9);

// Patrols keep the standard handling.
const standardPatrol=body(20),driftPatrol=body(20),clear={near:()=>false};
makeDrivePhysics(TUNE).steerPatrol(standardPatrol,1,clear,1/120);
drift().steerPatrol(driftPatrol,1,clear,1/120);
assert.deepEqual(driftPatrol,standardPatrol);

console.log(`Drift QA passed (base speed at ${seconds.toFixed(2)} s, 100 ms tap ${tap.heading.toFixed(1)} degrees, slide limit ${degrees(d.maxSlip).toFixed(0)} degrees, 60 vs 120 Hz ${degrees(fast.h-slow.h).toFixed(2)} degrees)`);
