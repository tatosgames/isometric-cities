import {makeFlight} from '../flight/flight.ts';
import {settleTrees,shakeTree} from '../render/wind.ts';
import {cityDetail} from '../render/dynamic-quality.ts';
import { carGeometry, carShellHeight, carShellParts, carShellPivot, carWheelParts, tint } from './car-model.ts';
import type { Building, Point } from '../data/types.ts';
import { element as el } from '../map/dom.ts';
import { required } from '../required.ts';
import {BUILDING_BIT,surfaceStencil} from '../render/building-stencil.ts';
import {buildDriveWorld} from './drive-world.ts';
import type {ZoneData} from '../data/types.ts';
export {TUNE};
import {makeDrivePhysics,resetSteering,restBody} from './drive-physics.ts';
import {makeRoadGrade} from './road-grade.ts';
import {groundPitch,makeDrivePose} from './drive-pose.ts';
import {driveLookAhead,makeDriveCamera} from './drive-camera.ts';
import {makeDriveRoute} from './drive-route.ts';
import type { RouteEvent } from './drive-route.ts';
import { chooseStartNode, type RoadNode } from './road-routing.ts';
import {makeDriveInput} from './drive-input.ts';
import {POLICE,createPoliceDirector,crossJunction,findInterceptCandidates,type Approach} from './police-director.ts';
import {straightRoadEntry} from './police-road-entry.ts';
import {chaseSteer} from './drive-chase.ts';
import {makeDriveLocation} from './drive-location.ts';
import {makePedestrians,PEDESTRIANS} from './pedestrians.ts';
import {DEBRIS,makeDriveEffects,type ParticleKind} from './drive-effects.ts';
import {makeSurfaceMap,type SurfaceMap} from './drive-surface.ts';
import {makeCrowdView} from './drive-crowd.ts';
import {BUS_AXLE,HALF_LENGTH,HALF_WIDTH,makeGuaguaViews,resolveGuaguaContact} from './guagua.ts';
import {makeLocalFleet} from './guagua-fleet.ts';
import {aimShot,fly,launch,makeSlug,segmentBox,segmentCircle,shotBlast,type Shot,type Thrown} from './drive-weapon.ts';
import {makeDemolisher} from '../demolition/demolish.ts';
import {makeShake} from '../demolition/shake.ts';
import {DEBRIS_TUNE} from '../demolition/debris.ts';
import {ringCenter} from '../data/sector-index.ts';
import {CAPTURE,COINS,SURFACES,TUNE,wrap} from './drive-tune.ts';

// Ratios that keep a single tuning value for related effects. At the defaults they give the earlier separate
// values exactly: dust at 2.5 and 1.5 m/s of slip, a kick damping of 22, a zoom ease of 1.1.
const PUFF_START=2.5/4,PUFF_REARM=1.5/4,KICK_DAMPING=22/(2*Math.sqrt(220)),ZOOM_PACE=1.1/.7;
// Hit-stops on arrival and on capture as shares of the impact one: 100 and 220 ms with the default 110 ms.
const STOP_ARRIVE=.1/.11,STOP_CAUGHT=.22/.11;
// Slope tilt: half the distance between the axles of the model (before its visual scale), how fast the tilt
// follows the road, and the steepest one shown. The terrain grid is 5 m, so the raw slope steps at its cells.
const HALF_BASE=.95,TILT_RATE=10,TILT_LIMIT=T.MathUtils.degToRad(22);
// Off the road: tracks from 2 m/s, thrown turf or sand from 4 m/s at about one piece per 0.6 m rolled (twice as
// sparse for patrols), a hop of 2 cm per m/s (up to 35 cm) on leaving or rejoining the road, the shake of the
// body at full rumble (metres and radians) and the speed that reaches it.
// A sliding player puffs smoke this often on asphalt and paving, on top of the burst when the slide starts.
const DRIFT_SMOKE=.05;
const TRACK_SPEED=2,DEBRIS_SPEED=4,DEBRIS_STEP=.6,KERB_HOP=.02,KERB_HOP_MAX=.35,KERB_SPEED=5;
const SHAKE_LIFT=.05,SHAKE_ROLL=.025,SHAKE_PITCH=.02,SHAKE_SPEED=10;
const feel=()=>({odo:0,rumble:0,shake:0,rough:false,debris:0,wheel2:1});
import { approach } from '../geometry.ts';
import { CAMERA_DISTANCE, screenOffsetOnGround } from '../render/map-camera.ts';

/** Destination colour: marker and beam. Kept apart from the coins' yellow so the two never read as one thing. */
const DESTINATION='#3cc9b8';
import type {DriveOptions,DriveState,Patrol,RouteField,Vehicle} from './drive-types.ts';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';



