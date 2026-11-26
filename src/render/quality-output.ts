import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// Look prototype (`?look=…&tilt`): the folio-2019 edge blur used by Soso Mart, sharp in the middle band and
// soft at the top and bottom of the frame. Gaussian weights from folio-2019 (MIT, Bruno Simon).
function tiltPass(){
  return new ShaderPass({
    uniforms:{tDiffuse:{value:null},uStep:{value:new T.Vector2()}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 uStep;varying vec2 vUv;
      void main(){
        vec4 center=texture2D(tDiffuse,vUv);
        vec2 near=1.3846153846*uStep,far=3.2307692308*uStep;
        vec4 blur=center*.2270270270+(texture2D(tDiffuse,vUv+near)+texture2D(tDiffuse,vUv-near))*.3162162162
          +(texture2D(tDiffuse,vUv+far)+texture2D(tDiffuse,vUv-far))*.0702702703;
        gl_FragColor=mix(center,blur,1.-sin(vUv.y*3.14159265));
      }`
  });
}

// FXAA reads display-space colour after OutputPass. The offscreen depth/stencil
// buffer preserves the drive effects that test the building stencil.
export function makeQualityOutput(renderer:T.WebGLRenderer,{tilt=false}={}){
  const bufferSize=new T.Vector2();
  let pipeline:ReturnType<typeof create>|null=null;
  function create(){
    const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:true,samples:0});
    const composer=new EffectComposer(renderer,target);
    // Work in physical pixels throughout, including when the canvas DPR changes.
    composer.setPixelRatio(1);
    const renderPass=new RenderPass(new T.Scene(),new T.Camera());
    const outputPass=new OutputPass(),fxaaPass=new ShaderPass(FXAAShader);
    const tiltPasses=tilt?[tiltPass(),tiltPass()]:[];
    composer.addPass(renderPass);composer.addPass(outputPass);composer.addPass(fxaaPass);
    for(const pass of tiltPasses)composer.addPass(pass);
    return {composer,renderPass,outputPass,fxaaPass,tiltPasses};
  }
  function dispose(){
    if(!pipeline)return;
    pipeline.composer.dispose();pipeline.outputPass.dispose();pipeline.fxaaPass.dispose();
    for(const pass of pipeline.tiltPasses)pass.dispose();
    pipeline=null;
  }
  return {
    configure(fxaa:boolean){
      if(!fxaa && !tilt){dispose();return;}
      pipeline??=create();
      renderer.getDrawingBufferSize(bufferSize);
      const width=Math.max(1,bufferSize.x),height=Math.max(1,bufferSize.y);
      pipeline.composer.setSize(width,height);
      pipeline.fxaaPass.enabled=fxaa;
      pipeline.fxaaPass.uniforms.resolution.value.set(1/width,1/height);
      const [horizontal,vertical]=pipeline.tiltPasses;
      horizontal?.uniforms.uStep.value.set(1.6/width,0);
      vertical?.uniforms.uStep.value.set(0,1.6/height);
    },
    render(scene:T.Scene,camera:T.Camera){
      if(!pipeline){renderer.render(scene,camera);return;}
      pipeline.renderPass.scene=scene;pipeline.renderPass.camera=camera;pipeline.composer.render();
    },
    dispose
  };
}
