import * as T from 'three';

const INTERVAL=1/30,SEGMENTS=8,HALF_SPAN=5.35;

/** Two short ribbons remember where the wingtips were during a loaded turn. */
export function makeWingTrails(){
  const positions=new Float32Array(2*SEGMENTS*6*3);
  const geometry=new T.BufferGeometry();
  const vertices=new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position',vertices);
  const material=new T.MeshBasicMaterial({color:'#f5f1da',side:T.DoubleSide,transparent:true,depthWrite:false});
  const mesh=new T.Mesh(geometry,material);
  mesh.visible=false;mesh.frustumCulled=false;
  const tracks=[-1,1].map(side=>({
    tip:new T.Vector3(),previous:new T.Vector3(),side,
    samples:Array.from({length:SEGMENTS},()=>new T.Vector3())
  }));
  let remainder=0,opacity=0;
  function reset(){
    opacity=remainder=0;mesh.visible=false;
  }
  function update(plane:T.Object3D,bank:number,dt:number){
    const load=T.MathUtils.smoothstep(Math.abs(bank),.40,.70);
    opacity+=(load-opacity)*-Math.expm1(-12*dt);
    if(opacity<.012){reset();return;}
    plane.updateWorldMatrix(true,false);
    const rightX=Math.sin(plane.rotation.y),rightZ=Math.cos(plane.rotation.y);
    for(const track of tracks){
      const {samples,tip,previous,side}=track;
      tip.set(-.3,.96,side*HALF_SPAN).applyMatrix4(plane.matrixWorld);
      if(!mesh.visible){
        previous.copy(tip);
        for(const sample of samples)sample.copy(tip);
      }
      for(let time=INTERVAL-remainder;time<=dt;time+=INTERVAL){
        const sample=samples.pop()!;
        sample.lerpVectors(previous,tip,time/dt);samples.unshift(sample);
      }
      previous.copy(tip);
      let offset=side<0?0:SEGMENTS*6;
      for(let i=0;i<SEGMENTS;i++){
        const a=i?samples[i-1]:tip,b=samples[i];
        const wa=.14*(1-i/SEGMENTS),wb=.14*(1-(i+1)/SEGMENTS);
        // Spread the ribbon across the flight path so it reads in the rear view.
        vertices.setXYZ(offset++,a.x+rightX*wa,a.y,a.z+rightZ*wa);vertices.setXYZ(offset++,a.x-rightX*wa,a.y,a.z-rightZ*wa);
        vertices.setXYZ(offset++,b.x+rightX*wb,b.y,b.z+rightZ*wb);vertices.setXYZ(offset++,b.x+rightX*wb,b.y,b.z+rightZ*wb);
        vertices.setXYZ(offset++,a.x-rightX*wa,a.y,a.z-rightZ*wa);vertices.setXYZ(offset++,b.x-rightX*wb,b.y,b.z-rightZ*wb);
      }
    }
    remainder=(remainder+dt)%INTERVAL;
    material.opacity=opacity*.58;vertices.needsUpdate=true;mesh.visible=true;
  }
  return {mesh,reset,update};
}
