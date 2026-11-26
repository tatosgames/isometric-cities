import {createAdaptiveQuality, type QualityMode, type QualityDecision, type InterruptReason} from '../quality/adaptive-quality.ts';
export type {QualityMode} from '../quality/adaptive-quality.ts';
export interface FlightRenderRange {
  detailRadius:number;
  zoneRadius:number;
  visibility:number;
}
export interface DynamicQualityConfig {
  flight?:FlightRenderRange;
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

export type CityQualityLevel=Pick<DynamicQualityConfig,'stage'|'shadows'|'antialias'|'dprScale'|'flight'>;

const compactLevels: readonly CityQualityLevel[] = [
  {stage:-2, shadows:'off', antialias:'off', dprScale:.7},
  {stage:-1, shadows:'off', antialias:'off', dprScale:.85},
  {stage:0, shadows:'off', antialias:'off', dprScale:1},
  {stage:1, shadows:'static', antialias:'off', dprScale:1},
  {stage:2, shadows:'static', antialias:'fxaa', dprScale:1},
  {stage:3, shadows:'static', antialias:'fxaa', dprScale:1.25}
];

const desktopStaticLevels: readonly CityQualityLevel[] = [
  {stage:-2, shadows:'off', antialias:'native', dprScale:.7},
  {stage:-1, shadows:'off', antialias:'native', dprScale:.85},
  {stage:0, shadows:'off', antialias:'native', dprScale:1},
  {stage:1, shadows:'static', antialias:'native', dprScale:1}
];

const desktopSolarLevels: readonly CityQualityLevel[] = [
  ...desktopStaticLevels,
  {stage:3, shadows:'solar', antialias:'native', dprScale:1}
];

// The buffers under the base reduce pixels only after trimming the distant geometry.
function flightLevels(compact:boolean):CityQualityLevel[]{
  const antialias=compact?'off':'native';
  return [
    {stage:-2,shadows:'off',antialias,dprScale:.70,flight:{detailRadius:120,zoneRadius:360,visibility:1300}},
    {stage:-1,shadows:'off',antialias,dprScale:.85,flight:{detailRadius:180,zoneRadius:480,visibility:1700}},
    {stage:0,shadows:'off',antialias,dprScale:1,flight:{detailRadius:240,zoneRadius:640,visibility:2200}},
    {stage:1,shadows:'off',antialias,dprScale:1,flight:{detailRadius:320,zoneRadius:800,visibility:3000}},
    {stage:2,shadows:'static',antialias,dprScale:1,flight:{detailRadius:400,zoneRadius:960,visibility:4000}}
  ];
}

type GraphicsMode='ground'|'flight';
export type CityQualityDecision=QualityDecision<CityQualityLevel> & {mode:GraphicsMode};

export function makeDynamicQuality({compact,losses=0,preview,sky=true,solarShadows=true,onDecision}:{
  compact:boolean;losses?:number;preview?:string|null;sky?:boolean;solarShadows?:boolean;
  onDecision?:(event:CityQualityDecision)=>void;
}){
  const desktopLevels=solarShadows?desktopSolarLevels:desktopStaticLevels;
  const groundLevels=compact?compactLevels:desktopLevels;
  const airLevels=flightLevels(compact);
  const fixed=preview==='base'||preview==='static'||preview==='fxaa';
  const groundCap=compact?1:1.75;
  let safe=losses>=2, skyAllowed=true, mode:GraphicsMode='ground',flightCap=groundCap;
  function controller(kind:GraphicsMode,calibrate:boolean){
    const air=kind==='flight',levels=air?airLevels:groundLevels;
    const baseIndex=levels.findIndex(entry=>entry.stage===0);
    return createAdaptiveQuality({
      levels:safe?levels.slice(0,baseIndex+1):levels,
      initialIndex:air||compact||safe?baseIndex:levels.length-1,baseIndex,
      calibrate:!air && calibrate && compact && !safe && !fixed,detect30Fps:air || compact,adaptWhileResting:!air,
      ...(onDecision && {onDecision:(event:QualityDecision<CityQualityLevel>)=>onDecision({...event,mode:kind})})
    });
  }
  const monitors={ground:controller('ground',true),flight:controller('flight',false)};
  function config(entry=monitors[mode].level):DynamicQualityConfig{
    const result={...entry,dprCap:entry.flight?flightCap:groundCap,dprScale:entry.dprScale*(safe?.75:1),sky:sky && skyAllowed};
    if(fixed && !safe){
      result.shadows=preview==='base'?'off':'static';
      if(preview==='fxaa')result.antialias='fxaa';
    }
    return result;
  }
  return {
    nativeAntialias:!compact,
    get config(){return config();},
    get state(){return monitors[mode].state;},
    get calibrationPending(){return monitors[mode].calibrationPending;},
    get calibrating(){return monitors[mode].calibrating;},
    setFlight(active:boolean){
      const next=active?'flight':'ground';
      if(next===mode)return null;
      // Discard the old window, rolling a trial back before leaving its scene.
      monitors[mode].interrupt();
      mode=next;
      return config();
    },
    beginCalibration(now:number){monitors[mode].beginCalibration(now);},
    sample(now:number,{mode:activity,ready,preparing=false,preparingShadows=false}:{
      mode:QualityMode;ready:boolean;preparing?:boolean;preparingShadows?:boolean
    }){
      if(fixed && !safe)return null;
      const change=monitors[mode].sample(now,{mode:activity,ready,preparing:preparing || preparingShadows});
      return change && config(change);
    },
    updateViewport(width:number,height:number,physical:number){
      if(width<=0 || height<=0)return;
      flightCap=Math.min(groundCap,1920/Math.max(width,height),1080/Math.min(width,height));
      if(!compact || safe || fixed)return;
      const top=groundLevels.length-1;
      const previous=config(groundLevels[top-1]),highest=config(groundLevels[top]);
      const low=renderPixelRatio(previous,physical),high=renderPixelRatio(highest,physical);
      const identical=previous.shadows===highest.shadows && previous.antialias===highest.antialias
        && Math.floor(width*high)===Math.floor(width*low) && Math.floor(height*high)===Math.floor(height*low);
      monitors.ground.setMaxIndex(identical?top-1:top);
    },
    interrupt(reason?:InterruptReason){
      const change=monitors[mode].interrupt(reason);
      return change && config(change);
    },
    restore(lossCount:number){
      const from=config(),wasSafe=safe;
      safe=lossCount>=2;
      if(mode==='ground' || safe!==wasSafe)monitors.ground=controller('ground',false);
      if(mode==='flight' || safe!==wasSafe)monitors.flight=controller('flight',false);
      const to=config();
      onDecision?.({mode,action:'reset',reason:'context-restored',from,to,targetFps:60,fps:null,p95Ms:null});
      return to;
    },
    allowSky(allowed:boolean){skyAllowed=allowed;return sky && skyAllowed;}
  };
}
