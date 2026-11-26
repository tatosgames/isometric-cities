import assert from 'node:assert/strict';
import test from 'node:test';
import {createAdaptiveQuality} from './adaptive-quality.ts';

const levels=[{particles:16},{particles:32},{particles:80}];
const profile={levels,initialIndex:1,baseIndex:1,calibrate:true,detect30Fps:true};

function timeline(controller){
  let now=0;
  return (fps,frames,mode='moving',overrides={})=>{
    for(let i=0;i<frames;i++){
      now+=1000/fps;
      controller.sample(now,{mode,ready:true,...overrides});
    }
  };
}

test('a custom particle profile can calibrate, promote, and restore its baseline',()=>{
  const quality=createAdaptiveQuality(profile);
  const run=timeline(quality);
  assert.equal(quality.level,levels[1]);
  quality.beginCalibration(0);
  run(30,100,'calibration');
  assert.equal(quality.state.targetFps,30);
  assert.equal(quality.state.level,levels[2]);
  assert.equal(quality.state.trial,true);
  assert.ok(Math.abs(quality.state.p95Ms-1000/30)<.01);
  assert.ok(Math.abs(quality.state.fps-30)<.01);
  run(30,70,'calibration');
  assert.equal(quality.state.trial,false);
  run(30,300,'resting');
  assert.equal(quality.level,levels[2]);
  run(24,70);
  assert.equal(quality.level,levels[1]);
  assert.equal(quality.reset(),levels[1]);
  assert.equal(quality.calibrationPending,true);
  assert.equal(quality.state.targetFps,60);
  assert.equal(quality.state.fps,null);
});

test('unfinished effects roll back and idle time preserves the cooldown',()=>{
  const quality=createAdaptiveQuality({...profile,calibrate:false});
  const run=timeline(quality);
  run(60,490);
  assert.equal(quality.state.trial,true);
  run(60,365,'moving',{preparing:true});
  assert.equal(quality.level,levels[1]);
  assert.equal(quality.state.trial,false);
  const remaining=quality.state.cooldownMs;
  assert.ok(remaining>29000);
  run(30,150,'resting');
  assert.equal(quality.state.cooldownMs,remaining);
  run(60,120);
  assert.ok(quality.state.cooldownMs<remaining);
});

test('a single level is valid and invalid indices fail at construction',()=>{
  const only=createAdaptiveQuality({levels:[0],initialIndex:0,baseIndex:0,calibrate:true});
  assert.equal(only.calibrationPending,false);
  timeline(only)(60,800);
  assert.equal(only.level,0);
  assert.throws(()=>createAdaptiveQuality({...profile,baseIndex:-1}),RangeError);
  assert.throws(()=>createAdaptiveQuality({...profile,levels:[]}),RangeError);
});

test('flag presets apply at startup, trial, rollback and reset, once per transition',()=>{
  const flags=[{shadows:false,fxaa:false},{shadows:true,fxaa:false},{shadows:true,fxaa:true}];
  const applied=[];
  const quality=createAdaptiveQuality({levels:flags,baseIndex:0,initialIndex:0,applyLevel:value=>applied.push(value)});
  const run=timeline(quality);
  run(60,670);
  run(60,490);
  assert.deepEqual(applied,[flags[0],flags[1],flags[2]]);
  quality.interrupt();
  quality.interrupt();
  assert.deepEqual(applied,[flags[0],flags[1],flags[2],flags[1]]);
  quality.reset();
  assert.equal(applied.at(-1),flags[0]);
});
