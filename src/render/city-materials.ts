import type { GroundMap } from './ground-map.ts';
import {surfaceStencil} from './building-stencil.ts';
import {breezy} from './wind.ts';
import * as T from 'three';

export function cityMaterials(neutral: boolean,groundMap: GroundMap | null){
  const mat=new T.MeshStandardMaterial({...surfaceStencil(),vertexColors:true,flatShading:true,side:T.DoubleSide,roughness:1});
  if(!neutral && groundMap) mat.onBeforeCompile=shader=>{
    const road=groundMap.flatRoad;
    if(road){shader.uniforms.roadMask={value:road.mask};shader.uniforms.roadColor={value:road.color};}
    shader.uniforms.groundColours={value:groundMap.texture};
    shader.uniforms.groundBounds={value:groundMap.bounds};
    shader.vertexShader='attribute float surface; varying float vKind; varying vec3 vMap;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vKind=surface; vMap=position;');
    shader.fragmentShader=(road?'uniform sampler2D roadMask;uniform vec3 roadColor;':'')+'uniform sampler2D groundColours; uniform vec4 groundBounds; varying float vKind; varying vec3 vMap;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=vMap.xz;
      float speck=fract(sin(dot(floor((p+vMap.y*.41)*5.),vec2(12.9898,78.233)))*4375.5453);
      float fade=1.-smoothstep(.13,.75,length(fwidth(p)));
      float grain=(speck-.5)*.07;
      if(vKind>100.){
        grain+=(speck-.5)*.36+.07*sin(p.x*2.+p.y*3.);
      }else if(vKind>5.5){
        vec2 uv=(vec2(p.x,-p.y)-groundBounds.xy)/groundBounds.zw;
        vec3 ground=texture2D(groundColours,uv).rgb;
        ${road?'float roadCoverage=texture2D(roadMask,uv).r;':''}
        if(ground.g>ground.r && ground.g>ground.b){grain+=.1*sin(p.x*.73)*sin(p.y*.61);}
        else if(ground.r>=ground.b){
          vec2 paving=p*vec2(.85,1.65);paving.x+=mod(floor(paving.y),2.)*.5;
          vec2 edge=min(fract(paving),1.-fract(paving));
          grain-=.15*(1.-smoothstep(.01,.1,min(edge.x,edge.y)));
        }
        ${road?'grain*=1.-roadCoverage;ground=mix(ground,roadColor,roadCoverage);':''}
        diffuseColor.rgb*=ground;
      }else if(vKind>2.5){
        grain=0.;
      }
      diffuseColor.rgb*=1.+grain*fade;
    `);
  };
  const buildingMat=mat.clone();
  buildingMat.onBeforeCompile=mat.onBeforeCompile;
  Object.assign(buildingMat,surfaceStencil(true));
  breezy(mat,'frond');breezy(buildingMat);
  if(groundMap?.flatRoad)for(const material of [mat,buildingMat]){
    const baseKey=material.customProgramCacheKey();
    material.customProgramCacheKey=()=>baseKey+':flat-road';
  }
  const timber=()=>new T.MeshStandardMaterial({...surfaceStencil(),flatShading:true,roughness:1});
  const shadeMat=new T.ShaderMaterial({
    transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
    vertexShader:'varying vec2 v; void main(){v=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 v;void main(){gl_FragColor=vec4(.13,.14,.10,.22*(1.-smoothstep(.08,.50,length(v))));}'
  });
  return {mat,buildingMat,shadeMat,wood:breezy(timber()),leaf:breezy(timber(),'crown')};
}
