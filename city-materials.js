import * as T from 'three';

export function cityMaterials(neutral,groundMap,roofColours,roofAtlas){
  const mat=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,side:T.DoubleSide,roughness:1});
  if(!neutral) mat.onBeforeCompile=shader=>{
    shader.uniforms.groundColours={value:groundMap.texture};
    shader.uniforms.groundBounds={value:groundMap.bounds};
    shader.uniforms.roofColours={value:roofColours};
    shader.uniforms.atlasBounds={value:new T.Vector4().fromArray(roofAtlas.bounds)};
    shader.vertexShader='attribute float surface; varying float vKind; varying vec3 vMap;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vKind=surface; vMap=position;');
    shader.fragmentShader='uniform sampler2D groundColours; uniform vec4 groundBounds; uniform sampler2D roofColours; uniform vec4 atlasBounds; varying float vKind; varying vec3 vMap;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
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
        // Same metric frame as scripts/roof-colours.py. Texture origin is southwest.
        vec2 atlasUV=(vec2(p.x,-p.y)-atlasBounds.xy)/atlasBounds.zw;
        vec3 roof=texture2D(roofColours,atlasUV).rgb;
        diffuseColor.rgb=mix(diffuseColor.rgb,roof,vKind<3.5?.64:.20);
        bool tile=roof.r>1.35*roof.b && roof.r>1.18*roof.g;
        vec2 uv=tile?vec2(p.x*1.8+p.y*.42,p.y*2.-p.x*.38):p*.85;
        uv.x+=mod(floor(uv.y),2.)*.5;
        vec2 edge=min(fract(uv),1.-fract(uv));
        float seam=1.-smoothstep(.015,.09,min(edge.x,edge.y));
        grain+=tile?.12*cos(uv.x*6.283)-.17*seam:-.14*seam;
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
