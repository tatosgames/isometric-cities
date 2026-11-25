import * as T from 'three';
import type { Altitude } from '../data/types.ts';
import { ASPHALT, DUST, PAVING, SKIDS, TUNE } from './drive-tune.ts';
import type { Vehicle } from './drive-types.ts';

// Sparks live this share of a dust puff's life: 0.16 s with the default 0.22 s.
const SPARK_LIFE=.16/.22;

// Kinds and their colours. Grass throws clumps of turf and earth, dirt a brown cloud, sand a pale spray.
const KINDS=['dust','smoke','drift','spark','grass','dirt','sand'] as const;
export type ParticleKind=typeof KINDS[number];
const COLOURS: Record<ParticleKind,T.Color[]>={
  dust:[new T.Color('#d8cdbb')],smoke:[new T.Color('#3b3836')],drift:[new T.Color('#fff6de')],spark:[new T.Color('#ffcc68')],
  grass:[new T.Color('#4f6b2e'),new T.Color('#6b8a3c'),new T.Color('#6d5235')],dirt:[new T.Color('#a88d66'),new T.Color('#94785a')],
  sand:[new T.Color('#f7ecd2'),new T.Color('#c9a86c'),new T.Color('#e8d3a0')]
};
// Tracks left by each surface: colour, opacity while rolling and while sliding, half width. Paving keeps none.
// Ruts in soft ground are wider than rubber on asphalt.
const TRACKS=[
  {colour:new T.Color('#1d1c1f'),roll:0,slide:.34,half:.14},
  null,
  {colour:new T.Color('#33401f'),roll:.3,slide:.5,half:.24},
  {colour:new T.Color('#5e4a30'),roll:.3,slide:.5,half:.24},
  {colour:new T.Color('#8a6c42'),roll:.35,slide:.55,half:.26}
];
/** Thrown by a wheel on a surface, or null where the road throws nothing but dust when sliding. */
export const DEBRIS: (ParticleKind|null)[]=[null,null,'grass','dirt','sand'];
// A track is laid in pieces of at least this length.
const TRACK_STEP=.5;

