import assert from 'node:assert/strict';
import {makeDynamicQuality,compactScreen,renderPixelRatio} from '../src/render/dynamic-quality.ts';

function device(compact=true){
  const policy=makeDynamicQuality({compact});
  let now=0;
  const steps=[];
  function run(fps,seconds,mode='moving',ready=true){
    for(let i=0;i<Math.ceil(fps*seconds);i++){
      now+=1000/fps;
      const changed=policy.sample(now,{mode,ready});
      if(changed)steps.push(changed.stage);
    }
    return policy.config;
  }
  return {policy,run,steps,probe(){policy.beginCalibration(now);}};
}
for(const fps of [60,120]){
  const {policy,run,steps,probe}=device();
  assert.deepEqual(policy.config,{stage:0,sky:true,shadows:'off',antialias:'off',dprCap:1,dprScale:1});
  probe();
  assert.equal(run(fps,2.9,'calibration').stage,0);
  assert.equal(run(fps,.3,'calibration').stage,1);
  assert.equal(run(fps,2.3,'calibration').antialias,'off');
  assert.equal(policy.calibrating,false);
  assert.equal(run(30,31,'resting').stage,1);
  assert.equal(run(fps,8.6).antialias,'fxaa');
  assert.equal(run(fps,14).dprScale,1.25);
  steps.length=0;
  run(45,14);
  assert.deepEqual(steps,[2,1,0,-1,-2]);
  assert.equal(policy.config.dprScale,.7);
}
for(const reason of ['input','busy','timeout','slow']){
  const {policy,run,probe}=device();probe();run(60,3.2,'calibration');
  assert.equal(policy.config.shadows,'static');
  if(reason==='input')policy.interrupt();
  if(reason==='busy')run(60,.1,'calibration',false);
  if(reason==='timeout')policy.sample(15000,{mode:'calibration',ready:true});
  if(reason==='slow')run(45,2.5,'calibration');
  assert.equal(policy.config.stage,0,reason);
  assert.equal(policy.calibrating,false);
  run(30,40,'resting');
  assert.equal(run(60,25).stage,0,'idle must not shorten failed-promotion cooldown');
  assert.equal(run(60,6).stage,1);
}
const desktop=device(false);
const capped=device();
capped.probe();
assert.equal(capped.run(30,5.5,'calibration').shadows,'static');
assert.equal(capped.policy.calibrating,false);
assert.equal(capped.run(30,9).antialias,'fxaa');
assert.equal(capped.run(24,1.7).stage,1,'a costly promotion must roll back even at the 30 fps target');
assert.equal(capped.run(28,5).stage,1,'dead band near 30');
assert.equal(capped.run(25,3).stage,0);
const loadDrop=device();
loadDrop.run(60,11);
assert.equal(loadDrop.run(30,2.7).stage,0,'protect an established 60 fps rate first');
assert.equal(loadDrop.run(30,5).dprScale,1,'a cheaper baseline still paced at 30 does not need less resolution');
assert.equal(loadDrop.run(30,12).shadows,'static');
const capLifted=device();
capLifted.probe();
capLifted.run(30,5.5,'calibration');
capLifted.run(60,3);
assert.equal(capLifted.run(30,3).stage,0,'protect 60 again when the cap lifts');
assert.equal(capLifted.run(60,6).stage,0,'keep the cheaper setting when it restores 60');
const uneven=makeDynamicQuality({compact:true});
let clock=0;
for(let n=0;n<160;n++){
  clock+=n%2?50:1000/60;
  uneven.sample(clock,{mode:'moving',ready:true});
}
assert.ok(uneven.config.stage<0,'uneven frames averaging 30 must not qualify as a stable cap');
assert.equal(desktop.policy.config.shadows,'solar');
assert.equal(desktop.policy.config.antialias,'native');
assert.equal(desktop.policy.config.dprScale,1);
assert.equal(desktop.run(45,2.6).shadows,'static');
desktop.policy.restore(2);
assert.equal(desktop.run(60,45).shadows,'off');
assert.equal(desktop.run(30,5.5).dprScale,.7*.75);
assert.equal(compactScreen(false,900,650),true);
assert.equal(compactScreen(false,700,900),false);
assert.equal(compactScreen(true,1400,1000),true);
const fixed=makeDynamicQuality({compact:true,preview:'fxaa'});
assert.equal(fixed.config.antialias,'fxaa');
assert.equal(fixed.config.shadows,'static');
assert.equal(renderPixelRatio(fixed.config,3),1);
fixed.beginCalibration(0);
assert.equal(fixed.calibrating,false);
assert.equal(fixed.restore(2).shadows,'off');
assert.equal(renderPixelRatio(fixed.config,3),.75);
assert.equal(makeDynamicQuality({compact:false,preview:'static'}).config.antialias,'native');
const startup=device();
startup.run(60,.5);
startup.run(30,.5,'resting');
assert.equal(startup.policy.calibrationPending,true,'automatic camera movement must allow the initial probe');
startup.policy.interrupt();
assert.equal(startup.policy.calibrationPending,false);
assert.equal(makeDynamicQuality({compact:true,sky:false}).allowSky(true),false);
const stalled=makeDynamicQuality({compact:true});
for(let t=0;t<=8500;t+=1000/60)stalled.sample(t,{mode:'moving',ready:true});
assert.equal(stalled.config.stage,1);
stalled.sample(15000,{mode:'moving',ready:true,preparingShadows:true});
assert.equal(stalled.config.stage,0,'a pending mask must not block rollback');
function stageTrace(compact){
  const quality=makeDynamicQuality({compact});
  const rows=[];
  let frame=0,now=0;
  function run(fps,count,mode,ready=true){
    for(let n=0;n<count;n++){
      frame++;now+=1000/fps;
      const change=quality.sample(now,{mode,ready});
      if(change)rows.push([frame,change.stage]);
    }
  }
  quality.beginCalibration(now);
  run(60,330,'calibration');run(30,90,'resting');run(60,80,'moving',false);
  run(60,1200,'moving');run(24,350,'moving');run(30,850,'moving');
  return rows;
}
// Frame indices recorded from the original city controller for this sequence.
assert.deepEqual(stageTrace(true),[[181,1],[981,2],[1583,3],[1702,2],[1751,1],[1800,0],[1849,-1],[1898,-2],[2522,-1],[2824,0]]);
assert.deepEqual(stageTrace(false),[[1749,1],[1798,0],[1847,-1],[1896,-2]]);
console.log('Dynamic quality: profiles, timing, recovery, interrupts and cooldowns passed.');
