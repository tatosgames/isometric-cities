import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {required} from '../required.ts';
import {tint} from './car-model.ts';
import type {Point} from '../data/types.ts';
import type {Body} from './drive-physics.ts';
import {busTimetable,emptyBusState} from './guagua-timetable.ts';

export interface GuaguaData {
  line: string; direction: string; path: Point[];
  stops: {id: string; name: string; position: Point; distance: number}[];
}
const point = (p: unknown): p is Point => Array.isArray(p) && p.length===2 && p.every(Number.isFinite);
export function validGuagua(value: unknown,minStops=2): value is GuaguaData {
  if (!value || typeof value!=='object') return false;
  const d=value as Partial<GuaguaData>;
  if (!d.line || typeof d.line!=='string' || !d.direction || typeof d.direction!=='string'
    || !Array.isArray(d.path) || d.path.length<2 || !d.path.every(point)) return false;
  let length=0;
  for (let i=1;i<d.path.length;i++){
    const [x,y]=d.path[i], prev=d.path[i-1], step=Math.hypot(x-prev[0],y-prev[1]);
    if (!step) return false;
    length+=step;
  }
  return Array.isArray(d.stops) && d.stops.length>=minStops && d.stops.every((s,i,stops)=>
    s && typeof s.id==='string' && typeof s.name==='string' && point(s.position)
    && Number.isFinite(s.distance) && s.distance>=0 && s.distance<=length+.006
    && (i===0 || s.distance>stops[i-1].distance));
}

export function makeGuagua(data: GuaguaData){
  const clock=busTimetable(data),state=emptyBusState();
  let age=0,nextStop=0;
  function reset(){age=nextStop=0;clock.sample(0,state);}
  reset();
  return {state,reset,step(dt:number,visible:(p:Point)=>boolean){
    if(age>=clock.duration){
      if(!visible(data.path[0]) && !visible(data.path[data.path.length-1]))reset();
      return;
    }
    age=Math.min(age+dt,clock.duration);
    const stop=data.stops[nextStop];
    if(stop && age>=clock.timeAt(stop.distance)){
      age=clock.timeAt(stop.distance);nextStop++;
    }
    clock.sample(age,state);
  }};
}

type BusPose=Pick<ReturnType<typeof makeGuagua>['state'],'x'|'y'|'h'|'speed'>;
type CarBody=Pick<Body,'x'|'y'|'vx'|'vy'>;
export const HALF_LENGTH=3.6, HALF_WIDTH=1.1;
export const BUS_AXLE=2.08;

/** Resolve circle against moving oriented body, preserving tangential velocity. */
export function resolveGuaguaContact(bus: BusPose, car: CarBody, radius: number){
  const dx=car.x-bus.x, dy=car.y-bus.y;
  if(Math.abs(dx)>5+radius || Math.abs(dy)>5+radius)return false;
  const c=Math.cos(bus.h),s=Math.sin(bus.h);
  const x=dx*c+dy*s, y=-dx*s+dy*c;
  let nx=x-T.MathUtils.clamp(x,-HALF_LENGTH,HALF_LENGTH);
  let ny=y-T.MathUtils.clamp(y,-HALF_WIDTH,HALF_WIDTH);
  const d=Math.hypot(nx,ny);
  if(d>=radius)return false;
  let depth=radius-d;
  if(d>0){nx/=d;ny/=d;}
  else {
    const end=HALF_LENGTH-Math.abs(x), side=HALF_WIDTH-Math.abs(y);
    nx=end<side?(Math.sign(x)||1):0;
    ny=end<side?0:(Math.sign(y)||1);
    depth+=Math.min(end,side);
  }
  const wx=nx*c-ny*s, wy=nx*s+ny*c;
  car.x+=wx*depth; car.y+=wy*depth;
  const closing=(car.vx-bus.speed*c)*wx+(car.vy-bus.speed*s)*wy;
  if(closing<0){car.vx-=closing*wx; car.vy-=closing*wy;}
  return true;
}

