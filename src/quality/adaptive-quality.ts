export type QualityMode = 'calibration' | 'moving' | 'resting';

export interface QualitySample {
  mode: QualityMode;
  ready: boolean;
  preparing?: boolean;
}

export type InterruptReason = 'input' | 'hidden' | 'context-lost' | 'interrupted';
type DecisionReason = InterruptReason | 'stable' | 'slow' | 'insufficient-headroom' | 'loading' | 'preparing'
  | 'timeout' | 'resting' | 'moving' | 'startup' | 'capability' | 'reset' | 'context-restored';

export interface QualityDecision<T> {
  action: 'calibration' | 'trial' | 'confirm' | 'reduce' | 'cancel' | 'reset';
  reason: DecisionReason;
  from: T;
  to: T;
  targetFps: 30|60;
  fps: number|null;
  p95Ms: number|null;
}

export interface QualityProfile<T> {
  levels: readonly T[];
  initialIndex: number;
  baseIndex: number;
  calibrate?: boolean;
  detect30Fps?: boolean;
  onDecision?: (event:QualityDecision<T>)=>void;
  /** Applies the initial level, each transition (including rollback), and reset. */
  applyLevel?: (level:T)=>void;
}

/** Levels are ordered from cheapest to most expensive. Timestamps are in milliseconds. */
export function createAdaptiveQuality<T extends NonNullable<unknown>>({
  levels, initialIndex, baseIndex, calibrate=false, detect30Fps=false, applyLevel, onDecision
}: QualityProfile<T>){
  for(const index of [initialIndex,baseIndex]){
    if(!Number.isInteger(index) || index<0 || index>=levels.length)
      throw new RangeError('Quality indices must identify a level in the profile');
  }
  let maxIndex=levels.length-1;
  let index=initialIndex;
  function applyCurrentLevel(){
    const level=levels[index];
    applyLevel?.(level);
    return level;
  }
  let pending=canCalibrate();
  function canCalibrate(){return calibrate && index===baseIndex && index<maxIndex;}
  let lastFps:number|null=null, lastP95:number|null=null;
  let probeStart:number|null=null, trial=false;
  let trialDeadline=0;
  let previous:number|null=null, mode:QualityMode='resting';
  let total=0,goodMs=0,badMs=0,trialMs=0,backoff=0;
  let targetFps:30|60=60, observedFast=false, reducedForLoad=false, fastMs=0, steady30Ms=0;
  const intervals:number[]=[];
  function clearWindow(){previous=null;total=0;intervals.length=0;goodMs=badMs=trialMs=fastMs=steady30Ms=0;}
  function notify(action:QualityDecision<T>['action'],reason:DecisionReason,from=index){
    onDecision?.({action,reason,from:levels[from],to:levels[index],targetFps,fps:lastFps,p95Ms:lastP95});
  }
  function cancel(reason:DecisionReason){
    const active=(pending && canCalibrate()) || trial || probeStart!==null;
    const from=index;
    pending=false;
    const rollback=trial;
    if(rollback){index--;backoff=30000;}
    trial=false;probeStart=null;clearWindow();
    if(active)notify('cancel',reason,from);
    return rollback?applyCurrentLevel():null;
  }
  function reset(){
    const from=index;
    trial=false;
    probeStart=null;
    clearWindow();
    index=Math.min(initialIndex,maxIndex);pending=canCalibrate();mode='resting';backoff=0;
    targetFps=60;observedFast=false;reducedForLoad=false;
    lastFps=lastP95=null;
    notify('reset','reset',from);
    return applyCurrentLevel();
  }
  function sample(now:number,input:QualitySample):T|null{
    if(!Number.isFinite(now))return null;
    const timeoutReason=input.preparing?'preparing':!input.ready?'loading':'timeout';
    if(trial && now>=trialDeadline)return cancel(timeoutReason);
    const probeAge=probeStart===null?null:now-probeStart;
    const probing=probeAge!==null;
    if(probing && input.mode!=='calibration')return cancel(input.mode);
    if(probing && !input.ready)return cancel('loading');
    if(probing && probeAge>=6000)return cancel(timeoutReason);
    if(input.mode==='resting'){
      if(mode!=='resting'){
        mode='resting';
        if(trial)return cancel('resting');
        clearWindow();
      }
      return null;
    }
    if(mode!==input.mode){clearWindow();mode=input.mode;}
    if(!input.ready || (trial && input.preparing)){clearWindow();return null;}
    if(probing && probeAge<1000){previous=null;return null;}
    const last=previous;
    if(last!==null && now<=last)return null;
    previous=now;
    if(last===null)return null;
    const dt=now-last;
    intervals.push(dt);total+=dt;
    backoff=Math.max(0,backoff-dt);
    // Half-second windows keep decisions comparable on 30, 60 and 120 Hz screens.
    if(total+0.01<(probing?2000:500))return null;
    intervals.sort((a,b)=>a-b);
    const p95=intervals[Math.ceil(intervals.length*.95)-1],fps=1000*intervals.length/total;
    lastFps=fps;lastP95=p95;
    const fast=fps>=57 && p95<=22;
    const elapsed=total;
    fastMs=fast?fastMs+elapsed:0;
    if(fastMs+.01>=2000){targetFps=60;observedFast=true;reducedForLoad=false;}
    // Infer a 30 Hz cadence only on a light profile, outside a quality trial.
    // A 60 Hz session first tries a cheaper frame before accepting a new cadence.
    const p05=intervals[Math.floor((intervals.length-1)*.05)];
    const steady30=fps>=29 && fps<=31.5 && p05>=29 && p95<=36;
    const canLearn30=detect30Fps && !trial && targetFps===60 && index<=baseIndex && (!observedFast || reducedForLoad || index===0);
    steady30Ms=canLearn30 && steady30?steady30Ms+elapsed:0;
    if(steady30Ms+.01>=(observedFast?4000:2000)){targetFps=30;observedFast=false;}
    const good=targetFps===60?fast:fps>=29 && p95<=38;
    const bad=targetFps===60?fps<54 || p95>25:fps<27 || p95>42;
    total=0;intervals.length=0;
    if(trial){
      trialMs+=elapsed;
      goodMs=good?goodMs+elapsed:0;
      if(goodMs+.01>=2000){trial=false;probeStart=null;clearWindow();notify('confirm','stable');return null;}
      if(trialMs+.01>=2000)return cancel(bad?'slow':'insufficient-headroom');
      return null;
    }
    goodMs=good?goodMs+elapsed:0;
    badMs=bad && steady30Ms===0?badMs+elapsed:0;
    if(probing && !good)return cancel(bad?'slow':'insufficient-headroom');
    if(!probing && badMs+.01>=2000 && index>0){
      index--;reducedForLoad=true;clearWindow();notify('reduce','slow',index+1);return applyCurrentLevel();
    }
    if(goodMs+.01>=(probing?2000:8000) && backoff===0 && index<maxIndex){
      index++;trial=true;trialDeadline=now+6000;clearWindow();notify('trial','stable',index-1);return applyCurrentLevel();
    }
    return null;
  }
  applyCurrentLevel();
  return {
    get level(){return levels[index];},
    get state(){
      return {index,level:levels[index],targetFps,fps:lastFps,p95Ms:lastP95,
        trial,cooldownMs:backoff};
    },
    get calibrationPending(){return pending && canCalibrate();},
    get calibrating(){return probeStart!==null;},
    beginCalibration(now:number){
      if(pending && canCalibrate() && Number.isFinite(now)){
        pending=false;clearWindow();probeStart=now;mode='calibration';notify('calibration','startup');
      }
    },
    setMaxIndex(limit:number){
      if(!Number.isInteger(limit) || limit<0 || limit>=levels.length)throw new RangeError('Invalid quality ceiling');
      maxIndex=limit;
      if(index===limit && probeStart!==null && !trial)return cancel('capability');
      if(index<=limit)return null;
      const from=index;
      index=limit;trial=false;probeStart=null;clearWindow();
      notify('reduce','capability',from);
      return applyCurrentLevel();
    },
    interrupt(reason:InterruptReason='interrupted'){return cancel(reason);},
    sample,reset
  };
}
