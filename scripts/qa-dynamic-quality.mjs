import assert from 'node:assert/strict';
import {makeDynamicQuality,compactScreen,renderPixelRatio} from '../src/render/dynamic-quality.ts';

function device(compact=true,solarShadows=true){
  const policy=makeDynamicQuality({compact,solarShadows});
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
const matcap=device(false,false);
assert.equal(matcap.policy.config.stage,1);
assert.equal(matcap.policy.config.shadows,'static');
assert.equal(matcap.run(20,3.2,'resting').shadows,'off','the first Matcap reduction changes the rendered shadows');
assert.equal(matcap.run(60,12).stage,1,'the Matcap profile cannot promote to a duplicate level');
const idleDesktop=device(false);
assert.equal(idleDesktop.run(30,10,'resting').shadows,'solar');
assert.equal(idleDesktop.policy.state.targetFps,30);
assert.equal(idleDesktop.run(20,2.4,'resting').shadows,'solar');
assert.equal(idleDesktop.run(30,2,'resting').shadows,'solar','a smooth interval clears the slowdown');
assert.equal(idleDesktop.run(20,2.5,'resting').shadows,'solar');
assert.equal(idleDesktop.run(45,1).shadows,'solar','movement starts a fresh measurement');
assert.equal(idleDesktop.policy.state.targetFps,60);
assert.equal(idleDesktop.run(20,3.2,'resting').shadows,'static');
assert.equal(idleDesktop.run(20,3.2,'resting').shadows,'off');
assert.equal(idleDesktop.run(30,15,'resting').shadows,'off','idle can lower quality only');
const idleStall=device(false);
idleStall.policy.sample(0,{mode:'resting',ready:true});
idleStall.policy.sample(4000,{mode:'resting',ready:true});
assert.equal(idleStall.policy.config.shadows,'solar','a single stalled frame is not sustained low FPS');
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
// Frame indices for this sequence. Since loading frames keep the window running (they count towards a
// reduction, never a promotion), the stages match the original city controller within ten frames.
assert.deepEqual(stageTrace(true),[[181,1],[991,2],[1593,3],[1706,2],[1755,1],[1804,0],[1853,-1],[1902,-2],[2527,-1],[2829,0]]);
assert.deepEqual(stageTrace(false),[[1741,1],[1790,0],[1839,-1],[1888,-2]]);
console.log('Dynamic quality: profiles, timing, recovery, interrupts and cooldowns passed.');

const display=device();
display.policy.updateViewport(390,844,1);
assert.equal(display.run(60,40).stage,2,'DPR 1.25 would render the same pixels on this display');
display.policy.updateViewport(390,844,2);
assert.equal(display.run(60,12).stage,3,'retina display makes the next step available');
display.policy.updateViewport(390,844,1);
assert.equal(display.policy.config.stage,2,'changing back to DPR 1 clamps only the redundant step');

// A desktop may be fast at street level and reach a stable 30 Hz over the city.
const recorded=[];
const air=makeDynamicQuality({compact:false,onDecision:e=>recorded.push(e)});
let airNow=0;
function airFrames(fps,seconds,options={}){
  for(let i=0;i<Math.ceil(seconds*fps);i++)
    air.sample(airNow+=1000/fps,{mode:'moving',ready:true,...options});
}
air.updateViewport(3840,2160,1);
const onStreet=air.config;
assert.equal(air.setFlight(true).flight.detailRadius,240);
assert.equal(renderPixelRatio(air.config,1),.5,'UHD CSS viewport produces a 1080p flight buffer');
assert.equal(air.setFlight(true),null);
airFrames(30,3);
assert.equal(air.state.targetFps,30);
assert.equal(air.config.stage,0);
airFrames(30,7);
assert.equal(air.state.trial,true);
assert.equal(air.config.stage,1);
airFrames(18,3);
assert.equal(air.config.stage,0);
assert.ok(recorded.some(e=>e.mode==='flight' && e.action==='cancel' && e.reason==='slow'));
airFrames(20,4.5);
assert.equal(air.config.dprScale,.7);
const airborne=air.config;
assert.deepEqual(air.setFlight(false),onStreet);
airFrames(60,2);
airNow+=900000;
assert.deepEqual(air.setFlight(true),airborne);
airFrames(60,.6);
assert.equal(air.config.stage,-2);
assert.ok(air.state.p95Ms<18,'the inactive interval is not a drawn frame');
air.restore(1);
assert.equal(air.config.flight.detailRadius,240);
assert.deepEqual(air.setFlight(false),onStreet);
airFrames(45,2.6);
assert.equal(air.config.stage,1);
air.setFlight(true);
air.restore(1);
assert.equal(air.setFlight(false).stage,1,'context recovery in flight preserves the ground decision');
airFrames(60,8.6);
assert.equal(air.state.trial,true);
air.setFlight(true);
air.setFlight(false);
assert.equal(air.config.stage,1,'takeoff cancels a ground promotion before returning to the street');

const preparingFlight=device(false);
preparingFlight.policy.setFlight(true);
preparingFlight.run(60,8.5);
assert.ok(preparingFlight.policy.state.trial);
preparingFlight.policy.sample(16000,{mode:'moving',ready:true,preparing:true});
assert.equal(preparingFlight.policy.config.stage,0,'incomplete horizon resources roll back a trial');
preparingFlight.policy.restore(2);
assert.equal(preparingFlight.run(60,45).stage,0,'safe recovery limits both flight and ground');
assert.equal(preparingFlight.policy.setFlight(false).shadows,'off');
fixed.setFlight(true);
assert.equal(fixed.config.shadows,'off','safe recovery takes priority over a fixed preview');
console.log('Flight quality: 1080p cap, 30 Hz, trial rollback, reduction, mode isolation and WebGL recovery passed.');
