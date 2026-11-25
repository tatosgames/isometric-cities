import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeGuagua,resolveGuaguaContact,validGuagua} from '../src/drive/guagua.ts';

import {makeDrivePhysics,restBody} from '../src/drive/drive-physics.ts';
import {buildDriveWorld} from '../src/drive/drive-world.ts';
import {chaseSteer} from '../src/drive/drive-chase.ts';
import {TUNE} from '../src/drive/drive-tune.ts';

const data=JSON.parse(readFileSync(new URL('../public/data/guaguas.json',import.meta.url)));
assert.ok(validGuagua(data));
assert.equal(validGuagua({...data,stops:[...data.stops].reverse()}),false);
const bus=makeGuagua(data),dt=1/120;
const visible=()=>true;
for(const stop of data.stops){
  let approach=false;
  for(let steps=0;steps<120*120 && bus.state.distance<stop.distance;steps++){
    const before=bus.state.speed;
    bus.step(dt,visible);
    if(bus.state.braking && bus.state.speed>0 && bus.state.speed<before)approach=true;
  }
  assert.ok(approach,'Bus should brake before the stop');
  assert.equal(bus.state.distance,stop.distance);
  assert.equal(bus.state.stopped,3);
  for(let i=0;i<360;i++){
    bus.step(dt,visible);
    assert.equal(bus.state.distance,stop.distance);
    assert.equal(bus.state.speed,0);
  }
  for(let i=0;i<2;i++)bus.step(dt,visible);
  assert.ok(bus.state.distance>stop.distance);
}
for(let i=0;i<1500;i++)bus.step(dt,visible);
const end=data.path.at(-1);
assert.deepEqual([bus.state.x,bus.state.y],end);
for(const endpoint of [end,data.path[0]]){
  bus.step(dt,point=>point===endpoint);
  assert.deepEqual([bus.state.x,bus.state.y],end);
}
bus.step(dt,()=>false);
assert.equal(bus.state.distance,0);

// Replay the same chase at La Portadilla with the game physics and the pilot's
// actual obstacles. The passing run approaches on the left of the guagua.
const pilot=JSON.parse(readFileSync(new URL('../public/data/pilot.json',import.meta.url)));
const world=buildDriveWorld(pilot,()=>0,TUNE), physics=makeDrivePhysics(TUNE);
while(bus.state.distance!==data.stops[1].distance)bus.step(dt,visible);
const {x,y,h}=bus.state,fx=Math.cos(h),fy=Math.sin(h);
function vehicle(along,side,speed){
  return {...restBody(),x:x+fx*along-fy*side,y:y+fy*along+fx*side,h,vx:speed*fx,vy:speed*fy,node:-1};
}
function encounter(side){
  const player=vehicle(-12,side,10),patrol=vehicle(-20,0,14);
  let playerHits=0,patrolHits=0;
  const field=world.routesFrom(world.nearestNode(x,y));
  for(let step=0;step<200;step++){
    physics.steerPlayer(player,0,false,dt);
    if(resolveGuaguaContact(bus.state,player,TUNE.radius))playerHits++;
    physics.collide(player,world);
    const steer=chaseSteer(patrol,player,world,field.prev,TUNE);
    assert.notEqual(steer,null);
    physics.steerPatrol(patrol,steer,world,dt);
    if(resolveGuaguaContact(bus.state,patrol,TUNE.radius))patrolHits++;
    physics.collide(patrol,world);
    physics.bump(patrol,player);
    resolveGuaguaContact(bus.state,player,TUNE.radius);
    resolveGuaguaContact(bus.state,patrol,TUNE.radius);
  }
  const ahead=car=>(car.x-x)*fx+(car.y-y)*fy;
  return {player:ahead(player),patrol:ahead(patrol),playerHits,patrolHits};
}
const queued=encounter(0),passed=encounter(2.45);
assert.ok(queued.playerHits>0 && queued.player<0);
assert.ok(passed.playerHits===0 && passed.player>6 && passed.patrolHits>0 && passed.patrol<0);
const turning={x:0,y:0,h:Math.PI/2,speed:4};
const alongside={x:-1.9,y:0,vx:2,vy:7};
assert.ok(resolveGuaguaContact(turning,alongside,1.15));
assert.ok(Math.abs(alongside.vx)<1e-10 && alongside.vy===7,'Side scrape must preserve forward motion');
const inside={x:0,y:0,vx:0,vy:0};
resolveGuaguaContact(turning,inside,1.15);
assert.ok(Math.hypot(inside.x,inside.y)>=2.24,'Separate even a coincident centre');
console.log('Guagua motion QA passed (braking, both dwells, offscreen restart, overtaking and oriented contacts)');
