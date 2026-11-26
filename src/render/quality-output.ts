import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// FXAA reads display-space colour after OutputPass. The offscreen depth/stencil
// buffer preserves the drive effects that test the building stencil.
export function makeQualityOutput(renderer:T.WebGLRenderer){
  const bufferSize=new T.Vector2();
  let pipeline:ReturnType<typeof create>|null=null;
  function create(){
    const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:true,samples:0});
    const composer=new EffectComposer(renderer,target);
    // Work in physical pixels throughout, including when the canvas DPR changes.
    composer.setPixelRatio(1);
    const renderPass=new RenderPass(new T.Scene(),new T.Camera());
    const outputPass=new OutputPass(),fxaaPass=new ShaderPass(FXAAShader);
    composer.addPass(renderPass);composer.addPass(outputPass);composer.addPass(fxaaPass);
    return {composer,renderPass,outputPass,fxaaPass};
  }
  function dispose(){
    if(!pipeline)return;
    pipeline.composer.dispose();pipeline.outputPass.dispose();pipeline.fxaaPass.dispose();
    pipeline=null;
  }
  return {
    configure(fxaa:boolean){
      if(!fxaa){dispose();return;}
      pipeline??=create();
      renderer.getDrawingBufferSize(bufferSize);
      const width=Math.max(1,bufferSize.x),height=Math.max(1,bufferSize.y);
      pipeline.composer.setSize(width,height);
      pipeline.fxaaPass.uniforms.resolution.value.set(1/width,1/height);
    },
    render(scene:T.Scene,camera:T.Camera){
      if(!pipeline){renderer.render(scene,camera);return;}
      pipeline.renderPass.scene=scene;pipeline.renderPass.camera=camera;pipeline.composer.render();
    },
    dispose
  };
}
