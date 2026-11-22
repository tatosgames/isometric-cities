import { carGeometry, carVisualScale, tint } from './car-model.ts';
import type { Altitude, CityData, Place, Point } from '../data/types.ts';
import { element as el } from '../map/dom.ts';
import { required } from '../required.ts';
import type { Body } from './drive-physics.ts';
import type { routesFrom } from './road-routing.ts';
import {BUILDING_BIT,surfaceStencil} from '../render/building-stencil.ts';
import {buildDriveWorld} from './drive-world.ts';
import {makeDrivePhysics} from './drive-physics.ts';
import {makeDrivePose} from './drive-pose.ts';
import {makeDriveCamera} from './drive-camera.ts';
import {makeDriveRoute} from './drive-route.ts';
import type { RouteEvent } from './drive-route.ts';
import { chooseStartNode, type RoadNode } from './road-routing.ts';
import {makeDriveInput} from './drive-input.ts';
import {makePedestrians} from './pedestrians.ts';
import {breezy} from '../render/wind.ts';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

interface DriveOptions {
  scene: T.Scene;
  camera: T.OrthographicCamera;
  renderer: T.WebGLRenderer;
  host: HTMLElement;
  data: CityData;
  locations: Place[];
  altitude: Altitude;
  view: (target: T.Vector3, zoom: number, offset: T.Vector3) => void;
  mapDirection: T.Vector3;
  compact: boolean;
  onExit: () => void;
}

interface Vehicle extends Body {
  mesh: T.Mesh<T.BufferGeometry,T.MeshStandardMaterial>;
  blob: T.Mesh;
  hop: number;
  wreck: number;
  stuck: number;
  max: number;
  trail: [number,number,number][] | null;
  puff: number;
  node: number;
}

interface Patrol extends Vehicle {
  light: T.Mesh<T.BoxGeometry,T.MeshBasicMaterial>;
}

type DriveState = 'off' | 'ready' | 'playing' | 'caught';
type RouteField = ReturnType<typeof routesFrom>;


// Every gameplay number lives here. Metres, seconds, radians.
export const TUNE={
  maxSpeed:16.5, accel:9, turn:2.6, turnRamp:.2, grip:7.5, driftGrip:3.2, driftDrag:.035, brake:16, brakeGrip:2.2,
  deflect:4.5,
  // Juice: visual only, no effect on collisions.
  roll:.035, tailSwing:.3, hop:.5, dive:.09, skidSpeed:4,
  poseYaw:T.MathUtils.degToRad(21), poseRoll:T.MathUtils.degToRad(10), poseYawLimit:T.MathUtils.degToRad(45),
  poseMinSpeed:2, poseFullSpeed:10, poseAttack:.085, poseRelease:.17, poseReverse:.04,
  // Hit-stop: seconds of held simulation per event, the wall impact that earns one and the least gap between two.
  stopImpact:9, stopWall:.055, stopArrive:.05, stopCaught:.11, stopGap:.6,
  // Camera kick: launch speed of a full hit (m/s), spring back to rest, hard limit in metres.
  kick:36, kickStiff:220, kickDamp:22, kickMax:1.2,
  // Camera: slow, small and never driven by single hits, so it reads as breathing rather than pumping.
  zoomSpeed:.1, zoomThreat:.08, zoomCaught:.14, zoomRate:1.1, paceRate:.7, leadRate:2.4, followRate:9,
  radius:1.15, treeRadius:.3, treeClearance:4.5, bounce:.3, wallLoss:.6, visualScale:carVisualScale,
  catchSpeed:4.5, catchReach:4, grace:2.5,
  chaserEvery:18, chaserSpeed:1.04, chaserSpeedStep:.02, chaserSpeedMax:1.16, chaserTurn:.8, chaserSight:45, chaserLost:170, wreckImpact:11.5, wreckTime:3, stuckTime:2,
  coinStep:8, coinReach:2.6, magnet:6, coinPullSpeed:25, arriveReach:16, arriveBonus:10, wreckBonus:2,
  viewSpanCompact:62, viewSpanWide:95, lookAhead:.42
};
const SKIDS=600, DUST=48, COINS=220;
const wrap=(a: number)=>Math.atan2(Math.sin(a),Math.cos(a));

