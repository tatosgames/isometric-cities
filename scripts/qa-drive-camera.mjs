import assert from 'node:assert/strict';
import {Vector3,MathUtils} from 'three';
import {driveLookAhead,makeDriveCamera} from '../src/drive/drive-camera.ts';
import {TUNE} from '../src/drive/drive-tune.ts';

for(const [kmh,metres] of [[0,0],[5,2.5],[10,5],[50,8.5],[90,12],[100,12]]){
  assert.equal(driveLookAhead(kmh/3.6,TUNE.player.maxSpeed),metres);
}

const direction=new Vector3(-.82,1.15,.68).normalize();
const clear=()=>false;
const car={vx:10,vy:0};
function run(rate){
  const rig=makeDriveCamera(direction);
  const step=(seconds,blocked=clear)=>{
    let pose;
    for(let i=0;i<Math.round(seconds*rate);i++)pose=rig.update(1/rate,car,blocked);
    return pose;
  };
  rig.enter();rig.startHeading(0);
  assert.ok(step(1).direction.distanceTo(direction)<1e-9);
  rig.cycle();step(1);
  // East to north, then a U-turn. Cross the azimuth seam by the short arc.
  car.vx=0;car.vy=10;
  let yaw=step(.5).yaw;
  assert.ok(Math.abs(Math.atan2(Math.sin(yaw-Math.PI),Math.cos(yaw-Math.PI)))<=MathUtils.degToRad(50.01));
  step(3);car.vy=-10;
  const turn=step(1).direction.clone();
  car.vy=0;
  yaw=step(1).yaw;
  assert.equal(step(1).yaw,yaw);
  rig.cycle();step(1);
  const blocked=(x,y)=>Math.hypot(x,y)>.2;
  assert.ok(step(1,blocked).pitch>MathUtils.degToRad(78));
  assert.ok(step(.4).pitch>MathUtils.degToRad(78));
  assert.ok(step(3).pitch<MathUtils.degToRad(49));
  car.vx=10;
  return turn;
}
assert.ok(run(30).distanceTo(run(120))<.02);
const rotated=direction.clone().applyAxisAngle(new Vector3(0,1,0),Math.PI/2);
const rig=makeDriveCamera(direction);
rig.enter(rotated);
assert.ok(rig.update(1/60,car,clear).direction.distanceTo(rotated)<1e-9);
console.log('Drive camera turn, stop, occlusion and frame-rate checks passed');
