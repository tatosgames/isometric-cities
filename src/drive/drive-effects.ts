import * as T from 'three';
import type { Altitude } from '../data/types.ts';
import { DUST, SKIDS, TUNE } from './drive-tune.ts';

// Sparks live this share of a dust puff's life: 0.16 s with the default 0.22 s.
const SPARK_LIFE=.16/.22;
import type { Vehicle } from './drive-types.ts';

const COLOURS={dust:new T.Color('#d8cdbb'),smoke:new T.Color('#3b3836'),drift:new T.Color('#fff6de'),spark:new T.Color('#ffcc68')};
export type ParticleKind=keyof typeof COLOURS;

/** Skid marks and the shared particle pool (dust, smoke, drift puffs, sparks). */
export function makeDriveEffects(group: T.Group,groundAt: Altitude){
  const dummy=new T.Object3D();
  const skidPositions=new Float32Array(SKIDS*18);
  const skidGeometry=new T.BufferGeometry();skidGeometry.setAttribute('position',new T.BufferAttribute(skidPositions,3));
  const skidMesh=new T.Mesh(skidGeometry,new T.MeshBasicMaterial({color:'#1d1c1f',transparent:true,opacity:.34,depthWrite:false,side:T.DoubleSide}));
  skidMesh.frustumCulled=false;group.add(skidMesh);
  const dustMesh=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshBasicMaterial({transparent:true,opacity:.5,depthWrite:false}),DUST);
  // Colours exist from the start: adding them at the first puff would build a second shader mid-run.
  for(let i=0;i<DUST;i++)dustMesh.setColorAt(i,COLOURS.dust);
  dustMesh.frustumCulled=false;group.add(dustMesh);
  const dust=Array.from({length:DUST},()=>({x:0,y:0,z:0,vx:0,vy:0,life:0,kind:'dust' as ParticleKind}));
  let skidAt=0,dustAt=0;
  return {
    puff(x: number,y: number,kind: ParticleKind='dust',vx=0,vy=0){
      const p=dust[dustAt];
      Object.assign(p,{x,y,z:groundAt(x,y)+(kind==='spark'?1.25:1),vx,vy,life:1,kind});
      dustMesh.setColorAt(dustAt,COLOURS[kind]);if(dustMesh.instanceColor)dustMesh.instanceColor.needsUpdate=true;
      dustAt=(dustAt+1)%DUST;
    },
    skid(b: Vehicle,fx: number,fy: number,scale: number){
      const now: NonNullable<Vehicle["trail"]>=[];
      for(const side of [-.7,.7]){
        const x=b.x-(fx*1.1+fy*side)*scale,y=b.y+(-fy*1.1+fx*side)*scale;
        now.push([x,groundAt(x,y)+.78,-y]);
      }
      if(b.trail){
        for(let k=0;k<2;k++){
          const [ax,ay,az]=b.trail[k],[bx,by,bz]=now[k],w=.14;
          skidPositions.set([ax-w,ay,az,ax+w,ay,az,bx+w,by,bz,ax-w,ay,az,bx+w,by,bz,bx-w,by,bz],skidAt*18);
          skidAt=(skidAt+1)%SKIDS;
        }
        skidGeometry.attributes.position.needsUpdate=true;
      }
      b.trail=now;
    },
    reset(){
      skidPositions.fill(0);skidGeometry.attributes.position.needsUpdate=true;
      for(const p of dust)p.life=0;
    },
    /** Advance and draw every live particle. */
    update(dt: number){
      dust.forEach((p,i)=>{
        const spark=p.kind==='spark',drift=p.kind==='drift';
        p.life=Math.max(0,p.life-dt*(spark?1/(TUNE.puffLife*SPARK_LIFE):drift?1/TUNE.puffLife:1.5));
        const age=1-p.life;
        if(spark){
          const elapsed=age*TUNE.puffLife*SPARK_LIFE,size=.25*p.life;
          dummy.position.set(p.x+p.vx*elapsed,p.z+.22*Math.sin(age*Math.PI),-p.y-p.vy*elapsed);
          dummy.rotation.set(0,Math.atan2(p.vy,p.vx),0);dummy.scale.set(size*2.1,size*.6,size*.6);
        }else{
          const size=drift?Math.min(1,.72+age*2,p.life*3):p.life?.5+age*1.5:0;
          dummy.position.set(p.x,p.z+age*(drift?.45:1.6),-p.y);dummy.rotation.set(0,0,0);dummy.scale.setScalar(size);
        }
        dummy.updateMatrix();dustMesh.setMatrixAt(i,dummy.matrix);
      });
      dustMesh.instanceMatrix.needsUpdate=true;
    }
  };
}
