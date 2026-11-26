import {createAdaptiveQuality, type QualityMode} from '../quality/adaptive-quality.ts';
export type {QualityMode} from '../quality/adaptive-quality.ts';
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

type Level=Pick<DynamicQualityConfig,'stage'|'shadows'|'antialias'|'dprScale'>;

const compactLevels: readonly Level[] = [
  {stage:-2, shadows:'off', antialias:'off', dprScale:.7},
  {stage:-1, shadows:'off', antialias:'off', dprScale:.85},
  {stage:0, shadows:'off', antialias:'off', dprScale:1},
  {stage:1, shadows:'static', antialias:'off', dprScale:1},
  {stage:2, shadows:'static', antialias:'fxaa', dprScale:1},
  {stage:3, shadows:'static', antialias:'fxaa', dprScale:1.25}
];

const desktopLevels: readonly Level[] = [
  {stage:-2, shadows:'off', antialias:'native', dprScale:.7},
  {stage:-1, shadows:'off', antialias:'native', dprScale:.85},
  {stage:0, shadows:'off', antialias:'native', dprScale:1},
  {stage:1, shadows:'static', antialias:'native', dprScale:1},
  {stage:3, shadows:'solar', antialias:'native', dprScale:1}
];

export function makeDynamicQuality({compact,losses=0,preview,sky=true}:{
  compact:boolean;losses?:number;preview?:string|null;sky?:boolean;
}){
  const levels=compact?compactLevels:desktopLevels;
  const baseIndex=levels.findIndex(entry=>entry.stage===0);
  const fixed=preview==='base'||preview==='static'||preview==='fxaa';
  let safe=losses>=2, skyAllowed=true;
  function controller(calibrate:boolean){
    return createAdaptiveQuality({
      levels:safe?levels.slice(0,baseIndex+1):levels,
      initialIndex:compact||safe?baseIndex:levels.length-1,baseIndex,
      calibrate:calibrate && compact && !safe && !fixed,detect30Fps:compact
    });
  }
  let monitor=controller(true);
  function config(entry=monitor.level):DynamicQualityConfig{
    const result={...entry,dprCap:compact?1:1.75,dprScale:entry.dprScale*(safe?.75:1),sky:sky && skyAllowed};
    if(fixed && !safe){
      result.shadows=preview==='base'?'off':'static';
      if(preview==='fxaa')result.antialias='fxaa';
    }
    return result;
  }
  return {
    nativeAntialias:!compact,
    get config(){return config();},
    get calibrationPending(){return monitor.calibrationPending;},
    get calibrating(){return monitor.calibrating;},
    beginCalibration(now:number){monitor.beginCalibration(now);},
    sample(now:number,{mode,ready,preparingShadows=false}:{mode:QualityMode;ready:boolean;preparingShadows?:boolean}){
      if(fixed && !safe)return null;
      const change=monitor.sample(now,{mode,ready,preparing:preparingShadows});
      return change && config(change);
    },
    interrupt(){
      const change=monitor.interrupt();
      return change && config(change);
    },
    restore(lossCount:number){safe=lossCount>=2;monitor=controller(false);return config();},
    allowSky(allowed:boolean){skyAllowed=allowed;return sky && skyAllowed;}
  };
}
