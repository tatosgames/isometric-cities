export type QualityMode = 'calibration' | 'moving' | 'resting';
export interface DynamicQualityConfig {
  shadows: 'off' | 'static' | 'solar';
  antialias: 'off' | 'fxaa' | 'native';
  dprCap: number;
  dprScale: number;
  stage: number;
  sky: boolean;
}

export function compactScreen(coarse=matchMedia('(pointer:coarse)').matches,width=screen.width,height=screen.height){
  return coarse || Math.min(width,height)<700;
}

export function renderPixelRatio(config:Pick<DynamicQualityConfig,'dprScale'|'dprCap'>,physical=devicePixelRatio){
  return Math.min(physical, Math.min(physical,config.dprCap)*config.dprScale);
}

// Baked into geometry or reserved at startup. A frame-rate transition never rebuilds a city sector.
const compactDetail={
  sectorMiB:58,shadowMiB:12,zoneSpan:3200,walkers:26,roofDetails:24,crownSubdivisions:0,fronds:8,crowns:4,
  simplifiedBuildings:true,parapetWidth:.56,contactTint:true,treeGroundShade:true,overviewNormals:false
} as const;
const standardDetail={
  sectorMiB:115,shadowMiB:24,zoneSpan:6000,walkers:40,roofDetails:60,crownSubdivisions:1,fronds:13,crowns:7,
  simplifiedBuildings:false,parapetWidth:0,contactTint:false,treeGroundShade:false,overviewNormals:true
} as const;
export function cityDetail(compact:boolean){return compact?compactDetail:standardDetail;}

// The authoring viewport uses a fixed resolution for precise placement at any device size.
export const editorQuality={antialias:'native',dprCap:2,dprScale:1} as const;

/** Steps -2 and -1 reduce the drawing buffer below the original profile.
 * Calibration only tries step 1. Subsequent promotions need real activity. */
