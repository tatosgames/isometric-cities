import {makeTerrainCeiling} from './flight/terrain-ceiling.ts';
import { cityFillLight, citySun, sunOffset } from './render/city-light.ts';
import { parseViewState } from './data/load.ts';
import type { ViewState, ZoneData } from './data/types.ts';
import { element as el } from './map/dom.ts';
import { required } from './required.ts';
import { lodTransition } from './render/sectors/lod-transition.ts';
import { streamCity } from './render/sectors/sector-stream.ts';
import { createPlacesUI } from './map/places-ui.ts';
import { loadStartupData } from './map/load-startup-data.ts';
import { coastWindow, measureCoast, sampleFlight, type DragSample, type Flight } from './map/motion.ts';
import * as T from 'three';
import { makeCity } from './render/scene.ts';
import { makeDrive } from './drive/drive.ts';
import { compactScreen, renderPixelRatio, makeDynamicQuality, type DynamicQualityConfig } from './render/dynamic-quality.ts';
import {makeStaticGroundShadow} from './render/static-ground-shadow.ts';
import { makeQualityOutput } from './render/quality-output.ts';
import { lightLook, makeMatcapPatcher, readLook } from './render/look-lab.ts';
import { makeStatsOverlay } from './render/stats-overlay.ts';
import { makeSkyEffects } from './render/sky-effects.ts';
import { wind } from './render/wind.ts';
import { makeSea, SEA_LEVEL } from './render/sea.ts';
import { makeFlightArea } from './flight/flight-area.ts';
import { propObstacles } from './render/port-props.ts';
import { makeMapFraming, normalizeTurn } from './map/framing.ts';
import { approach, wrapAngle } from './geometry.ts';
import { CAMERA_DISTANCE, GroundControls, fitPixels, makeMapCamera, mapViewDirection, screenOffsetOnGround } from './render/map-camera.ts';
import { bootError, bootEvent, bootPaint, bootPhase, bootProgress, booting, openingFrame, startup } from './boot.ts';

const turnDuration=300;
const coastRate=6;
const map=el('map');