export function makeDrive({scene,camera,renderer,host,data,locations,streets,altitude,groundAt,view,mapDirection,compact,busArea,buses,onExit,flightArea,flightGround,flightTerrainCeiling,redraw,demandLanding,releaseLanding,zoning,police=true,endless=false,hideBuilding,showBuilding,partsOf,buildingMaterial,tones}: DriveOptions){
  let world: ReturnType<typeof buildDriveWorld> | null=null;
  let location: ReturnType<typeof makeDriveLocation> | undefined;
  const street=el('drive-street'),barrio=el('drive-barrio');
  const activeWorld=()=>required(world,"drive world");
  // The surface map is built with the driving world, on the first run.
  let surfaceMap: SurfaceMap | null=null;
  const {steerPatrol,steerPlayer,collide,bump}=makeDrivePhysics(TUNE,makeRoadGrade(altitude,data.roads),(x,y)=>surfaceMap?.at(x,y)??0);
  const playerPose=makeDrivePose(TUNE);
  const rig=makeDriveCamera(mapDirection);
  const button=el('drive-camera');
  function showMode(){
    button.title='Cambiar vista (C) · '+rig.label;
    button.setAttribute('aria-label',button.title);
    button.dataset.mode=rig.mode;
  }
  function cycleCamera(){
    if(state==='off' || state==='caught' || !raf)return;
    rig.cycle();showMode();
    for(const c of chasers)c.visibleFor=-1;
  }
  // A second finger can tap a HUD button while the primary pointer keeps steering: a touch acts on pointerup, the
  // mouse on click.
  function tapped(target: HTMLElement,action: ()=>void){
    return (e: MouseEvent)=>{
      const touch=e instanceof PointerEvent && e.pointerType==='touch';
      if(e.type==='pointerup'?!touch || document.elementFromPoint(e.clientX,e.clientY)?.closest('button')!==target:touch)return;
      action();host.focus({preventScroll:true});
    };
  }
  button.onpointerup=button.onclick=tapped(button,cycleCamera);
  const controls=makeDriveInput(host,go,onExit,cycleCamera,()=>state!=='caught',()=>fire());


  // ---- scene objects ----
  const group=new T.Group();
  const paint=new T.MeshStandardMaterial({...surfaceStencil(),vertexColors:true,flatShading:true,roughness:.8});
  const policeGeometry=carGeometry('#f3f3ee','#2b3440',true);
  const interceptorGeometry=carGeometry('#344660','#c7d1d6',true).scale(1.15,.78,1);
  const wreckPaint=new T.MeshStandardMaterial({...surfaceStencil(),color:'#3a3a3a',flatShading:true,roughness:1});
  const blobGeometry=new T.PlaneGeometry(4.15,2.5).rotateX(-Math.PI/2);
  const blobMaterial=new T.MeshBasicMaterial({color:'#15170f',transparent:true,opacity:.38,depthWrite:false});
  // A tree hit at closing speed shakes its crowns for an instant, harder the faster the car (up to 0.7 m).
  // The player's step also eases every shake back, once per step.
  function struck(car: {treeHit?: {x: number;y: number;speed: number}},dt: number){
    if(car===player)settleTrees(dt);
    const hit=car.treeHit;
    if(hit && hit.speed>1)shakeTree(hit.x,hit.y,Math.min(.7,.18+hit.speed*.045));
  }
  function vehicle(geometry: T.BufferGeometry): Vehicle{
    const mesh=new T.Mesh(geometry,paint),blob=new T.Mesh(blobGeometry,blobMaterial);
    mesh.scale.setScalar(TUNE.visualScale);group.add(mesh,blob);
    mesh.rotation.order='YXZ';blob.rotation.order='YXZ';
    return {...restBody(),...feel(),hop:0,lift:0,lv:0,tumble:0,tumbleRate:0,mesh,blob,wreck:0,stuck:0,trail:null,puff:0,node:-1,tilt:0,treeHit:{x:0,y:0,speed:0}};
  }
  const lightGeometry=new T.BoxGeometry(.3,.24,1.05).translate(-.2,1.66,0);
  const lightRed=new T.MeshBasicMaterial({...surfaceStencil(),color:'#ff3b30'}),lightBlue=new T.MeshBasicMaterial({...surfaceStencil(),color:'#2f7bff'});
  let busViews:ReturnType<typeof makeGuaguaViews>|undefined;
  let fleet:ReturnType<typeof makeLocalFleet>|undefined;
  let fleetSteps=0,fleetCpu=0,runGeneration=0;
  function inCameraFrame(x:number,y:number,reach=0){
    const [px,py]=project(x,y,2);
    const margin=(7+reach)*camera.zoom;
    return px>=-margin && py>=-margin && px<=host.clientWidth+margin && py<=host.clientHeight+margin;
  }
  function busOccupied(x:number,y:number,h:number){
    const c=Math.cos(h),s=Math.sin(h);
    const overlaps=(car:Vehicle)=>{
      const dx=car.x-x,dy=car.y-y;
      if(Math.abs(dx)>6 || Math.abs(dy)>6)return false;
      const along=Math.max(0,Math.abs(dx*c+dy*s)-3.6);
      const side=Math.max(0,Math.abs(dy*c-dx*s)-1.1);
      return along*along+side*side<TUNE.radius*TUNE.radius;
    };
    return overlaps(player)||chasers.some(overlaps);
  }
  function busContact(car:Vehicle){
    const start=endless && fleet?performance.now():0;
    let hit=false;
    if(fleet)for(const bus of fleet.active){
      if(resolveGuaguaContact(bus.state,car,TUNE.radius))hit=true;
    }
    // A thrown guagua blocks the road where it lies, until it sinks.
    for(const k of knocked)if(!k.lift && k.rest>0 && resolveGuaguaContact(k,car,TUNE.radius))hit=true;
    if(start)fleetCpu+=performance.now()-start;
    return hit;
  }
  function patrol(id: number,interceptor: boolean): Patrol{
    const c=vehicle(interceptor?interceptorGeometry:policeGeometry);
    const light=new T.Mesh(lightGeometry,lightRed);
    if(interceptor)light.position.y=-.34;
    c.mesh.add(light);
    return {...c,light,id,interceptor,hit:0,visibleFor:-1,role:'support',target:-1};
  }
  const player=Object.assign(vehicle(required(mergeGeometries(carWheelParts()),'player wheels')),
    {scrape:{x:0,y:0,nx:0,ny:0,vx:0,vy:0,closing:0}});
  const shellGeometry=required(mergeGeometries(carShellParts('#d8452f','#f4ead7')),'player shell').translate(0,-carShellPivot,0);
  const shell=new T.Mesh(shellGeometry,paint);
  player.mesh.add(shell);
  const silhouetteMaterial=new T.MeshBasicMaterial({
    color:'#ffd84a',toneMapped:false,transparent:true,blending:T.NoBlending,
    depthFunc:T.GreaterDepth,depthWrite:false,
    stencilWrite:true,stencilWriteMask:0,stencilFuncMask:BUILDING_BIT,
    stencilFunc:T.EqualStencilFunc,stencilRef:BUILDING_BIT
  });
  // Read the completed opaque depth and building mask before transparent effects.
  for(const mesh of [player.mesh,shell]){
    const silhouette=new T.Mesh(mesh.geometry,silhouetteMaterial);
    silhouette.renderOrder=-1;
    mesh.add(silhouette);
  }
  const beacon=new T.Mesh(new T.CylinderGeometry(3.2,3.2,26,20,1,true).translate(0,13,0),new T.MeshBasicMaterial({color:DESTINATION,transparent:true,opacity:.26,depthWrite:false,side:T.DoubleSide}));
  group.add(beacon);
  // Drawn through buildings so the car stays readable in narrow streets.
  const nose=new T.Shape();
  nose.moveTo(2.24,0);
  nose.lineTo(.5,.95);
  nose.lineTo(.95,0);
  nose.lineTo(.5,-.95);
  nose.closePath();
  const arrow=new T.ShapeGeometry(nose);
  const inset=arrow.clone().translate(-1.25,0,0).scale(.70,.65,1).translate(1.25,0,0);
  const markerMaterial=new T.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.9,depthTest:false,depthWrite:false});
  const heading=new T.Mesh(required(mergeGeometries([tint(arrow,'#263831'),tint(inset,'#fff7d6')]),'heading geometry').rotateX(-Math.PI/2),markerMaterial);
  heading.renderOrder=11;heading.visible=false;
  group.add(heading);
  function cabinIsHidden(dx: number,dy: number){
    const height=player.mesh.position.y+(shell.position.y+1.2-carShellPivot)*TUNE.visualScale;
    return activeWorld().occluded(player.x,player.y,height,dx,dy);
  }
  const dummy=new T.Object3D();
  const coinTurn=new T.Quaternion(),screenUp=new T.Vector3(0,1,0);
  const coinMesh=new T.InstancedMesh(new T.CylinderGeometry(1.15,1.15,.24,14).rotateX(Math.PI/2),new T.MeshStandardMaterial({...surfaceStencil(),color:'#ffcf24',emissive:'#b07a00',roughness:.4,flatShading:true}),COINS);
  coinMesh.frustumCulled=false;coinMesh.count=0;group.add(coinMesh);
  const {puff,skid,reset: resetEffects,update: updateEffects}=makeDriveEffects(group,groundAt);
  const WALKERS=cityDetail(compact).walkers;
  const crowd=makeCrowdView(group,altitude,WALKERS);
  let people: ReturnType<typeof makePedestrians> | null=null;
  function place(b: Vehicle,yaw: number,roll: number,pitch: number,dt: number){
    const z=groundAt(b.x,b.y);
    // The whole car, wheels and shadow included, follows the road: it pivots on the ground under its centre.
    const slope=groundPitch(groundAt,b.x,b.y,yaw,HALF_BASE*TUNE.visualScale,TILT_LIMIT);
    b.tilt+=(slope-b.tilt)*approach(TILT_RATE,dt);
    b.mesh.position.set(b.x,z+.72+b.hop+b.lift+b.shake*SHAKE_LIFT*(Math.sin(b.odo*2.9)+.5*Math.sin(b.odo*7.3+1.1)),-b.y);
    b.mesh.rotation.set(roll+b.tumble,yaw,pitch+b.tilt);
    b.blob.position.set(b.x,z+.76,-b.y);
    b.blob.rotation.set(0,yaw,b.tilt);
    return z;
  }

  // ---- game state ----
  let state: DriveState='off';
  let score=0,time=0,record=0,raf=0,last=0,acc=0,grace=0,spin=0,routeAge=1,held=false,warmed=false,lastStart: number | undefined;
  let capture: {patrol: Patrol;elapsed: number;motionElapsed: number;started: number} | null=null;
  let puffArmed=true,sparkCool=0;
  let chasers: Patrol[]=[];
  const stars=el('wanted-stars');
  const starIcons=Array.from(stars.querySelectorAll<SVGElement>('svg'));
  function showStars(level: number){
    if(stars.dataset.level===String(level))return;
    const previousLevel=Number(stars.dataset.level??0);
    stars.dataset.level=String(level);
    stars.hidden=!level;
    stars.setAttribute('aria-label',`Nivel de búsqueda: ${level} de 5`);
    starIcons.forEach((icon,i)=>{
      icon.toggleAttribute('hidden',i>=level);
      icon.classList.toggle('promoted',previousLevel>0 && level>previousLevel && i===level-1);
    });
  }
  type RecordedInput={tick:number;steer:number;brake:boolean};
  let manualLab=false,steppingLab=false;
  let labInput:{steer:number;brake:boolean}|undefined;
  let recordedInputs:RecordedInput[]=[],replay:readonly RecordedInput[]|undefined,replayIndex=0,tick=0;
  function readDriveInput(){
    if(!endless)return controls.read();
    const list=replay;
    if(list)while(replayIndex+1<list.length && list[replayIndex+1].tick<=tick)replayIndex++;
    const input=labInput??list?.[replayIndex]??controls.read();
    const previous=recordedInputs.at(-1);
    if(input.steer!==previous?.steer || input.brake!==previous?.brake)
      recordedInputs.push({tick,steer:input.steer,brake:input.brake});
    tick++;
    return input;
  }
  const runSeed=Number(new URLSearchParams(window.location.search).get('seed')??1)>>>0;
  let randomState=runSeed;
  function random(){
    if(!endless)return Math.random();
    randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;
    return randomState/4294967296;
  }
  // Sample the fixed-step simulation only in the endless tuning lab.
  let nextSample=0;
  const trace: string[]=[];
  let traceCursor=0;
  const traceLimit=3600;
  function samplePolice(steer: number,brake: boolean){
    if(!endless || time<nextSample)return;
    nextSample=time+.1;
    const sample=JSON.stringify({time,seed:runSeed,camera:rig.mode,level:policing?director.stars:0,truce:director.truce,
      destination:route.target?.node,coin:coins.find(c=>Math.hypot(c.x-player.x,c.y-player.y)>6),player:{x:player.x,y:player.y,h:player.h,speed:Math.hypot(player.vx,player.vy)},steer,brake,
      patrols:chasers.map(c=>({id:c.id,x:c.x,y:c.y,h:c.h,speed:Math.hypot(c.vx,c.vy),role:c.role,
        stage:staging?.unitId===c.id,model:c.interceptor?'interceptor':'standard',visible:c.visibleFor>=0,visibleFor:c.visibleFor,target:c.target,aim:[c.aimX,c.aimY],plannedSpeed:c.cornerSpeed,hit:c.hit,wreck:c.wreck}))});
    host.dataset.police=sample;
    trace[traceCursor]=sample;
    traceCursor=(traceCursor+1)%traceLimit;
  }
  let field: RouteField | null=null;
  let zoomNow=1,paceEase=0,threat=0;
  let freeze=0,stopCool=0,stops=0,kickX=0,kickY=0,kickVX=0,kickVY=0;
  let release: (() => void) | null=null;
  const lead=new T.Vector3(),screen=new T.Vector3();
  const goalLabel=required(el('goal').querySelector('b'),'goal label');
  let goalFlight=1,goalText='';
  const focus=new T.Vector3(),chase=new T.Vector3(),targetPoint=new T.Vector3();
  const pois=locations.map((f,i)=>({name:f.properties.name,number:String(i+1).padStart(2,'0'),x:f.properties.xy[0],y:f.properties.xy[1]}));
  const route=makeDriveRoute(pois,altitude,TUNE,COINS);
  const {coins}=route;
  try{record=Number(localStorage.getItem('drive-record'))||0;}catch{}
  const clock=(s: number)=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  const guide=el('guide'),zones={left:required(guide.querySelector('.left'),'left guide'),right:required(guide.querySelector('.right'),'right guide')};
  const over=el('over'),actions=el('over-actions'),again=el('again');
  let flightWaiting=false;
  let aircraft:ReturnType<typeof makeFlight>|undefined;
  const flightButton=el('drive-flight') as HTMLButtonElement;
  const flightIcon=required(flightButton.querySelector('use'),'flight icon');
  let candidates:number[]|undefined,landingCursor=0,landingRequested=0,crashElapsed=0,landingTruce=0;
  function flightButtonState(inAir:boolean){
    const label=inAir?'Volver al coche':'Volar';
    flightButton.title=label;flightButton.setAttribute('aria-label',label);
    flightIcon.setAttribute('href',inAir?'#i-car':'#i-plane');
    el('hud').classList.toggle('airborne',inAir);
    flightButton.disabled=false;
  }
  function endFlight(){
    if(!aircraft || aircraft.phase==='off')return;
    flightWaiting=false;
    aircraft.stop();releaseLanding();candidates=undefined;group.visible=true;
    flightButtonState(false);
    delete host.dataset.flight;
    controls.activate();
  }
  flightButton.onclick=()=>{
    if(!raf || state==='caught' || state==='off')return;
    if(aircraft && aircraft.phase!=='off'){
      if(aircraft.phase==='fly' && !candidates){
        candidates=activeWorld().landingCandidates(aircraft.x,aircraft.y);
        landingCursor=0;landingRequested=performance.now();flightButton.disabled=true;
      }
    }else if(group.visible){
      go();controls.deactivate();acc=0;
      aircraft??=makeFlight(host,scene,flightGround,(x,y)=>activeWorld().roofAt(x,y),onExit,flightArea,
        (w,s,e,n)=>Math.max(flightTerrainCeiling(w,s,e,n),activeWorld().roofCeiling(w,s,e,n)));
      aircraft.start(player.x,player.y,player.h,camera);
      group.visible=false;flightButtonState(true);flightButton.disabled=true;
    }
    host.focus({preventScroll:true});
  };
  function flightFrame(dt:number){
    if(!aircraft)return;
    if(candidates){
      const world=activeWorld();
      for(let checked=0;checked<32 && landingCursor<candidates.length;checked++){
        const i=candidates[landingCursor],n=world.nodes[i];
        if(!demandLanding(n.x,n.y))break;
        landingCursor++;
        const h=world.landingHeading(i,aircraft.h);
        if(h===undefined || fleet?.active.some(b=>Math.hypot(b.state.x-n.x,b.state.y-n.y)<8))continue;
        aircraft.land(n.x,n.y,h);candidates=undefined;break;
      }
      if(candidates && (landingCursor===candidates.length || performance.now()-landingRequested>12000)){
        releaseLanding();candidates=undefined;
      }
    }
    if(aircraft.phase!=='crash')time+=dt;
    // Keep the aircraft on the loaded side of a zone edge while its collision footprints arrive.
    const world=activeWorld(),c=Math.cos(aircraft.h),s=Math.sin(aircraft.h);
    const corridorReady=(x:number,y:number)=>world.footprintsReady(x,y) &&
      world.footprintsReady(x+5.4*s,y-5.4*c) && world.footprintsReady(x-5.4*s,y+5.4*c);
    const needsZone=aircraft.phase==='fly' && (!corridorReady(aircraft.x,aircraft.y) ||
      !corridorReady(aircraft.x+12*c,aircraft.y+12*s));
    flightWaiting=needsZone || !!candidates;
    const event=aircraft.step(flightWaiting?0:dt);
    if(event==='landed'){
      const {x,y,h}=aircraft;
      endFlight();
      Object.assign(player,restBody(),feel(),{x,y,h,trail:null,tilt:0,hop:0,slopeAccel:undefined});
      playerPose.reset();previous.delete(player);resetEffects();people?.reset(player);crowd.reset();
      focus.set(x,groundAt(x,y),-y);lead.set(0,0,0);rig.startHeading(h);
      for(const car of chasers)group.remove(car.mesh,car.blob);
      chasers=[];director.reset();showStars(0);arrivalPending=false;
      secondsOutOfView=perceptionAge=0;staging=undefined;field=null;sideRoutes.clear();
      Object.assign(lastSighting,{x,y,vx:0,vy:0});paceEase=threat=0;
      grace=TUNE.grace;landingTruce=POLICE.truceTime;spawnDelay=0;freeze=0;release=null;
      return;
    }
    if(event==='impact'){
      state='caught';candidates=undefined;releaseLanding();crashElapsed=0;buzz(140);
      over.dataset.caught='';finishResult('Accidente aéreo');
    }
    if(aircraft.phase==='crash'){
      crashElapsed+=dt;flightButton.hidden=true;
      if(crashElapsed>=CAPTURE.summary)over.hidden=false;
      if(crashElapsed>=CAPTURE.actions && actions.hidden){actions.hidden=false;again.focus({preventScroll:true});}
    }else flightButton.disabled=aircraft.phase!=='fly' || !!candidates;
    el('hud-time').textContent=clock(time);
    host.dataset.flight=[aircraft.phase,aircraft.x.toFixed(1),aircraft.y.toFixed(1),aircraft.target.y.toFixed(1),aircraft.h.toFixed(3)].join(',');
    redraw();
  }
  function clearCapture(){
    flightButton.hidden=fireButton.hidden=false;
    capture=null;
    over.hidden=actions.hidden=true;
    over.inert=false;
    delete over.dataset.caught;
    delete over.dataset.paused;
  }
  // Screen position of a map point, in CSS pixels of the host.
  function project(x: number,y: number,lift: number): Point{
    screen.set(x,altitude(x,y)+lift,-y).project(camera);
    return [(screen.x+1)*host.clientWidth/2,(1-screen.y)*host.clientHeight/2];
  }
  function pop(x: number,y: number,amount: number,icon: "coin" | "crash",big: boolean){
    const [px,py]=project(x,y,3),node=document.createElement('span');
    node.className='pop'+(big?' big':'');node.style.left=px+'px';node.style.top=py+'px';
    node.innerHTML='<svg class="ic"><use href="#i-'+icon+'"/></svg>+'+amount;
    node.onanimationend=()=>node.remove();el('pops').append(node);
  }
  function gain(amount: number){
    score+=amount;const chip=el('stat-coins');
    chip.classList.remove('bump');void chip.offsetWidth;chip.classList.add('bump');
  }
  const buzz=(ms: number)=>{try{navigator.vibrate?.(ms);}catch{}};
  // Hit-stop: the simulation holds for a few frames while dust, camera and HUD keep moving.
  // `then` runs when it lets go.
  function stop(seconds: number,then?: () => void){
    freeze=Math.max(freeze,seconds);stops++;
    if(then)release=then;
  }
  function advanceStop(dt: number){
    freeze=Math.max(0,freeze-dt);
    if(!freeze){release?.();release=null;}
  }
  // Camera kick towards whatever hit, along (dx,dy) in map coordinates. Strength 0 to 1.
  function kick(dx: number,dy: number,strength: number){
    const d=Math.hypot(dx,dy);
    if(d<1e-5)return;
    kickVX+=dx/d*strength*TUNE.kick;kickVY+=dy/d*strength*TUNE.kick;
  }
  // ---- gun ----
  const W=TUNE.weapon,SHOT_HEIGHT=1.1;
  const slug=makeSlug(group),quake=makeShake();
  // The rubble outlives the run: it stays in the scene until its building is rebuilt.
  const demolisher=makeDemolisher({material:buildingMaterial,altitude,tones,hide:hideBuilding});
  scene.add(demolisher.root);
  const fireButton=el('drive-fire'),coolRing=required(fireButton.querySelector('circle'),'cooldown ring');
  let cool=0,cooling=false,shot: Shot | null=null,trailLeft=0;
  // Demolished buildings wait to be rebuilt; guaguas thrown off the road lie there, then sink.
  const ruins: {id: number;members: Building[];x: number;y: number;reach: number;away: number;age: number}[]=[];
  // The real footprints under what came down: a zone that arrives leaves them out until they are rebuilt.
  const fallen=new Set<number>();
  const knocked: (Thrown & {line: string;x: number;y: number;h: number;speed: number;rest: number})[]=[];
  const rayFrom=new T.Vector3(),rayDir=new T.Vector3();
  /** A slug level from the nose, along the car or (lab checks) towards a world point. False while it cools. */
  function fire(at?: T.Vector3){
    if(state!=='playing' || capture || held || cool>0 || (aircraft && aircraft.phase!=='off'))return false;
    const heading=at?Math.atan2(-at.z-player.y,at.x-player.x):player.h;
    const c=Math.cos(heading),s=Math.sin(heading),x=player.x+c*2.2,y=player.y+s*2.2,z=groundAt(x,y)+SHOT_HEIGHT;
    const {t,building}=activeWorld().rayHit(rayFrom.set(x,z,-y),rayDir.set(c,0,-s),W.range);
    shot=aimShot(x,y,z,heading,t,building,W.range);
    cool=W.cooldown;
    player.hop=Math.max(player.hop,.12);quake.add(.25);
    puff(x,y,'smoke',c*6,s*6);
    // The ring fills by itself, a CSS transition over the cooldown.
    cooling=true;fireButton.classList.add('cooling');fireButton.setAttribute('aria-disabled','true');
    coolRing.style.transition='none';fireButton.style.setProperty('--cool','0');void coolRing.getBoundingClientRect();
    coolRing.style.transition='stroke-dashoffset '+W.cooldown+'s linear';fireButton.style.setProperty('--cool','100');
    return true;
  }
  /** Moves the slug one step; it stops at the first patrol or guagua on its way, else at its wall or its reach. */
  function advanceShot(dt: number){
    if(!shot)return;
    const length=Math.min(shot.left,W.speed*dt),ax=shot.x,ay=shot.y,dx=shot.dx,dy=shot.dy;
    const bx=ax+dx*length,by=ay+dy*length;
    let first=1,patrolHit: Patrol | undefined,busHit: NonNullable<typeof fleet>['active'][number] | undefined;
    for(const c of chasers){
      if(c.wreck)continue;
      const t=segmentCircle(ax,ay,bx,by,c.x,c.y,TUNE.radius+.4);
      if(t<=first){first=t;patrolHit=c;}
    }
    for(const bus of fleet?.active??[]){
      const t=segmentBox(ax,ay,bx,by,bus.state.x,bus.state.y,bus.state.h,HALF_LENGTH+.1,HALF_WIDTH+.15);
      if(t<=first){first=t;busHit=bus;patrolHit=undefined;}
    }
    const travelled=length*first;
    trailLeft-=travelled;
    if(trailLeft<=0){trailLeft=4;puff(shot.x,shot.y,'smoke',-dx*2,-dy*2);}
    shot.x+=dx*travelled;shot.y+=dy*travelled;shot.z=groundAt(shot.x,shot.y)+SHOT_HEIGHT;shot.left-=travelled;
    if(patrolHit){
      // Wrecked as in a crash, then thrown along the shot.
      wreck(patrolHit);launch(patrolHit,dx,dy,W.launch,W.lift);quake.add(.6);
      shot=null;return;
    }
    if(busHit && fleet){
      fleet.knock(busHit);
      const {x,y,h}=busHit.state,k={line:busHit.line,x,y,h,speed:0,rest:W.busRest,lift:0,lv:0,tumble:0,tumbleRate:0,vx:0,vy:0};
      launch(k,dx,dy,W.busLaunch,W.busLift);knocked.push(k);
      kick(x-player.x,y-player.y,.5);quake.add(.8);
      for(let i=0;i<6;i++)puff(x+Math.cos(i)*2,y+Math.sin(i)*2,'smoke');
      shot=null;return;
    }
    if(shot.left>1e-6)return;
    const b=shot.building;
    // A monument is its own model, which the city cannot take away: the slug stops on it in a cloud of dust.
    if(b?.landmark){
      for(let i=0;i<6;i++)puff(shot.x,shot.y,'dust',(Math.random()-.5)*5,(Math.random()-.5)*5);
      kick(shot.x-player.x,shot.y-player.y,.3);quake.add(.4);
    }else if(b){
      // What comes down is what the city draws as one: all the parts of a building, or its fused block.
      const parts=partsOf(b),id=parts[0].id,members=activeWorld().removeUnder(parts);
      for(const m of members)fallen.add(m.id);
      demolisher.demolish(id,parts.map(p=>({building:p,base:altitude(...p.rings[0][0])})),shotBlast(shot,W));
      const corners=parts.flatMap(p=>p.rings[0]),[cx,cy]=ringCenter(corners);
      ruins.push({id,members,x:cx,y:cy,reach:Math.max(...corners.map(([x,y])=>Math.hypot(x-cx,y-cy))),away:0,age:0});
      kick(shot.x-player.x,shot.y-player.y,.6);buzz(30);quake.add(1.2);
      if(!stopCool){stop(.08);stopCool=TUNE.stopGap;}
    }else for(let i=0;i<4;i++)puff(shot.x,shot.y,'dirt',(Math.random()-.5)*4,(Math.random()-.5)*4);
    shot=null;
  }
  /** A thrown body moves along its throw until a wall or a tree stops it: it never lands inside a building. */
  function glide(b: {x: number;y: number;vx: number;vy: number},dt: number,radius: number){
    if(!b.vx && !b.vy)return;
    const x=b.x+b.vx*dt,y=b.y+b.vy*dt;
    if(activeWorld().free(x,y,radius)){b.x=x;b.y=y;}else b.vx=b.vy=0;
  }
  function throwBuses(dt: number){
    for(let i=knocked.length-1;i>=0;i--){
      const k=knocked[i];
      glide(k,dt,1.3);
      if(!fly(k,dt,W.gravity) && (k.rest-=dt)< -W.busSink)knocked.splice(i,1);
    }
  }
  /**
   * A building out of view for `W.rebuild` seconds, its pieces sunk, stands again and its rubble goes: nothing piles
   * up. `force` (leaving the drive) skips the waits. The city may not rebuild it yet: then it asks again in 0.5 s.
   */
  function rebuild(dt: number,force=false){
    for(let i=ruins.length-1;i>=0;i--){
      const r=ruins[i];
      r.age+=dt;r.away=inCameraFrame(r.x,r.y,r.reach)?0:r.away+dt;
      if(!force && (r.away<W.rebuild || r.age<DEBRIS_TUNE.life+DEBRIS_TUNE.sink))continue;
      if(!showBuilding(r.id)){r.away=W.rebuild-.5;continue;}
      for(const m of r.members){fallen.delete(m.id);world?.restoreBuilding(m);}
      demolisher.restore(r.id);ruins.splice(i,1);
    }
  }
  fireButton.onpointerup=fireButton.onclick=tapped(fireButton,()=>fire());
  function trail(){
    const world=activeWorld();
    const from=world.nearestNode(player.x,player.y);
    const next=route.choose(world,world.routesFrom(from),random);
    if(!next)return null;
    const {target,path}=next;
    const end=world.nodes[target.node];
    beacon.position.set(end.x,altitude(end.x,end.y),-end.y);
    // The marker flies out of the car to its place, so a new destination is seen being handed over.
    goalFlight=0;
    el('hud-live').textContent='Destino: '+target.poi.name;
    return path;
  }
  function handleRouteEvent(event: RouteEvent){
    if(event.type==='coin'){
      pop(event.coin.x,event.coin.y,event.points,'coin',false);
      gain(event.points);buzz(8);
      return;
    }
    if(policing)arrivalPending=true;
    pop(player.x,player.y,event.points,'coin',true);
    gain(event.points);buzz(40);stop(TUNE.hitStop*STOP_ARRIVE);
    for(let k=0;k<8;k++)puff(player.x+Math.cos(k*.8)*2.5,player.y+Math.sin(k*.8)*2.5);
    trail();
  }
  const director=createPoliceDirector();
  const lastSighting={x:0,y:0,vx:0,vy:0};
  const interceptorProfile={...TUNE.patrol,topSpeed:TUNE.patrol.topSpeed*1.08,turn:TUNE.patrol.turn*.85};
  let secondsOutOfView=0;
  let arrivalPending=false,perceptionAge=0,spawnDelay=0,nextPatrolId=0;
  let staging:(Approach & {until:number;field:RouteField})|undefined;
  let nextStage=0;
  const sideRoutes=new Map<number,RouteField>();
  function sideRoute(node:number){
    let route=sideRoutes.get(node);
    if(!route){
      route=activeWorld().patrolRoutesFrom(node);
      if(sideRoutes.size>=4)sideRoutes.delete(sideRoutes.keys().next().value!);
      sideRoutes.set(node,route);
    }
    return route;
  }
  function perceive(dt:number){
    const world=activeWorld();
    let closest=Infinity,seen=false;
    const units=chasers.map(c=>{
      const distance=Math.hypot(c.x-player.x,c.y-player.y);
      if(!c.wreck){
        closest=Math.min(closest,distance);
        if(distance<TUNE.chaserSight && world.sight(c.x,c.y,player.x,player.y))seen=true;
      }
      c.visibleFor=!c.wreck && patrolVisible(c.x,c.y)?Math.max(0,c.visibleFor+dt):-1;
      return {id:c.id,distance,wrecked:c.wreck>0};
    });
    secondsOutOfView=chasers.some(c=>!c.wreck && c.visibleFor>=.3)?0:secondsOutOfView+dt;
    if(seen){lastSighting.x=player.x;lastSighting.y=player.y;}
    director.setUnits(units);
    const choices:Approach[]=[];
    const search=director.stars>=4 && director.canStage && !staging && time>=nextStage;
    if(search)nextStage=time+1;
    const result=director.update({dt,anyVisible:seen,closestDistance:closest,arrived:arrivalPending,
      candidates:findInterceptCandidates(world,player,chasers,director.stars,TUNE.radius,search?{route:sideRoute,choices}:undefined)});
    if(staging && (time>=staging.until || !director.canStage || !chasers.some(c=>c.id===staging?.unitId && !c.wreck))){
      staging=undefined;nextStage=time+2;
    }
    if(director.canStage && !staging && choices.length){
      const choice=choices[0];
      staging={...choice,field:sideRoute(choice.node),until:time+4};
    }
    arrivalPending=false;showStars(result.stars);
    for(const c of chasers)c.role=result.units.find(unit=>unit.id===c.id)?.role??'support';
  }
  function supportSpeed(c:Patrol){
    if(c.role!=='support')return Infinity;
    const fx=Math.cos(c.h),fy=Math.sin(c.h);
    let limit=Infinity;
    for(const other of chasers){
      if(c===other || other.wreck)continue;
      const dx=other.x-c.x,dy=other.y-c.y,along=dx*fx+dy*fy;
      if(along>0 && along<13 && Math.abs(dx*fy-dy*fx)<3)
        limit=Math.min(limit,Math.max(2,Math.hypot(other.vx,other.vy)+(along-9)*.8));
    }
    return limit;
  }
  const eye=new T.Vector3();
  function patrolVisible(x: number,y: number){
    const [px,py]=project(x,y,2);
    if(px<0 || py<0 || px>host.clientWidth || py>host.clientHeight)return false;
    camera.getWorldDirection(eye).negate();
    return !activeWorld().occluded(x,y,groundAt(x,y)+2,eye.x/eye.y,-eye.z/eye.y);
  }
  function spawnChaser(level: number,routeField: RouteField){
    const world=activeWorld(),pool:number[]=[],preferred:number[]=[];
    const forwardX=Math.cos(player.h),forwardY=Math.sin(player.h);
    const behind=chasers.every(c=>c.wreck);
    for(const index of world.validNodes){
      const n=world.nodes[index],dx=n.x-player.x,dy=n.y-player.y,d=dx*dx+dy*dy;
      if(d<75*75 || d>135*135 || routeField.prev[index]<0 || !n.ok)continue;
      if(inCameraFrame(n.x,n.y) || !world.free(n.x,n.y,TUNE.radius+.25))continue;
      if(chasers.some(c=>Math.hypot(c.x-n.x,c.y-n.y)<12))continue;
      pool.push(index);
      if((dx*forwardX+dy*forwardY<0)===behind)preferred.push(index);
    }
    const choices=preferred.length?preferred:pool;
    if(!choices.length)return;
    const index=choices[Math.floor(random()*choices.length)],n=world.nodes[index];
    const next=world.nodes[routeField.prev[index]];
    const c=patrol(nextPatrolId++,level>=3 && !chasers.some(p=>p.interceptor));
    Object.assign(c,{x:n.x,y:n.y,h:Math.atan2(next.y-n.y,next.x-n.x),node:index});
    chasers.push(c);
  }
  function reinforceStraight(speed:number){
    const live=chasers.filter(c=>!c.wreck);
    const approaching=live.some(c=>{
      const dx=c.x-player.x,dy=c.y-player.y,vx=c.vx-player.vx,vy=c.vy-player.vy;
      const t=-(dx*vx+dy*vy)/Math.max(1,vx*vx+vy*vy);
      return t>0 && t<3 && Math.hypot(dx+t*vx,dy+t*vy)<12 &&
        activeWorld().sight(player.x,player.y,c.x,c.y,TUNE.radius);
    });
    if(approaching)return false;
    const atCapacity=live.length>=director.maxUnits;
    const replace=atCapacity?live.filter(c=>!inCameraFrame(c.x,c.y) && !director.assignment(c.id))
      .sort((a,b)=>Math.hypot(b.x-player.x,b.y-player.y)-Math.hypot(a.x-player.x,a.y-player.y))[0]:undefined;
    if(atCapacity && !replace)return false;
    const world=activeWorld(),pace=Math.min(13,speed*.48);
    camera.getWorldDirection(eye);
    const viewX=eye.x/eye.y,viewY=-eye.z/eye.y;
    const entry=straightRoadEntry(world,player,TUNE.radius,(x,y,h,ahead)=>{
      if(inCameraFrame(x,y) || chasers.some(c=>Math.hypot(c.x-x,c.y-y)<12) ||
        fleet?.active.some(bus=>Math.hypot(bus.state.x-x,bus.state.y-y)<10))return Infinity;
      // Prefer a clear view across the whole encounter. A shorter opening between facades
      // also works if the moving car can be seen for at least half a second on approach.
      const meet=Math.min(5,ahead/(speed-pace));
      const clearAt=(t:number)=>{
        const px=x+pace*t*Math.cos(h),py=y+pace*t*Math.sin(h);
        return world.free(px,py,TUNE.radius) && !world.occluded(px,py,groundAt(px,py)+2,viewX,viewY);
      };
      if(clearAt(meet) && clearAt(Math.max(0,meet-1.2)))return 0;
      for(let t=Math.max(0,(ahead-42)/(speed-pace));t<=meet+.5;t+=.5){
        if(clearAt(t) && clearAt(t+.5))return 35;
      }
      // Prefer an early entry on this road over leaving both units on distant parallel streets.
      // The camera can gain a view through gaps between the sampled points as the cars advance.
      return 85;
    });
    if(!entry)return false;
    const interceptor=replace?.interceptor??(director.stars>=3 && !chasers.some(c=>c.interceptor));
    if(replace)retire(replace);
    const c=patrol(nextPatrolId++,interceptor);
    Object.assign(c,entry,{vx:pace*Math.cos(entry.h),vy:pace*Math.sin(entry.h),entryUntil:time+5,entryPace:pace});
    chasers.push(c);secondsOutOfView=0;
    return true;
  }
  function retire(c: Patrol){
    group.remove(c.mesh,c.blob);
    chasers.splice(chasers.indexOf(c),1);
  }
  function nextStart(){
    const world=activeWorld();
    // A fixed start, when given, is the road node nearest to it.
    const index=fixedStart?world.nearestNode(fixedStart[0],fixedStart[1]):chooseStartNode(world.nodes,world.validNodes,world.free,10,random,lastStart);
    if(index===undefined || !world.nodes[index])return undefined;
    lastStart=index;
    return world.nodes[index];
  }
  function restart(n: RoadNode){
    endFlight();landingTruce=0;
    manualLab=false;tick=0;recordedInputs=[];replay=undefined;replayIndex=0;
    randomState=runSeed;secondsOutOfView=0;nextPatrolId=0;spawnDelay=0;
    trace.length=traceCursor=nextSample=0;
    delete host.dataset.police;
    director.reset();staging=undefined;nextStage=0;sideRoutes.clear();perceptionAge=0;arrivalPending=false;showStars(policing?1:0);
    lastSighting.x=n.x;lastSighting.y=n.y;
    location?.reset([n.x,n.y]);
    for(const c of chasers)group.remove(c.mesh,c.blob);
    chasers=[];held=false;freeze=stopCool=kickX=kickY=kickVX=kickVY=0;release=null;score=0;time=0;grace=TUNE.grace;acc=0;routeAge=1;field=null;route.clear();
    puffArmed=true;
    sparkCool=0;cool=0;shot=null;knocked.length=0;quake.clear();
    playerPose.reset();
    resetEffects();
    Object.assign(player,restBody(),feel(),{x:n.x,y:n.y,trail:null,hop:0,tilt:0,slopeAccel:undefined});
    paceEase=0;threat=0;lead.set(0,0,0);el('pops').replaceChildren();
    people?.reset(player);crowd.reset();
    fleetSteps=0;fleetCpu=0;
    busViews?.hideAfter(0);
    const generation=++runGeneration;
    group.visible=!fleet;
    delete host.dataset.guagua;delete host.dataset.guaguas;
    if(fleet)void fleet.reset(n.x,n.y).then(()=>{
      if(generation===runGeneration)group.visible=true;
    });
    const path=trail();
    // The first destination is there when the run starts: the camera is still gliding in, so nothing flies.
    goalFlight=1;
    if(path?.[1])player.h=Math.atan2(path[1].y-n.y,path[1].x-n.x);
    rig.startHeading(player.h);
    focus.set(player.x,groundAt(player.x,player.y),-player.y);
    clearCapture();guide.className='ready';
    state='ready';
  }
  function caught(by: Patrol){
    location?.clearTitle();
    state='caught';buzz(140);guide.className='';
    controls.release();
    over.dataset.caught='';
    capture={patrol:by,elapsed:0,motionElapsed:0,started:last};
    for(const car of [player,by]){
      const speed=Math.hypot(car.vx,car.vy);
      if(speed>CAPTURE.maxSpeed){
        car.vx*=CAPTURE.maxSpeed/speed;
        car.vy*=CAPTURE.maxSpeed/speed;
      }
    }
    kick(by.x-player.x,by.y-player.y,1);
    // The contact holds for a beat; dust and the push-in start when it lets go.
    stop(TUNE.hitStop*STOP_CAUGHT,()=>{for(let k=0;k<6;k++)puff(player.x+Math.cos(k)*1.5,player.y+Math.sin(k)*1.5);});
    flightButton.hidden=fireButton.hidden=true;finishResult('Atrapado');
  }
  function finishResult(title:string){
    el('over-title').textContent=title;
    const best=score>record;
    if(best){record=score;try{localStorage.setItem('drive-record',String(record));}catch{}}
    el('over-coins').textContent=String(score);el('over-time').textContent=clock(time);el('over-record').textContent=String(record);
    el('over-record').classList.toggle('new',best);
    el('hud-live').textContent=title+'. '+score+' monedas en '+Math.round(time)+' segundos.'+(best?' Nuevo rÃ©cord.':'');
  }

  // The result is already fixed. Move only the two cars involved, using their remaining momentum.
  function coast(patrol: Patrol,elapsed: number,dt: number){
    const damping=1-Math.min(1,elapsed/CAPTURE.coast);
    const world=activeWorld();
    const cars=[player,...chasers];
    for(const car of [player,patrol]){
      if(!car.vx && !car.vy)continue;
      const x=car.x+car.vx*dt*damping,y=car.y+car.vy*dt*damping;
      const occupied=cars.some(other=>other!==car && Math.hypot(x-other.x,y-other.y)<TUNE.radius*2);
      if(!damping || occupied || !world.free(x,y,TUNE.radius)){
        car.vx=car.vy=0;
        continue;
      }
      car.x=x;car.y=y;
    }
  }

  function go(){
    manualLab=false;
    if(state==='ready'){state='playing';guide.className='play';}
    // A run held after an interruption continues on the next input, never by itself.
    if(held){held=false;guide.className='play';}
  }
  // ---- simulation ----
  function step(dt: number){
    const world=activeWorld();
    landingTruce=Math.max(0,landingTruce-dt);
    time+=dt;grace=Math.max(0,grace-dt);stopCool=Math.max(0,stopCool-dt);cool=Math.max(0,cool-dt);
    advanceShot(dt);throwBuses(dt);
    if(fleet){
      const start=endless?performance.now():0;
      fleet.step(dt,player.x,player.y);
      if(endless){fleetCpu+=performance.now()-start;fleetSteps+=fleet.active.length;}
    }
    const {steer,brake}=readDriveInput();
    const driveLoad=steerPlayer(player,steer,brake,dt);
    const beforeContactX=player.x,beforeContactY=player.y;
    busContact(player);
    const knock=collide(player,world);
    struck(player,dt);
    let playerContact=knock>0 || player.x!==beforeContactX || player.y!==beforeContactY;
    sparkCool=Math.max(0,sparkCool-dt);
    const scrape=player.scrape;
    if(!knock && !sparkCool && scrape.closing>.15 && Math.hypot(scrape.vx,scrape.vy)>=TUNE.sparkSpeed){
      const x=scrape.x+scrape.nx*.22,y=scrape.y+scrape.ny*.22;
      for(const spread of [.8,2.3,4]){
        puff(x,y,'spark',scrape.nx*spread-scrape.vx*.28,scrape.ny*spread-scrape.vy*.28);
      }
      sparkCool=TUNE.sparkGap;
    }
    if(knock>3)player.hop=Math.max(player.hop,Math.min(TUNE.playerHop,knock*TUNE.playerHopGain));
    if(knock>6){kick(player.hitX,player.hitY,Math.min(1,knock/14));buzz(18);}
    // Only a hard, nearly head-on hit stops time, and not twice in a row: scraping along a street never does.
    if(knock>TUNE.hardImpact && !stopCool){stop(TUNE.hitStop);stopCool=TUNE.stopGap;}
    const speed=Math.hypot(player.vx,player.vy);
    if(policing && !landingTruce){
      perceptionAge+=dt;
      if(perceptionAge>=.1){perceive(perceptionAge);perceptionAge=0;}
      routeAge+=dt;
      if(routeAge>=.5 || !field){
        routeAge=0;
        const target=director.truce?lastSighting:player;
        const source=world.nearestNode(target.x,target.y);
        if(!field || field.source!==source)field=world.patrolRoutesFrom(source);
      }
      spawnDelay-=dt;
      if(!director.truce && spawnDelay<=0){
        const reinforced=director.stars>=2 && speed>=16 && secondsOutOfView>=4 && reinforceStraight(speed);
        if(!reinforced && chasers.filter(c=>!c.wreck).length<director.maxUnits)spawnChaser(director.stars,field);
        spawnDelay=.6;
      }
    }
    for(let i=chasers.length-1;i>=0;i--){
      const c=chasers[i];
      if(c.wreck>0){
        c.wreck=Math.max(0,c.wreck-dt);c.puff-=dt;c.h+=dt*14*Math.max(0,c.wreck-TUNE.wreckTime+.45);
        if(c.lift>0 || c.lv){glide(c,dt,TUNE.radius);fly(c,dt,W.gravity);}
        if(c.puff<=0 && c.wreck>0){c.puff=.12;puff(c.x,c.y,'smoke');}
        if(!c.wreck)retire(c);
        continue;
      }
      const assignment=director.assignment(c.id);
      let turn:number|null;
      let limit=supportSpeed(c);
      if(c.entryUntil && time<c.entryUntil && Math.hypot(player.x-c.x,player.y-c.y)>16 && !director.truce && !assignment){
        turn=0;limit=Math.min(limit,c.entryPace??13);
      }else if(assignment){
        c.entryUntil=0;
        turn=crossJunction(c,world.nodes,assignment);
        c.aimX=world.nodes[c.target].x;c.aimY=world.nodes[c.target].y;
        c.node=-1;c.cornerSpeed=Infinity;
      }else if(staging?.unitId===c.id && c.role==='support'){
        const entry=world.nodes[staging.node],distance=Math.hypot(c.x-entry.x,c.y-entry.y);
        c.target=staging.node;
        turn=chaseSteer(c,{x:entry.x,y:entry.y,vx:0,vy:0},world,staging.field.prev,TUNE);
        limit=Math.min(limit,Math.max(0,(distance-2)*1.5));
      }else{
        c.entryUntil=0;turn=chaseSteer(c,director.truce?lastSighting:player,world,required(field,'patrol routes').prev,TUNE);
        c.target=c.node;
      }
      if(turn===null){
        if(!inCameraFrame(c.x,c.y))retire(c);
        continue;
      }
      steerPatrol(c,turn,world,dt,c.interceptor?interceptorProfile:TUNE.patrol,limit);
      const blocked=busContact(c);
      const hit=collide(c,world),pace=Math.hypot(c.vx,c.vy);
      struck(c,dt);
      if(hit>3)c.hit=hit;
      if(hit>3)c.hop=Math.min(TUNE.hop,hit*.05);
      c.stuck=!blocked && pace<1.5?c.stuck+dt:0;
      if(hit>TUNE.hardImpact)wreck(c);
      else if(c.stuck>TUNE.stuckTime && !inCameraFrame(c.x,c.y))retire(c);
    }
    for(let i=0;i<chasers.length;i++){
      const a=chasers[i];
      if(a.lift>0)continue;
      for(let j=i+1;j<chasers.length;j++){
        if(chasers[j].lift>0)continue;
        const impact=bump(a,chasers[j]);
        if(impact>TUNE.hardImpact && !a.wreck && !chasers[j].wreck){wreck(a);wreck(chasers[j]);}
      }
      const shove=bump(a,player);
      if(shove>=0){
        playerContact=true;
        // A car-to-car shove can push either body back into the bus.
        busContact(a);busContact(player);
      }
      if(shove>6)kick(a.x-player.x,a.y-player.y,Math.min(1,shove/14)*.7);
      // Close enough counts as contact: a tree or a corner must not save a stopped car.
      if(!endless && !a.wreck && !grace && speed<TUNE.catchSpeed && Math.hypot(a.x-player.x,a.y-player.y)<TUNE.catchReach){
        playerPose.update(player,steer,dt,driveLoad);
        caught(a);return;
      }
    }
    const playerSlip=playerPose.update(player,steer,dt,driveLoad);
    // Dust starts below the skid marks and rearms once the slide has nearly gone: 2.5 and 1.5 m/s by default.
    // Off the road the slide throws the surface instead of white smoke.
    if(playerSlip<TUNE.skidSpeed*PUFF_REARM)puffArmed=true;
    else if(puffArmed && playerSlip>=TUNE.skidSpeed*PUFF_START){
      puffArmed=false;
      if(!playerContact && (steer || brake)){
        const yaw=player.h+playerPose.yaw,fx=Math.cos(yaw),fy=Math.sin(yaw),rough=DEBRIS[player.ground];
        for(const side of [-.72,0,.72]){
          const rear=side===0?1.55:1.3,scale=TUNE.visualScale;
          if(rough)for(let k=0;k<3;k++)spray(player,rough,fx,fy,scale,true);
          else puff(player.x-(fx*rear+fy*side)*scale,player.y+(-fy*rear+fx*side)*scale,'drift');
        }
      }
    }
    route.advance(player,world.nodes,dt,handleRouteEvent);
    samplePolice(steer,brake);
    for(const b of [player,...chasers]){
      const isPlayer=b===player,slip=isPlayer?playerSlip:b.slip,speed=Math.hypot(b.vx,b.vy);
      surfaceFeel(b,isPlayer,speed,dt);
      const rough=DEBRIS[b.ground],sliding=slip>=TUNE.skidSpeed;
      if(b.wreck>0 || !(sliding || (rough && speed>TRACK_SPEED))){b.trail=null;continue;}
      const yaw=b.h+(isPlayer?playerPose.yaw:0),fx=Math.cos(yaw),fy=Math.sin(yaw);
      const scale=isPlayer?TUNE.visualScale:1;
      skid(b,fx,fy,scale,b.ground,sliding);
      if(rough){
        b.debris-=dt;
        if(speed>DEBRIS_SPEED && b.debris<=0){b.debris=DEBRIS_STEP/speed*(isPlayer?1:2);spray(b,rough,fx,fy,scale,sliding);}
        continue;
      }
      b.puff-=dt;
      if(b.puff>0)continue;
      if(isPlayer){
        // The player's slide smokes all along, from one rear wheel and then the other.
        b.puff=DRIFT_SMOKE;b.wheel2=-b.wheel2;
        const side=.7*b.wheel2;
        puff(b.x-(fx*1.3+fy*side)*scale,b.y+(-fy*1.3+fx*side)*scale,'drift');
      }else{b.puff=.07;puff(b.x-fx*1.3*scale,b.y-fy*1.3*scale);}
    }
  }
  // Leaving the road or coming back onto it hops the car; the rumble of the surface follows it within 0.2 s.
  function surfaceFeel(b: Vehicle,isPlayer: boolean,speed: number,dt: number){
    const rough=DEBRIS[b.ground]!==null;
    if(rough!==b.rough){
      b.rough=rough;
      if(speed>KERB_SPEED && !b.wreck){
        b.hop=Math.max(b.hop,Math.min(KERB_HOP_MAX,speed*KERB_HOP));
        if(isPlayer)buzz(12);
      }
    }
    const name=SURFACES[b.ground],target=name==='asphalt'?0:TUNE.surfaces[name].rumble;
    b.rumble+=(target-b.rumble)*approach(14,dt);
    b.odo+=speed*dt;
    b.shake=b.wreck>0?0:b.rumble*Math.min(1,speed/SHAKE_SPEED);
  }
  // A piece of the surface thrown up and back by one rear wheel, sideways too when sliding.
  function spray(b: Vehicle,kind: ParticleKind,fx: number,fy: number,scale: number,sliding: boolean){
    b.wheel2=-b.wheel2;
    const side=.7*b.wheel2,x=b.x-(fx*1.2+fy*side)*scale,y=b.y+(-fy*1.2+fx*side)*scale;
    const back=kind==='dirt'?.25:.15,spread=(Math.random()-.5)*2.4,lateral=sliding?.35:0;
    const along=b.vx*fx+b.vy*fy;
    const vx=-b.vx*back-fy*spread+(b.vx-fx*along)*lateral;
    const vy=-b.vy*back+fx*spread+(b.vy-fy*along)*lateral;
    puff(x,y,kind,vx,vy,kind==='dirt'?0:kind==='sand'?2.5+Math.random()*2:1.5+Math.random()*1.5);
  }
  function wreck(c: Patrol){
    c.wreck=TUNE.wreckTime;c.vx=c.vy=0;c.trail=null;c.mesh.material=wreckPaint;c.hop=TUNE.hop;
    const far=Math.hypot(c.x-player.x,c.y-player.y);
    if(far<40)kick(c.x-player.x,c.y-player.y,.1+.4*(1-far/40));
    for(let k=0;k<6;k++)puff(c.x+Math.cos(k)*1.4,c.y+Math.sin(k)*1.4,'smoke');
    pop(c.x,c.y,TUNE.wreckBonus,'crash',false);gain(TUNE.wreckBonus);
  }

  // The simulation runs at 120 Hz. Cars are drawn between their last two steps, so a 144 Hz
  // screen, which gets one step on some frames and none on others, does not judder.
  const STEP=1/120;
  const previous=new WeakMap<Vehicle,{x: number;y: number;h: number}>();
  function remember(){
    for(const b of [player,...chasers]){
      const p=previous.get(b);
      if(p){p.x=b.x;p.y=b.y;p.h=b.h;}else previous.set(b,{x:b.x,y:b.y,h:b.h});
    }
  }
  // Moves every car to its drawn pose and returns the simulated poses to put back after drawing.
  // A respawn or restart is a jump, not motion: those cars are drawn where they are.
  function between(alpha: number){
    const saved: [Vehicle,number,number,number][]=[];
    for(const b of [player,...chasers]){
      const p=previous.get(b);
      if(!p || Math.hypot(b.x-p.x,b.y-p.y)>4)continue;
      saved.push([b,b.x,b.y,b.h]);
      b.x=p.x+(b.x-p.x)*alpha;b.y=p.y+(b.y-p.y)*alpha;b.h=p.h+wrap(b.h-p.h)*alpha;
    }
    return saved;
  }

  function frame(now: number){
    raf=requestAnimationFrame(frame);
    const airborne=aircraft && aircraft.phase!=='off';
    if(document.hidden || (!airborne && !group.visible)){last=0;return;}
    fleetCpu=0;
    const wallDt=manualLab && !steppingLab?0:(now-(last||now))/1000;last=now;
    const captureDt=capture?wallDt:0;
    let dt=Math.min(.05,wallDt);
    if(airborne){flightFrame(dt);return;}
    if(!capture){
      if(freeze)advanceStop(dt);
      else if(state==='playing' && !held){
        acc+=dt;
        for(;acc>=STEP && state==='playing' && !freeze;acc-=STEP){remember();step(STEP);}
        if(freeze)acc=0;
        // The next tile of the surface map is painted between steps, before the car reaches it.
        surfaceMap?.prefetch(player.x,player.y,player.vx,player.vy);
      }
    }
    const drawn=state==='playing' && !capture && !freeze && !held?between(acc/STEP):[];
    if(capture){
      // Use the part of the frame after the hit-stop for the result. Bound world motion on long frames.
      const stopped=Math.min(freeze,captureDt);
      if(freeze)advanceStop(stopped);
      const elapsed=captureDt-stopped;
      const motion=Math.min(.05,elapsed);
      capture.elapsed+=elapsed;
      capture.motionElapsed+=motion;
      dt=motion*CAPTURE.speed;
      if(elapsed){
        if(player.vx || player.vy || capture.patrol.vx || capture.patrol.vy)coast(capture.patrol,capture.motionElapsed,dt);
        if(capture.elapsed>=CAPTURE.summary)over.hidden=false;
        if(capture.elapsed>=CAPTURE.actions && actions.hidden){
          actions.hidden=false;
          again.focus({preventScroll:true});
        }
      }
      playerPose.release(dt);
    }
    spin+=dt*4;
    for(const b of [player,...chasers])b.hop=Math.max(0,b.hop-dt*2.2);
    const playerGround=place(player,player.h+playerPose.yaw,0,0,dt);
    const fleetRenderStart=endless && fleet?performance.now():0;
    let busSlot=0;
    if(fleet)for(const bus of fleet.active){
      const {x,y,h,braking}=bus.state;
      busViews??=makeGuaguaViews(group,paint,lightRed);
      const busView=busViews.show(busSlot++,bus.line);
      busView.mesh.position.set(x,groundAt(x,y)+.72,-y);
      busView.mesh.rotation.set(0,h,groundPitch(groundAt,x,y,h,BUS_AXLE,TILT_LIMIT));
      busView.brake.visible=braking;
    }
    for(const k of knocked){
      busViews??=makeGuaguaViews(group,paint,lightRed);
      const view=busViews.show(busSlot++,k.line),sink=k.rest<0?-k.rest/W.busSink*3.6:0;
      view.mesh.position.set(k.x,groundAt(k.x,k.y)+.72+k.lift-sink,-k.y);
      view.mesh.rotation.set(k.tumble,k.h,0);
      view.brake.visible=false;
    }
    busViews?.hideAfter(busSlot);
    if(fleetRenderStart)fleetCpu+=performance.now()-fleetRenderStart;
    const shake=player.shake,odo=player.odo;
    const shellPitch=playerPose.pitch+player.tilt*TUNE.slopeLean+shake*SHAKE_PITCH*Math.sin(odo*4.9+2);
    const shellRoll=playerPose.roll+shake*SHAKE_ROLL*Math.sin(odo*3.7+.4);
    shell.rotation.set(shellRoll,0,shellPitch);
    shell.position.y=carShellHeight(shellRoll,shellPitch);
    heading.position.copy(player.blob.position);
    heading.rotation.y=player.mesh.rotation.y;

    const lightTime=capture?capture.started+capture.motionElapsed*CAPTURE.speed*1000:now;
    chasers.forEach((c,i)=>{
      place(c,c.h+c.steer*TUNE.tailSwing*Math.min(1,c.slip/5+.25),T.MathUtils.clamp(c.side*TUNE.roll,-.32,.32),-c.dive*TUNE.dive,dt);
      c.light.visible=!c.wreck;c.light.material=(Math.floor(lightTime/140)+i)%2?lightRed:lightBlue;
    });
    beacon.scale.set(1+Math.sin(spin*.8)*.08,1,1+Math.sin(spin*.8)*.08);beacon.visible=!!route.target && !capture;
    updateEffects(dt);
    if(demolisher.update(freeze?0:dt) && renderer.shadowMap.enabled)renderer.shadowMap.needsUpdate=true;
    slug.show(shot);
    if(!freeze)rebuild(dt);
    if(cooling && !cool){cooling=false;fireButton.classList.remove('cooling');fireButton.setAttribute('aria-disabled','false');}
    // Pedestrians hold with the simulation during a hit-stop, and keep strolling before the start and after a capture.
    let walking=0,clearance=99;
    if(people){
      if(dt && !freeze && !held){
        const threats: {x:number;y:number;vx:number;vy:number}[]=[player,...chasers.filter(c=>!c.wreck)];
        if(fleet)for(const bus of fleet.active){
          const {x,y,h,speed}=bus.state,fx=Math.cos(h),fy=Math.sin(h);
          if(Math.hypot(x-player.x,y-player.y)>PEDESTRIANS.cull+20)continue;
          for(const along of [-2.4,0,2.4])threats.push({x:x+along*fx,y:y+along*fy,vx:speed*fx,vy:speed*fy});
        }
        people.update(dt,player,threats);
      }
      ({walking,clearance}=crowd.update(people,dt,player));
    }
    // Camera. The look-ahead is smoothed on its own so a wall hit never yanks the view;
    // the follow itself is tight, which keeps the car steady on screen.
    const speed=Math.hypot(player.vx,player.vy);
    const leadScale=speed?driveLookAhead(speed,TUNE.player.baseSpeed)/speed:0;
    lead.lerp(chase.set(player.vx*leadScale,0,-player.vy*leadScale),approach(TUNE.leadRate,dt));
    const cx=player.x+lead.x,cy=player.y-lead.z;
    focus.lerp(chase.set(cx,playerGround,-cy),approach(TUNE.followRate,dt));
    // Kick: a damped spring back to rest, in small steps so a long frame cannot blow it up.
    for(let n=Math.max(1,Math.ceil(dt*240)),h=dt/n;n>0;n--){
      const damp=KICK_DAMPING*2*Math.sqrt(TUNE.kickStiff);
      kickVX-=(TUNE.kickStiff*kickX+damp*kickVX)*h;kickVY-=(TUNE.kickStiff*kickY+damp*kickVY)*h;
      kickX+=kickVX*h;kickY+=kickVY*h;
    }
    const reach=Math.hypot(kickX,kickY);
    if(reach>TUNE.kickMax){kickX*=TUNE.kickMax/reach;kickY*=TUNE.kickMax/reach;}
    const nearest=Math.min(999,...chasers.filter(c=>!c.wreck).map(c=>Math.hypot(c.x-player.x,c.y-player.y)));
    paceEase+=(Math.min(1,speed/TUNE.player.baseSpeed)-paceEase)*approach(TUNE.paceRate,dt);
    threat+=(T.MathUtils.clamp((45-nearest)/30,0,1)-threat)*approach(TUNE.paceRate,dt);
    // Zoom: a little wider with speed and with patrols closing in, a slow push-in when caught.
    const wantZoom=state==='caught'?(freeze?zoomNow:1+TUNE.zoomCaught):1-TUNE.zoomSpeed*paceEase-TUNE.zoomThreat*threat;
    zoomNow+=(wantZoom-zoomNow)*approach(TUNE.paceRate*ZOOM_PACE,dt);
    const base=Math.min(host.clientWidth,host.clientHeight)/(compact?TUNE.viewSpanCompact:TUNE.viewSpanWide);
    const pose=rig.update(dt,player,cabinIsHidden);
    const zoom=base*zoomNow*pose.zoom;
    // Aim at the ground point the camera shows above the car, so the car sits lower on screen by `framing`.
    targetPoint.set(focus.x+kickX,focus.y,focus.z-kickY);
    const sway=quake.offset(wallDt);
    if(sway){targetPoint.x+=(Math.random()-.5)*sway;targetPoint.z+=(Math.random()-.5)*sway;}
    view(screenOffsetOnGround(targetPoint,targetPoint,0,-host.clientHeight*pose.framing,zoom,pose.direction),zoom,pose.direction);
    // Coins spin about the screen's vertical axis, facing the camera at the start of each turn:
    // seen from above, a coin spinning about the world's vertical never shows its whole face.
    coinMesh.count=coins.length;
    coins.forEach((c,i)=>{
      dummy.position.set(c.x,c.z+Math.sin(spin+i)*.15,-c.y);
      dummy.quaternion.copy(camera.quaternion).multiply(coinTurn.setFromAxisAngle(screenUp,spin+i*.7));dummy.scale.setScalar(1);
      dummy.updateMatrix();coinMesh.setMatrixAt(i,dummy.matrix);
    });
    coinMesh.instanceMatrix.needsUpdate=true;
    heading.visible=cabinIsHidden(pose.direction.x/pose.direction.y,-pose.direction.z/pose.direction.y);
    // HUD
    if(state!=='caught')location?.update(player.x,player.y,speed>2?Math.atan2(player.vy,player.vx):player.h,now);
    el('hud-coins').textContent=String(score);
    el('hud-time').textContent=clock(time);
    const {steer,brake}=controls.read();
    zones.left.classList.toggle('on',state==='playing' && (steer>0 || brake));
    zones.right.classList.toggle('on',state==='playing' && (steer<0 || brake));
    const target=route.target,goal=el('goal');goal.hidden=!target || state==='caught';
    if(target){
      // The destination marker sits over the place, or slides along the screen edge with its tip towards it.
      const world=activeWorld(),end=world.nodes[target.node],[gx,gy]=project(end.x,end.y,14);
      const w=host.clientWidth,h=host.clientHeight,pad=42,bottom=h-178;
      const nearLabels=Math.abs(gx-w/2)<Math.min(180,w/2);
      let top=104;
      if(nearLabels && w<=620 && street.textContent)top=124;
      if(nearLabels && barrio.textContent)top=w<=620?154:124;
      let px=T.MathUtils.clamp(gx,pad,w-pad),py=T.MathUtils.clamp(gy,top,bottom);
      const off=px!==gx || py!==gy;
      // On screen the tip points down at the beam; off screen it points at the place.
      goal.style.setProperty('--turn',(off?Math.atan2(gy-py,gx-px)+Math.PI/2:Math.PI).toFixed(2)+'rad');
      goalFlight=Math.min(1,goalFlight+dt/.45);
      let scale=1;
      if(goalFlight<1){
        const [carX,carY]=project(player.x,player.y,2),ease=1-(1-goalFlight)**3;
        const cx=T.MathUtils.clamp(carX,0,w),cy=T.MathUtils.clamp(carY,0,h);
        px=cx+(px-cx)*ease;py=cy+(py-cy)*ease;scale=.5+.5*ease;
      }
      goal.style.transform='translate('+px.toFixed(1)+'px,'+py.toFixed(1)+'px) scale('+scale.toFixed(3)+')';
      // Straight-line distance, like the tip: a road distance jumps whenever the nearest road changes.
      const metres=Math.hypot(end.x-player.x,end.y-player.y);
      const text=metres>=995?(metres/1000).toFixed(1)+'km':Math.round(metres/10)*10+'m';
      if(text!==goalText){goalText=text;goalLabel.textContent=text;}
    }
    for(const [b,x,y,h] of drawn){b.x=x;b.y=y;b.h=h;}
    if(endless && host.dataset.labReady==='true'){
      const active=fleet?.active.map(({id,line,direction,state})=>({id,line,direction,...state}))??[];
      const pilot=active.find(b=>b.line==='13' && b.direction==='Tres Palmas');
      if(pilot)host.dataset.guagua=[pilot.x,pilot.y,pilot.distance,pilot.speed,pilot.stopped,Number(pilot.braking)].join(',');
      else delete host.dataset.guagua;
      host.dataset.guaguas=JSON.stringify({active,errors:fleet?.errors??[],cpuMs:fleetCpu,steps:fleetSteps});
    }
    host.dataset.drive=[held?'held':state,score,player.x.toFixed(1),player.y.toFixed(1),wrap(player.h).toFixed(2),chasers.length,coins.length,nearest.toFixed(0),zoomNow.toFixed(3),renderer.info.programs?.length??0,stops,Math.hypot(kickX,kickY).toFixed(2),walking,clearance.toFixed(1)].join(',');
  }

  // Compile every material the mode can show before the first frame, so the first skid,
  // wreck or siren does not stall on a shader build. Materials that only appear later
  // (wreck paint, siren lamps) get stand-in meshes for the duration of the compile.
  function warm(){
    if(warmed)return;
    warmed=true;
    const stand=[wreckPaint,lightRed,lightBlue,paint].map(material=>new T.Mesh(material===paint?policeGeometry:lightGeometry,material));
    group.add(...stand);
    try{renderer.compile(scene,camera);}catch{}
    group.remove(...stand);
  }
  const available=pois.length>0 && data.roads.length>0;
  // Road graph, surface map, walls of the zones in memory, walkers: seconds of work on a slow phone, in steps that
  // leave room for a frame between them. The walkers come last, so they tell that all of it is there.
  function* build(){
    if(!world){world=buildDriveWorld(data,altitude,TUNE,zoning,fallen);yield;}
    if(!surfaceMap){surfaceMap=makeSurfaceMap(data.roads,data.surfaces,streets);yield;}
    for(const [id,zone] of zoning?.resident??[]){world.addZone(id,zone.buildings,zone.trees);yield;}
    people??=makePedestrians(data.roads,data.surfaces,world,WALKERS);
  }
  again.onclick=()=>{
    if(state!=='caught' || actions.hidden)return;
    const start=nextStart();
    if(start){restart(start);host.focus({preventScroll:true});}
  };
  el('leave').onclick=()=>onExit();
  let policing=police,fixedStart: Point | undefined;
  return {
    get flightWaiting(){return flightWaiting;},
    get flightView(){return aircraft && aircraft.phase!=='off'?aircraft:undefined;},
    get active(){return state!=='off';},
    /** The player's body and the patrols on the road, for the lab's readout. */
    get player(): Readonly<Vehicle>{return player;},
    get patrols(){return chasers.length;},
    roadRunLab(x:number,y:number,h:number,stars:number){
      if(!endless || !world || !Number.isInteger(stars) || stars<1 || stars>5 ||
        !Number.isFinite(x+y+h) || !world.free(x,y,TUNE.radius))throw new Error('Invalid road fixture');
      const node=world.nearestNode(x,y);
      if(node<0)throw new Error('Missing road');
      restart(world.nodes[node]);
      const pace=TUNE.player.baseSpeed;
      Object.assign(player,{x,y,h,vx:pace*Math.cos(h),vy:pace*Math.sin(h),gear:pace});
      rig.startHeading(h);focus.set(x,groundAt(x,y),-y);
      for(let level=1;level<stars;level++){
        const seconds=POLICE.thresholds[level]-POLICE.thresholds[level-1];
        director.update({dt:seconds,anyVisible:false,closestDistance:Infinity});time+=seconds;
      }
      showStars(stars);
    },
    advanceLab(seconds:number,steer:number,brake:boolean){
      if(!endless || !raf || !world || !group.visible || document.hidden || state==='off')return;
      if(!Number.isFinite(seconds) || seconds<=0 || seconds>180 || ![-1,0,1].includes(steer))throw new Error('Invalid lab input');
      labInput={steer,brake};go();manualLab=steppingLab=true;
      let now=performance.now();
      last=now;
      try{
        const frames=Math.ceil(seconds*30),frameMs=seconds*1000/frames;
        for(let i=0;i<frames;i++){
          cancelAnimationFrame(raf);
          now+=frameMs;frame(now);
        }
      }finally{last=performance.now();labInput=undefined;steppingLab=false;}
      return host.dataset.police?JSON.parse(host.dataset.police):undefined;
    },
    replayInputs(inputs:readonly RecordedInput[]){
      if(!endless || state==='off')return;
      if(!Array.isArray(inputs) || !inputs.length || inputs[0].tick!==0 ||
        inputs.some((v,i)=>!Number.isSafeInteger(v.tick) || (i>0 && inputs[i-1].tick>=v.tick) ||
          ![-1,0,1].includes(v.steer) || typeof v.brake!=='boolean'))throw new Error('Invalid drive replay');
      const start=activeWorld().nodes[lastStart??-1];
      if(start){restart(start);replay=inputs.map(v=>({...v}));go();}
    },
    inputLog(){return recordedInputs.map(v=>({...v}));},
    policeTrace(){
      const samples=trace.length<traceLimit?trace:[...trace.slice(traceCursor),...trace.slice(0,traceCursor)];
      return samples.map(sample=>JSON.parse(sample));
    },
    /** Patrols on or off during a run. Turning them off clears the streets. */
    setPolice(on: boolean){
      secondsOutOfView=0;policing=on;director.reset();staging=undefined;arrivalPending=false;perceptionAge=0;spawnDelay=0;showStars(on?1:0);
      if(!on){for(const c of chasers)group.remove(c.mesh,c.blob);chasers=[];}
    },
    /** Lab checks: a shot at a map point as if it were at the centre of the screen. False while the gun cools. */
    fireAt(x: number,y: number){
      if(!endless)return false;
      go();
      return fire(new T.Vector3(x,altitude(x,y),-y));
    },
    /** Lab checks: the gun, what it brought down and threw. */
    get gun(){return {cool,flying:!!shot,demolished:demolisher.demolished.size,pieces:demolisher.pieces,ruins:ruins.length,
      lastDown:ruins.at(-1)?{id:ruins.at(-1)!.id,members:ruins.at(-1)!.members.length}:null,
      knockedBuses:knocked.length,wrecks:chasers.filter(c=>c.wreck).length};},
    /** Every run from now on starts at the road node nearest to this point. */
    startAt(point: Point){fixedStart=point;},
    /** Back to the start with a fresh run. */
    respawn(){
      const node=state==='off'?undefined:nextStart();
      if(node){clearCapture();restart(node);}
    },
    /** Reapply the tuning values that are read only when a car is built. */
    retune(){field=null;routeAge=1;sideRoutes.clear();staging=undefined;Object.assign(interceptorProfile,TUNE.patrol,{topSpeed:TUNE.patrol.topSpeed*1.08,turn:TUNE.patrol.turn*.85});for(const c of [player,...chasers])c.mesh.scale.setScalar(TUNE.visualScale);},
    get desaturation(){return capture?T.MathUtils.smoothstep(capture.elapsed,0,CAPTURE.grade):0;},
    get visualTimeScale(){return capture?(freeze?0:CAPTURE.speed):1;},
    /** False when the city has no places or no roads to drive on. */
    available,
    /** Whether the road graph, the walls and the walkers are in memory. `enter` builds what is missing in one go. */
    get built(){return !!people;},
    /** The same work as `enter` would do, one step per `next()`, for a caller that draws between the steps. */
    build,
    /** The map alone does not pay for the drive: outside a run, free what `build` made. */
    release(){
      if(state!=='off')return;
      world=null;people=null;field=null;route.clear();
    },
    enter(): 'started' | 'unavailable'{
      if(state!=='off')return 'started';
      if(!available)return 'unavailable';
      if(!people)for(const _ of build());
      const start=nextStart();
      if(!start)return 'unavailable';
      location??=makeDriveLocation(data.roads,street,barrio);
      scene.add(group);
      const mapOffset=camera.getWorldDirection(new T.Vector3()).negate();
      rig.enter(mapOffset);showMode();
      controls.activate();
      el('hud').hidden=false;
      if(buses)fleet=makeLocalFleet(busArea,inCameraFrame,busOccupied);
      warm();
      restart(start);
      // Glide in from the map zoom instead of cutting to the play zoom.
      zoomNow=T.MathUtils.clamp(camera.zoom/(Math.min(host.clientWidth,host.clientHeight)/(compact?TUNE.viewSpanCompact:TUNE.viewSpanWide)),.35,1.6);
      focus.copy(camera.position).addScaledVector(mapOffset,-CAMERA_DISTANCE);
      last=0;raf=requestAnimationFrame(frame);
      return 'started';
    },
    exit(){
      if(state==='off')return;
      endFlight();state='off';runGeneration++;cancelAnimationFrame(raf);raf=0;scene.remove(group);group.visible=true;
      // The pieces in the air settle at once; buildings whose sectors are out of view stand again.
      demolisher.update(Infinity);rebuild(0,true);
      shot=null;knocked.length=0;
      settleTrees(Infinity);
      fleet?.dispose();fleet=undefined;busViews?.dispose();busViews=undefined;
      controls.deactivate();
      location?.reset();
      held=false;
      el('hud').hidden=true;clearCapture();guide.className='';el('pops').replaceChildren();
      delete host.dataset.police;delete host.dataset.drive;delete host.dataset.guagua;delete host.dataset.guaguas;
    },
    /** A zone arrived with its footprints, or left with `null`. */
    zone(id: string,content: ZoneData | null){
      field=null;routeAge=1;sideRoutes.clear();staging=undefined;
      if(content)world?.addZone(id,content.buildings,content.trees);else world?.removeZone(id);
    },
    visibilityChanged(){
      last=0;aircraft?.release();
      if(capture)over.toggleAttribute('data-paused',document.hidden || !raf);
    },
    // Graphics interruption: stop drawing and stepping, drop any touch in progress, keep the run.
    suspend(){
      if(state==='off')return;
      cancelAnimationFrame(raf);raf=0;controls.release();aircraft?.release();
      resetSteering(player);
      if(capture){over.inert=true;over.dataset.paused='';}
      else playerPose.reset();
      if(state==='playing' && (!aircraft || aircraft.phase==='off')){held=true;guide.className='ready';}
    },
    resume(){
      if(state==='off' || raf)return;
      warmed=false;warm();
      over.inert=false;
      if(capture)over.toggleAttribute('data-paused',document.hidden);
      last=0;acc=0;raf=requestAnimationFrame(frame);
    }
  };
}
