import { carGeometry, carShellHeight, carShellParts, carShellPivot, carWheelParts, tint } from './car-model.ts';
import type { Point } from '../data/types.ts';
import { element as el } from '../map/dom.ts';
import { required } from '../required.ts';
import {BUILDING_BIT,surfaceStencil} from '../render/building-stencil.ts';
import {buildDriveWorld} from './drive-world.ts';
import type {ZoneData} from '../data/types.ts';
export {TUNE};
import {makeDrivePhysics} from './drive-physics.ts';
import {makeRoadGrade} from './road-grade.ts';
import {makeDrivePose} from './drive-pose.ts';
import {driveLookAhead,makeDriveCamera} from './drive-camera.ts';
import {makeDriveRoute} from './drive-route.ts';
import type { RouteEvent } from './drive-route.ts';
import { chooseStartNode, type RoadNode } from './road-routing.ts';
import {makeDriveInput} from './drive-input.ts';
import {makeDriveLocation} from './drive-location.ts';
import {makePedestrians} from './pedestrians.ts';
import {makeDriveEffects} from './drive-effects.ts';
import {makeCrowdView} from './drive-crowd.ts';
import {CAPTURE,COINS,TUNE,wrap} from './drive-tune.ts';
import type {DriveOptions,DriveState,Patrol,RouteField,Vehicle} from './drive-types.ts';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';



