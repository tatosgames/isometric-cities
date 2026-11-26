import * as T from 'three';

// One wind for the whole city. The north-east trade wind drives cloud shadows, tree crowns and
// palm fronds from the same direction and clock, so they read as one weather and not three effects.
// World x points east and z points south: the wind blows towards the south-south-west.
export const wind={
  time:{value:0},
  dir:{value:new T.Vector2(-.5,.866)},
  clouds:{value:null as T.DataTexture | null},
  /** Strength of the cloud shadows (the Matcap look tunes it). */
  shade:{value:1},
  /** A struck tree: world x and z, strength in metres (eases back to 0 in about half a second). */
  shake:{value:new T.Vector3()}
};

/** Shakes the crowns and palm fronds around a struck point (easting, northing) by about `strength` metres. */
export function shakeTree(x: number,y: number,strength: number){
  const shake=wind.shake.value;
  if(strength<shake.z)return;
  shake.set(x,-y,strength);
}
/** Eases the shake back to rest. */
export function settleTrees(dt: number){
  const shake=wind.shake.value;
  if(shake.z>0)shake.z=Math.max(0,shake.z-dt*(.4+shake.z*2.2));
}

export type Sway='none' | 'crown' | 'frond';

// Tileable value noise, three octaves. One small texture replaces per-pixel noise on phones.
function cloudTexture(){
  const size=128,raw=new Float32Array(size*size);
  const hash=(x: number,y: number,s: number)=>{const v=Math.sin(x*127.1+y*311.7+s*74.7)*43758.5453;return v-Math.floor(v);};
  const ease=(t: number)=>t*t*(3-2*t);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let v=0;
    for(const [cells,weight] of [[3,.58],[6,.28],[12,.14]]){
      const fx=x/size*cells,fy=y/size*cells,ix=Math.floor(fx),iy=Math.floor(fy),tx=ease(fx-ix),ty=ease(fy-iy);
      const at=(i: number,j: number)=>hash((ix+i)%cells,(iy+j)%cells,cells);
      v+=weight*T.MathUtils.lerp(T.MathUtils.lerp(at(0,0),at(1,0),tx),T.MathUtils.lerp(at(0,1),at(1,1),tx),ty);
    }
    raw[y*size+x]=v;
  }
  // Stretch to the full range: a few lattice cells never reach both ends on their own.
  let low=1,high=0;
  for(const v of raw){low=Math.min(low,v);high=Math.max(high,v);}
  const data=Uint8Array.from(raw,v=>Math.round((v-low)/(high-low)*255));
  const texture=new T.DataTexture(data,size,size,T.RedFormat);
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=texture.minFilter=T.LinearFilter;
  texture.needsUpdate=true;
  return texture;
}

export const cloudDensityGLSL=`vec2 windDrift=windDir*windTime;
      float cloud=texture2D(windClouds,(vWind-windDrift*14.)/1500.).r*.7+texture2D(windClouds,(vWind.yx-windDrift.yx*9.)/830.+.37).r*.3;`;

export function windCloudTexture(){return wind.clouds.value??=cloudTexture();}

const header='uniform vec2 windDir; uniform float windTime; uniform vec3 windShake; varying vec2 vWind;\n';
const sways: Record<Sway,string>={
  none:'',
  // Each crown is one instance: it leans downwind as a whole, with a slow gust that crosses the city.
  crown:`
    #ifdef USE_INSTANCING
      vec3 windRoot=instanceMatrix[3].xyz;
      float gust=dot(windRoot.xz,windDir)*.045-windTime*1.7+sin(windRoot.x*12.9+windRoot.z*78.2)*.6;
      float lean=.38+.24*sin(gust*.37+windRoot.x*.011);
      vec2 push=windDir*lean*(.5+.5*sin(gust))+vec2(-windDir.y,windDir.x)*.1*sin(gust*2.3+windRoot.z);
      float flutter=.09*sin(windTime*4.6+position.y*4.+windRoot.x);
      // A struck tree: its crowns sway faster and wider for an instant.
      float struck=windShake.z*(1.-smoothstep(2.5,6.5,distance(windRoot.xz,windShake.xy)));
      vec3 shake=struck*vec3(sin(windTime*31.+windRoot.x*3.1),.35*sin(windTime*23.+position.y*3.),cos(windTime*27.+windRoot.z*2.7));
      transformed+=inverse(mat3(instanceMatrix))*(vec3(push.x,flutter,push.y)+shake);
    #endif`,
  // Fronds are merged geometry: values above 128 in the surface attribute carry the distance from the trunk.
  frond:`
    float bend=max(surface-128.,0.)/100.;
    if(bend>0.){
      float gust=dot(position.xz,windDir)*.045-windTime*1.7;
      transformed.xz+=windDir*bend*bend*(.8+.6*sin(gust));
      transformed.y+=bend*.3*sin(gust*1.9+position.x*.7);
      float struck=windShake.z*(1.-smoothstep(2.,6.,distance(position.xz,windShake.xy)));
      transformed.xz+=bend*struck*1.6*vec2(sin(windTime*29.+position.x),cos(windTime*25.+position.z));
    }`
};

// Adds the moving cloud shadow, and optionally the sway, to a lit material. Call it after any other
// onBeforeCompile has been assigned: it wraps the hook and keeps a distinct program key per variant.
export function breezy<M extends T.Material>(material: M,sway: Sway='none'): M {
  const inner=material.onBeforeCompile;
  material.onBeforeCompile=(shader,renderer)=>{
    inner.call(material,shader,renderer);
    windCloudTexture();
    shader.uniforms.windTime=wind.time;shader.uniforms.windDir=wind.dir;shader.uniforms.windClouds=wind.clouds;
    shader.uniforms.windShade=wind.shade;shader.uniforms.windShake=wind.shake;
    const surface=sway==='frond' && !shader.vertexShader.includes('attribute float surface')?'attribute float surface;\n':'';
    shader.vertexShader=header+surface+shader.vertexShader
      .replace('#include <begin_vertex>','#include <begin_vertex>\n'+sways[sway])
      .replace('#include <project_vertex>',`#include <project_vertex>
        vec4 windPosition=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          windPosition=instanceMatrix*windPosition;
        #endif
        vWind=(modelMatrix*windPosition).xz;`);
    shader.fragmentShader='uniform sampler2D windClouds;\nuniform float windShade;\n'+header+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      ${cloudDensityGLSL}
      diffuseColor.rgb*=mix(vec3(1.),vec3(.80,.84,.92),min(1.,smoothstep(.54,.72,cloud)*windShade));`);
  };
  material.customProgramCacheKey=()=>'wind:'+sway+':'+inner.toString();
  return material;
}
