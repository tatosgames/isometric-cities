import {MathUtils,Vector3} from 'three';
import { wrapAngle as shortest } from '../geometry.ts';

const radians=MathUtils.degToRad;
const modes=[
  {id:'fixed',label:'Isométrica',zoom:1,framing:0},
  {id:'high',label:'Aérea',pitch:radians(65),zoom:1,framing:.055},
  {id:'chase',label:'Seguimiento',pitch:radians(48),zoom:1.22,framing:.13}
];
const key='drive-camera';

export function driveLookAhead(speed: number,maxSpeed: number){
  const lowSpeed=10/3.6;
  if(speed<=lowSpeed)return 5*speed/lowSpeed;
  return MathUtils.lerp(5,12,Math.min(1,(speed-lowSpeed)/(maxSpeed-lowSpeed)));
}

export function makeDriveCamera(mapDirection: Vector3){
  const mapPitch=Math.asin(mapDirection.y);
  let mapYaw=Math.atan2(mapDirection.z,mapDirection.x);
  const pose={direction:new Vector3(),yaw:mapYaw,pitch:mapPitch,zoom:1,framing:0};
  let index=0,travelYaw=mapYaw,lift=0,clearTime=0,blend=1;
  let from={...pose};
  function transition(){from={...pose};blend=0;}
  return {
    get mode(){return modes[index].id;},
    get label(){return modes[index].label;},
    enter(direction=mapDirection){
      try{index=Math.max(0,modes.findIndex(m=>m.id===localStorage.getItem(key)));}catch{}
      mapYaw=Math.atan2(direction.z,direction.x);
      Object.assign(pose,{yaw:mapYaw,pitch:mapPitch,zoom:1,framing:0});
      lift=clearTime=0;transition();
    },
    cycle(){
      index=(index+1)%modes.length;transition();
      try{localStorage.setItem(key,modes[index].id);}catch{}
    },
    startHeading(h: number){travelYaw=shortest(Math.PI-h);lift=clearTime=0;transition();},
    update(dt: number,car: {vx: number;vy: number},occluded: (dx: number,dy: number) => boolean){
      const mode=modes[index];
      if(Math.hypot(car.vx,car.vy)>=2){
        const error=shortest(Math.atan2(car.vy,-car.vx)-travelYaw);
        const limit=radians(100)*dt;
        travelYaw=shortest(travelYaw+MathUtils.clamp(error*(-Math.expm1(-3*dt)),-limit,limit));
      }
      const previous=blend*blend*(3-2*blend);
      blend=Math.min(1,blend+2*dt);
      const t=blend*blend*(3-2*blend);
      // Re-evaluate the short arc from the displayed pose if the car turns mid-blend.
      const fraction=blend===1?1:(t-previous)/(1-previous);
      pose.yaw=shortest(pose.yaw+shortest((index?travelYaw:mapYaw)-pose.yaw)*fraction);
      const x=Math.cos(pose.yaw),z=Math.sin(pose.yaw);
      const basePitch=mode.pitch??mapPitch;
      let wanted=basePitch;
      if(index){
        while(wanted<radians(85) && occluded(x/Math.tan(wanted),-z/Math.tan(wanted))){
          wanted=Math.min(radians(85),wanted+radians(8));
        }
      }
      if(wanted>basePitch)clearTime=0;else clearTime+=dt;
      const needed=wanted-basePitch;
      if(needed>=lift || clearTime>=.5){
        lift+=(needed-lift)*(-Math.expm1(-(needed>lift?18:3)*dt));
      }
      pose.pitch=MathUtils.lerp(from.pitch,basePitch+(index?lift:0),t);
      pose.zoom=MathUtils.lerp(from.zoom,mode.zoom,t);
      pose.framing=MathUtils.lerp(from.framing,mode.framing,t);
      const horizontal=Math.cos(pose.pitch);
      pose.direction.set(x*horizontal,Math.sin(pose.pitch),z*horizontal);
      return pose;
    }
  };
}