export function makeDrive({scene,camera,renderer,host,data,locations,altitude,groundAt,view,mapDirection,compact,onExit,zoning}: DriveOptions){
  let world: ReturnType<typeof buildDriveWorld> | null=null;
  let location: ReturnType<typeof makeDriveLocation> | undefined;
  const street=el('drive-street'),barrio=el('drive-barrio');
  const activeWorld=()=>required(world,"drive world");
  const {steerPatrol,steerPlayer,collide,bump,resetPlayerSteering}=makeDrivePhysics(TUNE,makeRoadGrade(altitude,data.roads));
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
  const controls=makeDriveInput(host,go,onExit,cycleCamera,()=>state!=='caught');
  function routes(source: number){
    if(field?.source===source)return field;
    field=activeWorld().routesFrom(source);
    return field;
  }

  // ---- scene objects ----
  const group=new T.Group();
  const paint=new T.MeshStandardMaterial({...surfaceStencil(),vertexColors:true,flatShading:true,roughness:.8});
  const policeGeometry=carGeometry('#f3f3ee','#2b3440',true);
  const wreckPaint=new T.MeshStandardMaterial({...surfaceStencil(),color:'#3a3a3a',flatShading:true,roughness:1});
  const blobGeometry=new T.PlaneGeometry(4.15,2.5).rotateX(-Math.PI/2);
  const blobMaterial=new T.MeshBasicMaterial({color:'#15170f',transparent:true,opacity:.38,depthWrite:false});
  function vehicle(geometry: T.BufferGeometry): Vehicle{
    const mesh=new T.Mesh(geometry,paint),blob=new T.Mesh(blobGeometry,blobMaterial);
    mesh.scale.setScalar(TUNE.visualScale);group.add(mesh,blob);
    mesh.rotation.order='YXZ';
    return {x:0,y:0,h:0,vx:0,vy:0,slip:0,side:0,hold:0,steer:0,hop:0,dive:0,way:1,wayHold:0,hitX:0,hitY:0,mesh,blob,wreck:0,stuck:0,trail:null,puff:0,node:-1};
  }
  const lightGeometry=new T.BoxGeometry(.3,.24,1.05).translate(-.2,1.66,0);
  const lightRed=new T.MeshBasicMaterial({...surfaceStencil(),color:'#ff3b30'}),lightBlue=new T.MeshBasicMaterial({...surfaceStencil(),color:'#2f7bff'});
  function patrol(){
    const c=vehicle(policeGeometry);
    const light=new T.Mesh(lightGeometry,lightRed);
    c.mesh.add(light);
    return Object.assign(c,{light});
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
    const height=player.mesh.position.y+(shell.position.y+1.2-carShellPivot)*TUNE.visualScale;
    return activeWorld().occluded(player.x,player.y,height,dx,dy);
  }
  const dummy=new T.Object3D();
  const coinMesh=new T.InstancedMesh(new T.CylinderGeometry(1.15,1.15,.24,14).rotateX(Math.PI/2),new T.MeshStandardMaterial({...surfaceStencil(),color:'#ffcf24',emissive:'#b07a00',roughness:.4,flatShading:true}),COINS);
  coinMesh.frustumCulled=false;coinMesh.count=0;group.add(coinMesh);
  const {puff,skid,reset: resetEffects,update: updateEffects}=makeDriveEffects(group,groundAt);
  const WALKERS=compact?26:40;
  const crowd=makeCrowdView(group,altitude,WALKERS);
  let people: ReturnType<typeof makePedestrians> | null=null;
  function place(b: Vehicle,yaw: number,roll: number,pitch: number){
    const z=groundAt(b.x,b.y);
    b.mesh.position.set(b.x,z+.72+b.hop,-b.y);
    b.mesh.rotation.set(roll,yaw,pitch);
    b.blob.position.set(b.x,z+.76,-b.y);
    b.blob.rotation.y=yaw;
    return z;
  }

  // ---- game state ----
  let state: DriveState='off';
  let score=0,time=0,record=0,raf=0,last=0,acc=0,grace=0,spin=0,routeAge=1,held=false,warmed=false,lastStart: number | undefined;
  let capture: {patrol: Patrol;elapsed: number;motionElapsed: number;started: number} | null=null;
  let puffArmed=true,sparkCool=0;
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
  const over=el('over'),actions=el('over-actions'),again=el('again');
  function clearCapture(){
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
    for(let k=0;k<8;k++)puff(player.x+Math.cos(k*.8)*2.5,player.y+Math.sin(k*.8)*2.5);
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
    Object.assign(c,{x:n.x,y:n.y,vx:0,vy:0,h:Math.atan2(next.y-n.y,next.x-n.x),wreck:0,stuck:0,trail:null,node:index,hold:0,steer:0,slip:0,side:0,puff:0,slopeAccel:undefined});
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
    location?.reset([n.x,n.y]);
    for(const c of chasers)group.remove(c.mesh,c.blob);
    chasers=[];held=false;freeze=stopCool=kickX=kickY=kickVX=kickVY=0;release=null;score=0;time=0;grace=TUNE.grace;acc=0;routeAge=1;field=null;route.clear();
    resetPlayerSteering();
    puffArmed=true;
    sparkCool=0;
    playerPose.reset();
    resetEffects();
    Object.assign(player,{x:n.x,y:n.y,vx:0,vy:0,h:0,trail:null,hold:0,steer:0,side:0,hop:0,dive:0,slopeAccel:undefined});
    paceEase=0;threat=0;lead.set(0,0,0);el('pops').replaceChildren();
    people?.reset(player);crowd.reset();
    const path=trail();
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
    stop(TUNE.stopCaught,()=>{for(let k=0;k<6;k++)puff(player.x+Math.cos(k)*1.5,player.y+Math.sin(k)*1.5);});
    const best=score>record;
    if(best){record=score;try{localStorage.setItem('drive-record',String(record));}catch{}}
    el('over-coins').textContent=String(score);el('over-time').textContent=clock(time);el('over-record').textContent=String(record);
    el('over-record').classList.toggle('new',best);
    el('hud-live').textContent='Atrapado. '+score+' monedas en '+Math.round(time)+' segundos.'+(best?' Nuevo rÃ©cord.':'');
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
    if(state==='ready'){state='playing';guide.className='play';}
    // A run held after an interruption continues on the next input, never by itself.
    if(held){held=false;guide.className='play';}
  }
  // ---- simulation ----
  function step(dt: number){
    const world=activeWorld();
    time+=dt;grace=Math.max(0,grace-dt);stopCool=Math.max(0,stopCool-dt);
    const {steer,brake}=controls.read();
    const driveLoad=steerPlayer(player,steer,brake,dt);
    const beforeContactX=player.x,beforeContactY=player.y;
    const knock=collide(player,world);
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
    if(knock>TUNE.stopImpact && !stopCool){stop(TUNE.stopWall);stopCool=TUNE.stopGap;}
    const speed=Math.hypot(player.vx,player.vy);
    routeAge+=dt;
    if(routeAge>.6){routeAge=0;field=routes(world.nearestNode(player.x,player.y));}
    const wanted=Math.min(compact?6:8,1+Math.floor(time/TUNE.chaserEvery));
    while(chasers.length<wanted){const c=patrol();chasers.push(c);spawnChaser(c);}
    for(const c of chasers){
      if(c.wreck>0){
        c.wreck-=dt;c.puff-=dt;c.h+=dt*14*Math.max(0,c.wreck-TUNE.wreckTime+.45);
        if(c.puff<=0){c.puff=.12;puff(c.x,c.y,'smoke');}
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
      steerPatrol(c,T.MathUtils.clamp(turn,-1,1),world,dt);
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
      if(shove>=0)playerContact=true;
      if(shove>6)kick(a.x-player.x,a.y-player.y,Math.min(1,shove/14)*.7);
      // Close enough counts as contact: a tree or a corner must not save a stopped car.
      if(!a.wreck && !grace && speed<TUNE.catchSpeed && Math.hypot(a.x-player.x,a.y-player.y)<TUNE.catchReach){
        playerPose.update(player,steer,dt,driveLoad);
        caught(a);return;
      }
    }
    const playerSlip=playerPose.update(player,steer,dt,driveLoad);
    if(playerSlip<TUNE.puffRearm)puffArmed=true;
    else if(puffArmed && playerSlip>=TUNE.puffSlip){
      puffArmed=false;
      if(!playerContact && (steer || brake)){
        const yaw=player.h+playerPose.yaw,fx=Math.cos(yaw),fy=Math.sin(yaw);
        for(const side of [-.72,0,.72]){
          const rear=side===0?1.55:1.3,scale=TUNE.visualScale;
          puff(player.x-(fx*rear+fy*side)*scale,player.y+(-fy*rear+fx*side)*scale,'drift');
        }
      }
    }
    route.advance(player,world.nodes,dt,handleRouteEvent);
    for(const b of [player,...chasers]){
      const isPlayer=b===player;
      if(b.wreck>0 || (isPlayer?playerSlip:b.slip)<TUNE.skidSpeed){b.trail=null;continue;}
      const yaw=b.h+(isPlayer?playerPose.yaw:0),fx=Math.cos(yaw),fy=Math.sin(yaw);
      const scale=isPlayer?TUNE.visualScale:1;
      skid(b,fx,fy,scale);
      if(isPlayer)continue;
      b.puff-=dt;
      if(b.puff<=0){b.puff=.07;puff(b.x-fx*1.3*scale,b.y-fy*1.3*scale);}
    }
  }
  function wreck(c: Patrol){
    c.wreck=TUNE.wreckTime;c.vx=c.vy=0;c.trail=null;c.mesh.material=wreckPaint;c.hop=TUNE.hop;
    const far=Math.hypot(c.x-player.x,c.y-player.y);
    if(far<40)kick(c.x-player.x,c.y-player.y,.1+.4*(1-far/40));
    for(let k=0;k<6;k++)puff(c.x+Math.cos(k)*1.4,c.y+Math.sin(k)*1.4,'smoke');
    pop(c.x,c.y,TUNE.wreckBonus,'crash',false);gain(TUNE.wreckBonus);
  }

  function frame(now: number){
    raf=requestAnimationFrame(frame);
    if(document.hidden){last=0;return;}
    const wallDt=(now-(last||now))/1000;last=now;
    const captureDt=capture?wallDt:0;
    let dt=Math.min(.05,wallDt);
    if(!capture){
      if(freeze)advanceStop(dt);
      else if(state==='playing' && !held){
        acc+=dt;
        for(;acc>=1/120 && state==='playing' && !freeze;acc-=1/120)step(1/120);
        if(freeze)acc=0;
      }
    }
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
    const playerGround=place(player,player.h+playerPose.yaw,0,0);
    shell.rotation.set(playerPose.roll,0,playerPose.pitch);
    shell.position.y=carShellHeight(playerPose.roll,playerPose.pitch);
    heading.position.copy(player.blob.position);
    heading.rotation.y=player.mesh.rotation.y;

    const lightTime=capture?capture.started+capture.motionElapsed*CAPTURE.speed*1000:now;
    chasers.forEach((c,i)=>{
      place(c,c.h+c.steer*TUNE.tailSwing*Math.min(1,c.slip/5+.25),T.MathUtils.clamp(c.side*TUNE.roll,-.32,.32),-c.dive*TUNE.dive);
      c.light.visible=!c.wreck;c.light.material=(Math.floor(lightTime/140)+i)%2?lightRed:lightBlue;
    });
    beacon.scale.set(1+Math.sin(spin*.8)*.08,1,1+Math.sin(spin*.8)*.08);beacon.visible=!!route.target && !capture;
    coinMesh.count=coins.length;
    coins.forEach((c,i)=>{
      dummy.position.set(c.x,c.z+Math.sin(spin+i)*.15,-c.y);dummy.rotation.set(0,spin+i*.7,0);dummy.scale.setScalar(1);
      dummy.updateMatrix();coinMesh.setMatrixAt(i,dummy.matrix);
    });
    coinMesh.instanceMatrix.needsUpdate=true;
    updateEffects(dt);
    // Pedestrians hold with the simulation during a hit-stop, and keep strolling before the start and after a capture.
    let walking=0,clearance=99;
    if(people){
      if(dt && !freeze && !held)people.update(dt,player,[player,...chasers.filter(c=>!c.wreck)]);
      ({walking,clearance}=crowd.update(people,dt,player));
    }
    // Camera. The look-ahead is smoothed on its own so a wall hit never yanks the view;
    // the follow itself is tight, which keeps the car steady on screen.
    const speed=Math.hypot(player.vx,player.vy);
    const leadScale=speed?driveLookAhead(speed,TUNE.player.maxSpeed)/speed:0;
    lead.lerp(new T.Vector3(player.vx*leadScale,0,-player.vy*leadScale),Math.min(1,dt*TUNE.leadRate));
    const cx=player.x+lead.x,cy=player.y-lead.z;
    focus.lerp(new T.Vector3(cx,playerGround,-cy),Math.min(1,dt*TUNE.followRate));
    // Kick: a damped spring back to rest, in small steps so a long frame cannot blow it up.
    for(let n=Math.max(1,Math.ceil(dt*240)),h=dt/n;n>0;n--){
      kickVX-=(TUNE.kickStiff*kickX+TUNE.kickDamp*kickVX)*h;kickVY-=(TUNE.kickStiff*kickY+TUNE.kickDamp*kickVY)*h;
      kickX+=kickVX*h;kickY+=kickVY*h;
    }
    const reach=Math.hypot(kickX,kickY);
    if(reach>TUNE.kickMax){kickX*=TUNE.kickMax/reach;kickY*=TUNE.kickMax/reach;}
    const nearest=Math.min(999,...chasers.filter(c=>!c.wreck).map(c=>Math.hypot(c.x-player.x,c.y-player.y)));
    paceEase+=(Math.min(1,speed/TUNE.player.maxSpeed)-paceEase)*Math.min(1,dt*TUNE.paceRate);
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
    if(state!=='caught')location?.update(player.x,player.y,speed>2?Math.atan2(player.vy,player.vx):player.h,now);
    el('hud-coins').textContent=String(score);
    el('hud-time').textContent=clock(time);
    const {steer,brake}=controls.read();
    zones.left.classList.toggle('on',state==='playing' && (steer>0 || brake));
    zones.right.classList.toggle('on',state==='playing' && (steer<0 || brake));
    const target=route.target,goal=el('goal');goal.hidden=!target || state==='caught';
    if(target){
      // The destination chip sits over the place, or slides along the screen edge and points at it.
      const end=activeWorld().nodes[target.node],[gx,gy]=project(end.x,end.y,14);
      const w=host.clientWidth,h=host.clientHeight,pad=34,bottom=h-150;
      const nearLabels=Math.abs(gx-w/2)<Math.min(180,w/2);
      let top=88;
      if(nearLabels && w<=620 && street.textContent)top=112;
      if(nearLabels && barrio.textContent)top=w<=620?142:112;
      const px=T.MathUtils.clamp(gx,pad,w-pad),py=T.MathUtils.clamp(gy,top,bottom),off=px!==gx || py!==gy;
      goal.style.transform='translate('+px.toFixed(1)+'px,'+py.toFixed(1)+'px)';
      goal.classList.toggle('near',!off);
      goal.style.setProperty('--turn',(Math.atan2(gy-py,gx-px)+Math.PI/2).toFixed(2)+'rad');
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
  function prepare(){
    if(!pois.length || !data.roads.length)return false;
    if(!world){
      world=buildDriveWorld(data,altitude,TUNE,zoning);
      for(const [id,zone] of zoning?.resident??[])world.addZone(id,zone.buildings,zone.trees);
    }
    people??=makePedestrians(data.roads,data.surfaces,world,WALKERS);
    return true;
  }
  again.onclick=()=>{
    if(state!=='caught' || actions.hidden)return;
    const start=nextStart();
    if(start){restart(start);host.focus({preventScroll:true});}
  };
  el('leave').onclick=()=>onExit();
  return {
    get active(){return state!=='off';},
    get desaturation(){return capture?T.MathUtils.smoothstep(capture.elapsed,0,CAPTURE.grade):0;},
    get visualTimeScale(){return capture?(freeze?0:CAPTURE.speed):1;},
    prepare,
    enter(): 'started' | 'unavailable'{
      if(state!=='off')return 'started';
      if(!prepare())return 'unavailable';
      const start=nextStart();
      if(!start)return 'unavailable';
      location??=makeDriveLocation(data.roads,street,barrio);
      scene.add(group);
      const mapOffset=camera.getWorldDirection(new T.Vector3()).negate();
      rig.enter(mapOffset);showMode();
      controls.activate();
      el('hud').hidden=false;
      restart(start);
      warm();
      // Glide in from the map zoom instead of cutting to the play zoom.
      zoomNow=T.MathUtils.clamp(camera.zoom/(Math.min(host.clientWidth,host.clientHeight)/(compact?TUNE.viewSpanCompact:TUNE.viewSpanWide)),.35,1.6);
      focus.copy(camera.position).addScaledVector(mapOffset,-1500);
      last=0;raf=requestAnimationFrame(frame);
      return 'started';
    },
    exit(){
      if(state==='off')return;
      state='off';cancelAnimationFrame(raf);scene.remove(group);
      controls.deactivate();
      location?.reset();
      held=false;
      el('hud').hidden=true;clearCapture();guide.className='';el('pops').replaceChildren();
      delete host.dataset.drive;
    },
    /** A zone arrived with its footprints, or left with `null`. */
    zone(id: string,content: ZoneData | null){
      if(content)world?.addZone(id,content.buildings,content.trees);else world?.removeZone(id);
    },
    visibilityChanged(){
      last=0;
      if(capture)over.toggleAttribute('data-paused',document.hidden || !raf);
    },
    // Graphics interruption: stop drawing and stepping, drop any touch in progress, keep the run.
    suspend(){
      if(state==='off')return;
      cancelAnimationFrame(raf);raf=0;controls.release();
      resetPlayerSteering();
      if(capture){over.inert=true;over.dataset.paused='';}
      else playerPose.reset();
      if(state==='playing'){held=true;guide.className='ready';}
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
