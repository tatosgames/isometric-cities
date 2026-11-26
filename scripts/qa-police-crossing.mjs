import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {makeMapCamera,fitPixels,mapViewDirection,screenOffsetOnGround,CAMERA_DISTANCE} from '../src/render/map-camera.ts';
import {makeDriveCamera,driveLookAhead} from '../src/drive/drive-camera.ts';
import {createPoliceDirector,crossJunction,findInterceptCandidates} from '../src/drive/police-director.ts';
import {makeDrivePhysics,restBody} from '../src/drive/drive-physics.ts';
import {TUNE} from '../src/drive/drive-tune.ts';

const nodes=[[-16,0],[0,0],[25,0],[0,-25],[0,25]].map(([x,y])=>({x,y,ok:true,links:[]}));
for(const i of [0,2,3,4]){const d=Math.hypot(nodes[i].x,nodes[i].y);nodes[i].links.push([1,d]);nodes[1].links.push([i,d]);}
const world={nodes,free:()=>true,near:()=>false,nearestNode:()=>0};
const dt=1/120;
function encounter(mode,width,height,evasive){
  const physics=makeDrivePhysics(TUNE),camera=makeMapCamera(),rig=makeDriveCamera(mapViewDirection());
  const player={...restBody(),x:-15,vx:10};
  const side={...restBody(),id:2,y:-16,h:Math.PI/2,vy:11,visibleFor:0,wreck:0,target:-1};
  const lead={...restBody(),id:1,x:-26,vx:10,visibleFor:2,wreck:0};
  rig.enter();for(let i=0;i<mode;i++)rig.cycle();rig.startHeading(0);
  for(let i=0;i<120;i++)rig.update(dt,player,()=>false);
  // Replay the approach before the decision in the actual orthographic frustum.
  for(let i=0;i<=180;i++){
    const ago=(180-i)*dt,pose=rig.update(dt,player,()=>false);
    camera.zoom=Math.min(width,height)*pose.zoom/TUNE.viewSpanCompact;
    fitPixels(camera,width,height);
    const center=new Vector3(player.x-ago*10+driveLookAhead(10,TUNE.player.baseSpeed),0,0);
    screenOffsetOnGround(center,center,0,-height*pose.framing,camera.zoom,pose.direction);
    camera.position.copy(center).addScaledVector(pose.direction,CAMERA_DISTANCE);camera.lookAt(center);camera.updateMatrixWorld();
    const point=new Vector3(0,2,-side.y+ago*11).project(camera);
    side.visibleFor=Math.abs(point.x)<1 && Math.abs(point.y)<1?side.visibleFor+dt:0;
  }
  const candidates=findInterceptCandidates(world,player,[lead,side],2,TUNE.radius);
  assert.equal(findInterceptCandidates(world,player,[lead],2,TUNE.radius).length,0);
  assert.equal(findInterceptCandidates({...world,free:()=>false},player,[lead,side],2,TUNE.radius).length,0);
  const director=createPoliceDirector();
  director.setUnits([{id:1,distance:11},{id:2,distance:22}]);
  director.update({dt:25,anyVisible:true,closestDistance:11,candidates});
  const order=director.assignment(side.id);
  if(!order){assert.ok(side.visibleFor<1.2);return null;}
  assert.ok(order.reactionSeconds>=1.2);
  let closest=Infinity;
  for(let step=0;step<240;step++){
    physics.steerPlayer(player,evasive && step<58?-1:0,false,dt);
    physics.steerPatrol(side,crossJunction(side,nodes,order),world,dt);
    closest=Math.min(closest,Math.hypot(player.x-side.x,player.y-side.y));
  }
  assert.ok(side.y>0,'A committed patrol must continue across the junction');
  return closest;
}
let accepted=0;
for(const [width,height] of [[390,844],[844,390]])for(let mode=0;mode<3;mode++){
  const straight=encounter(mode,width,height,false),dodge=encounter(mode,width,height,true);
  if(straight===null){assert.equal(dodge,null);continue;}
  assert.ok(straight<TUNE.catchReach && dodge>TUNE.catchReach,JSON.stringify({mode,width,straight,dodge}));
  accepted++;
}
assert.ok(accepted>=1);
console.log('Crossing QA passed: '+accepted+'/6 views accepted, other views deferred for visibility.');
