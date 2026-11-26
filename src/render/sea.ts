import type { Point, Sea } from '../data/types.ts';
import { surfaceStencil } from './building-stencil.ts';
import { breezy } from './wind.ts';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The terrain reaches 0 m along the quays, so the water sits just below it and the quay wall stays visible.
export const SEA_LEVEL=-.9;
const REACH=90, STEPS=24;

// Distance to the mapped coastline, painted once: nested strokes from wide and dark to thin and bright,
// so the red channel reads 1 on the coast and 0 at REACH metres. Foam and shallows follow it in the shader.
function shoreMap(shore: Point[][],box: T.Box2){
  const size=box.getSize(new T.Vector2()),scale=Math.min(1,2048/Math.max(size.x,size.y));
  const canvas=typeof document==='undefined'?new OffscreenCanvas(1,1):document.createElement('canvas');
  canvas.width=Math.ceil(size.x*scale);canvas.height=Math.ceil(size.y*scale);
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx || !('fillRect' in ctx))throw new Error('Sea canvas requires a 2D context');
  const sx=canvas.width/size.x,sy=canvas.height/size.y;
  ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(sx,0,0,-sy,-box.min.x*sx,box.max.y*sy);
  ctx.lineJoin=ctx.lineCap='round';
  for(let k=1;k<=STEPS;k++){
    const v=Math.round(255*k/STEPS);
    ctx.strokeStyle=`rgb(${v},${v},${v})`;ctx.lineWidth=2*REACH*(1-(k-1)/STEPS);
    ctx.beginPath();
    for(const l of shore){
      ctx.moveTo(l[0][0],l[0][1]);
      for(let i=1;i<l.length;i++)ctx.lineTo(l[i][0],l[i][1]);
    }
    ctx.stroke();
  }
  const texture=new T.CanvasTexture(canvas);
  texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;
  return texture;
}

export function makeSea(sea: Sea){
  const box=new T.Box2();
  for(const line of sea.shore)for(const [x,y] of line)box.expandByPoint(new T.Vector2(x,y));
  // A black texture border keeps the clamped samples in open water clear of foam.
  box.expandByScalar(REACH+4);
  const size=box.getSize(new T.Vector2());
  const surface=mergeGeometries(sea.water.map(polygon=>{
    const [outer,...holes]=polygon.map(r=>r.map(([x,y])=>new T.Vector2(x,y)));
    const shape=new T.Shape(outer);shape.holes=holes.map(h=>new T.Path(h));
    return new T.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,SEA_LEVEL,0);
  }));
  if(!surface)throw new Error('Incompatible sea geometries');
  const water=new T.MeshBasicMaterial({...surfaceStencil(),side:T.DoubleSide});
  const uniforms={
    shoreMap:{value:shoreMap(sea.shore,box)},seaBounds:{value:new T.Vector4(box.min.x,box.min.y,size.x,size.y)},
    seaDeep:{value:new T.Color('#2b7888')},seaShallow:{value:new T.Color('#74c4bd')},seaFoam:{value:new T.Color('#f3f6ef')}
  };
  // Runs inside breezy(): the wind uniforms, the noise texture and vWind (world xz) come from its header,
  // and the colour is multiplied in so the cloud shadow applied just before survives.
  water.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.fragmentShader='uniform sampler2D shoreMap; uniform vec4 seaBounds; uniform vec3 seaDeep,seaShallow,seaFoam;\n'+
      shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 seaUv=(vec2(vWind.x,-vWind.y)-seaBounds.xy)/seaBounds.zw;
      float seaDist=(1.-texture2D(shoreMap,seaUv).r)*${REACH}.;
      float ragged=texture2D(windClouds,vWind/61.).r;
      vec3 seaTone=mix(seaShallow,seaDeep,smoothstep(2.,75.,seaDist));
      // Open-water swell travels with the wind; near the coast, crests roll in towards the shore.
      seaTone*=1.+.045*sin(dot(vWind,windDir)*.13-windTime*1.2+ragged*5.);
      float roll=fract(seaDist/15.+windTime*.14+ragged*.6);
      float crest=smoothstep(0.,.1,roll)*(1.-smoothstep(.1,.34,roll));
      float foam=crest*(1.-smoothstep(10.,46.,seaDist))*smoothstep(.3,.62,ragged);
      foam=max(foam,1.-smoothstep(1.2,4.+ragged*3.,seaDist));
      diffuseColor.rgb*=mix(seaTone,seaFoam,clamp(foam,0.,1.)*.9);`);
  };
  return new T.Mesh(surface,breezy(water));
}
