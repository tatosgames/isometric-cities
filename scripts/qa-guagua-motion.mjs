import assert from 'node:assert/strict';
import {guaguaHit,guaguaState,validGuagua} from '../src/drive/guagua.ts';

const data = {
  line:'QA', direction:'test',
  path:[[0,0],[12,0],[24,0],[36,0]],
  stops:[
    {id:'a',name:'Primera',position:[12,0],distance:12},
    {id:'b',name:'Segunda',position:[24,0],distance:24}
  ]
};
assert.equal(validGuagua(data),true);
assert.equal(validGuagua({}),false);

let state = guaguaState(data,null,.25);
assert.ok(state.distance > 0 && state.x > 0 && state.speed > 0,'Bus should leave its spawn point');
let elapsed = 0;
while (state.distance < 12) { state = guaguaState(data,state,.25); elapsed += .25; }
assert.equal(state.distance,12,'Bus should snap to the first stop');
assert.equal(state.speed,0,'Bus should stop at a source stop');
const dwell = state.stopped;
assert.ok(dwell > 2.9 && dwell <= 3,'Stop dwell should be three seconds');
state = guaguaState(data,state,dwell);
state = guaguaState(data,state,.5);
assert.ok(state.distance > 12,'Bus must depart after its dwell');

// The route loops when it reaches its final point, so a stale bus never remains
// outside the playable area or accumulates an unbounded distance.
let wrapped = state;
for (let i=0;i<30;i++) wrapped = guaguaState(data,wrapped,1);
assert.ok(wrapped.distance >= 0 && wrapped.distance <= 36);
assert.ok([wrapped.x,wrapped.y,wrapped.h,wrapped.speed].every(Number.isFinite));

const bus = {x:0,y:0,h:0,distance:0,speed:8,stopped:0};
assert.ok(guaguaHit(bus,{x:4,y:0,vx:12,vy:0}) > 0,'A closing car should be slowed by the bus');
assert.equal(guaguaHit(bus,{x:4,y:0,vx:2,vy:0}),0,'A car moving away should not be pushed');
assert.equal(guaguaHit(bus,{x:20,y:0,vx:30,vy:0}),0,'A distant car should not collide');

console.log('Guaguas motion QA passed (spawn, stop dwell, departure, loop and collision)');
