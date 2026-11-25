import type {GuaguaData} from './guagua.ts';

const ACCEL=2.5, BRAKE=3.5, LIMIT=8, DWELL=3;
export interface BusState {
  x:number; y:number; h:number; distance:number; speed:number; stopped:number; braking:boolean;
}

function firstAtLeast(ends:number[],value:number){
  let lo=0,hi=ends.length-1;
  while(lo<hi){
    const mid=(lo+hi)>>>1;
    if(ends[mid]<value)lo=mid+1;else hi=mid;
  }
  return lo;
}

/** The same clock reconstructs a passing bus mid-route and advances its live pose. */
export function busTimetable(data:GuaguaData){
  const ends=[0];
  for(let i=1;i<data.path.length;i++){
    const [x,y]=data.path[i],a=data.path[i-1];
    ends.push(ends[i-1]+Math.hypot(x-a[0],y-a[1]));
  }
  const length=ends[ends.length-1];
  const targets=data.stops.map(s=>Math.min(s.distance,length));
  const stopCount=targets.length;
  if(!targets.length || targets[targets.length-1]<length)targets.push(length);
  let from=0,depart=0;
  const legs=targets.map((to,i)=>{
    const span=to-from,peak=Math.min(LIMIT,Math.sqrt(2*span/(1/ACCEL+1/BRAKE)));
    const accelerating=peak/ACCEL,braking=peak/BRAKE;
    const cruising=peak?Math.max(0,span/peak-(accelerating+braking)/2):0;
    const arrive=depart+accelerating+cruising+braking;
    const leave=arrive+(i<stopCount?DWELL:0);
    const leg={from,to,depart,arrive,leave,peak,accelerating,cruising};
    from=to;depart=leave;
    return leg;
  });
  const times=legs.map(l=>l.leave);
  function timeAt(distance:number,afterDwell=false){
    // Index distances are rounded to micrometres. Retain the entire dwell
    // when an interval ends at a stop or at the final vertex.
    const leg=legs[firstAtLeast(targets,distance-.000001)];
    const d=Math.max(0,distance-leg.from),v=leg.peak;
    if(distance>=leg.to-.000001)return afterDwell?leg.leave:leg.arrive;
    if(d<=v*v/(2*ACCEL))return leg.depart+Math.sqrt(2*d/ACCEL);
    if(leg.to-distance<=v*v/(2*BRAKE))return leg.arrive-Math.sqrt(2*(leg.to-distance)/BRAKE);
    return leg.depart+leg.accelerating+(d-v*v/(2*ACCEL))/v;
  }
  function sample(time:number,out:BusState){
    const leg=legs[firstAtLeast(times,time)],t=time-leg.depart<1e-9?0:time-leg.depart;
    let speed=0,d=leg.to;
    const braking=time>=leg.depart+leg.accelerating+leg.cruising;
    if(time<leg.arrive){
      if(t<leg.accelerating){speed=ACCEL*t;d=leg.from+.5*speed*t;}
      else if(braking){speed=BRAKE*(leg.arrive-time);d=leg.to-.5*speed*(leg.arrive-time);}
      else{speed=leg.peak;d=leg.from+speed*(t-leg.accelerating/2);}
    }
    sampleAtDistance(d,out);
    out.speed=speed;
    out.stopped=time>=leg.arrive?Math.min(DWELL,Math.max(0,leg.leave-time)):0;out.braking=braking;
    return out;
  }
  function sampleAtDistance(d:number,out:BusState){
    const i=Math.max(1,firstAtLeast(ends,d)),a=data.path[i-1],b=data.path[i];
    const u=(d-ends[i-1])/(ends[i]-ends[i-1]);
    out.x=a[0]+(b[0]-a[0])*u;out.y=a[1]+(b[1]-a[1])*u;
    out.h=Math.atan2(b[1]-a[1],b[0]-a[0]);out.distance=d;
    return out;
  }
  const first=data.path[0],last=data.path[data.path.length-1];
  return {timeAt,sample,sampleAtDistance,length,duration:depart,loop:first[0]===last[0] && first[1]===last[1]};
}
export const emptyBusState=():BusState=>({x:0,y:0,h:0,distance:0,speed:0,stopped:0,braking:false});
