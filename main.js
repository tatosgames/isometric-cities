import { streamCity } from './sector-stream.js';
import { createPlacesUI } from './places-ui.js';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeCity } from './scene.js';
import { makeDrive } from './drive.js';
import { makeAdaptiveResolution } from './adaptive-resolution.js';

const el=id=>document.getElementById(id);
async function start(){
  const query=new URLSearchParams(location.search);
  const pilot=query.get('area')==='pilot';
  const load=async path=>{const r=await fetch('./data/'+path);if(!r.ok)throw Error(path);return r.json();};
  const neutral=query.has('neutral');
  const [data,poi,roofColours,roofAtlas,index]=await Promise.all([load((pilot?'pilot':'city')+'.json'),load('poi.geojson'),
    neutral?null:new T.TextureLoader().loadAsync('./data/roof-colours.webp'),neutral?{}:load('roof-tones.json'),pilot?null:load('city-index.json')]);
  if(roofColours)roofColours.colorSpace=T.SRGBColorSpace;
  const scene=new T.Scene(),host=el('scene'),camera=new T.OrthographicCamera(-1,1,1,-1,1,5000);
  const compact=matchMedia('(pointer:coarse)').matches || Math.min(screen.width,screen.height)<700;
  const sessionKey='map-view:'+location.pathname+location.search;
  let resume=null;
  try{resume=JSON.parse(sessionStorage.getItem(sessionKey));sessionStorage.removeItem(sessionKey);}catch{}
  let losses=Number(resume?.losses)||0;
  const baseRatio=()=>Math.min(devicePixelRatio,compact?1:1.75)*(losses>=2?.75:1);
  const renderer=new T.WebGLRenderer({antialias:!compact,alpha:true});
  renderer.setPixelRatio(baseRatio());
  renderer.shadowMap.enabled=!compact && losses<2;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  host.append(renderer.domElement);
  const streamed=pilot?null:streamCity({data:{...data,...index},neutral,roofColours,roofAtlas,compact,host,
    refresh(){renderer.shadowMap.needsUpdate=true;if(!lost)draw();}});
  const {group,altitude}=streamed??makeCity(data,neutral,roofColours,roofAtlas,compact);scene.add(group);
  scene.add(new T.HemisphereLight(0xf1f4ff,0x9b9dac,1.38));
  const sun=new T.DirectionalLight(0xfff6ea,2.12);sun.position.set(-550,690,-370);
  sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-850,right:850,top:850,bottom:-850,far:2200});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.00035;sun.shadow.normalBias=.4;scene.add(sun,sun.target);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableRotate=false;controls.screenSpacePanning=false;controls.enableDamping=false;
  controls.mouseButtons.LEFT=T.MOUSE.PAN;controls.touches.ONE=T.TOUCH.PAN;controls.touches.TWO=T.TOUCH.DOLLY_PAN;
  const direction=new T.Vector3(-.82,1.15,.68).normalize();
  let frame=0,fit=1,flight=null,lost=false,lastView=null,drive=null,beforeDrive=null;
  const locations=poi.features.filter(f=>f.properties.areas.includes(pilot?'pilot':'city'));
  const places=createPlacesUI(locations,altitude,(_id,point)=>{
    if(lost)return false;
    fly(point,Math.max(fit,Math.min(host.clientWidth,host.clientHeight)/245),320);
    return true;
  });
  function view(target,zoom){camera.zoom=zoom;camera.updateProjectionMatrix();controls.target.copy(target);camera.position.copy(target).addScaledVector(direction,1500);controls.update();draw();}
  const border=data.boundary.map(([x,y])=>new T.Vector3(x,altitude(x,y),-y));
  const center=new T.Box3().setFromPoints(border).getCenter(new T.Vector3());
  const bounds=new T.Box3().setFromPoints(border);
  function sizeCamera(){
    const w=host.clientWidth,h=host.clientHeight;
    camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const box=new T.Box3().setFromPoints(border.map(p=>p.clone().applyMatrix4(camera.matrixWorldInverse)));
    fit=Math.min(w/(box.max.x-box.min.x+60),h/(box.max.y-box.min.y+65))*.92;
    controls.minZoom=fit*.8;controls.maxZoom=drive?.active?Infinity:Math.max(fit*12,4);
  }
  function reset(){if(lost)return;flight=null;places.close();view(center,fit);}
  function fly(target,zoom,duration){
    if(lost)return;
    host.dataset.moving='true';
    flight={start:performance.now(),duration,from:controls.target.clone(),to:target.clone(),z0:camera.zoom,z1:zoom};
    draw();
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
  function sampleCadence(time){
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
    if(lastView)view(new T.Vector3().fromArray(lastView.target),lastView.zoom);
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
      if(flight){
        const t=Math.min(1,(time-flight.start)/flight.duration),ease=t*t*(3-2*t);
        view(flight.from.clone().lerp(flight.to,ease),Math.exp(T.MathUtils.lerp(Math.log(flight.z0),Math.log(flight.z1),ease)));
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
      renderer.render(scene,camera);
      if(renderer.getContext().isContextLost())return;
      status.hidden=true;
      if(!drive?.active)lastView={target:controls.target.toArray(),zoom:camera.zoom,selected:places.selected};
      host.dataset.moving=String(!!flight);
      places.project(camera);
      host.dataset.view=[controls.target.x,controls.target.z,camera.zoom].map(v=>v.toFixed(2)).join(',');
    });
  }
  function zoom(k){fly(controls.target,T.MathUtils.clamp((flight?.z1??camera.zoom)*k,controls.minZoom,controls.maxZoom),180);}
  el('plus').onclick=()=>zoom(1.4);el('minus').onclick=()=>zoom(1/1.4);el('reset').onclick=reset;
  host.onkeydown=e=>{
    if(lost || drive.active)return;
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
  drive=makeDrive({scene,camera,renderer,host,data,locations,altitude,view,compact,onExit:leaveDrive});
  el('drive').onclick=()=>{
    if(lost || drive.active)return;
    flight=null;places.close();document.querySelector('nav').classList.remove('open');
    beforeDrive={target:controls.target.clone(),zoom:camera.zoom};
    controls.enabled=false;controls.maxZoom=Infinity;map.classList.add('driving');drive.enter();
  };
  el('drive-exit').onclick=leaveDrive;
  controls.addEventListener('change',draw);
  let firstView=true;
  new ResizeObserver(()=>{
    if(lost || !host.clientWidth || !host.clientHeight)return;
    if(firstView){
      firstView=false;
      const start=places.point(data.focus) ?? new T.Vector3(-95,11,218);
      view(start,Math.max(host.clientWidth/340,host.clientHeight/225));
      if(Array.isArray(resume?.target) && resume.target.length===3 && resume.target.every(Number.isFinite) && Number.isFinite(resume.zoom) && resume.zoom>0){
        view(new T.Vector3().fromArray(resume.target),resume.zoom);
        places.restore(resume.selected);
      }
    }
    syncSize();
  }).observe(host);
  el('status').hidden=true;
}
start().catch(e=>{console.error(e);el('status').textContent='No se pudo abrir el mapa. Comprueba WebGL y los datos locales.';});