function busBodyGeometry(){
  const box=(l:number,h:number,w:number,x:number,y:number,z:number,color:string)=>
    tint(new T.BoxGeometry(l,h,w).translate(x,y,z),color);
  const yellow='#fac421', trim='#222c33', glass='#446678';
  const shell=(l:number,h:number,w:number,y:number,r:number,color:string)=>
    tint(new RoundedBoxGeometry(l,h,w,1,r).translate(0,y,0),color);
  const parts=[
    shell(2*HALF_LENGTH,1.15,2.14,.92,.16,yellow),
    shell(7.14,1.58,2.13,2.08,.17,trim),
    shell(7.04,.17,2.10,2.88,.08,yellow),
    box(.035,1.03,1.86,3.57,1.97,0,glass),
    box(.02,.18,1.82,3.59,2.38,0,'#64828b'),
    box(.025,.09,1.05,3.60,.66,0,trim),
    box(.04,.78,1.67,-3.57,2.03,0,glass),
    box(1.48,.14,1.12,-1.15,3.01,0,'#d4c499')
  ];
  for(const side of [-1,1]){
    parts.push(box(.025,.27,.36,3.597,.97,side*.78,'#a9a99d'),
      box(.025,.11,.24,3.612,1.0,side*.78,'#fff1bb'));
    const wiper=box(.023,.033,.62,0,0,0,trim).rotateX(-.16).translate(3.597,1.53,side*.45);
    parts.push(wiper);
    for(const x of [-2.67,-1.38,-.09,1.20,2.88]){
      // The two passenger doors are on the right (local +Z) and reach the step.
      const door=side===1 && (x===-.09 || x===2.88);
      const width=x===2.88 ? .78 : 1.12;
      if(door)parts.push(box(width+.08,2.11,.03,x,1.51,1.068,trim));
      parts.push(box(width,door?1.75:.98,.034,x,door?1.52:1.99,side*1.084,glass));
      if(door)parts.push(box(.06,1.80,.036,x,1.52,1.086,trim));
    }
    for(const axle of [-BUS_AXLE,BUS_AXLE]){
      const wheel=(radius:number,depth:number,z:number,color:string)=>tint(
        new T.CylinderGeometry(radius,radius,depth,12).rotateX(Math.PI/2).translate(axle,.48,side*z),color);
      parts.push(wheel(.48,.18,1.00,'#25282b'),wheel(.245,.02,1.09,yellow));
    }
  }
  for(let i=0;i<4;i++)parts.push(box(.085,.035,.75,-1.55+i*.23,3.09,0,'#727975'));
  return required(mergeGeometries(parts.map(p=>p.index?p.toNonIndexed():p)),'bus geometry');
}

// Three-column amber dot matrix above the windscreen, including the night and express prefixes.
const glyphs: Record<string,number[]> = {
  '0':[7,5,5,5,7], '1':[2,6,2,2,7], '2':[7,1,7,4,7], '3':[7,1,7,1,7],
  '4':[5,5,7,1,1], '5':[7,4,7,1,7], '6':[7,4,7,5,7], '7':[7,1,2,2,2],
  '8':[7,5,7,5,7], '9':[7,5,7,1,7], L:[4,4,4,4,7], X:[5,5,2,5,5]
};
function displayGeometry(line:string){
  const vertices:number[]=[];
  for(const [digit,char] of [...line].entries()){
    const rows=glyphs[char];
    if(!rows)continue;
    for(let row=0;row<5;row++)for(let col=0;col<3;col++){
      if(!(rows[row] & (4>>col)))continue;
      const y=2.81-row*.061,z=.82-(digit*4+col)*.06;
      vertices.push(3.58,y,z, 3.58,y-.050,z, 3.58,y,z-.049,
                    3.58,y,z-.049, 3.58,y-.050,z, 3.58,y-.050,z-.049);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  return geometry;
}

/** Created on the first local bus. All slots share body, brake and route display geometries. */
export function makeGuaguaViews(group:T.Group,paint:T.MeshStandardMaterial,red:T.MeshBasicMaterial){
  const body=busBodyGeometry();
  const lights=[-.78,.78].map(z=>new T.BoxGeometry(.05,.2,.23).translate(-3.57,.96,z));
  const brakeGeometry=required(mergeGeometries(lights),'bus stop lights');
  const amber=red.clone();amber.color.set('#ff9b37');
  const signs=new Map<string,T.BufferGeometry>();
  const slots:{mesh:T.Mesh; brake:T.Mesh; sign:T.Mesh}[]=[];
  function show(slot:number,line:string){
    let geometry=signs.get(line);
    if(!geometry){geometry=displayGeometry(line);signs.set(line,geometry);}
    let view=slots[slot];
    if(!view){
      const mesh=new T.Mesh(body,paint),brake=new T.Mesh(brakeGeometry,red),sign=new T.Mesh(geometry,amber);
      mesh.add(brake,sign);mesh.rotation.order='YXZ';group.add(mesh);
      view={mesh,brake,sign};slots.push(view);
    }
    view.mesh.visible=true;view.sign.geometry=geometry;
    return view;
  }
  return {show,hideAfter(count:number){for(let i=count;i<slots.length;i++)slots[i].mesh.visible=false;},
    dispose(){
      for(const {mesh} of slots)group.remove(mesh);
      body.dispose();brakeGeometry.dispose();amber.dispose();
      for(const geometry of signs.values())geometry.dispose();
    }};
}