export function makeDrive({scene,camera,renderer,host,data,locations,altitude,view,mapDirection,compact,onExit}: DriveOptions){
  let world: ReturnType<typeof buildDriveWorld> | null=null;
  const activeWorld=()=>required(world,"drive world");
  const {steerBody,collide,bump}=makeDrivePhysics(TUNE);
  const playerPose=makeDrivePose(TUNE);
  const rig=makeDriveCamera(mapDirection);
  const button=el('drive-camera');
  function showMode(){
    button.title='Cambiar cámara (C) · '+rig.label;
    button.setAttribute('aria-label',button.title);
    button.dataset.mode=rig.mode;
  }
  function cycleCamera(){
    if(state==='off' || state==='caught' || !raf)return;
    rig.cycle();showMode();
  }
  // A second finger can tap while the primary pointer keeps steering.
  button.onpointerup=e=>{
    if(e.pointerType==='touch' && document.elementFromPoint(e.clientX,e.clientY)?.closest('button')===button){
      cycleCamera();host.focus({preventScroll:true});
    }
  };
  button.onclick=e=>{
    if(e instanceof PointerEvent && e.pointerType==='touch')return;
    cycleCamera();host.focus({preventScroll:true});
  };
  const controls=makeDriveInput(host,go,onExit,cycleCamera);
  function routes(source: number){
    if(field?.source===source)return field;
    field=activeWorld().routesFrom(source);
    return field;
  }

  // ---- scene objects ----
  const group=new T.Group();
  const paint=new T.MeshStandardMaterial({...surfaceStencil(),vertexColors:true,flatShading:true,roughness:.8});
  const playerGeometry=carGeometry('#d8452f','#f4ead7',false),policeGeometry=carGeometry('#f3f3ee','#2b3440',true);
  const wreckPaint=new T.MeshStandardMaterial({...surfaceStencil(),color:'#3a3a3a',flatShading:true,roughness:1});
  const blobGeometry=new T.CircleGeometry(2.3,16).rotateX(-Math.PI/2);
  const blobMaterial=new T.MeshBasicMaterial({color:'#15170f',transparent:true,opacity:.26,depthWrite:false});
  function vehicle(geometry: T.BufferGeometry): Vehicle{
    const mesh=new T.Mesh(geometry,paint),blob=new T.Mesh(blobGeometry,blobMaterial);
    mesh.scale.setScalar(TUNE.visualScale);group.add(mesh,blob);
    mesh.rotation.order='YXZ';
    return {x:0,y:0,h:0,vx:0,vy:0,slip:0,side:0,hold:0,steer:0,hop:0,dive:0,way:1,wayHold:0,hitX:0,hitY:0,mesh,blob,wreck:0,stuck:0,max:0,trail:null,puff:0,node:-1};
  }
  const lightGeometry=new T.BoxGeometry(.3,.24,1.05).translate(-.2,1.66,0);
  const lightRed=new T.MeshBasicMaterial({...surfaceStencil(),color:'#ff3b30'}),lightBlue=new T.MeshBasicMaterial({...surfaceStencil(),color:'#2f7bff'});
  function patrol(){
    const c=vehicle(policeGeometry);
    const light=new T.Mesh(lightGeometry,lightRed);
    c.mesh.add(light);
    return Object.assign(c,{light});
  }
  const player=vehicle(playerGeometry);
  const silhouette=new T.Mesh(playerGeometry,new T.MeshBasicMaterial({
    color:'#ffd84a',toneMapped:false,transparent:true,blending:T.NoBlending,
    depthFunc:T.GreaterDepth,depthWrite:false,
    stencilWrite:true,stencilWriteMask:0,stencilFuncMask:BUILDING_BIT,
    stencilFunc:T.EqualStencilFunc,stencilRef:BUILDING_BIT
  }));
  // Read the completed opaque depth and building mask before transparent effects.
  silhouette.renderOrder=-1;
  player.mesh.add(silhouette);
  const beacon=new T.Mesh(new T.CylinderGeometry(3.2,3.2,26,20,1,true).translate(0,13,0),new T.MeshBasicMaterial({color:'#ffd84a',transparent:true,opacity:.22,depthWrite:false,side:T.DoubleSide}));
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
    const height=player.mesh.position.y+1.2*TUNE.visualScale;
    return activeWorld().occluded(player.x,player.y,height,dx,dy);
  }
  const dummy=new T.Object3D();
  const coinMesh=new T.InstancedMesh(new T.CylinderGeometry(1.15,1.15,.24,14).rotateX(Math.PI/2),new T.MeshStandardMaterial({...surfaceStencil(),color:'#ffcf24',emissive:'#b07a00',roughness:.4,flatShading:true}),COINS);
  coinMesh.frustumCulled=false;coinMesh.count=0;group.add(coinMesh);
  const skidPositions=new Float32Array(SKIDS*18);
  const skidGeometry=new T.BufferGeometry();skidGeometry.setAttribute('position',new T.BufferAttribute(skidPositions,3));
  const skidMesh=new T.Mesh(skidGeometry,new T.MeshBasicMaterial({color:'#1d1c1f',transparent:true,opacity:.34,depthWrite:false,side:T.DoubleSide}));
  skidMesh.frustumCulled=false;group.add(skidMesh);
  const dustMesh=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshBasicMaterial({transparent:true,opacity:.5,depthWrite:false}),DUST);
  // Colours exist from the start: adding them at the first puff would build a second shader mid-run.
  for(let i=0;i<DUST;i++)dustMesh.setColorAt(i,new T.Color('#d8cdbb'));
  dustMesh.frustumCulled=false;group.add(dustMesh);
  const dust=Array.from({length:DUST},()=>({x:0,y:0,z:0,life:0}));
  const dustColour=new T.Color('#d8cdbb'),smokeColour=new T.Color('#3b3836');
  // Pedestrians: legless toy figures that get about by hopping, larger than life like the cars.
  // A tinted body and a fixed head share one matrix per walker, so the body colour does not tint the skin.
  const WALKERS=compact?26:40;
  const figure=()=>breezy(new T.MeshStandardMaterial({...surfaceStencil(),flatShading:true,roughness:1}));
  const torsoMesh=new T.InstancedMesh(new T.CylinderGeometry(.34,.52,1.45,8).translate(0,.725,0),figure(),WALKERS);
  const limbs=figure();limbs.vertexColors=true;
  const restMesh=new T.InstancedMesh(tint(new T.IcosahedronGeometry(.4,1).translate(0,1.78,0),'#e0b48e'),limbs,WALKERS);
  const shirts=['#d9614c','#e8c25a','#5b8fb9','#6aa27a','#f1ebe0','#8d6bb0','#e58f4f'].map(c=>new T.Color(c));
  for(let i=0;i<WALKERS;i++)torsoMesh.setColorAt(i,shirts[i%shirts.length]);
  torsoMesh.frustumCulled=restMesh.frustumCulled=false;group.add(torsoMesh,restMesh);
  let people: ReturnType<typeof makePedestrians> | null=null;
  const shown=new Float32Array(WALKERS),lifted=new Float32Array(WALKERS),wasAlive=new Uint8Array(WALKERS);
  let skidAt=0,dustAt=0;
  function puff(x: number,y: number,dark: boolean){
    const p=dust[dustAt];
    Object.assign(p,{x,y,z:altitude(x,y)+1,life:1});
    dustMesh.setColorAt(dustAt,dark?smokeColour:dustColour);if(dustMesh.instanceColor)dustMesh.instanceColor.needsUpdate=true;
    dustAt=(dustAt+1)%DUST;
  }
  function skid(b: Vehicle,fx: number,fy: number,scale: number){
    const now: NonNullable<Vehicle["trail"]>=[];
    for(const side of [-.7,.7]){
      const x=b.x-(fx*1.1+fy*side)*scale,y=b.y+(-fy*1.1+fx*side)*scale;
      now.push([x,altitude(x,y)+.78,-y]);
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
  }
  function place(b: Vehicle,yaw: number,roll: number){
    const z=altitude(b.x,b.y);
    b.mesh.position.set(b.x,z+.72+b.hop,-b.y);
    b.mesh.rotation.set(roll,yaw,-b.dive*TUNE.dive);
    b.blob.position.set(b.x,z+.76,-b.y);
  }

  // ---- game state ----
  let state: DriveState='off';
  let score=0,time=0,record=0,raf=0,last=0,acc=0,grace=0,spin=0,routeAge=1,overAt=0,held=false,warmed=false,lastStart: number | undefined;
  let steerTime=0,steerDirection=0;
  let chasers: Patrol[]=[];
  let field: RouteField | null=null;
  let zoomNow=1,paceEase=0,threat=0;
  let freeze=0,stopCool=0,stops=0,kickX=0,kickY=0,kickVX=0,kickVY=0;
  let release: (() => void) | null=null;
  const lead=new T.Vector3(),screen=new T.Vector3();
  const focus=new T.Vector3();
  const pois=locations.map((f,i)=>({name:f.properties.name,number:String(i+1).padStart(2,'0'),x:f.properties.xy[0],y:f.properties.xy[1]}));
  const route=makeDriveRoute(pois,altitude,TUNE,COINS);
  const {coins}=route;
  try{record=Number(localStorage.getItem('drive-record'))||0;}catch{}
  const clock=(s: number)=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  const guide=el('guide'),zones={left:required(guide.querySelector('.left'),'left guide'),right:required(guide.querySelector('.right'),'right guide')};
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
  // Camera kick towards whatever hit, along (dx,dy) in map coordinates. Strength 0 to 1.
  function kick(dx: number,dy: number,strength: number){
    const d=Math.hypot(dx,dy);
    if(d<1e-5)return;
    kickVX+=dx/d*strength*TUNE.kick;kickVY+=dy/d*strength*TUNE.kick;
  }
  function trail(){
    const world=activeWorld();
    const from=world.nearestNode(player.x,player.y);
    const next=route.choose(world,routes(from));
    if(!next)return null;
    const {target,path}=next;
    const end=world.nodes[target.node];
    beacon.position.set(end.x,altitude(end.x,end.y),-end.y);
    required(el('goal').querySelector('b'),'goal label').textContent=target.poi.number;
    el('hud-live').textContent='Destino: '+target.poi.name;
    return path;
  }
  function handleRouteEvent(event: RouteEvent){
    if(event.type==='coin'){
      pop(event.coin.x,event.coin.y,event.points,'coin',false);
      gain(event.points);buzz(8);
      return;
    }
    pop(player.x,player.y,event.points,'coin',true);
    gain(event.points);buzz(40);stop(TUNE.stopArrive);
    for(let k=0;k<8;k++)puff(player.x+Math.cos(k*.8)*2.5,player.y+Math.sin(k*.8)*2.5,false);
    trail();
  }
  function spawnChaser(c: Patrol){
    const world=activeWorld();
    const all=world.validNodes;
    const ring=all.filter(i=>{
      const d=Math.hypot(world.nodes[i].x-player.x,world.nodes[i].y-player.y);
      return d>75 && d<120;
    });
    // Half of the patrols come from where the player is heading.
    const ahead=ring.filter(i=>(world.nodes[i].x-player.x)*player.vx+(world.nodes[i].y-player.y)*player.vy>0);
    const pool=ahead.length && Math.random()<.5?ahead:ring.length?ring:all;
    const index=pool[Math.floor(Math.random()*pool.length)],n=world.nodes[index];
    const next=(field ? world.nodes[field.prev[index]] : undefined) ?? player;
    Object.assign(c,{x:n.x,y:n.y,vx:0,vy:0,h:Math.atan2(next.y-n.y,next.x-n.x),wreck:0,stuck:0,trail:null,node:index,hold:0,steer:0,side:0});
    c.max=TUNE.maxSpeed*Math.min(TUNE.chaserSpeedMax,TUNE.chaserSpeed+TUNE.chaserSpeedStep*Math.floor(time/TUNE.chaserEvery));
    c.mesh.material=paint;c.mesh.visible=c.blob.visible=true;
  }
  function nextStart(){
    const world=activeWorld();
    const index=chooseStartNode(world.nodes,world.validNodes,world.free,10,Math.random,lastStart);
    if(index===undefined)return undefined;
    lastStart=index;
    return world.nodes[index];
  }
  function restart(n: RoadNode){
    for(const c of chasers)group.remove(c.mesh,c.blob);
    chasers=[];held=false;freeze=stopCool=kickX=kickY=kickVX=kickVY=0;release=null;score=0;time=0;grace=TUNE.grace;acc=0;routeAge=1;field=null;route.clear();
    steerTime=steerDirection=0;
    playerPose.reset();
    skidPositions.fill(0);skidGeometry.attributes.position.needsUpdate=true;
    for(const p of dust)p.life=0;
    Object.assign(player,{x:n.x,y:n.y,vx:0,vy:0,h:0,trail:null,hold:0,steer:0,side:0,hop:0,dive:0});
    paceEase=0;threat=0;lead.set(0,0,0);el('pops').replaceChildren();
    people?.reset(player);shown.fill(0);
    const path=trail();
    if(path?.[1])player.h=Math.atan2(path[1].y-n.y,path[1].x-n.x);
    rig.startHeading(player.h);
    focus.set(player.x,altitude(player.x,player.y),-player.y);
    el('over').hidden=true;guide.className='ready';
    state='ready';
  }
  function caught(by: Vehicle){
    state='caught';buzz(140);guide.className='';
    kick(by.x-player.x,by.y-player.y,1);
    // The contact holds for a beat; dust and the push-in start when it lets go.
    stop(TUNE.stopCaught,()=>{for(let k=0;k<6;k++)puff(player.x+Math.cos(k)*1.5,player.y+Math.sin(k)*1.5,false);});
    const best=score>record;
    if(best){record=score;try{localStorage.setItem('drive-record',String(record));}catch{}}
    el('over-coins').textContent=String(score);el('over-time').textContent=clock(time);el('over-record').textContent=String(record);
    required(el('over-record').parentElement,'record stat').classList.toggle('new',best);
    el('hud-live').textContent='Atrapado. '+score+' monedas en '+Math.round(time)+' segundos.'+(best?' Nuevo rÃ©cord.':'');
    // A beat on the frozen scene before the result slides in.
    overAt=performance.now()+420+TUNE.stopCaught*1000;
  }

  function go(){
    if(state==='ready'){state='playing';guide.className='play';}
    // A run held after an interruption continues on the next input, never by itself.
    if(held){held=false;guide.className='play';}
  }
  // ---- simulation ----
  function step(dt: number){
    const world=activeWorld();
    time+=dt;grace=Math.max(0,grace-dt);stopCool=Math.max(0,stopCool-dt);
    const {steer,brake}=controls.read();
    if(steer!==steerDirection){steerTime=0;steerDirection=steer;}
    if(steer)steerTime=Math.min(TUNE.turnRamp,steerTime+dt);
    steerBody(player,steer,brake,TUNE.maxSpeed,dt,steerTime/TUNE.turnRamp);
    const knock=collide(player,world);
    if(knock>3)player.hop=Math.min(TUNE.hop,knock*.05);
    if(knock>6){kick(player.hitX,player.hitY,Math.min(1,knock/14));buzz(18);}
    // Only a hard, nearly head-on hit stops time, and not twice in a row: scraping along a street never does.
    if(knock>TUNE.stopImpact && !stopCool){stop(TUNE.stopWall);stopCool=TUNE.stopGap;}
    const speed=Math.hypot(player.vx,player.vy);
    routeAge+=dt;
    if(routeAge>.6){routeAge=0;field=routes(world.nearestNode(player.x,player.y));}
    const wanted=Math.min(compact?6:8,1+Math.floor(time/TUNE.chaserEvery));
    while(chasers.length<wanted){const c=patrol();chasers.push(c);spawnChaser(c);}
    for(const c of chasers){
      if(c.wreck>0){
        c.wreck-=dt;c.puff-=dt;c.h+=dt*14*Math.max(0,c.wreck-TUNE.wreckTime+.45);
        if(c.puff<=0){c.puff=.12;puff(c.x,c.y,true);}
        if(c.wreck<=0)spawnChaser(c);
        continue;
      }
      let tx=player.x+player.vx*.4,ty=player.y+player.vy*.4;
      const gap=Math.hypot(player.x-c.x,player.y-c.y);
      if(gap>TUNE.chaserLost){spawnChaser(c);continue;}
      if(gap>TUNE.chaserSight || !world.sight(c.x,c.y,player.x,player.y)){
        // Follow the road graph node by node: straight lines between nodes stay clear of buildings.
        let n=world.nodes[c.node];
        if(!n || Math.hypot(n.x-c.x,n.y-c.y)>60){c.node=world.nearestNode(c.x,c.y);n=world.nodes[c.node];}
        const prev=required(field,"route field").prev;
        for(let hop=0;hop<3 && prev[c.node]>=0 && Math.hypot(n.x-c.x,n.y-c.y)<5;hop++){c.node=prev[c.node];n=world.nodes[c.node];}
        tx=n.x;ty=n.y;
      }else c.node=-1;
      let turn=T.MathUtils.clamp(wrap(Math.atan2(ty-c.y,tx-c.x)-c.h)*2.5,-1,1);
      for(const side of [-1,1])if(world.near(c.x+Math.cos(c.h+side*.45)*6,c.y+Math.sin(c.h+side*.45)*6,1.2))turn-=side*.9;
      const ahead=world.near(c.x+Math.cos(c.h)*4,c.y+Math.sin(c.h)*4,1.1);
      steerBody(c,T.MathUtils.clamp(turn,-1,1),ahead && Math.hypot(c.vx,c.vy)>8,c.max,dt,TUNE.chaserTurn);
      const hit=collide(c,world),pace=Math.hypot(c.vx,c.vy);
      if(hit>3)c.hop=Math.min(TUNE.hop,hit*.05);
      c.stuck=pace<1.5?c.stuck+dt:0;
      if(hit>TUNE.wreckImpact)wreck(c);
      else if(c.stuck>TUNE.stuckTime)spawnChaser(c);
    }
    for(let i=0;i<chasers.length;i++){
      const a=chasers[i];
      for(let j=i+1;j<chasers.length;j++){
        const impact=bump(a,chasers[j]);
        if(impact>TUNE.wreckImpact && !a.wreck && !chasers[j].wreck){wreck(a);wreck(chasers[j]);}
      }
      const shove=bump(a,player);
      if(shove>6)kick(a.x-player.x,a.y-player.y,Math.min(1,shove/14)*.7);
      // Close enough counts as contact: a tree or a corner must not save a stopped car.
      if(!a.wreck && !grace && speed<TUNE.catchSpeed && Math.hypot(a.x-player.x,a.y-player.y)<TUNE.catchReach){
        playerPose.update(player,steer,dt);
        caught(a);return;
      }
    }
    const playerSlip=playerPose.update(player,steer,dt);
    route.advance(player,world.nodes,dt,handleRouteEvent);
    for(const b of [player,...chasers]){
      const isPlayer=b===player;
      if(b.wreck>0 || (isPlayer?playerSlip:b.slip)<TUNE.skidSpeed){b.trail=null;continue;}
      const yaw=b.h+(isPlayer?playerPose.yaw:0),fx=Math.cos(yaw),fy=Math.sin(yaw);
      const scale=isPlayer?TUNE.visualScale:1;
      skid(b,fx,fy,scale);b.puff-=dt;
      if(b.puff<=0){b.puff=.07;puff(b.x-fx*1.3*scale,b.y-fy*1.3*scale,false);}
    }
  }
  function wreck(c: Patrol){
    c.wreck=TUNE.wreckTime;c.vx=c.vy=0;c.trail=null;c.mesh.material=wreckPaint;c.hop=TUNE.hop;
    const far=Math.hypot(c.x-player.x,c.y-player.y);
    if(far<40)kick(c.x-player.x,c.y-player.y,.1+.4*(1-far/40));
    for(let k=0;k<6;k++)puff(c.x+Math.cos(k)*1.4,c.y+Math.sin(k)*1.4,true);
    pop(c.x,c.y,TUNE.wreckBonus,'crash',false);gain(TUNE.wreckBonus);
  }

  function frame(now: number){
    raf=requestAnimationFrame(frame);
    const dt=Math.min(.05,(now-last)/1000||0);last=now;
    if(freeze){
      freeze=Math.max(0,freeze-dt);
      if(!freeze){release?.();release=null;}
    }else if(state==='playing' && !held){
      acc+=dt;
      for(;acc>=1/120 && state==='playing' && !freeze;acc-=1/120)step(1/120);
      if(freeze)acc=0;
    }else if(state==='caught'){
      playerPose.release(dt);
    }
    spin+=dt*4;
    for(const b of [player,...chasers])b.hop=Math.max(0,b.hop-dt*2.2);
    place(player,player.h+playerPose.yaw,playerPose.roll);
    heading.position.copy(player.blob.position);
    heading.rotation.y=player.mesh.rotation.y;

    chasers.forEach((c,i)=>{
      place(c,c.h+c.steer*TUNE.tailSwing*Math.min(1,c.slip/5+.25),T.MathUtils.clamp(c.side*TUNE.roll,-.32,.32));
      c.light.visible=!c.wreck;c.light.material=(Math.floor(now/140)+i)%2?lightRed:lightBlue;
    });
    beacon.scale.set(1+Math.sin(spin*.8)*.08,1,1+Math.sin(spin*.8)*.08);beacon.visible=!!route.target;
    coinMesh.count=coins.length;
    coins.forEach((c,i)=>{
      dummy.position.set(c.x,c.z+Math.sin(spin+i)*.15,-c.y);dummy.rotation.set(0,spin+i*.7,0);dummy.scale.setScalar(1);
      dummy.updateMatrix();coinMesh.setMatrixAt(i,dummy.matrix);
    });
    coinMesh.instanceMatrix.needsUpdate=true;
    dust.forEach((p,i)=>{
      p.life=Math.max(0,p.life-dt*1.5);
      dummy.position.set(p.x,p.z+(1-p.life)*1.6,-p.y);dummy.rotation.set(0,0,0);dummy.scale.setScalar(p.life?.5+(1-p.life)*1.5:0);
      dummy.updateMatrix();dustMesh.setMatrixAt(i,dummy.matrix);
    });
    dustMesh.instanceMatrix.needsUpdate=true;
    // Pedestrians hold with the simulation during a hit-stop, and keep strolling before the start and after a capture.
    let walking=0,clearance=99;
    if(people){
      if(!freeze && !held)people.update(dt,player,[player,...chasers.filter(c=>!c.wreck)]);
      people.walkers.forEach((w,i)=>{
        if(w.alive && !wasAlive[i])shown[i]=0;
        wasAlive[i]=w.alive?1:0;
        shown[i]+=((w.alive?1:0)-shown[i])*Math.min(1,dt*7);
        lifted[i]+=((w.air>0?2.7:0)-lifted[i])*Math.min(1,dt*16);
        const fleeing=w.alarm>0;
        if(w.alive){walking++;if(!w.air)clearance=Math.min(clearance,Math.hypot(w.x-player.x,w.y-player.y));}
        // Every step is a hop: stretched on the way up, squashed on landing.
        const hop=Math.abs(Math.sin(w.phase)),size=shown[i]<.02?0:shown[i]*1.3,tall=.82+.36*hop,wide=1/Math.sqrt(tall);
        dummy.position.set(w.x,altitude(w.x,w.y)+.75+lifted[i]+hop*(fleeing?.9:.42),-w.y);
        dummy.rotation.set(0,w.h,fleeing?-.3:-.08);dummy.scale.set(size*wide,size*tall,size*wide);
        dummy.updateMatrix();torsoMesh.setMatrixAt(i,dummy.matrix);restMesh.setMatrixAt(i,dummy.matrix);
      });
      torsoMesh.instanceMatrix.needsUpdate=restMesh.instanceMatrix.needsUpdate=true;
    }
    // Camera. The look-ahead is smoothed on its own so a wall hit never yanks the view;
    // the follow itself is tight, which keeps the car steady on screen.
    lead.lerp(new T.Vector3(player.vx,0,-player.vy).multiplyScalar(TUNE.lookAhead),Math.min(1,dt*TUNE.leadRate));
    const cx=player.x+lead.x,cy=player.y-lead.z;
    focus.lerp(new T.Vector3(cx,altitude(player.x,player.y),-cy),Math.min(1,dt*TUNE.followRate));
    // Kick: a damped spring back to rest, in small steps so a long frame cannot blow it up.
    for(let n=Math.max(1,Math.ceil(dt*240)),h=dt/n;n>0;n--){
      kickVX-=(TUNE.kickStiff*kickX+TUNE.kickDamp*kickVX)*h;kickVY-=(TUNE.kickStiff*kickY+TUNE.kickDamp*kickVY)*h;
      kickX+=kickVX*h;kickY+=kickVY*h;
    }
    const reach=Math.hypot(kickX,kickY);
    if(reach>TUNE.kickMax){kickX*=TUNE.kickMax/reach;kickY*=TUNE.kickMax/reach;}
    const nearest=Math.min(999,...chasers.filter(c=>!c.wreck).map(c=>Math.hypot(c.x-player.x,c.y-player.y)));
    paceEase+=(Math.hypot(player.vx,player.vy)/TUNE.maxSpeed-paceEase)*Math.min(1,dt*TUNE.paceRate);
    threat+=(T.MathUtils.clamp((45-nearest)/30,0,1)-threat)*Math.min(1,dt*TUNE.paceRate);
    // Zoom: a little wider with speed and with patrols closing in, a slow push-in when caught.
    const wantZoom=state==='caught'?(freeze?zoomNow:1+TUNE.zoomCaught):1-TUNE.zoomSpeed*paceEase-TUNE.zoomThreat*threat;
    zoomNow+=(wantZoom-zoomNow)*Math.min(1,dt*TUNE.zoomRate);
    const base=Math.min(host.clientWidth,host.clientHeight)/(compact?TUNE.viewSpanCompact:TUNE.viewSpanWide);
    const pose=rig.update(dt,player,cabinIsHidden);
    const zoom=base*zoomNow*pose.zoom;
    const targetPoint=focus.clone().add(new T.Vector3(kickX,0,-kickY));
    // Shift in the camera's vertical screen axis, expressed as horizontal ground metres.
    const advance=host.clientHeight*pose.framing/(zoom*pose.direction.y);
    targetPoint.x-=Math.cos(pose.yaw)*advance;
    targetPoint.z-=Math.sin(pose.yaw)*advance;
    view(targetPoint,zoom,pose.direction);
    heading.visible=cabinIsHidden(pose.direction.x/pose.direction.y,-pose.direction.z/pose.direction.y);
    // HUD
    el('hud-coins').textContent=String(score);
    el('hud-time').textContent=clock(time);
    const {steer,brake}=controls.read();
    zones.left.classList.toggle('on',state==='playing' && (steer>0 || brake));
    zones.right.classList.toggle('on',state==='playing' && (steer<0 || brake));
    const target=route.target,goal=el('goal');goal.hidden=!target || state==='caught';
    if(target){
      // The destination chip sits over the place, or slides along the screen edge and points at it.
      const end=activeWorld().nodes[target.node],[gx,gy]=project(end.x,end.y,14);
      const w=host.clientWidth,h=host.clientHeight,pad=34,top=88,bottom=h-150;
      const px=T.MathUtils.clamp(gx,pad,w-pad),py=T.MathUtils.clamp(gy,top,bottom),off=px!==gx || py!==gy;
      goal.style.transform='translate('+px.toFixed(1)+'px,'+py.toFixed(1)+'px)';
      goal.classList.toggle('near',!off);
      goal.style.setProperty('--turn',(Math.atan2(gy-py,gx-px)+Math.PI/2).toFixed(2)+'rad');
    }
    if(state==='caught' && overAt && now>=overAt){overAt=0;el('over').hidden=false;el('again').focus({preventScroll:true});}
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
  el('again').onclick=()=>{
    if(state!=='caught')return;
    const start=nextStart();
    if(start)restart(start);
  };
  el('leave').onclick=()=>onExit();
  return {
    get active(){return state!=='off';},
    enter(): 'started' | 'unavailable'{
      if(state!=='off')return 'started';
      if(!pois.length)return 'unavailable';
      world??=buildDriveWorld(data,altitude,TUNE);
      people??=makePedestrians(data.roads,data.surfaces,world,WALKERS);
      const start=nextStart();
      if(!start)return 'unavailable';
      scene.add(group);
      rig.enter();showMode();
      controls.activate();
      el('hud').hidden=false;
      restart(start);
      warm();
      // Glide in from the map zoom instead of cutting to the play zoom.
      zoomNow=T.MathUtils.clamp(camera.zoom/(Math.min(host.clientWidth,host.clientHeight)/(compact?TUNE.viewSpanCompact:TUNE.viewSpanWide)),.35,1.6);
      focus.copy(camera.position).addScaledVector(camera.getWorldDirection(new T.Vector3()),1500);
      last=0;raf=requestAnimationFrame(frame);
      return 'started';
    },
    exit(){
      if(state==='off')return;
      state='off';cancelAnimationFrame(raf);scene.remove(group);
      controls.deactivate();
      held=false;
      el('hud').hidden=el('over').hidden=true;guide.className='';el('pops').replaceChildren();
      delete host.dataset.drive;
    },
    // Graphics interruption: stop drawing and stepping, drop any touch in progress, keep the run.
    suspend(){
      if(state==='off')return;
      cancelAnimationFrame(raf);raf=0;controls.release();
      steerTime=steerDirection=0;
      playerPose.reset();
      if(state==='playing'){held=true;guide.className='ready';}
    },
    resume(){
      if(state==='off' || raf)return;
      warmed=false;warm();
      last=0;acc=0;raf=requestAnimationFrame(frame);
    }
  };
}
