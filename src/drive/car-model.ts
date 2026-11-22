import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { required } from '../required.ts';

export const carVisualScale=1.3;
export function tint(geometry: T.BufferGeometry,color: T.ColorRepresentation){
  const c=new T.Color(color),n=geometry.attributes.position.count,a=new Float32Array(n*3);
  for(let i=0;i<n;i++)a.set([c.r,c.g,c.b],i*3);
  geometry.setAttribute('color',new T.BufferAttribute(a,3));
  return geometry;
}
export function carGeometry(body: string,top: string,police: boolean){
  const parts=[
    tint(new T.BoxGeometry(3,.7,1.5).translate(0,.6,0),body),
    tint(new T.BoxGeometry(1.5,.55,1.3).translate(-.2,1.2,0),top)
  ];
  for(const x of [-.95,.95])for(const z of [-.72,.72])parts.push(tint(new T.BoxGeometry(.62,.5,.26).translate(x,.25,z),'#22252b'));
  if(police){
    parts.push(tint(new T.BoxGeometry(.9,.72,1.52).translate(1.06,.6,0),'#1f4a8f'));
    parts.push(tint(new T.BoxGeometry(.25,.2,.95).translate(-.2,1.57,0),'#3d7bff'));
  }
  return required(mergeGeometries(parts),"car geometry");
}
