import * as T from 'three';

export function cityMaterials(neutral,groundMap){
  const mat=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,side:T.DoubleSide,roughness:1});
  if(!neutral) mat.onBeforeCompile=shader=>{
    shader.uniforms.groundColours={value:groundMap.texture};
    shader.uniforms.groundBounds={value:groundMap.bounds};
    shader.vertexShader='attribute float surface; varying float vKind; varying vec3 vMap;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vKind=surface; vMap=position;');
    shader.fragmentShader='uniform sampler2D groundColours; uniform vec4 groundBounds; varying float vKind; varying vec3 vMap;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 p=vMap.xz;
      float speck=fract(sin(dot(floor((p+vMap.y*.41)*5.),vec2(12.9898,78.233)))*4375.5453);
      float fade=1.-smoothstep(.13,.75,length(fwidth(p)));
      float grain=(speck-.5)*.07;
      if(vKind>5.5){
        vec2 uv=(vec2(p.x,-p.y)-groundBounds.xy)/groundBounds.zw;
        vec3 ground=texture2D(groundColours,uv).rgb;
        diffuseColor.rgb*=ground;
        if(ground.g>ground.r && ground.g>ground.b){grain+=.1*sin(p.x*.73)*sin(p.y*.61);}
        else if(ground.r>=ground.b){
          vec2 paving=p*vec2(.85,1.65);paving.x+=mod(floor(paving.y),2.)*.5;
          vec2 edge=min(fract(paving),1.-fract(paving));
          grain-=.15*(1.-smoothstep(.01,.1,min(edge.x,edge.y)));
        }
      }else if(vKind>4.5){
        grain+=(speck-.5)*.36+.07*sin(p.x*2.+p.y*3.);
      }else if(vKind>2.5){
        grain=0.;
      }
      diffuseColor.rgb*=1.+grain*fade;
    `);
  };
  const shadeMat=new T.ShaderMaterial({
    transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,
    vertexShader:'varying vec2 v; void main(){v=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 v;void main(){gl_FragColor=vec4(.13,.14,.10,.22*(1.-smoothstep(.08,.50,length(v))));}'
  });
  return {mat,shadeMat,wood:new T.MeshStandardMaterial({flatShading:true,roughness:1})};
}
