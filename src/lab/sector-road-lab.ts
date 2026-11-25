import * as T from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import {loadData,isCity,isSectorIndex,isRoofPalette,isLayers} from '../data/load.ts';
import {zonesFromCity} from '../data/sector-index.ts';
import {streamCity} from '../render/sectors/sector-stream.ts';
import {carGeometry,carVisualScale} from '../drive/car-model.ts';
import {lodTransition} from '../render/sectors/lod-transition.ts';
import {CAMERA_DISTANCE,fitPixels,makeMapCamera,mapViewDirection} from '../render/map-camera.ts';
import type {Point} from '../data/types.ts';

export async function sectorRoadLab(){
  const el=(id:string)=>document.getElementById(id)!;
  const query=new URLSearchParams(location.search),host=el('view');
  el('tools').hidden=true;
  const [city,index,palette]=await Promise.all([loadData('city.json',isCity),loadData('city-index.json',isSectorIndex),loadData('roof-tones.json',isRoofPalette)]);
  const widths=query.get('test')==='larghezze';
  type Section={name:string;line:Point[];cell:string;before:number;sides:number[]};
  const samples:Record<string,Section>=widths?await fetch('./data/road-width-lab/sections.json').then(r=>{if(!r.ok)throw Error('Samples missing');return r.json();}):{};
  const selected=query.get('caso')??'ordinaria',section=samples[selected]??Object.values(samples)[0];
  const previous=widths&&query.has('prima');
  const way=section??city.roads.find(r=>r.id==='30801332');
  if(!way)throw Error('The Calle San Nicolás way is missing');
  const path=way.line.map(p=>new T.Vector2(...p)),lengths=[0];
  for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+path[i-1].distanceTo(path[i]));
  const pair=new Set(section?[section.cell]:['-2_-2','-1_-2']);
  const split=zonesFromCity(city,index,!widths&&query.has('intera')?undefined:id=>pair.has(id));
  const layers={...split.core,...split.index};
  if(previous)delete layers.roadCoverage;
  const compact=matchMedia('(pointer:coarse)').matches||screen.width<700;
  const renderer=new T.WebGLRenderer({antialias:!compact,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,compact?1:1.75));renderer.setClearColor(0xe7e5d5);
  renderer.shadowMap.enabled=!compact;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  host.prepend(renderer.domElement);
  const scene=new T.Scene(),camera=makeMapCamera(),toCamera=mapViewDirection();
  scene.add(new T.HemisphereLight(0xf1f4ff,0x9b9dac,1.38));
  const sun=new T.DirectionalLight(0xfff6ea,2.12);sun.position.set(-550,690,-370);
  sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-850,right:850,top:850,bottom:-850,far:2200});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00035;sun.shadow.normalBias=.4;scene.add(sun,sun.target);
  const car=new T.Mesh(carGeometry('#d8452f','#f4ead7',false),new T.MeshStandardMaterial({vertexColors:true,roughness:.8,flatShading:true}));
  car.scale.setScalar(carVisualScale);car.castShadow=true;scene.add(car);
  const ui={legacy:query.has('raster'),reverse:query.has('inverso'),drive:!query.has('mappa'),delay:query.has('ritardo'),
    pos:T.MathUtils.clamp(Number(query.get('pos')??(widths?50:0))||0,0,100)};
  const lod=query.get('test')==='lod';
  const options={mode:query.get('modo')??'visivo',ground:!query.has('noSuolo'),objects:!query.has('noRetino'),
    manual:false,progress:50,duration:Number(query.get('durata'))||250,span:Number(query.get('campo'))||185};
  let changes=0,previousFrame=0,switchGap=0,switchNext=false;
  const ready=new Set<string>();
  const stream=streamCity({data:layers,compact,neutral:false,tones:palette.tones,host,legacyRoads:ui.legacy,
    ...(lod?{lod:{stable:options.mode!=='attuale',...(options.mode==='visivo'?{attach:lodTransition(options)}:{}),
      observe(){changes++;}}}:{}),
    async loadZone(z){
      const zone=split.zones.get(z.id);
      if(!zone)throw Error('Missing zone '+z.id);
      return zone;
    },
    async loadLayers(s,signal){
      if(ui.delay&&s.id==='-1_-2')await new Promise<void>(r=>setTimeout(r,1800));
      const result=await loadData('city-sectors/'+s.file,isLayers,signal);
      if(previous){
        const response=await fetch('./data/road-width-lab/'+s.id+'.json',{signal});
        if(!response.ok)throw Error('Reference carriageway missing');
        result.carriageway=await response.json();
        if(!isLayers(result))throw Error('Invalid reference geometry');
      }
      if(result.carriageway)ready.add(s.id);
      return result;
    },refresh(){renderer.shadowMap.needsUpdate=true;schedule();}});
  scene.add(stream.group);
  const gui=new GUI({container:el('gui'),title:widths?'Road width':'Calle San Nicolás boundary'});
  function reload(){for(const [key,on] of [['raster',ui.legacy],['inverso',ui.reverse],['mappa',!ui.drive],['ritardo',ui.delay]] as const){
    if(on)query.set(key,'1');else query.delete(key);
  }query.set('pos',String(ui.pos));location.search=query.toString();}
  if(lod){
    const redrawMaterials=()=>{renderer.shadowMap.needsUpdate=true;schedule();};
    const store=()=>{query.set('modo',options.mode);query.set('campo',String(options.span));query.set('durata',String(options.duration));
      for(const [key,v] of [['noSuolo',options.ground],['noRetino',options.objects]] as const){if(v)query.delete(key);else query.set(key,'1');}
    };
    gui.add(options,'mode',{Current:'attuale','Thresholds and priority':'stabile','Thresholds and transitions':'visivo'}).name('Variant').onChange(()=>{store();reload();});
    if(options.mode==='visivo'){
      gui.add(options,'ground').name('Fade ground and roads').onChange(()=>{store();redrawMaterials();});
      gui.add(options,'objects').name('Screen buildings and trees').onChange(()=>{store();redrawMaterials();});
      gui.add(options,'manual').name('Inspect transition').onChange(redrawMaterials);
      gui.add(options,'progress',0,100,1).name('Transition (%)').onChange(()=>{options.manual=true;gui.controllers.forEach(c=>c.updateDisplay());redrawMaterials();});
      gui.add(options,'duration',100,600,25).name('Duration (ms)').onChange(store);
    }
    gui.add(options,'span',100,650,1).name('Map span (m)').onChange(()=>{ui.drive=false;store();schedule();});
    gui.add(ui,'delay').name('Delay east sector').onChange(()=>{store();reload();});
    gui.add({run(){ui.delay=true;ui.pos=95;ui.reverse=true;ui.drive=false;options.span=185;store();reload();}},'run').name('Arrival with a still camera');
    gui.add({run(){scenario='zoom';scenarioStart=performance.now();playing=false;ui.drive=false;schedule();}},'run').name('Oscillate on the zoom');
    gui.add({run(){scenario='guida';scenarioStart=performance.now();playing=false;ui.drive=true;schedule();}},'run').name('Bend and reversal');
  }else if(widths){
    const settings={selected,previous};
    gui.add(settings,'selected',Object.keys(samples)).name('Section').onChange((value:string)=>{
      query.set('caso',value);ui.pos=50;reload();
    });
    gui.add(settings,'previous').name('Previous width').onChange((on:boolean)=>{
      if(on)query.set('prima','1');else query.delete('prima');reload();
    });
  }else{
    gui.add(ui,'legacy').name('Raster comparison').onChange(reload);
    gui.add(ui,'delay').name('Delay east sector').onChange(reload);
  }
  gui.add(ui,'drive').name('Drive camera').onChange(reload);
  gui.add(ui,'reverse').name('Reverse direction').onChange(reload);
  const scrub=gui.add(ui,'pos',0,100,.1).name('Route (%)').onChange(()=>{playing=false;schedule();});
  gui.add({run(){playing=!playing;if(playing&&ui.pos>=100)ui.pos=0;last=performance.now();schedule();}},'run').name('Start / pause');
  let playing=false,last=0,frame=0,scenario='',scenarioStart=0;
  function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
  function draw(now:number){
    frame=0;
    if(scenario){
      const t=Math.min(1,(now-scenarioStart)/5000);
      if(scenario==='zoom')options.span=t<.15?500:550+20*Math.sin((t-.15)*Math.PI*8);
      else{ui.reverse=t>=.5;ui.pos=(t>=.5?t-.5:t)*200;}
      for(const c of gui.controllers)c.updateDisplay();
      if(t===1)scenario='';
    }
    if(playing){ui.pos=Math.min(100,ui.pos+(now-last)*.014);if(ui.pos===100)playing=false;last=now;scrub.updateDisplay();}
    const dist=(ui.reverse?100-ui.pos:ui.pos)/100*lengths[lengths.length-1];
    let i=1;while(i<path.length-1&&dist>lengths[i])i++;
    const p=path[i-1].clone().lerp(path[i],(dist-lengths[i-1])/(lengths[i]-lengths[i-1]));
    car.position.set(p.x,stream.altitude(p.x,p.y)+.1,-p.y);car.rotation.y=Math.atan2(path[i].y-path[i-1].y,path[i].x-path[i-1].x)+(ui.reverse?Math.PI:0);
    car.visible=ui.drive;
    const w=host.clientWidth,h=host.clientHeight;
    if(renderer.domElement.clientWidth!==w||renderer.domElement.width!==Math.floor(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.floor(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
    camera.zoom=Math.min(w,h)/(ui.drive?(compact?62:95):(lod?options.span:185));fitPixels(camera,w,h);
    camera.position.copy(car.position).addScaledVector(toCamera,CAMERA_DISTANCE);
    camera.lookAt(car.position);camera.updateMatrixWorld();
    const changesBefore=changes;
    stream.update(camera,car.position,ui.drive);renderer.render(scene,camera);
    if(lod){
      host.dataset.scenario=scenario;
      if(switchNext && previousFrame){switchGap=now-previousFrame;switchNext=false;}
      if(changesBefore!==changes){switchNext=true;schedule();}
      previousFrame=now;
      host.dataset.lodChanges=String(changes);
      el('metrics').textContent=changes+' sector changes · '+renderer.info.render.calls+' draw call · '+switchGap.toFixed(1)+' ms RAF interval after the change';
    }
    host.dataset.position=String(ui.pos);host.dataset.meshCells=[...ready].sort().join(',');
    if(playing||scenario)schedule();
  }
  el('panel').onclick=()=>{const p=el('settings');p.hidden=!p.hidden;el('panel').setAttribute('aria-expanded',String(!p.hidden));};
  el('status').textContent=section?section.name+' · '+(previous?section.before:section.sides.reduce((a,b)=>a+b,0)).toLocaleString('en')+' m at the middle of the route':'Calle San Nicolás · boundary at −240 m';
  new ResizeObserver(schedule).observe(host);draw(performance.now());host.dataset.ready='true';
}
