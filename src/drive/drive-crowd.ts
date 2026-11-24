import * as T from 'three';
import type { Altitude } from '../data/types.ts';
import { approach } from '../geometry.ts';
import { surfaceStencil } from '../render/building-stencil.ts';
import { breezy } from '../render/wind.ts';
import { tint } from './car-model.ts';
import type { makePedestrians } from './pedestrians.ts';

type Crowd = ReturnType<typeof makePedestrians>;

/**
 * Pedestrian meshes: legless toy figures that get about by hopping, larger than life like the cars.
 * A tinted body and a fixed head share one matrix per walker, so the body colour does not tint the skin.
 */
export function makeCrowdView(group: T.Group,altitude: Altitude,count: number){
  const figure=()=>breezy(new T.MeshStandardMaterial({...surfaceStencil(),flatShading:true,roughness:1}));
  const torso=new T.InstancedMesh(new T.CylinderGeometry(.34,.52,1.45,8).translate(0,.725,0),figure(),count);
  const limbs=figure();limbs.vertexColors=true;
  const head=new T.InstancedMesh(tint(new T.IcosahedronGeometry(.4,1).translate(0,1.78,0),'#e0b48e'),limbs,count);
  const shirts=['#d9614c','#e8c25a','#5b8fb9','#6aa27a','#f1ebe0','#8d6bb0','#e58f4f'].map(c=>new T.Color(c));
  for(let i=0;i<count;i++)torso.setColorAt(i,shirts[i%shirts.length]);
  torso.frustumCulled=head.frustumCulled=false;group.add(torso,head);
  const dummy=new T.Object3D();
  const shown=new Float32Array(count),lifted=new Float32Array(count),wasAlive=new Uint8Array(count);
  return {
    reset(){shown.fill(0);},
    /** Draw every walker. Returns how many are alive and the closest one on the ground to the player. */
    update(people: Crowd,dt: number,player: {x: number;y: number}){
      let walking=0,clearance=99;
      people.walkers.forEach((w,i)=>{
        if(w.alive && !wasAlive[i])shown[i]=0;
        wasAlive[i]=w.alive?1:0;
        shown[i]+=((w.alive?1:0)-shown[i])*approach(7,dt);
        lifted[i]+=((w.air>0?2.7:0)-lifted[i])*approach(16,dt);
        const fleeing=w.alarm>0;
        if(w.alive){walking++;if(!w.air)clearance=Math.min(clearance,Math.hypot(w.x-player.x,w.y-player.y));}
        // Every step is a hop: stretched on the way up, squashed on landing.
        const hop=Math.abs(Math.sin(w.phase)),size=shown[i]<.02?0:shown[i]*1.3,tall=.82+.36*hop,wide=1/Math.sqrt(tall);
        dummy.position.set(w.x,altitude(w.x,w.y)+.75+lifted[i]+hop*(fleeing?.9:.42),-w.y);
        dummy.rotation.set(0,w.h,fleeing?-.3:-.08);dummy.scale.set(size*wide,size*tall,size*wide);
        dummy.updateMatrix();torso.setMatrixAt(i,dummy.matrix);head.setMatrixAt(i,dummy.matrix);
      });
      torso.instanceMatrix.needsUpdate=head.instanceMatrix.needsUpdate=true;
      return {walking,clearance};
    }
  };
}
