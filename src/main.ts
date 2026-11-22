import { isCity, isPlaces, isRoofPalette, isSea, isSectorIndex, loadCore, loadData, parseViewState } from './data/load.ts';
import { validateSectorIndex } from './data/sector-index.ts';
import type { ViewState, ZoneData } from './data/types.ts';
import { element as el } from './map/dom.ts';
import { required } from './required.ts';
import { lodTransition } from './render/sectors/lod-transition.ts';
import { streamCity } from './render/sectors/sector-stream.ts';
import { createPlacesUI } from './map/places-ui.ts';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeCity } from './render/scene.ts';
import { makeDrive } from './drive/drive.ts';
import { makeAdaptiveResolution } from './render/adaptive-resolution.ts';
import { wind } from './render/wind.ts';
import { makeSea } from './render/sea.ts';

interface Flight {
  start: number; duration: number;
  from: T.Vector3; to: T.Vector3;
  z0: number; z1: number;
  turn0: number; turn1: number;
}

const turnDuration=300;
const upAxis=new T.Vector3(0,1,0);
const normalizeTurn=(turn: number)=>T.MathUtils.euclideanModulo(turn,4);

async function start(){
  const query=new URLSearchParams(location.search);
  const pilot=query.get('area')==='pilot';
  const neutral=query.has('neutral');
  const pilotPreview=pilot && query.has('editorPreview')
    ? import('./editor/pilot-preview.ts').then(({loadEditedPilot})=>loadEditedPilot(el('status'))) : null;
  // `stress` is a synthetic stage for load measurements; it is generated locally and never published.
  const stage=query.get('area')==='stress'?'stress':'city';
  const [core,single,poi,{tones},index,sea,edited]=await Promise.all([pilot?null:loadCore(stage),pilot&&!pilotPreview?loadData('pilot.json',isCity):null,loadData('poi.geojson',isPlaces),
    neutral?{tones:null}:loadData('roof-tones.json',isRoofPalette),pilot?null:loadData(stage+'-index.json',isSectorIndex),
    pilot||neutral||stage!=='city'?null:loadData('sea.json',isSea),pilotPreview]);
  const data=required(core??single??edited?.data,'map data');
  if(index)validateSectorIndex(index);
  const scene=new T.Scene(),host=el('scene'),camera=new T.OrthographicCamera(-1,1,1,-1,1,5000);
  const compact=matchMedia('(pointer:coarse)').matches || Math.min(screen.width,screen.height)<700;
  const sessionKey='map-view:'+location.pathname+location.search;
  let resume: ReturnType<typeof parseViewState>=null;
  try{resume=parseViewState(sessionStorage.getItem(sessionKey));sessionStorage.removeItem(sessionKey);}catch{}
  let losses=Number(resume?.losses)||0;
  const baseRatio=()=>Math.min(devicePixelRatio,compact?1:1.75)*(losses>=2?.75:1);
  const renderer=new T.WebGLRenderer({antialias:!compact,alpha:true,stencil:true});
  renderer.setPixelRatio(baseRatio());
  renderer.shadowMap.enabled=!compact && losses<2;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  host.append(renderer.domElement);
  const residentZones=new Map<string,ZoneData>();
  const streamed=index&&core?streamCity({data:{...core,...index},stage,neutral,tones,compact,host,
    onZone(id,content){
      if(content)residentZones.set(id,content);else residentZones.delete(id);
      drive?.zone(id,content);
    },
    lod:{stable:true,...(neutral?{}:{attach:lodTransition()})},
    refresh(){renderer.shadowMap.needsUpdate=true;if(!lost)draw();}}):null;
  const {group,altitude,groundAt}=streamed??makeCity(data,neutral,tones,compact);scene.add(group);
  if(edited)for(const prop of edited.props(groundAt))group.add(prop);
  if(sea)scene.add(makeSea(sea));
  scene.add(new T.HemisphereLight(0xf1f4ff,0x9b9dac,1.38));
  const sun=new T.DirectionalLight(0xfff6ea,2.12);sun.position.set(-550,690,-370);
  sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-850,right:850,top:850,bottom:-850,far:2200});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.00035;sun.shadow.normalBias=.4;scene.add(sun,sun.target);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableRotate=false;controls.screenSpacePanning=false;controls.enableDamping=false;
  controls.mouseButtons.LEFT=T.MOUSE.PAN;controls.touches.ONE=T.TOUCH.PAN;controls.touches.TWO=T.TOUCH.DOLLY_PAN;
  const direction=new T.Vector3(-.82,1.15,.68).normalize();
  const mapOffset=new T.Vector3();
  let frame=0,lost=false,painted=0,mapTurn=0;
  let flight: Flight | null=null;
  let lastView: ViewState | null=null;
  let drive: ReturnType<typeof makeDrive> | null=null,awaitingZone=false;
  let beforeDrive: {target: T.Vector3;zoom: number} | null=null;
  const locations=poi.features.filter(f=>f.properties.areas.includes(pilot?'pilot':'city'));
  const places=createPlacesUI(locations,altitude,(_id,point)=>{
    if(lost)return false;
    fly(point,Math.max(fitAt(flight?.turn1??mapTurn),Math.min(host.clientWidth,host.clientHeight)/245),320);
    return true;
  });
  function mapDirection(turn: number){return mapOffset.copy(direction).applyAxisAngle(upAxis,normalizeTurn(turn)*Math.PI/2);}
  function view(target: T.Vector3,zoom: number,offset=mapDirection(mapTurn)){
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(offset,1500);
    controls.update();
    // OrbitControls limits interactive zoom. Programmatic poses also restore views saved at another size.
    if(camera.zoom!==zoom){camera.zoom=zoom;camera.updateProjectionMatrix();}
    draw();
  }
  const border=data.boundary.map(([x,y])=>new T.Vector3(x,altitude(x,y),-y));
  // The opening view frames land and sea together; panning stays limited to the land.
  const framed=sea?[...border,...sea.water.flatMap(p=>p[0].map(([x,y])=>new T.Vector3(x,0,-y)))]:border;
  const bounds=new T.Box3().setFromPoints(border);
  const center=new T.Box3().setFromPoints(framed).getCenter(new T.Vector3()).clamp(bounds.min,bounds.max);
  function fitAt(turn: number){
    const offset=mapDirection(turn);
    const right=new T.Vector3().crossVectors(upAxis,offset).normalize();
    const up=new T.Vector3().crossVectors(offset,right);
    const point=new T.Vector3();
    let halfWidth=0,halfHeight=0;
    // Measure from the actual orbit center so an asymmetric coastline still fits.
    for(const vertex of framed){
      point.copy(vertex).sub(center);
      halfWidth=Math.max(halfWidth,Math.abs(point.dot(right)));
      halfHeight=Math.max(halfHeight,Math.abs(point.dot(up)));
    }
    return Math.max(farthest(),Math.min(host.clientWidth/(2*halfWidth+60),host.clientHeight/(2*halfHeight+65))*.92);
  }
  // The widest view shows a district, never the whole city: its longer side covers this many metres.
  // It stays inside the span where every building is drawn, so the merged far level only fills in while zones load.
  function farthest(){return Math.max(host.clientWidth,host.clientHeight)/(compact?2400:3000);}
  function sizeCamera(){
    const w=host.clientWidth,h=host.clientHeight;
    camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const fits=[0,1,2,3].map(fitAt);
    controls.minZoom=Math.max(farthest(),Math.min(...fits,fitAt(mapTurn))*.8);
    controls.maxZoom=drive?.active?Infinity:Math.max(Math.max(...fits)*12,4,openingZoom());
  }
  function openingZoom(){return Math.max(host.clientWidth/340,host.clientHeight/225);}
  // A city wider than the widest view has no centre worth showing: the reset goes home to the focus place.
  function home(){return places.point(data.focus) ?? new T.Vector3(-95,11,218);}
  function reset(){
    if(lost)return;places.close();
    const zoom=fitAt(flight?.turn1??mapTurn);
    fly(zoom===farthest()?home():center,zoom,300);
  }
  function fly(target: T.Vector3,zoom: number,duration: number,turn1=flight?.turn1??mapTurn){
    if(lost)return;
    host.dataset.moving='true';
    flight={start:performance.now(),duration:Math.max(duration,Math.abs(turn1-mapTurn)*turnDuration),
      from:controls.target.clone(),to:target.clone(),z0:camera.zoom,z1:zoom,turn0:mapTurn,turn1};
    draw();
  }
  function rotate(step: -1|1){
    if(lost || drive?.active)return;
    const turn=flight?.turn1??mapTurn;
    const next=step<0?Math.ceil(turn)-1:Math.floor(turn)+1;
    fly(flight?.to??controls.target,flight?.z1??camera.zoom,turnDuration,next);
  }
  // Resolution follows the frame cadence whenever the view moves continuously (drag, flight, driving)
  // and returns to full as soon as it rests, where a single sharp frame costs nothing.
  const adaptive=makeAdaptiveResolution();
  let gesture=false;
  const moving=()=>gesture || !!flight || !!drive?.active;
  function settle(){
    if(moving())return;
    if(adaptive.reset()){renderer.setPixelRatio(baseRatio());draw();}
  }
  function stopGesture(){gesture=false;settle();}
  controls.addEventListener('start',()=>{flight=null;gesture=true;});
  controls.addEventListener('end',stopGesture);
  function sampleCadence(time: number){
    if(!moving()){adaptive.suspend();return;}
    const scale=adaptive.sample(time);
    if(scale!==null){renderer.setPixelRatio(baseRatio()*scale);host.dataset.scale=String(scale);}
  }
  function remember(){
    if(!lastView)return;
    try{sessionStorage.setItem(sessionKey,JSON.stringify({...lastView,selected:places.selected,losses}));}catch{}
  }
  const status=el('status');
  renderer.domElement.addEventListener('webglcontextlost',event=>{
    // A run in progress is held, not ended: score, patrols and position survive the loss.
    event.preventDefault();lost=true;streamed?.suspend();losses++;flight=null;drive?.suspend();
    cancelAnimationFrame(frame);frame=0;gesture=false;adaptive.reset();delete host.dataset.scale;
    controls.enabled=false;controls.disconnect();
    remember();
    status.textContent='Restableciendo el mapa... ';
    const retry=document.createElement('button');
    retry.textContent='Recargar';retry.onclick=()=>{remember();location.reload();};
    status.append(retry);status.hidden=false;
  });
  function syncSize(){
    renderer.setSize(host.clientWidth,host.clientHeight);
    sizeCamera();draw();
  }
  renderer.domElement.addEventListener('webglcontextrestored',()=>{
    lost=false;controls.connect(renderer.domElement);controls.enabled=!drive?.active;
    renderer.setPixelRatio(baseRatio());renderer.shadowMap.enabled=!compact && losses<2;
    renderer.shadowMap.needsUpdate=true;
    if(drive?.active){syncSize();drive.resume();return;}
    if(lastView){mapTurn=lastView.turn;view(new T.Vector3().fromArray(lastView.target),lastView.zoom);}
    syncSize();
  });
  window.addEventListener('pagehide',remember);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){flight=null;stopGesture();remember();}
    else if(!lost)syncSize();
  });
  function draw(){
    if(frame || lost)return;
    frame=requestAnimationFrame(time=>{
      frame=0;sampleCadence(time);
      painted=time;wind.time.value=time/1000;
      if(flight){
        const t=Math.min(1,(time-flight.start)/flight.duration),ease=t*t*(3-2*t);
        mapTurn=t>=1?normalizeTurn(flight.turn1):T.MathUtils.lerp(flight.turn0,flight.turn1,ease);
        const zoom=flight.z0===flight.z1?flight.z0:Math.exp(T.MathUtils.lerp(Math.log(flight.z0),Math.log(flight.z1),ease));
        view(flight.from.clone().lerp(flight.to,ease),zoom);
        if(t>=1){flight=null;settle();}
      }
      const constrained=controls.target.clone().clamp(bounds.min,bounds.max);
      camera.position.add(constrained.clone().sub(controls.target));controls.target.copy(constrained);
      camera.updateMatrixWorld();
      if(renderer.shadowMap.enabled){
        const sx=Math.round(controls.target.x/240)*240,sz=Math.round(controls.target.z/240)*240;
        if(sun.target.position.x!==sx || sun.target.position.z!==sz){
          sun.target.position.set(sx,0,sz);sun.position.set(sx-550,690,sz-370);
          renderer.shadowMap.needsUpdate=true;
        }
      }
      streamed?.update(camera,controls.target,drive?.active);
      if(awaitingZone && streamed?.demand(controls.target.x,-controls.target.z))queueMicrotask(()=>el('drive').click());
      renderer.render(scene,camera);
      if(renderer.getContext().isContextLost())return;
      status.hidden=true;
      if(!drive?.active){
        lastView={target:controls.target.toArray(),zoom:camera.zoom,turn:normalizeTurn(mapTurn),selected:places.selected};
        host.dataset.mapAngle=(lastView.turn*90).toFixed(2);
      }
      host.dataset.moving=String(!!flight);
      places.project(camera);
      host.dataset.view=[controls.target.x,controls.target.z,camera.zoom].map(v=>v.toFixed(2)).join(',');
    });
  }
  // Wind and cloud shadows keep moving while the view rests. A resting map repaints at 30 frames a second
  // at most, with the camera, sectors and pins left as the last full frame set them; a hidden tab stops
  // because the browser stops calling back.
  function ambient(time: number){
    requestAnimationFrame(ambient);
    if(lost || frame || !painted || time-painted<31)return;
    painted=time;wind.time.value=time/1000;
    renderer.render(scene,camera);
  }
  requestAnimationFrame(ambient);
  function zoom(k: number){fly(controls.target,T.MathUtils.clamp((flight?.z1??camera.zoom)*k,controls.minZoom,controls.maxZoom),300);}
  el('plus').onclick=()=>zoom(1.4);el('minus').onclick=()=>zoom(1/1.4);el('reset').onclick=reset;
  el('rotate-left').onclick=()=>rotate(-1);el('rotate-right').onclick=()=>rotate(1);
  host.onkeydown=e=>{
    if(lost || drive?.active)return;
    if(e.key.startsWith('Arrow'))flight=null;
    if(e.key==='Home')reset();else if(['+','='].includes(e.key))zoom(1.4);else if(e.key==='-')zoom(1/1.4);
    else if(e.key.startsWith('Arrow')){
      const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
      const up=new T.Vector3().crossVectors(new T.Vector3(0,1,0),right);
      const delta=(['ArrowLeft','ArrowRight'].includes(e.key)?right:up).multiplyScalar((['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*50/camera.zoom);
      view(controls.target.clone().add(delta),camera.zoom);
    }else return;e.preventDefault();
  };
  const map=el('map');
  function leaveDrive(){
    if(!drive?.active)return;
    drive.exit();map.classList.remove('driving');controls.enabled=!lost;stopGesture();sizeCamera();
    if(beforeDrive && !lost)view(beforeDrive.target,beforeDrive.zoom);
    el('drive').focus({preventScroll:true});
  }
  drive=makeDrive({scene,camera,renderer,host,data,locations,altitude,groundAt,view,mapDirection:direction,compact,onExit:leaveDrive,
    ...(index?{zoning:{size:index.zoneSize,ids:new Set(index.zones.map(z=>z.id)),resident:residentZones}}:{})});
  const play=el('drive');
  play.onclick=()=>{
    if(lost || !drive || drive.active || play.getAttribute('aria-disabled')==='true')return;
    // The run starts on streets whose walls are loaded: wait for the zone under the view.
    if(streamed && !streamed.demand(controls.target.x,-controls.target.z)){awaitingZone=true;draw();return;}
    awaitingZone=false;streamed?.undemand();
    if(drive.enter()==='unavailable'){
      play.setAttribute('aria-disabled','true');
      play.setAttribute('aria-label','Play · Modo de conducción no disponible');
      play.title='Modo de conducción no disponible';
      return;
    }
    flight=null;places.close();required(document.querySelector('nav'),'navigation').classList.remove('open');
    beforeDrive={target:controls.target.clone(),zoom:camera.zoom};
    controls.enabled=false;controls.maxZoom=Infinity;map.classList.add('driving');
  };
  el('drive-exit').onclick=leaveDrive;
  controls.addEventListener('change',draw);
  let firstView=true;
  new ResizeObserver(()=>{
    if(lost || !host.clientWidth || !host.clientHeight)return;
    if(firstView){
      firstView=false;
      const start=home();
      view(start,openingZoom());
      if(resume){
        mapTurn=resume.turn;
        view(new T.Vector3().fromArray(resume.target),resume.zoom);
        places.restore(resume.selected);
      }
    }
    syncSize();
  }).observe(host);
  status.removeAttribute('lang');
  status.hidden=true;
}
start().catch(error=>{
  console.error(error);
  const notice=el('status');
  notice.textContent=notice.lang==='en'
    ? 'Could not open the pilot map. Check WebGL and the map data.'
    : 'No se pudo abrir el mapa. Comprueba WebGL y los datos locales.';
});
