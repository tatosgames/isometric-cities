import type {GuaguaData} from './guagua.ts';
import {validGuagua} from './guagua.ts';
import {busTimetable,emptyBusState,type BusState} from './guagua-timetable.ts';

type Interval=[string,number,number,number?,number?];
interface Piece {file:string;slot:number;line:string;direction:string;phase:number;period:number}
interface Index {version:1;size:number;cells:Record<string,Interval[]>;pieces:Record<string,Piece>}
interface Directory {version:1;size:number;zoneSize:number;zones:Record<string,string>}
interface Bundle {paths:GuaguaData['path'][];runs:{path:number;stops:GuaguaData['stops']}[]}
type Clock=ReturnType<typeof busTimetable>;
interface Bus {
  id:string;line:string;direction:string;state:BusState;
  clock:Clock; progress:number; waiting:number; next:BusState; ahead:BusState;
  cruise:number; speed:number;
}
const ACQUIRE=300,RELEASE=450,MAX_BUSES=6;
const CRUISE_SPEED=6;
// Each bus keeps its own cruise speed within ±15 % of the nominal one.
const SPEED_SPREAD=.15;
const ACCEL=1.6,BRAKE=3.2;
// Followers settle about one headway behind the bus in front in the same lane.
// New buses never enter closer than that to a bus heading the same way.
const HEADWAY=34,MIN_GAP=6,BODY=7.4,LANE=3.2;
// Curves: speed falls with the heading change over the lookahead.
const CURVE_FLOOR=2.2;
// Pose smoothing along the polyline: half the wheelbase window.
const SMOOTH=3;
const MIN_CITY_RUN=500;
const dist2=(x:number,y:number,p:BusState)=>(x-p.x)**2+(y-p.y)**2;
const angleGap=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));

function circuitLength(clock:Clock){return clock.loop?clock.length:2*clock.length;}

/** Stable value in [0,1) per passage, so speed survives a release and return. */
function unit(id:string){
  let h=2166136261;
  for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);
  return (h>>>0)/4294967296;
}

const rear={x:0,y:0},front={x:0,y:0},probe=emptyBusState();
function pathPoint(clock:Clock,d:number,out:{x:number;y:number}){
  d=clock.loop?((d%clock.length)+clock.length)%clock.length:Math.min(clock.length,Math.max(0,d));
  clock.sampleAtDistance(d,probe);
  out.x=probe.x;out.y=probe.y;
}
// Body centre and heading from points one window behind and ahead. Corners
// become short arcs instead of a pivot at the polyline vertex.
function sampleMotion(clock:Clock,progress:number,out:BusState){
  const offset=progress%circuitLength(clock);
  const returning=offset>=clock.length;
  const d=returning?2*clock.length-offset:offset;
  pathPoint(clock,d-SMOOTH,rear);pathPoint(clock,d+SMOOTH,front);
  clock.sampleAtDistance(d,out);
  out.x=(rear.x+2*out.x+front.x)/4;out.y=(rear.y+2*out.y+front.y)/4;
  if(front.x!==rear.x || front.y!==rear.y)out.h=Math.atan2(front.y-rear.y,front.x-rear.x);
  if(returning)out.h=Math.atan2(-Math.sin(out.h),-Math.cos(out.h));
  out.distance=d;
  out.stopped=0;
  out.braking=false;
}

/** Distance to the tail of the nearest bus ahead in the same lane and direction. */
function gapAhead(bus:Bus,active:Bus[]){
  const p=bus.state,c=Math.cos(p.h),s=Math.sin(p.h);
  let gap=Infinity;
  for(const other of active){
    if(other===bus)continue;
    const q=other.state,dx=q.x-p.x,dy=q.y-p.y;
    const along=dx*c+dy*s;
    if(along<=0 || along>HEADWAY+BODY || Math.abs(dy*c-dx*s)>LANE || angleGap(q.h,p.h)>.8)continue;
    gap=Math.min(gap,along-BODY);
  }
  return gap;
}
function crowded(state:BusState,active:Bus[]){
  const c=Math.cos(state.h),s=Math.sin(state.h);
  return active.some(({state:q})=>{
    const dx=q.x-state.x,dy=q.y-state.y;
    return Math.abs(dx*c+dy*s)<HEADWAY+BODY && Math.abs(dy*c-dx*s)<LANE && angleGap(q.h,state.h)<.8;
  });
}

