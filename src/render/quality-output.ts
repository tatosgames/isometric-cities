import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

// Look prototype (`?look=tilt:strength`): the folio-2019 edge blur used by Soso Mart, sharp in the middle band and
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

// Matcap look: colour grade (lift, gain, saturation, contrast) and a pink glow at the frame edges, in display space.
function gradePass(){
  return new ShaderPass({
    uniforms:{tDiffuse:{value:null},uLift:{value:new T.Vector3()},uGain:{value:new T.Vector3(1,1,1)},
      uSaturation:{value:1},uContrast:{value:1},uGlow:{value:0},uAspect:{value:1}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D tDiffuse;uniform vec3 uLift,uGain;uniform float uSaturation,uContrast,uGlow,uAspect;varying vec2 vUv;
      void main(){
        vec4 colour=texture2D(tDiffuse,vUv);
        vec3 c=colour.rgb*uGain+uLift*(1.-colour.rgb);
        c=mix(vec3(dot(c,vec3(.2126,.7152,.0722))),c,uSaturation);
        c=(c-.5)*uContrast+.5;
        vec2 p=(vUv-.5)*vec2(uAspect,1.);
        float edge=smoothstep(.45,1.,length(p)/length(vec2(uAspect,1.)*.5));
        c=mix(c,1.-(1.-c)*(1.-vec3(1.,.62,.78)),uGlow*edge);
        gl_FragColor=vec4(clamp(c,0.,1.),colour.a);
      }`
  });
}

export interface PostLook {
  /** Edge blur strength, 0 off. */
  tilt:number;
  /** Edge glow, 0 off. */
  glow:number;
  grade:{lift:readonly number[];gain:readonly number[];saturation:number;contrast:number}|null;
}

// FXAA reads display-space colour after OutputPass. The offscreen depth/stencil
// buffer preserves the drive effects that test the building stencil.
export function makeQualityOutput(renderer:T.WebGLRenderer,initial:PostLook={tilt:0,glow:0,grade:null}){
  const bufferSize=new T.Vector2();
  let pipeline:ReturnType<typeof create>|null=null,fxaa=false,post=initial;
  const graded=()=>post.glow>0 || !!post.grade;
  function create(){
    const target=new T.WebGLRenderTarget(1,1,{depthBuffer:true,stencilBuffer:true,samples:0});
    const composer=new EffectComposer(renderer,target);
    // Work in physical pixels throughout, including when the canvas DPR changes.
    composer.setPixelRatio(1);
    const renderPass=new RenderPass(new T.Scene(),new T.Camera());
    const outputPass=new OutputPass(),fxaaPass=new ShaderPass(FXAAShader);
    const tiltPasses=[tiltPass(),tiltPass()],grade=gradePass();
    composer.addPass(renderPass);composer.addPass(outputPass);composer.addPass(fxaaPass);
    for(const pass of tiltPasses)composer.addPass(pass);
    composer.addPass(grade);
    return {composer,renderPass,outputPass,fxaaPass,tiltPasses,grade};
  }
  function dispose(){
    if(!pipeline)return;
    pipeline.composer.dispose();pipeline.outputPass.dispose();pipeline.fxaaPass.dispose();pipeline.grade.dispose();
    for(const pass of pipeline.tiltPasses)pass.dispose();
    pipeline=null;
  }
  function configure(antialias:boolean){
    fxaa=antialias;
    if(!fxaa && post.tilt<=0 && !graded()){dispose();return;}
    pipeline??=create();
    renderer.getDrawingBufferSize(bufferSize);
    const width=Math.max(1,bufferSize.x),height=Math.max(1,bufferSize.y);
    pipeline.composer.setSize(width,height);
    pipeline.fxaaPass.enabled=fxaa;
    pipeline.fxaaPass.uniforms.resolution.value.set(1/width,1/height);
    const [horizontal,vertical]=pipeline.tiltPasses;
    horizontal.enabled=vertical.enabled=post.tilt>0;
    horizontal.uniforms.uStep.value.set(1.6*post.tilt/width,0);
    vertical.uniforms.uStep.value.set(0,1.6*post.tilt/height);
    const {uniforms}=pipeline.grade,grade=post.grade;
    pipeline.grade.enabled=graded();
    uniforms.uLift.value.fromArray(grade?.lift??[0,0,0]);
    uniforms.uGain.value.fromArray(grade?.gain??[1,1,1]);
    uniforms.uSaturation.value=grade?.saturation??1;
    uniforms.uContrast.value=grade?.contrast??1;
    uniforms.uGlow.value=post.glow;
    uniforms.uAspect.value=width/height;
  }
  return {
    configure,
    /** Changes the look's post-processing and rebuilds or drops the pipeline as needed. */
    setPost(next:PostLook){post=next;configure(fxaa);},
    render(scene:T.Scene,camera:T.Camera){
      if(!pipeline){renderer.render(scene,camera);return;}
      pipeline.renderPass.scene=scene;pipeline.renderPass.camera=camera;pipeline.composer.render();
    },
    dispose
  };
}