// Every particle moves on the GPU from its birth: the CPU writes one slot when it is born and nothing after.
const vertexShader=/* glsl */`
uniform float uTime;
uniform float uPuff;
attribute vec4 aStart;
attribute vec4 aVel;
attribute vec4 aColour;
varying vec3 vColour;
varying float vAlpha;
void main(){
  int kind=int(aVel.w+.5);
  float life=kind==3?uPuff*${SPARK_LIFE.toFixed(6)}:kind==2?uPuff:kind==4?.5:kind==5?.9:kind==6?.6:1./1.5;
  float age=(uTime-aStart.w)/life;
  vColour=aColour.rgb;vAlpha=.5;
  if(age<0.||age>=1.){gl_Position=vec4(0.,0.,2.,1.);return;}
  float t=age*life,left=1.-age;
  vec3 at=aStart.xyz,local=position;
  if(kind==3){
    // Spark: a streak along its velocity that arcs up and back down.
    float size=.25*left;
    vec2 dir=normalize(aVel.xz+vec2(1e-5,0.));
    vec3 s=position*vec3(size*2.1,size*.6,size*.6);
    local=vec3(s.x*dir.x-s.z*dir.y,s.y,s.x*dir.y+s.z*dir.x);
    at+=vec3(aVel.x*t,.22*sin(age*3.14159265),aVel.z*t);
  }else if(kind==4||kind==6){
    // Turf and sand: thrown up and back, they fall under gravity and stop on the ground.
    local*=aColour.w*(kind==4?.55:.5)*(1.-age*.5);
    at+=aVel.xyz*t+vec3(0.,-7.*t*t,0.);
    at.y=max(at.y,aStart.y-.15);
    vAlpha=.9*min(1.,left*4.);
  }else if(kind==5){
    // Dirt: a low brown cloud that drifts behind the car.
    local*=aColour.w*(.35+age*1.1);
    at+=aVel.xyz*t*.6+vec3(0.,age*.9,0.);
    vAlpha=.55;
  }else if(kind==2){
    local*=min(1.,min(.72+age*2.,left*3.));
    at.y+=age*.45;
  }else{
    local*=.5+age*1.5;
    at.y+=age*1.6;
  }
  gl_Position=projectionMatrix*modelViewMatrix*vec4(at+local,1.);
}`;
const fragmentShader=/* glsl */`
varying vec3 vColour;
varying float vAlpha;
void main(){
  gl_FragColor=vec4(vColour,vAlpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Tracks and the shared particle pool (dust, smoke, drift puffs, sparks, and what each surface throws up). */
export function makeDriveEffects(group: T.Group,groundAt: Altitude){
  // Tracks: a ring of quads, each with its own colour and opacity. Only the pieces written since the
  // last frame are uploaded.
  const skidPositions=new Float32Array(SKIDS*18),skidColours=new Float32Array(SKIDS*24);
  const skidGeometry=new T.BufferGeometry();
  const skidPosition=new T.BufferAttribute(skidPositions,3).setUsage(T.DynamicDrawUsage);
  const skidColour=new T.BufferAttribute(skidColours,4).setUsage(T.DynamicDrawUsage);
  skidGeometry.setAttribute('position',skidPosition);skidGeometry.setAttribute('color',skidColour);
  const skidMesh=new T.Mesh(skidGeometry,new T.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide}));
  skidMesh.frustumCulled=false;group.add(skidMesh);

  const shape=new T.IcosahedronGeometry(1,0),particles=new T.InstancedBufferGeometry();
  particles.setAttribute('position',shape.getAttribute('position'));
  const start=new T.InstancedBufferAttribute(new Float32Array(DUST*4).fill(-1e6),4).setUsage(T.DynamicDrawUsage);
  const velocity=new T.InstancedBufferAttribute(new Float32Array(DUST*4),4).setUsage(T.DynamicDrawUsage);
  const colour=new T.InstancedBufferAttribute(new Float32Array(DUST*4),4).setUsage(T.DynamicDrawUsage);
  particles.setAttribute('aStart',start);particles.setAttribute('aVel',velocity);particles.setAttribute('aColour',colour);
  particles.instanceCount=DUST;
  const uniforms={uTime:{value:0},uPuff:{value:TUNE.puffLife}};
  const material=new T.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false});
  const dustMesh=new T.Mesh(particles,material);
  dustMesh.frustumCulled=false;group.add(dustMesh);

  // Slots and track pieces written since the last upload, as a range in the ring.
  let dustAt=0,skidAt=0,dustFrom=-1,dustCount=0,skidFrom=-1,skidCount=0,now=0;
  // `vertices` per slot: a particle is one instance, a track piece six vertices.
  const upload=(attributes: T.BufferAttribute[],from: number,count: number,total: number,vertices=1)=>{
    for(const a of attributes){
      const size=a.itemSize*vertices;
      a.clearUpdateRanges();
      if(count>=total)a.addUpdateRange(0,total*size);
      else if(from+count<=total)a.addUpdateRange(from*size,count*size);
      else{a.addUpdateRange(from*size,(total-from)*size);a.addUpdateRange(0,(from+count-total)*size);}
      a.needsUpdate=true;
    }
  };
  return {
    /** A particle at ground level: `vx`, `vy` along the ground and `up` in m/s. */
    puff(x: number,y: number,kind: ParticleKind='dust',vx=0,vy=0,up=0){
      const k=KINDS.indexOf(kind),choices=COLOURS[kind],c=choices[Math.floor(Math.random()*choices.length)];
      const ground=groundAt(x,y),z=ground+(kind==='spark'?1.25:k>=4?.8:1);
      start.setXYZW(dustAt,x,z,-y,now);
      velocity.setXYZW(dustAt,vx,up,-vy,k);
      colour.setXYZW(dustAt,c.r,c.g,c.b,.75+Math.random()*.5);
      if(dustFrom<0)dustFrom=dustAt;
      dustCount=Math.min(DUST,dustCount+1);
      dustAt=(dustAt+1)%DUST;
    },
    /**
     * Lays the two rear tracks of `b` on `surface`. A piece is added once the wheels have rolled half a
     * metre, darker while sliding. Paving takes no marks.
     */
    skid(b: Vehicle,fx: number,fy: number,scale: number,surface=ASPHALT,sliding=true){
      const track=TRACKS[surface];
      if(!track || surface===PAVING){b.trail=null;return;}
      const wheels: NonNullable<Vehicle['trail']>=[];
      for(const side of [-.7,.7]){
        const x=b.x-(fx*1.1+fy*side)*scale,y=b.y+(-fy*1.1+fx*side)*scale;
        wheels.push([x,groundAt(x,y)+.78,-y]);
      }
      if(!b.trail){b.trail=wheels;return;}
      if(Math.hypot(wheels[0][0]-b.trail[0][0],wheels[0][2]-b.trail[0][2])<TRACK_STEP)return;
      const alpha=sliding?track.slide:track.roll,{r,g,b:blue}=track.colour;
      for(let k=0;k<2;k++){
        const [ax,ay,az]=b.trail[k],[bx,by,bz]=wheels[k],w=track.half;
        skidPositions.set([ax-w,ay,az,ax+w,ay,az,bx+w,by,bz,ax-w,ay,az,bx+w,by,bz,bx-w,by,bz],skidAt*18);
        for(let v=0;v<6;v++)skidColours.set([r,g,blue,alpha],skidAt*24+v*4);
        if(skidFrom<0)skidFrom=skidAt;
        skidCount=Math.min(SKIDS,skidCount+1);
        skidAt=(skidAt+1)%SKIDS;
      }
      b.trail=wheels;
    },
    reset(){
      skidPositions.fill(0);skidColours.fill(0);
      (start.array as Float32Array).fill(-1e6);
      upload([skidPosition,skidColour],0,SKIDS,SKIDS,6);upload([start],0,DUST,DUST);
      skidFrom=dustFrom=-1;skidCount=dustCount=0;
    },
    /** Advance the particles' clock and upload what was written since the last frame. */
    update(dt: number){
      now+=dt;uniforms.uTime.value=now;uniforms.uPuff.value=TUNE.puffLife;
      if(dustFrom>=0){upload([start,velocity,colour],dustFrom,dustCount,DUST);dustFrom=-1;dustCount=0;}
      if(skidFrom>=0){upload([skidPosition,skidColour],skidFrom,skidCount,SKIDS,6);skidFrom=-1;skidCount=0;}
    }
  };
}
