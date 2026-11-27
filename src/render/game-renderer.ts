import * as T from 'three';
import { cityFillLight, citySun } from './city-light.ts';
import { makeDynamicQuality, renderPixelRatio, type DynamicQualityConfig } from './dynamic-quality.ts';
import { fallbackToBase, lightLook, makeMatcapLook, readLook, readTune, tunePost } from './look-lab.ts';
import { makeQualityOutput, type PostLook } from './quality-output.ts';
import { wind } from './wind.ts';

type QualityOptions = Parameters<typeof makeDynamicQuality>[0];

/**
 * How the game draws a frame, for the map and for every lab: renderer, look (`?look=`, matcap tune), output pass
 * with FXAA and the look's post-processing, the two city lights, adaptive quality and the wind clock.
 * Who uses it owns only the scene and the camera.
 */
export function makeGameRenderer({query,...quality}: Omit<QualityOptions,'solarShadows'> & {query: URLSearchParams}){
  const look=readLook(),tune=readTune(query);
  // Base keeps the original frame; Sole accepts only the edge blur; Matcap takes the whole tune.
  const post=(): PostLook=>look==='matcap'?tunePost(tune):{tilt:look==='sole'?tune.tilt:0,glow:0,grade:null};
  const adaptive=makeDynamicQuality({...quality,solarShadows:look!=='matcap'});
  const renderer=new T.WebGLRenderer({antialias:adaptive.nativeAntialias,alpha:true,stencil:true});
  renderer.shadowMap.type=T.PCFShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const matcap=look==='matcap'?makeMatcapLook(tune):null;
  if(matcap){
    // Black raises no error: check once that the look draws colour, and fall back to base if a shader fails.
    renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{
      console.error('[atlas:gl] shader error',gl.getProgramInfoLog(program));
      for(const shader of [vertex,fragment]){
        const log=gl.getShaderInfoLog(shader);
        if(log)console.error(log,gl.getShaderSource(shader));
      }
      fallbackToBase('shader');
    };
    if(!matcap.probe(renderer))fallbackToBase('probe');
  }
  const output=makeQualityOutput(renderer,post());
  const fill=cityFillLight(),sun=citySun();
  lightLook(look,renderer,fill,sun);
  const staticShadows=new Set<(enabled: boolean)=>void>();
  let patched=-Infinity,painted=0;
  return {
    look,tune,post,quality:adaptive,renderer,output,fill,sun,
    /** The game's shadow masks (matcap look and small screens) follow the quality: register each city that has them. */
    onStaticShadows(set: (enabled: boolean)=>void){staticShadows.add(set);},
    /** Applies a quality level: pixel ratio, antialiasing pass and the kind of shadows. Returns the pixel ratio. */
    apply(config: DynamicQualityConfig){
      const {antialias,shadows}=config,ratio=renderPixelRatio(config);
      if(ratio!==renderer.getPixelRatio())renderer.setPixelRatio(ratio);
      output.configure(antialias==='fxaa');
      if(renderer.shadowMap.enabled!==(shadows==='solar')){
        renderer.shadowMap.enabled=shadows==='solar';
        renderer.shadowMap.needsUpdate=true;
      }
      for(const set of staticShadows)set(shadows==='static');
      return ratio;
    },
    /** Resizes the canvas and the output pass with it, as the map does on every resize. */
    setSize(width: number,height: number){
      adaptive.updateViewport(width,height,devicePixelRatio);
      renderer.setSize(width,height,false);
      return this.apply(adaptive.config);
    },
    /** A tune change from the lab: matcap, shadow strength and post-processing. */
    retune(){matcap?.set(tune);output.setPost(post());},
    /**
     * Draws a frame at `time` (a frame callback's clock). Wind advances by the time since the last frame,
     * slowed by `timeScale`; materials that appeared since are given the look.
     */
    render(scene: T.Scene,camera: T.Camera,time: number,timeScale=1){
      const elapsed=painted?Math.max(0,time-painted)/1000:time/1000;
      wind.time.value+=timeScale===1?elapsed:Math.min(.05,elapsed)*timeScale;
      painted=time;
      if(matcap && time-patched>400){patched=time;matcap.patch(scene);}
      output.render(scene,camera);
    },
    dispose(){output.dispose();renderer.dispose();}
  };
}
export type GameRenderer=ReturnType<typeof makeGameRenderer>;
