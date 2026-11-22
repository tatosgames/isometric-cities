// Sector LOD transition. The overview ground and detail terrain share world coordinates.
import * as T from 'three';
import type {SectorLod} from './sector-stream.ts';

export interface LodSettings {ground:boolean;objects:boolean;duration:number;manual?:boolean;progress?:number}
const threshold=`float lodThreshold(){
  vec2 p=mod(floor(gl_FragCoord.xy),4.);
  vec2 a=mod(p,2.), b=floor(p*.5);
  return (4.*(2.*a.x+3.*a.y-4.*a.x*a.y)+(2.*b.x+3.*b.y-4.*b.x*b.y)+.5)/16.;
}`;
export function lodTransition(settings:LodSettings={ground:true,objects:true,duration:250}):NonNullable<SectorLod['attach']>{
  return (low,detail,overview)=>{
    const objects={value:0},ground={value:0};
    const {mat,road,buildingMat,wood,leaf,shadeMat}=detail.materials;
    const simplified=low.children[0] as T.Mesh<T.BufferGeometry,T.Material[]>;
    const original=simplified.material;
    const copies=original.map(m=>{
      const copy=m.clone();
      copy.onBeforeCompile=m.onBeforeCompile;copy.customProgramCacheKey=m.customProgramCacheKey;
      return copy;
    });
    simplified.material=copies;
    function patch(material:T.Material,kind:'low'|'high'|'terrain'|'road'){
      const inner=material.onBeforeCompile,key=material.customProgramCacheKey();
      material.customProgramCacheKey=()=>key+'/lod/'+kind;
      material.onBeforeCompile=(shader,renderer)=>{
        inner.call(material,shader,renderer);
        Object.assign(shader.uniforms,{lodObjects:objects,lodGround:ground,lodMap:{value:overview.texture},lodBounds:{value:overview.bounds}});
        const declarations='uniform float lodObjects,lodGround;uniform sampler2D lodMap;uniform vec4 lodBounds;';
        shader.fragmentShader=declarations+threshold+'\n'+shader.fragmentShader;
        const reject=kind==='low'?'if(lodThreshold()<lodObjects)discard;':'if(lodThreshold()>=lodObjects)discard;';
        if(kind==='terrain'||kind==='road'){
          const blend='diffuseColor.rgb=mix(texture2D(lodMap,(vec2(vWind.x,-vWind.y)-lodBounds.xy)/lodBounds.zw).rgb,diffuseColor.rgb,lodGround);';
          const code=kind==='road'?blend:'if(vKind>5.5 && vKind<100.){'+blend+'}else{'+reject+'}';
          shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',code+'\n#include <roughnessmap_fragment>');
        }else{
          shader.fragmentShader=shader.fragmentShader.replace(/void main\s*\(\s*\)\s*\{/,'$&\n'+reject);
        }
      };
    }
    copies.forEach(m=>patch(m,'low'));
    patch(mat,'terrain');patch(road,'road');
    for(const m of [buildingMat,wood,leaf,shadeMat])patch(m,'high');
    const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});
    patch(depth,'high');
    for(const mesh of detail.group.children){
      if(mesh instanceof T.Mesh && mesh.castShadow && mesh.material!==mat)mesh.customDepthMaterial=depth;
    }
    let phase=0,last=0,goal=false;
    return {
      step(show,now){
        if(show!==goal){goal=show;last=now;}
        const delta=(now-last)/Math.max(1,settings.duration);last=now;
        phase=T.MathUtils.clamp(phase+(show?delta:-delta),0,1);
        const weight=settings.manual && show?(settings.progress??100)/100:phase;
        objects.value=settings.objects?weight:Number(show);ground.value=settings.ground?weight:Number(show);
        detail.group.visible=phase>0 && (objects.value>0 || ground.value>0);
        simplified.visible=!detail.group.visible||objects.value<1;
        low.children[1].visible=!detail.group.visible;
        low.visible=simplified.visible||!detail.group.visible;
        return phase!==Number(show);
      },
      dispose(){
        simplified.material=original;simplified.visible=true;low.children[1].visible=true;
        copies.forEach(m=>m.dispose());depth.dispose();
      }
    };
  };
}
