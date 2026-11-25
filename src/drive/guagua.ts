import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {required} from '../required.ts';
import {tint} from './car-model.ts';
import type {Point} from '../data/types.ts';
import type {Body} from './drive-physics.ts';

export interface GuaguaData {
  line: string; direction: string; path: Point[];
  stops: {id: string; name: string; position: Point; distance: number}[];
}
const point = (p: unknown): p is Point => Array.isArray(p) && p.length===2 && p.every(Number.isFinite);
export function validGuagua(value: unknown): value is GuaguaData {
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
  return Array.isArray(d.stops) && d.stops.length>=2 && d.stops.every((s,i,stops)=>
    s && typeof s.id==='string' && typeof s.name==='string' && point(s.position)
    && Number.isFinite(s.distance) && s.distance>=0 && s.distance<=length
    && (i===0 || s.distance>stops[i-1].distance));
}

export async function loadGuagua(): Promise<GuaguaData|null> {
  try {
    const response=await fetch('./data/guaguas.json');
    if (!response.ok) return null;
    const data: unknown=await response.json();
    return validGuagua(data)?data:null;
  } catch { return null; }
}

export function makeGuagua(data: GuaguaData){
  const ends=[0];
  for (let i=1;i<data.path.length;i++){
    const a=data.path[i-1], b=data.path[i];
    ends.push(ends[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1]));
  }
  const length=ends[ends.length-1];
  const state={x:0,y:0,h:0,distance:0,speed:0,stopped:0,braking:false};
  let nextStop=0, segment=0;
  function pose(){
    while(segment<ends.length-2 && state.distance>=ends[segment+1])segment++;
    const a=data.path[segment], b=data.path[segment+1];
    const t=(state.distance-ends[segment])/(ends[segment+1]-ends[segment]);
    state.x=a[0]+t*(b[0]-a[0]); state.y=a[1]+t*(b[1]-a[1]);
    state.h=Math.atan2(b[1]-a[1],b[0]-a[0]);
  }
  function reset(){
    state.distance=state.speed=state.stopped=nextStop=segment=0;
    state.braking=false;
    pose();
  }
  reset();
  return {state,reset,step(dt: number,visible: (point: Point)=>boolean){
    if(state.distance===length){
      if(!visible(data.path[0]) && !visible(data.path[data.path.length-1]))reset();
      return;
    }
    if(state.stopped>0){
      state.stopped=Math.max(0,state.stopped-dt);
      return;
    }
    const stop=data.stops[nextStop];
    const target=stop?.distance??length;
    const remaining=target-state.distance;
    const limit=Math.min(8,Math.sqrt(2*3.5*remaining));
    state.braking=limit<state.speed;
    state.speed=Math.min(limit,state.speed+2.5*dt);
    state.distance=Math.min(target,state.distance+state.speed*dt);
    if(target-state.distance<.001){
      state.distance=target;
      state.speed=0;
      state.braking=true;
      if(stop){nextStop++;state.stopped=3;}
    }
    pose();
  }};
}

type BusPose=Pick<ReturnType<typeof makeGuagua>['state'],'x'|'y'|'h'|'speed'>;
type CarBody=Pick<Body,'x'|'y'|'vx'|'vy'>;
const HALF_LENGTH=4.5, HALF_WIDTH=1.1;

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

export function guaguaMesh(paint: T.MeshStandardMaterial,red: T.MeshBasicMaterial){
  const box=(l:number,h:number,w:number,x:number,y:number,z:number,color:string)=>
    tint(new T.BoxGeometry(l,h,w).translate(x,y,z),color);
  const yellow='#efbd29', glass='#334c59';
  const parts=[
    box(9,2.6,2.16,0,1.66,0,yellow), box(8.55,.14,2.1,0,3,0,'#ffce47'),
    box(1.65,.16,1.12,-1,3.15,0,'#c7ba9a'), box(.04,1.12,1.92,4.49,1.93,0,glass),
    box(.04,.85,1.62,-4.49,2,0,glass)
  ];
  for(const side of [-1,1]){
    for(const x of [-3.46,-2.1,-.74,.62,1.98,3.34])parts.push(box(1.25,.96,.04,x,2.02,side*1.08,glass));
    for(const x of [-2.8,2.75])parts.push(tint(new T.CylinderGeometry(.49,.49,.22,10)
      .rotateX(Math.PI/2).translate(x,.49,side*.99),'#282a2b'));
  }
  const mesh=new T.Mesh(required(mergeGeometries(parts),'bus geometry'),paint);
  const lights=[-.78,.78].map(z=>new T.BoxGeometry(.07,.2,.31).translate(-4.5,1.25,z));
  const brake=new T.Mesh(required(mergeGeometries(lights),'bus stop lights'),red);
  mesh.add(brake); mesh.rotation.order='YXZ'; mesh.visible=false;
  return {mesh,brake};
}
