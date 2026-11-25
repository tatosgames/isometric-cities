import * as T from 'three';
import {cloudDensityGLSL, wind, windCloudTexture} from './wind.ts';

type Anchor={x:number;y:number;z:number};

// Local +X is the direction of flight. The outer panels hinge about the body.
// Three birds share the same geometry and material in each flock.
function gullGeometry(){
  const pos:number[]=[],colors:number[]=[];
  type Vertex=[number,number,number];
  function face(a:Vertex,b:Vertex,c:Vertex,tone:number){
    pos.push(...a,...b,...c);
    const color=new T.Color(tone);
    for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);
  }
  for(const side of [-1,1]){
    const shoulder:Vertex=[.22,0,.08*side],back:Vertex=[-.33,0,.06*side];
    const elbow:Vertex=[.09,.18,.78*side],wrist:Vertex=[-.22,.13,.94*side];
    face(shoulder,elbow,back,0xfffaeb);face(elbow,wrist,back,0xe0e5de);
    face(elbow,[-.52,.02,1.28*side],wrist,0x39434a);
    face([.45,0,0],shoulder,[-.50,.015,0],0xfff4df);
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.computeBoundingSphere();
  return g;
}

function build(anchors:Anchor[]){
  const group=new T.Group(),bird=gullGeometry(),pose=new T.Object3D();
  pose.scale.setScalar(1.5);
  const plumage=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide});
  plumage.onBeforeCompile=shader=>{
    shader.uniforms.skyTime=wind.time;
    shader.vertexShader='uniform float skyTime;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      float phase=instanceMatrix[3].x*.17+instanceMatrix[3].z*.11;
      float beats=smoothstep(.55,.88,sin(skyTime*.76+phase));
      transformed.y+=abs(position.z)*beats*.45*sin(skyTime*11.+phase);`);
  };
  const flocks=anchors.map(anchor=>{
    const mesh=new T.InstancedMesh(bird,plumage,3);
    mesh.position.set(anchor.x,anchor.y,anchor.z);
    mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    mesh.boundingSphere=new T.Sphere(new T.Vector3(),68);
    group.add(mesh);
    return mesh;
  });
  const mist=new T.ShaderMaterial({
    uniforms:{windTime:wind.time,windDir:wind.dir,windClouds:{value:windCloudTexture()},opacity:{value:0}},
    transparent:true,depthWrite:false,
    vertexShader:`varying vec2 vWind;
      void main(){vec4 world=modelMatrix*vec4(position,1.);vWind=world.xz;
      gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`uniform float windTime,opacity; uniform vec2 windDir; uniform sampler2D windClouds;
      varying vec2 vWind;
      void main(){${cloudDensityGLSL}
        float edge=texture2D(windClouds,(vWind-windDir*windTime*14.)/95.).r;
        float alpha=smoothstep(.57,.77,cloud+(edge-.5)*.095);
        gl_FragColor=vec4(.96,.97,1.,alpha*opacity);
        #include <colorspace_fragment>
      }`
  });
  const cloudGeometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2);
  const cloud=new T.Mesh(cloudGeometry,mist);
  group.add(cloud);
  return {group,update(camera:T.OrthographicCamera,target:T.Vector3,driving:boolean){
    const time=wind.time.value;
    for(const [k,flock] of flocks.entries()){
      for(let i=0;i<3;i++){
        const angle=time*(.102+i*.009)+i*.69+k*2.3;
        const radius=32+i*8,rx=radius,rz=radius*.64;
        pose.position.set(Math.cos(angle)*rx,3*Math.sin(angle*.8+i)+i*1.8,Math.sin(angle)*rz);
        pose.rotation.set(0,Math.atan2(-rz*Math.cos(angle),-rx*Math.sin(angle)),0,'YXZ');
        pose.rotateX(.24+.16*Math.sin(angle+i));
        pose.updateMatrix();flock.setMatrixAt(i,pose.matrix);
      }
      flock.instanceMatrix.needsUpdate=true;
    }
    const span=(camera.top-camera.bottom)/camera.zoom;
    mist.uniforms.opacity.value=(driving ? .08 : .28)*T.MathUtils.smoothstep(span,160,500);
    cloud.visible=mist.uniforms.opacity.value>.002;
    // Centre the sheet where the line of sight crosses the cloud deck.
    const clearance=400;
    const fraction=clearance/Math.max(1,camera.position.y-target.y);
    cloud.position.copy(target).lerp(camera.position,fraction);
    cloud.position.y=target.y+clearance;
    cloud.scale.setScalar(450+4*Math.max(span,(camera.right-camera.left)/camera.zoom));
  },dispose(){
    for(const flock of flocks)flock.dispose();
    bird.dispose();plumage.dispose();cloudGeometry.dispose();mist.dispose();
  }};
}

export function makeSkyEffects(scene:T.Scene,anchors:Anchor[]){
  let effects:ReturnType<typeof build>|undefined;
  return {
    setEnabled(on:boolean){
      if(on){effects??=build(anchors);if(!effects.group.parent)scene.add(effects.group);}
      else effects?.group.removeFromParent();
    },
    update(camera:T.OrthographicCamera,target:T.Vector3,driving:boolean){
      if(effects?.group.parent)effects.update(camera,target,driving);
    },
    dispose(){effects?.group.removeFromParent();effects?.dispose();effects=undefined;}
  };
}
