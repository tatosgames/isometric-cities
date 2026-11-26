// Handling: launch, gears, slide without speed loss, release, bonus, cadence, patrols.
import assert from 'node:assert/strict';
import {TUNE} from '../src/drive/drive-tune.ts';
import {makeDrivePhysics,restBody} from '../src/drive/drive-physics.ts';
import {chaseRuns} from './qa-drive-chase.mjs';

const d=TUNE.player;
const degrees=angle=>angle*180/Math.PI;
const speed=car=>Math.hypot(car.vx,car.vy);
const slip=car=>degrees(Math.atan2(Math.sin(car.h-Math.atan2(car.vy,car.vx)),Math.cos(car.h-Math.atan2(car.vy,car.vx))));
const body=(vx=0)=>({...restBody(),vx});
const physics=()=>makeDrivePhysics(TUNE);
function run(physics,car,steer,seconds,dt=1/120,brake=false){
  for(let i=0,n=Math.round(seconds/dt);i<n;i++)physics.steerPlayer(car,steer,brake,dt);
  return car;
}

// Launch and gears: base speed first, then the top speed creeps up on a straight.
const launch=body(),engine=physics();
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
const slide=body(d.baseSpeed),slider=physics();
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

// The bonus is a push over a fifth of a second, never a jump in one step.
const kicked=body(d.baseSpeed),kicker=physics();
run(kicker,kicked,1,1);
kicked.vx*=.6;kicked.vy*=.6;
let jump=0;
for(let i=0;i<60;i++){const was=speed(kicked);kicker.steerPlayer(kicked,0,false,1/120);jump=Math.max(jump,speed(kicked)-was);}
assert.ok(jump<d.bonusMax/.2/120+d.accel/120+.01,`The bonus adds at most ${(jump*3.6).toFixed(1)} km/h in one step`);
assert.ok(speed(kicked)>d.baseSpeed*.6+3,`The bonus still arrives: ${(speed(kicked)*3.6).toFixed(0)} km/h from ${(d.baseSpeed*.6*3.6).toFixed(0)}`);

// No bonus without a slide.
const short=body(d.baseSpeed),shorter=physics();
run(shorter,short,1,.1);run(shorter,short,0,1/120);
assert.ok(speed(short)<=d.baseSpeed,'A tap earns no bonus');

// Same result at 60 and 120 steps per second.
const fast=run(physics(),body(d.baseSpeed),1,1,1/120),slow=run(physics(),body(d.baseSpeed),1,1,1/60);
assert.ok(Math.abs(degrees(fast.h-slow.h))<3,`Cadence changes the turn by ${degrees(fast.h-slow.h).toFixed(2)} degrees`);
assert.ok(Math.abs(speed(fast)-speed(slow))<.05);

// Rolling back from a wall: the car pushes forward again instead of stopping dead or spinning.
const back=body(-3),reverser=physics();
reverser.steerPlayer(back,0,false,1/120);
assert.ok(Math.abs(back.vx-(-3+d.accel/120))<1e-9);
run(reverser,back,0,1);
assert.ok(back.vx>4 && Math.abs(back.vy)<1e-9);

// Every car carries its own steering state: one sliding does not change the other.
const pair=physics(),first=body(d.baseSpeed),second=body(d.baseSpeed),alone=body(d.baseSpeed);
for(let i=0;i<120;i++){pair.steerPlayer(first,1,false,1/120);pair.steerPlayer(second,0,false,1/120);}
run(physics(),alone,0,1);
assert.deepEqual(second,alone);

// Patrols: a short slide, and small corrections that neither drop the gear nor count as a held wheel.
const p=TUNE.patrol,clear={near:()=>false},chase=physics();
const cornering=body(p.baseSpeed),correcting=body(p.baseSpeed);
for(let i=0;i<240;i++){chase.steerPatrol(cornering,1,clear,1/120);chase.steerPatrol(correcting,.2,clear,1/120);}
assert.ok(Math.abs(slip(cornering))<=degrees(p.maxSlip)+.01 && Math.abs(slip(cornering))>degrees(p.maxSlip)-2,`Patrol slide ${slip(cornering).toFixed(1)} degrees`);
assert.ok(speed(correcting)>=p.baseSpeed-.01 && correcting.drifted===0 && correcting.h>0,'A light correction turns without slowing down');