export function makeDynamicQuality({compact,losses=0,preview,sky=true}:{
  compact:boolean;losses?:number;preview?:string|null;sky?:boolean;
}){
  let safe=losses>=2, skyAllowed=true;
  const fixed=preview==='base'||preview==='static'||preview==='fxaa';
  let pending=compact && !safe && !fixed;
  let stage=initialStage();
  let probeStart:number|null=null, trial=false;
  let trialDeadline=0;
  let previous:number|null=null, mode:QualityMode='resting';
  let total=0,goodMs=0,badMs=0,trialMs=0,backoff=0;
  let targetFps:30|60=60, observedFast=false, reducedForLoad=false, fastMs=0, steady30Ms=0;
  const intervals:number[]=[];
  function initialStage(){return compact||safe?0:3;}
  function config():DynamicQualityConfig{
    let shadows:DynamicQualityConfig['shadows']=stage<1?'off':'static';
    if(!compact && stage===3)shadows='solar';
    let antialias:DynamicQualityConfig['antialias']=compact?'off':'native';
    if(compact && stage>=2)antialias='fxaa';
    if(fixed && !safe){
      shadows=preview==='base'?'off':'static';
      if(preview==='fxaa')antialias='fxaa';
    }
    let scale=1;
    if(stage<0)scale=stage===-2?.7:.85;
    else if(compact && stage===3)scale=1.25;
    return {shadows,antialias,dprCap:compact?1:1.75,dprScale:safe?scale*.75:scale,stage,sky:sky && skyAllowed};
  }
  function clearWindow(){previous=null;total=0;intervals.length=0;goodMs=badMs=trialMs=fastMs=steady30Ms=0;}
  function interrupt(){
    pending=false;
    const rollback=trial;
    if(rollback){stage=nextStep(-1);backoff=30000;}
    trial=false;probeStart=null;clearWindow();
    return rollback?config():null;
  }
  function reset(){
    interrupt();backoff=0;targetFps=60;observedFast=false;reducedForLoad=false;stage=initialStage();return config();
  }
  function nextStep(direction:1|-1){
    // Desktop uses its native antialiasing throughout. Static shadows need a single step.
    const next=stage+direction;
    return !compact && next===2?next+direction:next;
  }
  function sample(now:number,input:{mode:QualityMode;ready:boolean;preparingShadows?:boolean}):DynamicQualityConfig|null{
    if((fixed && !safe) || !Number.isFinite(now))return null;
    if(trial && now>=trialDeadline)return interrupt();
    const probeAge=probeStart===null?null:now-probeStart;
    const probing=probeAge!==null;
    if(probing && (input.mode!=='calibration'||!input.ready||probeAge>=6000))return interrupt();
    if(input.mode==='resting'){
      if(mode!=='resting'){
        mode='resting';
        if(trial)return interrupt();
        clearWindow();
      }
      return null;
    }
    if(mode!==input.mode){clearWindow();mode=input.mode;}
    if(!input.ready || (trial && input.preparingShadows)){clearWindow();return null;}
    if(probing && probeAge<1000){previous=null;return null;}
    const last=previous;previous=now;
    if(last===null || now<=last)return null;
    const dt=now-last;
    intervals.push(dt);total+=dt;
    backoff=Math.max(0,backoff-dt);
    // Half-second windows keep decisions comparable on 30, 60 and 120 Hz screens.
    if(total+0.01<(probing?2000:500))return null;
    intervals.sort((a,b)=>a-b);
    const p95=intervals[Math.ceil(intervals.length*.95)-1],fps=1000*intervals.length/total;
    const fast=fps>=57 && p95<=22;
    const elapsed=total;
    fastMs=fast?fastMs+elapsed:0;
    if(fastMs+.01>=2000){targetFps=60;observedFast=true;reducedForLoad=false;}
    // Infer a 30 Hz cadence only on a light profile, outside a quality trial.
    // A 60 Hz session first tries a cheaper frame before accepting a new cadence.
    const p05=intervals[Math.floor((intervals.length-1)*.05)];
    const steady30=fps>=29 && fps<=31.5 && p05>=29 && p95<=36;
    const canLearn30=compact && !trial && targetFps===60 && stage<=0 && (!observedFast || reducedForLoad || stage===-2);
    steady30Ms=canLearn30 && steady30?steady30Ms+elapsed:0;
    if(steady30Ms+.01>=(observedFast?4000:2000)){targetFps=30;observedFast=false;}
    const good=targetFps===60?fast:fps>=29 && p95<=38;
    const bad=targetFps===60?fps<54 || p95>25:fps<27 || p95>42;
    total=0;intervals.length=0;
    if(trial){
      trialMs+=elapsed;
      goodMs=good?goodMs+elapsed:0;
      if(goodMs+.01>=2000){trial=false;probeStart=null;clearWindow();return null;}
      if(trialMs+.01>=2000)return interrupt();
      return null;
    }
    goodMs=good?goodMs+elapsed:0;
    badMs=bad && steady30Ms===0?badMs+elapsed:0;
    if(probing && !good){interrupt();return null;}
    if(!probing && badMs+.01>=2000 && stage> -2){
      stage=nextStep(-1);reducedForLoad=true;clearWindow();return config();
    }
    if(goodMs+.01>=(probing?2000:8000) && backoff===0 && stage<(safe?0:3)){
      stage=nextStep(1);trial=true;trialDeadline=now+6000;clearWindow();return config();
    }
    return null;
  }
  return {
    nativeAntialias:!compact,
    get config(){return config();},
    get calibrationPending(){return pending;},
    get calibrating(){return probeStart!==null;},
    beginCalibration(now:number){
      if(pending && stage===0){pending=false;clearWindow();probeStart=now;mode='calibration';}
    },
    sample,interrupt,
    restore(lossCount:number){safe=lossCount>=2;return reset();},
    allowSky(allowed:boolean){skyAllowed=allowed;return config().sky;}
  };
}
