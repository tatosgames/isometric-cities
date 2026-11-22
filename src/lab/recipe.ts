import type { Options } from './variants.ts';
import { defaults } from './variants.ts';
export const zones={ 'Mercado de Vegueta':'mercado','Plaza de Santa Ana':'santa-ana','Calle Mayor de Triana':'triana','Parque Doramas':'doramas','Isolato in pendenza':'pendio'};
export const views=['Isometrica','Dall’alto','Guida'] as const;
export type Pose={position:[number,number,number];target:[number,number,number];span:number};
export interface Recipe {version:1;zone:string;view:string;a:Options;b:Options;camera:Pose}
export const limits={grain:[0,1],bay:[2.4,6],roof:[0,1],area:[50,1000],radius:[0,.6],height:[0,.6]} as const;
export function parseRecipe(raw:string):Recipe{
  const r=JSON.parse(raw);
  const finite=(x:unknown)=>typeof x==='number'&&Number.isFinite(x);
  const vector=(v:unknown)=>Array.isArray(v)&&v.length===3&&v.every(x=>finite(x)&&Math.abs(x)<10000);
  function options(o:Options){
    return o&&Object.entries(defaults).every(([k,d])=>{
      const value=o[k as keyof Options];
      if(typeof d==='boolean')return typeof value==='boolean';
      const [lo,hi]=limits[k as keyof typeof limits];return typeof value==='number'&&finite(value)&&value>=lo&&value<=hi;
    });
  }
  if(r?.version!==1||!Object.values(zones).includes(r.zone)||!views.some(v=>v===r.view)||!options(r.a)||!options(r.b)||
    !vector(r.camera?.position)||!vector(r.camera?.target)||!finite(r.camera.span)||r.camera.span<5||r.camera.span>2000||
    Math.hypot(...r.camera.position.map((n:number,i:number)=>n-r.camera.target[i]))<1)throw Error('Ricetta non valida o versione incompatibile.');
  return r;
}
