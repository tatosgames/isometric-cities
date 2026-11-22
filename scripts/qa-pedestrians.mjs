import assert from 'node:assert/strict';
import {makePedestrians, PEDESTRIANS} from '../src/drive/pedestrians.ts';

function seeded(seed) {
  return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
}
const footway = [{kind:'footway',line:[[0,0],[100,0],[200,0]]}];

// Drive a car along the footway at full speed and check every walker on every frame.
function run(free, label) {
  const people = makePedestrians(footway,[],{free},16,PEDESTRIANS,seeded(7));
  const car = {x:20,y:0,vx:16.5,vy:0};
  people.reset(car);
  const started = people.walkers.filter(w => w.alive).length;
  assert.ok(started >= 8, label + ': expected walkers at the start, got ' + started);
  let fled = 0, vaulted = 0, closest = Infinity;
  for (let frame = 0; frame < 600; frame++) {
    car.x += car.vx / 60;
    people.update(1/60,car,[car]);
    for (const w of people.walkers) {
      if (!w.alive) continue;
      assert.ok(free(w.x,w.y,PEDESTRIANS.radius), label + ': walker inside an obstacle');
      if (w.alarm > 0) fled++;
      if (w.air > 0) { vaulted++; continue; }
      const gap = Math.hypot(w.x-car.x,w.y-car.y);
      closest = Math.min(closest,gap);
      assert.ok(gap >= PEDESTRIANS.clear - 1e-6, label + ': walker on the ground ' + gap.toFixed(2) + ' m from the car');
    }
  }
  return {fled,vaulted,closest};
}

// Open ground: walkers sidestep and nobody needs to jump.
const open = run(() => true,'open ground');
assert.ok(open.fled > 0,'Walkers should flee an approaching car');
assert.equal(open.vaulted,0,'Walkers with room should sidestep, not vault');

// A corridor two metres wide leaves no room beside the car: walkers vault it.
const corridor = run((x,y,r) => Math.abs(y) + r <= 1,'corridor');
assert.ok(corridor.vaulted > 0,'Walkers with no room should vault the car');

// A parked car alarms nobody that is not touching it.
const calm = makePedestrians(footway,[],{free:() => true},16,PEDESTRIANS,seeded(3));
const parked = {x:100,y:0,vx:0,vy:0};
calm.reset(parked);
for (let frame = 0; frame < 120; frame++) calm.update(1/60,parked,[parked]);
assert.ok(calm.walkers.filter(w => w.alive && w.alarm > 0)
  .every(w => Math.hypot(w.x-parked.x,w.y-parked.y) < 4),'A parked car should only move walkers that touch it');

console.log('Pedestrian QA passed (closest on the ground: ' + open.closest.toFixed(2) + ' m, clearance ' + PEDESTRIANS.clear + ' m)');