export function validFleetIndex(value:unknown):value is Index{
  if(!value || typeof value!=='object')return false;
  const i=value as Partial<Index>;
  if(i.version!==1 || i.size!==240 || !i.cells || !i.pieces)return false;
  const pieces=i.pieces;
  return Object.values(pieces).every(p=>p && typeof p.file==='string' && /^[\w./-]+$/.test(p.file)
    && !p.file.startsWith('/') && !p.file.includes('..') && typeof p.line==='string' && typeof p.direction==='string'
    && Number.isInteger(p.slot) && p.slot>=0 && Number.isFinite(p.phase) && Number.isFinite(p.period) && p.period>0)
    && Object.entries(i.cells).every(([key,list])=>/^-?\d+_-?\d+$/.test(key) && Array.isArray(list)
      && list.every(r=>Array.isArray(r) && (r.length===3||r.length===5) && Object.hasOwn(pieces,r[0])
        && r.slice(1).every(Number.isFinite) && r[1]>=0 && r[2]>r[1]));
}
export function validFleetDirectory(value:unknown):value is Directory{
  if(!value || typeof value!=='object')return false;
  const d=value as Directory;
  return d.version===1 && d.size===240 && d.zoneSize===960 && !!d.zones &&
    Object.entries(d.zones).every(([key,file])=>/^-?\d+_-?\d+$/.test(key) &&
      typeof file==='string' && file.startsWith('zones/'+key+'.') && /^zones\/-?\d+_-?\d+\.(?:[a-f0-9]{12}\.)?json$/.test(file));
}

// Separating axes of both oriented bodies, with a small bumper gap.
function overlap(a:BusState,b:BusState){
  const dx=b.x-a.x,dy=b.y-a.y;
  if(dx*dx+dy*dy>66)return false;
  const ca=Math.cos(a.h),sa=Math.sin(a.h),cb=Math.cos(b.h),sb=Math.sin(b.h);
  const c=Math.abs(ca*cb+sa*sb),s=Math.abs(ca*sb-sa*cb);
  const length=3.7*(1+c)+1.15*s,width=1.15*(1+c)+3.7*s;
  return Math.abs(dx*ca+dy*sa)<length && Math.abs(dy*ca-dx*sa)<width
    && Math.abs(dx*cb+dy*sb)<length && Math.abs(dy*cb-dx*sb)<width;
}