async function start(){
  if(!booting())return;
  bootProgress(12);
  const query=new URLSearchParams(location.search);
  const pilot=query.get('area')==='pilot';
  // `?lab=guida`: the tuning panel of the drive, listed in lab.html.
  const lab=query.get('lab')==='guida';
  const neutral=query.has('neutral');
  const {signal}=startup;
  // `stress` is a synthetic stage for load measurements; it is generated locally and never published.
  const stage=query.get('area')==='stress'?'stress':'city';
  const {data,core,poi,tones,index,sea,edited}=await loadStartupData({
    pilot,editorPreview:query.has('editorPreview'),neutral,stage,signal
  });
  signal.throwIfAborted();
  performance.mark('atlas:startup-data');
  bootPhase('Preparando la ciudad');
  await bootPaint();
  signal.throwIfAborted();
  const scene=new T.Scene(),host=el('scene'),camera=makeMapCamera();
  const compact=compactScreen();
  const sessionKey='map-view:'+location.pathname+location.search;
  let resume: ReturnType<typeof parseViewState>=null;
  try{resume=parseViewState(sessionStorage.getItem(sessionKey));}catch{}
  let losses=Number(resume?.losses)||0;
  const labOutput=query.get('lab')==='qualita' && (!query.has('preview') || query.has('diagnostics'))
    ? document.createElement('output'):null;
  const decisions:string[]=[];
  let bufferReport='', cadenceReport='', contextReport='WebGL active';
  const frameGaps:number[]=[];
  let lastDprChange='';
  function showQualityLab(){
    if(labOutput)labOutput.textContent=[bufferReport,cadenceReport,contextReport,...decisions].filter(Boolean).join('\n');
  }
  if(labOutput){
    labOutput.id='quality-diagnostics';
    labOutput.setAttribute('aria-label','Rendering quality');
    map.append(labOutput);
    signal.addEventListener('abort',()=>labOutput.remove(),{once:true});
  }
  const quality=makeDynamicQuality({compact,losses,sky:query.get('sky')!=='0',
    preview:query.get('lab')==='qualita'?query.get('preview'):null,
    ...(labOutput && {onDecision({mode,action,reason,from,to,targetFps,fps,p95Ms}){
      const metrics=fps===null || p95Ms===null?'':` · ${fps.toFixed(0)} FPS · p95 ${p95Ms.toFixed(1)} ms`;
      const effect=(entry:typeof from)=>`L${entry.stage} ${entry.shadows}/${entry.antialias}`;
      const detail=reason==='preparing'?'effect preparation timed out':reason;
      const before=effect(from), after=effect(to);
      const transition=before===after?after:`${before} → ${after}`;
      decisions.push(`${mode} · ${action} (${detail}) · ${transition} · target ${targetFps}${metrics}`);
      if(decisions.length>4)decisions.shift();
      showQualityLab();
    }})});
  let physicalDpr=devicePixelRatio, nextDisplayCheck=0;
  const renderer=new T.WebGLRenderer({antialias:quality.nativeAntialias,alpha:true,stencil:true});
  const look=readLook(),patchLook=look==='matcap'?makeMatcapPatcher():null;
  let lookPatched=0;
  const output=makeQualityOutput(renderer,{tilt:look!=='base'&&query.has('tilt')});
  const stats=makeStatsOverlay(renderer,query);
  renderer.shadowMap.type=T.PCFShadowMap;
  renderer.shadowMap.autoUpdate=false;
  host.append(renderer.domElement);
  const residentZones=new Map<string,ZoneData>();
  const flightTerrain=makeTerrainCeiling(data.terrain,SEA_LEVEL);
  flightTerrain.include(data.ground);
  if(core)for(const far of Object.values(core.far))flightTerrain.include(far.ground);
  const streamed=index&&core?streamCity({data:{...core,...index},stage,neutral,tones,compact,host,
    onGroundRings:flightTerrain.include,
    onZone(id,content){
      // The driving world knows trees as point obstacles: crane legs and chimneys join them.
      const solid=content?.props?.length?{...content,trees:[...content.trees,...propObstacles(content.props)]}:content;
      if(solid)residentZones.set(id,solid);else residentZones.delete(id);
      drive?.zone(id,solid);
    },
    lod:{stable:true,...(neutral?{}:{attach:lodTransition()})},
    refresh(){renderer.shadowMap.needsUpdate=true;if(!lost)draw();}}):null;
  const city=streamed??makeCity(data,neutral,tones,compact);
  const {group,altitude,groundAt}=city;
  scene.add(group);
  const pilotMask=!streamed && city.groundMap?makeStaticGroundShadow(city.groundMap.bounds,()=>data.buildings,draw):null;
  pilotMask?.attach(city.materials.mat,true);pilotMask?.attach(city.materials.road);
  let flightRange:DynamicQualityConfig['flight'];
  function applyQuality(config:DynamicQualityConfig){
    const {antialias:aa}=config;
    // The matcap look ignores lights, so it shows the painted static shadow instead of the shadow map.
    const shadows=look==='matcap'&&config.shadows==='solar'?'static':config.shadows;
    flightRange=config.flight;
    const flightCamera=drive?.flightView?.camera;
    if(flightRange && flightCamera){
      flightHaze.near=flightRange.visibility*.4;
      flightHaze.far=flightRange.visibility;
      flightCamera.far=flightRange.visibility;
      flightCamera.updateProjectionMatrix();
    }
    host.dataset.qualityMode=flightRange?'flight':'ground';
    host.dataset.qualityStage=String(config.stage);
    const gl=labOutput?renderer.getContext():null;
    const before=gl?`${gl.drawingBufferWidth}×${gl.drawingBufferHeight}`:'';
    const ratio=renderPixelRatio(config);
    if(ratio!==renderer.getPixelRatio())renderer.setPixelRatio(ratio);
    output.configure(aa==='fxaa');
    if(renderer.shadowMap.enabled!==(shadows==='solar')){
      renderer.shadowMap.enabled=shadows==='solar';
      renderer.shadowMap.needsUpdate=true;
    }
    streamed?.setStaticShadows(shadows==='static');
    pilotMask?.setEnabled(shadows==='static');
    host.dataset.aa=aa;
    host.dataset.shadows=shadows;
    host.dataset.dpr=String(ratio);
    if(gl){
      const after=`${gl.drawingBufferWidth}×${gl.drawingBufferHeight}`;
      if(before!==after)lastDprChange=`\nLast DPR change: ${before} → ${after} px`;
      bufferReport=`Buffer ${after} px · ${host.dataset.qualityMode} L${config.stage} · DPR ${ratio.toFixed(2)} · shadows ${shadows} · AA ${aa}${lastDprChange}`;
      showQualityLab();
    }
  }
  if(edited)for(const prop of edited.props(groundAt))group.add(prop);
  if(sea)scene.add(makeSea(sea));
  performance.mark('atlas:startup-scene');
  bootProgress(64);
  bootPhase('Preparando la vista');
  await bootPaint();
  signal.throwIfAborted();
  const fill=cityFillLight();scene.add(fill);
  const sun=citySun();scene.add(sun,sun.target);
  lightLook(look,renderer,fill,sun);
  // Map controls: the ground stays under the pointer, the wheel and the pinch zoom towards where they point.
  // Rotation goes by the buttons in quarter turns, so the two-finger gesture pans and zooms only.
  // No damping: three.js damping applies a share of each move per update, so the map trails the finger.
  // The glide after the release is the map's own (`coast`).
  const controls=new GroundControls(camera,renderer.domElement);
  controls.enableRotate=false;controls.zoomToCursor=true;controls.touches.TWO=T.TOUCH.DOLLY_PAN;
  const direction=mapViewDirection();
  const {mapInclination,mapDirection,bounds,center,fitAt,farthest,openingZoom}=makeMapFraming({host,compact,data,altitude,direction});
  // The full-city sea extends 2.8 km beyond the municipal bounds. The pilot has land only.
  const offshore=sea?650:0;
  const flightBounds:[number,number,number,number]=[bounds.min.x-offshore,-bounds.max.z-offshore,
    bounds.max.x+offshore,-bounds.min.z+offshore];
  const flightArea=makeFlightArea(data.boundary,sea,flightBounds,groundAt,SEA_LEVEL);
  const flightSky=new T.Color('#bfd9e7'),flightHaze=new T.Fog(flightSky,800,4800);
  let frame=0,lost=false,painted=0,mapTurn=0;
  let flight: Flight | null=null;
  // The glide after a drag: ground velocity in metres per second, and where the gesture went lately.
  let coasting=false,coastTime=0;
  const coastVelocity=new T.Vector3(),trail: DragSample[]=[];
  const shift=new T.Vector2(),toCamera=new T.Vector3(),centre=new T.Vector3();
  let lastView: ViewState | null=null;
  let drive: ReturnType<typeof makeDrive> | null=null,awaitingZone=false,building=false;
  const openingView=openingFrame(draw);
  let playRequestedAt=0;
  let beforeDrive: {target: T.Vector3;zoom: number} | null=null;
  const locations=poi.features.filter(f=>f.properties.areas.includes(pilot?'pilot':'city'));
  const sky=makeSkyEffects(scene,locations.filter(f=>['parque-doramas','parque-santa-catalina'].includes(f.properties.id)).map(f=>{
    const [x,y]=f.properties.xy;
    return {x,y:altitude(x,y)+34,z:-y};
  }));
  sky.setEnabled(quality.config.sky);
  window.addEventListener('atlas:sky-quality',e=>{
    const allowed=(e as CustomEvent<unknown>).detail;
    if(typeof allowed==='boolean')sky.setEnabled(quality.allowSky(allowed));
  },{signal});
  const places=createPlacesUI(locations,altitude,(_id,point,frame)=>{
    if(lost || flight?.driveOrbit)return false;
    rebase();
    const turn=flight?.turn1??mapTurn,zoom=Math.max(fitAt(turn),Math.min(host.clientWidth,host.clientHeight)/245);
    // The place becomes the target and the view offset puts it in the part of the view its card leaves free:
    // zoom and rotation then turn about the place itself.
    fly(point,zoom,320,turn,undefined,new T.Vector2(frame.x,frame.y));
    return true;
  },rebase);
  /** The ground point at the centre of the screen: the target itself unless a place card holds it aside. */
  function screenCentre(){
    if(!shift.x && !shift.y)return centre.copy(controls.target);
    toCamera.subVectors(camera.position,controls.target).normalize();
    return screenOffsetOnGround(centre,controls.target,-shift.x,-shift.y,camera.zoom,toCamera);
  }
  /**
   * The card no longer claims part of the view: the target moves to the centre of the screen and the offset goes,
   * leaving the picture exactly as it was. A flight in progress keeps its destination, seen the same way.
   */
  function rebase(){
    const end=flight;
    if(end?.driveOrbit || (!shift.x && !shift.y && !end?.s1.x && !end?.s1.y))return;
    flight=null;
    const now=screenCentre().clone();
    shift.set(0,0);fitPixels(camera,host.clientWidth,host.clientHeight);
    view(now,camera.zoom,toCamera.subVectors(camera.position,controls.target).normalize().clone());
    if(end){
      const landing=screenOffsetOnGround(new T.Vector3(),end.to,-end.s1.x,-end.s1.y,end.z1,mapDirection(end.turn1));
      fly(landing,end.z1,Math.max(0,end.start+end.duration-performance.now()),end.turn1);
    }
  }
  /**
   * Remember where a drag has been, to launch the glide at the speed the finger had when it let go. Times are
   * those of the pointer events, when the finger moved, not when a busy main thread got round to them.
   */
  let inputTime=0;
  for(const type of ['pointerdown','pointermove','pointerup'])host.addEventListener(type,event=>{inputTime=event.timeStamp;},{capture:true});
  function trace(){
    const t=inputTime;
    trail.push({t,x:controls.target.x,z:controls.target.z,zoom:camera.zoom});
    while(trail.length>2 && t-trail[1].t>coastWindow)trail.shift();
  }
  function launch(){
    const measured=measureCoast(trail,inputTime,coastVelocity);
    trail.length=0;
    // A finger that rested before lifting, or a pinch, leaves the map where it is.
    if(!measured || coastVelocity.length()*camera.zoom<60)return;
    coasting=true;coastTime=0;draw();
  }
  function view(target: T.Vector3,zoom: number,offset=mapDirection(mapTurn)){
    coasting=false;
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(offset,CAMERA_DISTANCE);
    controls.update();
    // OrbitControls limits interactive zoom. Programmatic poses also restore views saved at another size.
    if(camera.zoom!==zoom){camera.zoom=zoom;camera.updateProjectionMatrix();}
    draw();
  }
  function sizeCamera(){
    fitPixels(camera,host.clientWidth,host.clientHeight,shift);camera.updateMatrixWorld();
    const fits=[0,1,2,3].map(fitAt);
    controls.minZoom=Math.max(farthest(),Math.min(...fits,fitAt(mapTurn))*.8);
    controls.maxZoom=drive?.active?Infinity:Math.max(Math.max(...fits)*12,4,openingZoom());
  }
  // A city wider than the widest view has no centre worth showing: the reset goes home to the focus place.
  function home(){return places.point(data.focus) ?? new T.Vector3(-95,11,218);}
  function reset(){
    if(lost)return;places.close();
    const zoom=fitAt(flight?.turn1??mapTurn);
    fly(zoom===farthest()?home():center,zoom,300);
  }
  function fly(target: T.Vector3,zoom: number,duration: number,turn1=flight?.turn1??mapTurn,driveOrbit?: T.Spherical,s1=flight?.s1??shift){
    if(lost || flight?.driveOrbit)return;
    coasting=false;
    host.dataset.moving='true';
    flight={start:performance.now(),duration:Math.max(duration,Math.abs(turn1-mapTurn)*turnDuration),
      from:controls.target.clone(),to:target.clone(),z0:camera.zoom,z1:zoom,turn0:mapTurn,turn1,driveOrbit,
      s0:shift.clone(),s1:s1.clone()};
    draw();
  }
  function rotate(step: -1|1){
    if(lost || drive?.active)return;
    const turn=flight?.turn1??mapTurn;
    const next=step<0?Math.ceil(turn)-1:Math.floor(turn)+1;
    fly(flight?.to??controls.target,flight?.z1??camera.zoom,turnDuration,next);
  }
  let gesture=false, streamBusy=true, flightPreparing=false;
  const moving=()=>gesture || coasting || !!flight || !!drive?.active;
  function interruptProbe(reason:'input'|'context-lost'|'hidden'){
    const changed=quality.interrupt(reason);
    if(changed && !lost)applyQuality(changed);
  }
  for(const type of ['pointerdown','wheel','keydown']){
    document.addEventListener(type,()=>{if(quality.calibrationPending || quality.calibrating)interruptProbe('input');},{capture:true,passive:true,signal});
  }
  function stopGesture(){gesture=false;}
  const credits=required(map.querySelector('footer'),'data attribution');
  const licences=el('data-licences');
  function dismissCredits(){
    if(map.dataset.boot!=='ready' || !licences.hidden)return;
    licences.append(credits);
    licences.hidden=false;
  }
  el('map-content').addEventListener('click',event=>{
    if(event.target instanceof Element && event.target.closest('button:not(:disabled):not([aria-disabled="true"])'))dismissCredits();
  },{capture:true});
  controls.addEventListener('start',()=>{dismissCredits();flight=null;places.fold();gesture=true;coasting=false;trail.length=0;trace();});
  controls.addEventListener('change',()=>{if(gesture)trace();});
  controls.addEventListener('end',()=>{gesture=false;launch();});
  function remember(){
    if(!lastView)return;
    try{sessionStorage.setItem(sessionKey,JSON.stringify({...lastView,selected:places.selected,losses}));}catch{}
  }
  let desaturation=0;
  function setDesaturation(amount: number){
    if(desaturation===amount)return;
    desaturation=amount;
    if(amount)host.style.filter='grayscale('+amount+')';
    else host.style.removeProperty('filter');
  }
  const status=el('status');
  signal.addEventListener('abort',()=>{
    openingView.cancel();
    cancelAnimationFrame(frame);
    drive?.exit();
    streamed?.suspend();
    controls.dispose();
    sky.dispose();
    streamed?.disposeShadows();pilotMask?.dispose();
    output.dispose();
    renderer.dispose();
    setDesaturation(0);
  },{once:true});
  renderer.domElement.addEventListener('webglcontextlost',event=>{
    // A run in progress is held, not ended: score, patrols and position survive the loss.
    event.preventDefault();lost=true;losses++;
    contextReport=`WebGL context lost · losses ${losses}`;showQualityLab();
    streamed?.forget();flight=null;coasting=false;drive?.suspend();
    cancelAnimationFrame(frame);frame=0;gesture=false;interruptProbe('context-lost');
    controls.enabled=false;controls.disconnect();
    remember();
    if(map.dataset.boot!=='ready'){
      el('boot-progress').removeAttribute('aria-valuenow');
      bootEvent('interrupt');
      return;
    }
    status.textContent='Restableciendo el mapa... ';
    const retry=document.createElement('button');
    retry.textContent='Recargar';retry.onclick=()=>{remember();location.reload();};
    status.append(retry);status.hidden=false;
  });
  function syncSize(){
    if(signal.aborted)return;
    physicalDpr=devicePixelRatio;
    quality.updateViewport(host.clientWidth,host.clientHeight,physicalDpr);
    renderer.setSize(host.clientWidth,host.clientHeight);
    applyQuality(quality.config);
    sizeCamera();
    const airborne=drive?.flightView;
    if(airborne){
      airborne.camera.aspect=Math.max(1,host.clientWidth)/Math.max(1,host.clientHeight);
      airborne.camera.updateProjectionMatrix();
    }
    draw();
  }
  renderer.domElement.addEventListener('webglcontextrestored',()=>{
    if(signal.aborted)return;
    contextReport=`WebGL context restored · losses ${losses}`;showQualityLab();
    lost=false;controls.connect(renderer.domElement);controls.enabled=map.dataset.boot==='ready'&&!drive?.active;
    applyQuality(quality.restore(losses));
    renderer.shadowMap.needsUpdate=true;
    if(drive?.active){syncSize();drive.resume();return;}
    // The saved target is the centre of the screen, so the restored view needs no offset.
    if(lastView){mapTurn=lastView.turn;shift.set(0,0);view(new T.Vector3().fromArray(lastView.target),lastView.zoom);}
    syncSize();
  });
  window.addEventListener('pagehide',remember);
  document.addEventListener('visibilitychange',()=>{
    drive?.visibilityChanged();
    // A hidden page is the first the browser closes for memory: the drive's world goes unless a run is on.
    if(document.hidden && !building)drive?.release();
    if(document.hidden){interruptProbe('hidden');if(!flight?.driveOrbit)flight=null;coasting=false;stopGesture();remember();}
    else if(!lost)syncSize();
  });
  const ambientInterval=1000/30;
  let nextAmbientPaint=0;
  function paint(time: number, capped=false){
    // Keep the deadline on the 30 Hz cadence even if a display callback arrives late.
    nextAmbientPaint=capped?Math.max(nextAmbientPaint+ambientInterval,time):time+ambientInterval;
    // A screen change can leave the CSS viewport unchanged. Reuse the live loop.
    if(time>=nextDisplayCheck){
      nextDisplayCheck=time+1000;
      if(devicePixelRatio!==physicalDpr)syncSize();
      if(labOutput){
        // Every painted frame of the last second, whatever the controller is doing with them.
        const gaps=frameGaps.splice(0).sort((a,b)=>a-b);
        const span=gaps.reduce((sum,gap)=>sum+gap,0);
        const now=gaps.length?`Now ${(1000*gaps.length/span).toFixed(0)} FPS · p95 ${gaps[Math.ceil(gaps.length*.95)-1].toFixed(1)} ms`
          +(capped?' · resting, 30 FPS cap':'')+(streamBusy?' · loading':''):'Now —';
        const {targetFps,fps,p95Ms,trial}=quality.state;
        cadenceReport=`${now}\nController target ${targetFps} FPS`
          +(fps===null?' · no window yet':` · last window ${fps.toFixed(0)} FPS`)
          +(p95Ms===null?'':` · p95 ${p95Ms.toFixed(1)} ms`)+(trial?' · trial':'')
          +(flightRange?` · detail ${flightRange.detailRadius} m · horizon ${flightRange.visibility} m`:'');
        showQualityLab();
      }
    }
    if(labOutput && painted && time>painted)frameGaps.push(time-painted);
    const speed=drive?.visualTimeScale??1;
    const elapsed=painted?Math.max(0,time-painted)/1000:time/1000;
    wind.time.value+=speed===1?elapsed:Math.min(.05,elapsed)*speed;
    painted=time;
    const airborne=drive?.flightView;
    const lens=airborne?.camera??camera;
    scene.background=airborne?flightSky:null;
    scene.fog=airborne?flightHaze:null;
    sky.update(lens,airborne?.target??controls.target,!!drive?.active);
    if(patchLook && time-lookPatched>400){lookPatched=time;patchLook(scene);}
    if(map.dataset.boot==='ready' && !document.hidden){
      const changed=quality.sample(time,{
        mode:moving()?'moving':quality.calibrating?'calibration':'resting',
        ready:airborne?!drive?.flightWaiting:!streamBusy,
        preparing:flightPreparing || (streamed?.shadowsPending??pilotMask?.pending??false)
      });
      // Resizing clears the drawing buffer, so render into the new buffer in this frame.
      if(changed)applyQuality(changed);
    }
    stats?.begin();
    output.render(scene,lens);
    stats?.end();
    if(!document.hidden)setDesaturation(drive?.desaturation??0);
  }
  function draw(){
    if(frame || lost || signal.aborted)return;
    frame=requestAnimationFrame(time=>{
      frame=0;
      try{drawFrame(time);}
      catch(error){
        if(map.dataset.boot==='ready')throw error;
        if(!renderer.getContext().isContextLost())bootError(error);
      }
    });
  }
  function drawFrame(time: number){
    if(coasting){
      // Exponential decay, integrated exactly over the frame: the same glide at any frame cadence.
      const dt=coastTime?Math.min(.1,(time-coastTime)/1000):1/60;
      coastTime=time;
      const step=approach(coastRate,dt)/coastRate;
      controls.target.addScaledVector(coastVelocity,step);camera.position.addScaledVector(coastVelocity,step);
      coastVelocity.multiplyScalar(1-approach(coastRate,dt));
      if(coastVelocity.length()*camera.zoom<8){coasting=false;}else draw();
    }
    if(flight){
      const {t,ease,turn,zoom}=sampleFlight(flight,time);
      if(!flight.s0.equals(flight.s1) || !shift.equals(flight.s1)){
        shift.lerpVectors(flight.s0,flight.s1,ease);fitPixels(camera,host.clientWidth,host.clientHeight,shift);
      }
      mapTurn=turn;
      let offset=mapDirection(mapTurn);
      const orbit=flight.driveOrbit;
      if(orbit && t<1){
        const yaw=Math.atan2(offset.x,offset.z)-orbit.theta;
        offset.setFromSphericalCoords(1,T.MathUtils.lerp(orbit.phi,mapInclination,ease),
          orbit.theta+wrapAngle(yaw)*ease);
      }
      view(centre.lerpVectors(flight.from,flight.to,ease),zoom,offset);
      if(t>=1){
        flight=null;
        if(orbit)controls.enabled=true;
      }
    }
    // Keep the target inside the outline. Zooming to the cursor slides the camera across its own plane, so its
    // distance from the target drifts: an orthographic view looks the same from any distance, and this resets it.
    toCamera.subVectors(camera.position,controls.target).normalize();
    controls.target.clamp(bounds.min,bounds.max);
    camera.position.copy(controls.target).addScaledVector(toCamera,CAMERA_DISTANCE);
    camera.updateMatrixWorld();
    const airborne=drive?.flightView;
    const changed=quality.setFlight(!!airborne);
    if(changed)applyQuality(changed);
    const subject=airborne?.target??controls.target;
    if(airborne)airborne.camera.updateMatrixWorld();
    if(renderer.shadowMap.enabled){
      const sx=Math.round(subject.x/240)*240,sz=Math.round(subject.z/240)*240;
      if(sun.target.position.x!==sx || sun.target.position.z!==sz){
        sun.target.position.set(sx,0,sz);sun.position.copy(sun.target.position).add(sunOffset);
        renderer.shadowMap.needsUpdate=true;
      }
    }
    const opening=booting();
    const level=streamed?.update(airborne?.camera??camera,subject,drive?.active,opening?'covered':map.dataset.boot==='revealing'?'revealing':undefined,flightRange);
    flightPreparing=level?.flightPreparing??false;
    streamBusy=level?.busy??false;
    if(awaitingZone && streamed?.demand(controls.target.x,-controls.target.z))queueMicrotask(beginDrive);
    paint(time);
    if(renderer.getContext().isContextLost())return;
    if(drive?.active && playRequestedAt){
      performance.measure('atlas:play-first-frame',{start:playRequestedAt,end:performance.now()});
      playRequestedAt=0;
    }
    status.hidden=true;
    const middle=screenCentre();
    if(!drive?.active && !flight?.driveOrbit){
      lastView={target:middle.toArray(),zoom:camera.zoom,turn:normalizeTurn(mapTurn),selected:places.selected};
      host.dataset.mapAngle=(lastView.turn*90).toFixed(2);
    }
    host.dataset.moving=String(!!flight || coasting);
    if(!airborne)places.project(camera);
    if(map.dataset.boot==='ready'){
      host.dataset.view=[middle.x,middle.z,camera.zoom].map(v=>v.toFixed(2)).join(',');
    }else if(opening)openingView.painted(level?.zoneReady);
  }
  // Wind and cloud shadows keep moving while the view rests. A resting map repaints at 30 frames a second
  // at most, with the camera, sectors and pins left as the last full frame set them; a hidden tab stops
  // because the browser stops calling back.
  function ambient(time: number){
    if(signal.aborted)return;
    requestAnimationFrame(ambient);
    if(map.dataset.boot!=='ready' || document.hidden || lost || frame || !painted || time===painted)return;
    if(!!drive?.flightView!==!!flightRange){draw();return;}
    if(quality.calibrationPending && !streamBusy && !moving()){
      quality.beginCalibration(time);
    }
    const capped=!quality.calibrating && !moving();
    if(capped && time+.01<nextAmbientPaint)return;
    paint(time,capped);
  }
  requestAnimationFrame(ambient);
  function zoom(k: number){fly(flight?.to??controls.target,T.MathUtils.clamp((flight?.z1??camera.zoom)*k,controls.minZoom,controls.maxZoom),300);}
  el('plus').onclick=()=>zoom(1.4);el('minus').onclick=()=>zoom(1/1.4);el('reset').onclick=reset;
  el('rotate-left').onclick=()=>rotate(-1);el('rotate-right').onclick=()=>rotate(1);
  host.onkeydown=e=>{
    if(lost || drive?.active || flight?.driveOrbit)return;
    if(e.key.startsWith('Arrow'))flight=null;
    if(e.key==='Home')reset();else if(['+','='].includes(e.key))zoom(1.4);else if(e.key==='-')zoom(1/1.4);
    else if(e.key.startsWith('Arrow')){
      const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
      const up=new T.Vector3().crossVectors(new T.Vector3(0,1,0),right);
      const delta=(['ArrowLeft','ArrowRight'].includes(e.key)?right:up).multiplyScalar((['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*50/camera.zoom);
      view(controls.target.clone().add(delta),camera.zoom);
    }else return;
    dismissCredits();
    e.preventDefault();
  };
  function leaveDrive(){
    if(!drive?.active)return;
    const orbit=new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    drive.exit();setDesaturation(0);map.classList.remove('driving');sizeCamera();
    if(beforeDrive && !lost)fly(beforeDrive.target,beforeDrive.zoom,1500,mapTurn,orbit);
    controls.enabled=!lost && !flight?.driveOrbit;
    stopGesture();
    el('drive').focus({preventScroll:true});
  }
  drive=makeDrive({scene,camera,renderer,host,data,locations,...flightArea,flightTerrainCeiling:flightTerrain.ceiling,redraw:draw,
    demandLanding:(x,y)=>streamed?.demand(x,y)??true,releaseLanding:()=>streamed?.undemand(),
    ...(index?.roadCoverage?{streets:index.roadCoverage}:{}),altitude,groundAt,view,mapDirection:direction,compact,busArea:pilot?'pilot':'city',buses:!(lab && query.has('nobuses')),police:!query.has('nopolice'),endless:lab,onExit:leaveDrive,
    ...(index?{zoning:{size:index.zoneSize,ids:new Set(index.zones.map(z=>z.id)),resident:residentZones}}:{})});
  const play=el('drive');
  function disablePlay(){
    play.setAttribute('aria-disabled','true');
    play.setAttribute('aria-label','Play · Modo de conducción no disponible');
    play.title='Modo de conducción no disponible';
  }
  function beginDrive(){
    if(lost || !drive || drive.active || map.dataset.boot!=='ready')return;
    // The drive aims the camera itself and has no place card beside it.
    rebase();coasting=false;
    awaitingZone=false;streamed?.undemand();
    play.removeAttribute('aria-busy');play.setAttribute('aria-label','Play');
    if(drive.enter()==='unavailable'){
      disablePlay();
      return;
    }
    flight=null;places.close();required(document.querySelector('nav'),'navigation').classList.remove('open');
    beforeDrive={target:controls.target.clone(),zoom:camera.zoom};
    controls.enabled=false;controls.maxZoom=Infinity;map.classList.add('driving');
  }
  play.onclick=()=>{
    if(lost || !drive || drive.active || flight?.driveOrbit || awaitingZone || building || map.dataset.boot!=='ready' || play.getAttribute('aria-disabled')==='true')return;
    playRequestedAt=performance.now();
    rebase();
    const busy=()=>{play.setAttribute('aria-busy','true');play.setAttribute('aria-label','Play · Preparando la conducción');};
    const start=()=>{
      // The run starts on streets whose walls are loaded: wait for the zone under the view.
      if(streamed && !streamed.demand(controls.target.x,-controls.target.z)){awaitingZone=true;busy();return;}
      beginDrive();
    };
    if(drive.built){start();return;}
    // The driving world is built at the first Play, not behind the map: seconds on a slow phone, so the wait shows
    // first and a frame is drawn between the steps.
    building=true;busy();
    const steps=drive.build();
    const next=()=>{
      if(signal.aborted)return;
      if(!lost && !steps.next().done){setTimeout(next);return;}
      building=false;
      if(lost){play.removeAttribute('aria-busy');play.setAttribute('aria-label','Play');}else start();
    };
    requestAnimationFrame(()=>setTimeout(next));
  };
  el('drive-exit').onclick=leaveDrive;
  controls.addEventListener('change',draw);
  controls.enabled=false;
  addEventListener('atlas:boot-ready',()=>{
    try{sessionStorage.removeItem(sessionKey);}catch{}
    controls.enabled=!lost;
    performance.mark('atlas:startup-interactive');
    draw();
    // The driving world and its pedestrians are not needed to see the map: the first Play builds them.
    if(drive && !drive.available)disablePlay();
    if(lab && drive){
      // Driving lab: every run starts where the map opens, with the tuning panel beside the game.
      const tested=drive;
      // `start=x,y` (map metres) picks the street to test on, for example a steep one.
      const [sx,sy]=(query.get('start')??'').split(',').map(Number);
      if(Number.isFinite(sx) && Number.isFinite(sy)){
        // Look there first, so the zone with its walls is the one loaded before the run.
        view(new T.Vector3(sx,altitude(sx,sy),-sy),camera.zoom);
        tested.startAt([sx,sy]);
      }else tested.startAt([controls.target.x,-controls.target.z]);
      void import('./lab/drive-lab.ts').then(({driveLab})=>driveLab({drive:tested,host,compact,begin:()=>play.click()}));
      return;
    }
  },{once:true});
  const openingPlace=places.point(query.get('focus'));
  const initialZoom=()=>openingPlace ? Math.min(host.clientWidth,host.clientHeight)/270 : openingZoom();
  quality.updateViewport(host.clientWidth,host.clientHeight,physicalDpr);
  applyQuality(quality.config);
  let firstView=true;
  new ResizeObserver(()=>{
    if(signal.aborted || lost || !host.clientWidth || !host.clientHeight)return;
    if(firstView){
      firstView=false;
      view(openingPlace ?? home(),initialZoom());
      if(resume){
        mapTurn=resume.turn;
        view(new T.Vector3().fromArray(resume.target),resume.zoom);
        places.restore(resume.selected);
      }
    }else if(booting() && !resume){
      view(controls.target,initialZoom());
    }
    syncSize();
  }).observe(host);
  status.removeAttribute('lang');
  status.hidden=true;
}
start().catch(bootError);
