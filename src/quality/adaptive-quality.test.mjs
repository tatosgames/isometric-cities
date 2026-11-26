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

test('decision events describe each transition once with the last completed measurement',()=>{
  const events=[];
  const q=createAdaptiveQuality({...profile,onDecision:event=>events.push(event)});
  q.beginCalibration(0);
  const run=timeline(q);
  run(30,170,'calibration');
  run(30,300,'resting');
  run(24,75);
  assert.deepEqual(events.map(e=>[e.action,e.reason]),[
    ['calibration','startup'],['trial','stable'],['confirm','stable'],['reduce','slow']
  ]);
  assert.equal(events[0].fps,null);
  const last=events.at(-1);
  assert.equal(last.targetFps,30);
  assert.equal(last.from,levels[2]);
  assert.equal(last.to,levels[1]);
  assert.ok(Math.abs(last.p95Ms-1000/24)<.01);
});

test('input, loading, and preparation timeout explain separate cancellations',()=>{
  for(const reason of ['input','loading','preparing']){
    const events=[];
    const q=createAdaptiveQuality({...profile,onDecision:event=>events.push(event)});
    q.beginCalibration(0);
    timeline(q)(60,200,'calibration');
    if(reason==='input')q.interrupt('input');
    else q.sample(reason==='loading'?3500:6100,{mode:'calibration',ready:reason!=='loading',preparing:reason==='preparing'});
    assert.equal(events.at(-1).action,'cancel');
    assert.equal(events.at(-1).reason,reason);
    assert.equal(events.at(-1).to,levels[1]);
    q.interrupt();
    assert.equal(events.length,3);
  }
});

test('reset during a trial applies the starting level once, directly from the trial',()=>{
  const applied=[],events=[];
  const q=createAdaptiveQuality({...profile,applyLevel:v=>applied.push(v),onDecision:e=>events.push(e)});
  q.beginCalibration(0);
  timeline(q)(60,200,'calibration');
  applied.length=events.length=0;
  q.reset();
  assert.deepEqual(applied,[levels[1]]);
  assert.deepEqual(events.map(e=>[e.action,e.from,e.to]),[['reset',levels[2],levels[1]]]);
});

test('an unavailable promotion never leaves a calibration pending or running',()=>{
  const q=createAdaptiveQuality(profile);
  q.setMaxIndex(1);
  assert.equal(q.calibrationPending,false);
  q.setMaxIndex(2);
  assert.equal(q.calibrationPending,true);
  q.beginCalibration(0);
  q.setMaxIndex(1);
  assert.equal(q.calibrating,false);
  q.setMaxIndex(2);
  assert.equal(q.calibrationPending,false);
});

test('a neutral measurement cancels a probe without reporting a slow frame rate',()=>{
  const events=[];
  const q=createAdaptiveQuality({...profile,onDecision:e=>events.push(e)});
  q.beginCalibration(0);
  timeline(q)(55,200,'calibration');
  assert.equal(events.at(-1).reason,'insufficient-headroom');
});

test('a stale timestamp cannot inflate the following measured frame',()=>{
  const q=createAdaptiveQuality({...profile,calibrate:false});
  const frame={mode:'moving',ready:true};
  for(let t=0;t<=1000;t+=20){
    q.sample(t,frame);
    q.sample(t-100,frame);
  }
  assert.equal(q.state.fps,50);
  assert.equal(q.state.p95Ms,20);
});

test('slow frames while loading still reduce quality, but smooth loading never promotes',()=>{
  const top={...profile,calibrate:false,detect30Fps:false,initialIndex:2};
  const slow=createAdaptiveQuality(top);
  // Streaming flips readiness every few frames, as a panned map does.
  let now=0;
  for(let i=0;i<150;i++){now+=1000/40;slow.sample(now,{mode:'moving',ready:i%3===0});}
  assert.equal(slow.level,levels[1]);
  assert.equal(slow.state.fps!==null,true);

  const smooth=createAdaptiveQuality({...top,initialIndex:1});
  const run=timeline(smooth);
  run(60,700,'moving',{ready:false});
  assert.equal(smooth.level,levels[1]);
  assert.equal(smooth.state.trial,false);
  run(60,700);
  assert.equal(smooth.level,levels[2]);
});
