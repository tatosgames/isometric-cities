import type { Prop } from '../data/types.ts';
import * as T from 'three';

type Part = [geometry: T.BufferGeometry, color: string];

// Local frame of an object: x runs along its heading, z to its right, y up. Each part is placed there,
// then the whole object turns to its heading and moves to its place on the ground.
function box(w: number,h: number,d: number,x: number,y: number,z: number,tilt=0){
  const g=new T.BoxGeometry(w,h,d);
  if(tilt)g.rotateZ(tilt);
  return g.translate(x,y,z);
}

// Ship-to-shore gantry crane of the container quays, boom raised as when no ship is alongside.
// Light blue frame and white machinery house, after the 2024 orthophoto of the Puerto de la Luz.
function crane(detail: boolean): Part[]{
  const frame='#7fa6cf',house='#eef0ee',dark='#3d4a57';
  const gauge=11,half=13.5,portal=36,girder=portal+3,lift=78*Math.PI/180,boom=46;
  const parts: Part[]=[];
  for(const x of [-gauge,gauge])for(const z of [-half,half])parts.push([box(1.6,portal,1.6,x,portal/2,z),frame]);
  parts.push([box(40,3,5,-9,girder,0),frame]);
  parts.push([box(boom,2.6,4,gauge+Math.cos(lift)*boom/2,girder+Math.sin(lift)*boom/2,0,lift),frame]);
  if(!detail)return parts;
  for(const x of [-gauge,gauge])parts.push([box(1.6,2,half*2,x,portal,0),frame]);
  for(const z of [-half,half])parts.push([box(gauge*2,1.4,1.4,0,portal,z),frame]);
  for(const z of [-2.2,2.2])parts.push([box(1.4,24,1.4,8,girder+12,z),frame]);
  // Backstay from the head of the mast to the landward end of the girder.
  const dx=-29-8,dy=1.5-24;
  parts.push([box(Math.hypot(dx,dy),.5,.5,8+dx/2,girder+24+dy/2,0,Math.atan2(dy,dx)),frame]);
  parts.push([box(11,6,7,-14,girder+4.5,0),house]);
  parts.push([box(3,2.5,3,2,girder-2.75,0),dark]);
  return parts;
}

function chimney(height: number): Part[]{
  return [[new T.CylinderGeometry(1.2,1.7,height,8).translate(0,height/2,0),'#b9b2a6']];
}

// Port objects mapped in OpenStreetMap. `size` scales a crane and is the height of a chimney, in metres.
export function propParts([kind,x,y,angle,size]: Prop,base: number,detail: boolean): Part[]{
  const parts=kind==='crane'?crane(detail):kind==='chimney'?chimney(size):[];
  for(const [g] of parts){
    if(kind==='crane')g.scale(size,size,size);
    g.rotateY(angle).translate(x,base,-y);
  }
  return parts;
}
