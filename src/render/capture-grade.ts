import {
  Color, NoBlending, ShaderMaterial, Vector2, WebGLRenderTarget,
  type Camera, type Scene, type WebGLRenderer,
} from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export function makeCaptureGrade(renderer: WebGLRenderer, compact: boolean){
  const size=new Vector2();
  const backdrop=new Color('#e5e3d2');
  let target: WebGLRenderTarget | undefined;
  const material=new ShaderMaterial({
    uniforms:{image:{value:null},amount:{value:0}},
    depthTest:false,
    depthWrite:false,
    blending:NoBlending,
    vertexShader:`
      varying vec2 imageUv;
      void main(){
        imageUv=uv;
        gl_Position=vec4(position.xy,0.0,1.0);
      }
    `,
    fragmentShader:`
      uniform sampler2D image;
      uniform float amount;
      varying vec2 imageUv;
      void main(){
        vec3 color=texture2D(image,imageUv).rgb;
        float lightness=dot(color,vec3(0.2126,0.7152,0.0722));
        gl_FragColor=vec4(mix(color,vec3(lightness),amount),1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const quad=new FullScreenQuad(material);

  function release(){
    target?.dispose();
    target=undefined;
    material.uniforms.image.value=null;
  }

  return {
    release,
    render(scene: Scene,camera: Camera,amount: number){
      if(!amount){
        release();
        renderer.render(scene,camera);
        return;
      }

      renderer.getDrawingBufferSize(size);
      // The car silhouette uses the same building stencil as the normal render.
      target??=new WebGLRenderTarget(size.x,size.y,{
        stencilBuffer:true,
        samples:compact?0:Math.min(4,renderer.capabilities.maxSamples),
      });
      target.setSize(size.x,size.y);
      const background=scene.background;
      scene.background=background??backdrop;
      renderer.setRenderTarget(target);
      try{
        renderer.render(scene,camera);
      }finally{
        renderer.setRenderTarget(null);
        scene.background=background;
      }
      material.uniforms.image.value=target.texture;
      material.uniforms.amount.value=amount;
      quad.render(renderer);
    },
  };
}