export function makeLocalFleet(area:'city'|'pilot',visible:(x:number,y:number)=>boolean,
  occupied:(x:number,y:number,h:number)=>boolean,fetcher:typeof fetch=fetch){
  const base='./data/guaguas/'+area+'/';
  const active:Bus[]=[],errors:string[]=[];
  // Runs thrown off the road by a shot: the timetable must not put them back.
  const knocked=new Set<string>();
  const cache=new Map<string,Clock>();
  const zones=new Map<string,Index>(),bundles=new Map<string,Bundle>(),pending=new Map<string,Promise<void>>();
  const failed=new Map<string,number>(),controller=new AbortController();
  let directory:Directory|undefined,indexRequest:Promise<void>|undefined;
  let elapsed=0,nextScan=0,epoch=0,scan=0,px=0,py=0,disposed=false;
  async function read(file:string){
    const response=await fetcher(base+file,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(6000)])});
    if(!response.ok)throw Error(file+' HTTP '+response.status);
    return response.json();
  }
  function report(file:string,error:unknown){
    if(disposed)return;
    const message=file+' · '+String(error);
    if(!errors.includes(message))errors.push(message);
    if(errors.length>20)errors.shift();
    failed.set(file,elapsed+15);
  }
  function load(file:string,zone:boolean){
    if(zone?zones.has(file):bundles.has(file))return;
    const loading=pending.get(file);
    if(loading)return loading;
    if((failed.get(file)??-1)>elapsed)return;
    const request=read(file).then(data=>{
      if(disposed)return;
      if(zone){
        if(!validFleetIndex(data))throw Error('invalid sector index');
        zones.set(file,data);
      }else{
        if(!Array.isArray(data?.paths)||!Array.isArray(data?.runs))throw Error('invalid geometry bundle');
        bundles.set(file,data);
      }
    }).catch(error=>report(file,error)).finally(()=>pending.delete(file));
    pending.set(file,request);
    return request;
  }

  function intervals(x:number,y:number){
    const cells:{key:string;zone:string}[]=[];
    if(!directory)return cells;
    const size=directory.size;
    for(let i=Math.floor((x-ACQUIRE)/size);i<=Math.floor((x+ACQUIRE)/size);i++){
      for(let j=Math.floor((y-ACQUIRE)/size);j<=Math.floor((y+ACQUIRE)/size);j++){
        const dx=Math.max(i*size-x,0,x-(i+1)*size),dy=Math.max(j*size-y,0,y-(j+1)*size);
        if(dx*dx+dy*dy>ACQUIRE**2)continue;
        const zone=directory.zones[Math.floor(i/4)+'_'+Math.floor(j/4)];
        if(zone)cells.push({key:i+'_'+j,zone});
      }
    }
    return cells;
  }
  async function select(initial:boolean){
    if(!directory || disposed)return;
    const token=++scan,cells=intervals(px,py);
    const neededZones=new Set(cells.map(c=>c.zone));
    const loadZones=[...neededZones].filter(file=>!zones.has(file));
    if(loadZones.length)await Promise.all(loadZones.map(file=>load(file,true)));
    if(token!==scan || disposed)return;
    const local:{range:Interval;ref:Piece}[]=[];
    for(const cell of cells){
      const zone=zones.get(cell.zone);
      if(zone)for(const range of zone.cells[cell.key]??[])local.push({range,ref:zone.pieces[range[0]]});
    }
    const files=new Set<string>(),nearbyFiles=new Set<string>();
    for(const {range:[,,,start,end],ref} of local){
      nearbyFiles.add(ref.file);
      if(start!==undefined && end!==undefined &&
        Math.ceil((elapsed-ref.phase-end-.5)/ref.period)>Math.floor((elapsed-ref.phase-start+.5)/ref.period))continue;
      files.add(ref.file);
    }
    const missing=[...files].filter(file=>!bundles.has(file));
    if(missing.length)await Promise.all(missing.map(file=>load(file,false)));
    if(token!==scan || disposed)return;
    const candidates=new Map<string,Bus>(),present=new Set(active.map(b=>b.id));
    const neededClocks=new Set<string>();
    for(const {range:[piece,from,to,start,end],ref} of local){
      if(start!==undefined && end!==undefined &&
        Math.ceil((elapsed-ref.phase-end-.00001)/ref.period)>Math.floor((elapsed-ref.phase-start+.00001)/ref.period))continue;
      const bundle=bundles.get(ref.file);
      if(!bundle)continue;
      const key=ref.file+'#'+ref.slot;
      neededClocks.add(key);
      let clock=cache.get(key);
      if(!clock){
        const run=bundle.runs[ref.slot],data={line:ref.line,direction:ref.direction,path:bundle.paths[run?.path],stops:run?.stops};
        if(!validGuagua(data,0)){report(key,'invalid vehicle path or stops');continue;}
        clock=busTimetable(data);cache.set(key,clock);
      }
      // Short verified fragments still describe coverage in the data. An
      // independent city bus needs enough continuous road for a full pass.
      if(area==='city' && clock.length<MIN_CITY_RUN)continue;
      const latest=Math.floor((elapsed-ref.phase-clock.timeAt(from)+.00001)/ref.period);
      const earliest=Math.ceil((elapsed-ref.phase-clock.timeAt(to,true)-.00001)/ref.period);
      for(let k=earliest;k<=latest;k++){
        const id=piece+':'+k;
        if(present.has(id)||candidates.has(id)||knocked.has(id))continue;
        const age=Math.max(0,elapsed-ref.phase-k*ref.period);
        if(age>clock.duration+.00001)continue;
        const state=clock.sample(age,emptyBusState());
        if(dist2(px,py,state)>ACQUIRE**2 || (!initial && visible(state.x,state.y)) || occupied(state.x,state.y,state.h))continue;
        // Published time intervals select the entering pose. Once admitted, the
        // vehicle continues along the polyline without timetable dwells.
        const progress=state.distance;
        sampleMotion(clock,progress,state);
        const cruise=CRUISE_SPEED*(1+SPEED_SPREAD*(2*unit(id)-1));
        state.speed=cruise;
        candidates.set(id,{id,line:ref.line,direction:ref.direction,clock,progress,state,waiting:0,
          next:emptyBusState(),ahead:emptyBusState(),cruise,speed:cruise});
      }
    }
    const sorted=[...candidates.values()].sort((a,b)=>dist2(px,py,a.state)-dist2(px,py,b.state)||a.id.localeCompare(b.id));
    for(const bus of sorted){
      if(active.some(b=>overlap(bus.state,b.state)) || crowded(bus.state,active))continue;
      if(active.length===MAX_BUSES){
        let far=-1,distance=dist2(px,py,bus.state);
        for(let i=0;i<active.length;i++){
          const p=active[i].state,d=dist2(px,py,p);
          if(d>distance && !visible(p.x,p.y) && !occupied(p.x,p.y,p.h)){distance=d;far=i;}
        }
        if(far<0)break;
        active.splice(far,1);
      }
      active.push(bus);
    }
    // Active vehicles retain their own clock. Release geometry outside the neighbourhood.
    for(const key of cache.keys())if(!neededClocks.has(key))cache.delete(key);
    for(const file of bundles.keys())if(!nearbyFiles.has(file))bundles.delete(file);
    for(const file of zones.keys())if(!neededZones.has(file))zones.delete(file);
  }

  async function reset(x:number,y:number){
    const current=++epoch;
    scan++;elapsed=0;nextScan=.5;px=x;py=y;active.length=0;failed.clear();errors.length=0;knocked.clear();
    if(!directory){
      indexRequest??=read('index.json').then(value=>{
        if(!validFleetDirectory(value))throw Error('invalid network directory');
        if(!disposed)directory=value;
      }).catch(error=>report('index.json',error)).finally(()=>{indexRequest=undefined;});
      await indexRequest;
    }
    if(epoch===current && !disposed)await select(true);
  }
  function step(dt:number,x:number,y:number){
    if(disposed || !directory || dt<=0)return;
    elapsed+=dt;px=x;py=y;
    for(const b of active)sampleMotion(b.clock,b.progress+CRUISE_SPEED*1.25,b.ahead);
    // Following applies across line numbers. At crossings reserve the approach for
    // the nearer vehicle; use its passage ID when both are equally far from entry.
    for(let i=0;i<active.length;i++){
      const bus=active[i],pose=bus.state;
      // Target speed: own cruise, less in curves, less when closing on a bus ahead.
      const turn=Math.min(1,angleGap(bus.ahead.h,pose.h)/(Math.PI/2));
      let target=Math.max(CURVE_FLOOR,bus.cruise*(1-.6*turn));
      const gap=gapAhead(bus,active);
      if(gap<HEADWAY)target=Math.min(target,bus.cruise*Math.max(0,(gap-MIN_GAP)/(HEADWAY-MIN_GAP)));
      const before=bus.speed;
      bus.speed=target>bus.speed?Math.min(target,bus.speed+ACCEL*dt):Math.max(target,bus.speed-BRAKE*dt);
      const advance=bus.speed*dt;
      let progress=bus.progress+advance;
      const endOfLeg=Math.floor(progress/bus.clock.length)>Math.floor(bus.progress/bus.clock.length);
      if(endOfLeg || dist2(x,y,pose)>RELEASE**2){
        if(!visible(pose.x,pose.y) && !occupied(pose.x,pose.y,pose.h)){active.splice(i--,1);continue;}
      }
      sampleMotion(bus.clock,progress,bus.next);
      let headOn=false;
      let blocked=active.some(other=>{
        if(other===bus || dist2(pose.x,pose.y,other.state)>24**2)return false;
        headOn=angleGap(other.state.h,pose.h)>2.4;
        if(overlap(bus.next,other.state) || overlap(bus.ahead,other.state))return true;
        if(!overlap(bus.ahead,other.ahead))return false;
        const dx=other.state.x-pose.x,dy=other.state.y-pose.y;
        const approach=dx*Math.cos(pose.h)+dy*Math.sin(pose.h);
        const theirs=-dx*Math.cos(other.state.h)-dy*Math.sin(other.state.h);
        return approach>theirs+.1 || (Math.abs(approach-theirs)<=.1 && bus.id>other.id);
      });
      // Two buses can meet on the same stretch after a turnaround. Let a
      // yielding bus take the other direction if it has room behind it.
      // A crossing bus only has to wait for the other one to pass.
      if(blocked && headOn && !bus.clock.loop && bus.waiting>=2){
        const length=circuitLength(bus.clock),retreat=(length-bus.progress+advance)%length;
        sampleMotion(bus.clock,retreat,bus.next);
        if(!active.some(other=>other!==bus && overlap(bus.next,other.state))){
          progress=retreat;
          blocked=false;
        }
      }
      if(blocked){
        bus.waiting+=dt;
        bus.speed=pose.speed=0;pose.braking=true;
      }else{
        bus.waiting=0;
        bus.next.speed=bus.speed;bus.next.braking=bus.speed<before-1e-6;
        // A step can straddle a turnaround. Face the actual displacement
        // until the sampled path tangent and travel direction agree again.
        const dx=bus.next.x-pose.x,dy=bus.next.y-pose.y;
        if(dx*Math.cos(bus.next.h)+dy*Math.sin(bus.next.h)<0)bus.next.h=Math.atan2(dy,dx);
        bus.progress=progress%circuitLength(bus.clock);Object.assign(pose,bus.next);
      }
    }
    if(elapsed>=nextScan){nextScan=elapsed+.5;void select(false);}
  }
  /** Takes a bus off the road for good: its run does not come back. */
  function knock(bus:Bus){
    const at=active.indexOf(bus);
    if(at>=0)active.splice(at,1);
    knocked.add(bus.id);
  }
  return {reset,step,knock,active,errors,dispose(){
    disposed=true;epoch++;scan++;controller.abort();active.length=0;cache.clear();zones.clear();bundles.clear();pending.clear();
  }};
}