// A car turning on the spot after a wall is never held at zero speed by its own sideways drift.
const pinned={...body(),vx:0,vy:.2},freer=physics();
run(freer,pinned,-1,1.5);
assert.ok(speed(pinned)>4,`A stopped car pulls away while steering, ${speed(pinned).toFixed(1)} m/s`);

// The lab's sliders can bring a duration down to zero: the car must keep finite numbers.
const zeroed=makeDrivePhysics({...TUNE,player:{...TUNE.player,bonusTime:0,bonusLeast:0}}),instant=body(d.baseSpeed);
for(let i=0;i<120;i++)zeroed.steerPlayer(instant,i<60?1:0,false,1/120);
assert.ok(Number.isFinite(instant.x+instant.y+instant.h+instant.vx+instant.vy),'A zero bonus time keeps the car finite');

// Surfaces. Off the road the car slows to the surface's share of its speeds within a second and slides wider;
// back on asphalt it drives exactly as before. Indices: 0 asphalt, 2 grass, 4 sand.
const on=(ground)=>makeDrivePhysics(TUNE,undefined,()=>ground);
const lawn={...body(d.topSpeed),gear:d.topSpeed},lawnCar=on(2);
for(let i=0;i<120;i++)lawnCar.steerPlayer(lawn,0,false,1/120);
assert.ok(Math.abs(speed(lawn)-d.topSpeed*TUNE.surfaces.grass.speed)<.3,`One second on grass: ${(speed(lawn)*3.6).toFixed(0)} km/h`);
const beach={...body(d.topSpeed),gear:d.topSpeed},beachCar=on(4);
for(let i=0;i<120;i++)beachCar.steerPlayer(beach,0,false,1/120);
const sandShare=speed(beach)/d.topSpeed;
assert.ok(sandShare>TUNE.surfaces.sand.speed-.01 && sandShare<TUNE.surfaces.sand.speed+.02,`Sand holds ${(sandShare*100).toFixed(0)}% of the top speed, no less`);
const lawnSlide=body(d.baseSpeed*TUNE.surfaces.grass.speed);
for(let i=0;i<120;i++)lawnCar.steerPlayer(lawnSlide,1,false,1/120);
assert.ok(Math.abs(slip(lawnSlide))>degrees(d.maxSlip)+5,`Grass lets the slide open to ${slip(lawnSlide).toFixed(0)} degrees`);
// Leaving the grass: the shares come back and the car is the asphalt car again.
let ground=2;const mixed=makeDrivePhysics(TUNE,undefined,()=>ground),leaving=body(d.baseSpeed);
for(let i=0;i<240;i++){if(i===60)ground=0;mixed.steerPlayer(leaving,i%40<20?1:0,false,1/120);}
assert.ok(leaving.pace===1 && leaving.grip===1 && Number.isFinite(leaving.x+leaving.y+leaving.vx),'Back on asphalt the shares return to one');
// Patrols off the road slow down too.
const field=body(p.topSpeed),patrolOnGrass=on(2);
for(let i=0;i<120;i++)patrolOnGrass.steerPatrol(field,0,clear,1/120);
assert.ok(speed(field)<p.topSpeed*TUNE.surfaces.grass.speed+.3,'A patrol slows on grass');

// Chases on the pilot's streets. The previous handling reached the player in 22 of these 40 runs, at 41 km/h.
const chase40=await chaseRuns();
const reserve=await chaseRuns(true);
assert.ok(reserve.runs===20 && reserve.reached>=16 && reserve.wreck<=3,JSON.stringify(reserve));
assert.ok(chase40.runs===40 && chase40.reached>=34 && chase40.wreck<=3 && chase40.stuck<=4,`Chases: ${JSON.stringify(chase40)}`);

console.log(`Handling QA passed (chases ${chase40.reached}/${chase40.runs} at ${chase40.pace.toFixed(0)} km/h, base speed at ${seconds.toFixed(2)} s, 100 ms tap ${tap.heading.toFixed(1)} degrees, slide limit ${degrees(d.maxSlip).toFixed(0)} degrees, 60 vs 120 Hz ${degrees(fast.h-slow.h).toFixed(2)} degrees)`);
