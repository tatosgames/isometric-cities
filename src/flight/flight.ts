import * as T from 'three';
import {approach,wrapAngle} from '../geometry.ts';
import {makePiper} from './model.ts';
import {makeFlightControls} from './controls.ts';
import {makeWingTrails} from './wing-trails.ts';
import {makeBurst} from './burst.ts';

import type {FlightCeiling} from './terrain-ceiling.ts';

type Phase='off'|'launch'|'fly'|'return'|'crash';
type Sample=(x:number,y:number)=>number;
// viewScale stretches the horizon (fog and far plane) and the zones streamed for it, from the quality stage's own.
export const FLIGHT_TUNE={cruiseSpeed:32,bankLimit:.74,pitchLimit:.48,fov:54,viewScale:1};
const SPAN=10.7;
const smooth=(t:number)=>T.MathUtils.smoothstep(t,0,1);
const clamp=T.MathUtils.clamp;

/** Simulation coordinates are easting, northing and absolute elevation. The model points along local +X. */
export function makeFlight(host:HTMLElement,scene:T.Scene,ground:Sample,roof:Sample,
  onExit:()=>void,covered:(x:number,y:number)=>boolean,ceiling?:FlightCeiling){
  const camera=new T.PerspectiveCamera(FLIGHT_TUNE.fov,1,.35,6200),target=new T.Vector3();
  const trails=makeWingTrails();
  const plane=makePiper(),burst=makeBurst(),controls=makeFlightControls(host,onExit);
  const streetOffset=new T.Vector3();
  const eye=new T.Vector3(),aim=new T.Vector3(),fromEye=new T.Vector3(),fromAim=new T.Vector3();
  let phase:Phase='off',x=0,y=0,z=0,h=0,bank=0,pitch=0,age=0,deploy=0;
  let launchBase=0,launchTop=0,recoverHeading:number|undefined;
  let landing:{x:number;y:number;h:number;startX:number;startY:number;startZ:number;top:number;duration:number}|undefined;
  function surface(px:number,py:number){return Math.max(ground(px,py),roof(px,py));}
  function clearAround(px:number,py:number){
    let top=surface(px,py);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;
      top=Math.max(top,surface(px+7*Math.cos(a),py+7*Math.sin(a)));
    }
    return top;
  }
  let checkedX=Infinity,checkedY=Infinity,checkedHeading=0;
  function clearAhead(angle:number,reach:number){
    const dx=Math.cos(angle),dy=Math.sin(angle);
    for(let d=1;d<reach;d+=6)if(!covered(x+dx*d,y+dy*d))return false;
    return covered(x+dx*reach,y+dy*reach);
  }
  function steer(){
    if(Math.hypot(x-checkedX,y-checkedY)>2 || Math.abs(wrapAngle(h-checkedHeading))>.04){
      checkedX=x;checkedY=y;checkedHeading=h;
      if(recoverHeading!==undefined && (!clearAhead(recoverHeading,65) || Math.abs(wrapAngle(h-recoverHeading))<.12))
        recoverHeading=undefined;
      if(recoverHeading===undefined && !clearAhead(h,76)){
        for(let i=1;i<=12 && recoverHeading===undefined;i++)for(const side of [-1,1]){
          const a=h+side*i*Math.PI/12;
          if(clearAhead(a,85)){recoverHeading=a;break;}
        }
      }
    }
    if(recoverHeading===undefined)return controls.roll;
    return -clamp(wrapAngle(recoverHeading-h)*3,-1,1);
  }
  function cruise(dt:number){
    const desiredBank=steer()*FLIGHT_TUNE.bankLimit;
    bank+=(desiredBank-bank)*approach(4,dt);
    pitch+=(controls.pitch*FLIGHT_TUNE.pitchLimit-pitch)*approach(3,dt);
    h-=Math.tan(bank)*1.03*dt;
    const c=Math.cos(h),s=Math.sin(h),distance=FLIGHT_TUNE.cruiseSpeed*dt*Math.cos(pitch);
    const nx=x+c*distance,ny=y+s*distance;
    if(covered(nx,ny)){x=nx;y=ny;}
    // A lower valley can put us above the local climb limit. Only constrain further ascent.
    const rise=FLIGHT_TUNE.cruiseSpeed*dt*Math.sin(pitch);
    z=rise>0?Math.min(z+rise,Math.max(z,ground(x,y)+460)):z+rise;
    const half=SPAN/2;
    const lowest=z+Math.min(-.95,3*Math.sin(pitch),.82-half*Math.abs(Math.sin(bank)));
    if(ceiling && lowest>ceiling(x-half,y-half,x+half,y+half))return true;
    // Each substep advances at most 35 cm. Sweep the nose, wheels and banked high wing.
    if(z-.95<=surface(x,y) || z+3*Math.sin(pitch)<=surface(x+c*3,y+s*3))return false;
    for(let i=-9;i<=9;i++){
      const lateral=i*SPAN/18,side=lateral*Math.cos(bank);
      if(z+.82-lateral*Math.sin(bank)<=surface(x+s*side,y-c*side))return false;
    }
    return true;
  }
  function cameraPose(dt:number){
    target.set(x,z,-y);
    let nose=pitch,propSpeed=48;
    if(phase==='launch'){
      nose+=.19*Math.sin(Math.PI*smooth(age/1.45));
      propSpeed*=.18+.82*smooth(age/.5);
    }else if(phase==='return' && landing){
      const flare=smooth((age-.6-landing.duration)/1.05);
      nose+=.13*Math.sin(Math.PI*flare);
      propSpeed*=1-.72*flare;
    }
    plane.root.position.copy(target);plane.root.rotation.set(bank,h,nose,'YZX');
    plane.propeller.rotation.x=(plane.propeller.rotation.x+dt*propSpeed)%(Math.PI*2);
    if(phase==='fly')trails.update(plane.root,bank,dt);
    plane.wings.scale.z=.13+.87*smooth(deploy);
    const aspect=Math.max(.1,host.clientWidth/Math.max(1,host.clientHeight));
    if(camera.aspect!==aspect || camera.fov!==FLIGHT_TUNE.fov){
      camera.aspect=aspect;camera.fov=FLIGHT_TUNE.fov;camera.updateProjectionMatrix();
    }
    const distance=Math.max(23,SPAN/(.54*aspect)),c=Math.cos(h),s=Math.sin(h);
    // Follow the descent from above the tail, with the next stretch of the dive in frame.
    const dive=phase==='fly'?Math.max(0,-Math.sin(pitch)):0;
    eye.set(x-c*distance,z+distance*(.43+.95*dive),-y+s*distance);
    eye.y=Math.max(eye.y,surface(eye.x,-eye.z)+2);
    aim.set(x+c*distance*.62,z+distance*(.02-.48*dive),-y-s*distance*.62);
    if(phase==='launch'){
      const t=smooth(age/1.25);
      eye.lerpVectors(fromEye,eye,t);aim.lerpVectors(fromAim,aim,t);
    }
    if(phase==='return' && landing){
      const blend=smooth((age-.6-landing.duration)/1.05);
      fromEye.copy(target).add(streetOffset);
      eye.lerp(fromEye,blend);aim.lerp(target,blend);
    }
    camera.position.lerp(eye,approach(9,dt));
    if(phase==='fly'){
      // Test the smoothed boom: both ends can be clear while a facade cuts across its middle.
      const dx=camera.position.x-x,dz=camera.position.z+y,dy=camera.position.y-z;
      const length=Math.hypot(dx,dz),samples=Math.ceil(length/1.5);
      const endX=x+dx,endY=y-dz;
      const clearBoom=ceiling && length<120 && Math.min(z,camera.position.y)>
        ceiling(Math.min(x,endX),Math.min(y,endY),Math.max(x,endX),Math.max(y,endY))+.65;
      for(let i=1;!clearBoom && i<=samples;i++){
        const t=i/samples;
        if(z+dy*t>surface(x+dx*t,y-dz*t)+.65)continue;
        const clear=Math.max(0,(i-2)/samples);
        camera.position.x=x+dx*clear;camera.position.z=-y+dz*clear;
        camera.position.y=z+Math.hypot(dy,length*Math.sqrt(1-clear*clear));
        aim.lerpVectors(target,aim,clear);
        break;
      }
    }
    camera.lookAt(aim);
    camera.updateMatrixWorld();
  }
  function start(px:number,py:number,heading:number,source:T.OrthographicCamera){
    x=px;y=py;h=heading;z=launchBase=ground(x,y)+1;bank=pitch=age=deploy=0;
    phase='launch';checkedX=Infinity;recoverHeading=undefined;landing=undefined;
    launchTop=clearAround(x,y)+32;
    for(let i=4;i<=52;i+=4)launchTop=Math.max(launchTop,clearAround(x+Math.cos(h)*i,y+Math.sin(h)*i)+14);
    target.set(x,z,-y);fromAim.copy(target);
    const visibleHeight=(source.top-source.bottom)/source.zoom;
    const distance=visibleHeight/(2*Math.tan(T.MathUtils.degToRad(camera.fov*.5)));
    fromEye.copy(target).addScaledVector(source.getWorldDirection(eye),-distance);
    streetOffset.subVectors(fromEye,target);
    camera.position.copy(fromEye);plane.root.visible=true;scene.add(plane.root,trails.mesh);
    controls.toggle(true);cameraPose(0);
  }
  function land(px:number,py:number,heading:number){
    if(phase!=='fly')return;
    const distance=Math.hypot(px-x,py-y);
    let top=Math.max(z,clearAround(px,py)+12);
    const steps=Math.max(1,Math.ceil(distance/5));
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      top=Math.max(top,clearAround(x+(px-x)*t,y+(py-y)*t)+8);
    }
    landing={x:px,y:py,h:heading,startX:x,startY:y,startZ:z,top,duration:clamp(distance/36,1,12)};
    phase='return';age=0;controls.release();trails.reset();
  }
  function step(dt:number):'impact'|'landed'|undefined{
    if(phase==='off')return;
    age+=dt;
    if(phase==='crash'){burst.update(age);return;}
    if(phase==='launch'){
      const lift=smooth(age/1.05);
      z=T.MathUtils.lerp(launchBase,launchTop,lift);deploy=clamp((age-.45)/.66,0,1);
      if(age>1.05){
        const travel=FLIGHT_TUNE.cruiseSpeed*smooth((age-1.05)/.65)*dt;
        const nx=x+Math.cos(h)*travel,ny=y+Math.sin(h)*travel;
        if(covered(nx,ny)){x=nx;y=ny;}
      }
      if(age>=1.7){phase='fly';age=0;}
    }else if(phase==='fly'){
      const steps=Math.max(1,Math.ceil(dt*FLIGHT_TUNE.cruiseSpeed/.35));
      for(let i=0;i<steps;i++)if(!cruise(dt/steps)){
        phase='crash';age=0;controls.release();target.set(x,z,-y);
        plane.root.visible=false;trails.reset();burst.root.rotation.y=h;burst.root.position.copy(target);scene.add(burst.root);burst.update(0);
        camera.lookAt(target);return 'impact';
      }
    }else if(landing){
      const p=landing;
      const cross=smooth((age-.6)/p.duration),descent=smooth((age-.6-p.duration)/1.05);
      x=T.MathUtils.lerp(p.startX,p.x,cross);y=T.MathUtils.lerp(p.startY,p.y,cross);
      z=T.MathUtils.lerp(T.MathUtils.lerp(p.startZ,p.top,smooth(age/.6)),ground(p.x,p.y)+1,descent);
      const desired=cross<.97?Math.atan2(p.y-p.startY,p.x-p.startX):p.h;
      h+=wrapAngle(desired-h)*approach(5,dt);bank*=Math.exp(-5*dt);pitch*=Math.exp(-5*dt);
      deploy=1-descent;
      if(descent===1){h=p.h;landing=undefined;return 'landed';}
    }
    cameraPose(dt);
    return undefined;
  }
  function stop(){
    phase='off';landing=undefined;controls.toggle(false);
    plane.root.removeFromParent();burst.root.removeFromParent();trails.reset();trails.mesh.removeFromParent();
  }
  return {camera,target,get phase(){return phase;},get x(){return x;},get y(){return y;},get h(){return h;},
    start,land,step,stop,release:controls.release};
}
