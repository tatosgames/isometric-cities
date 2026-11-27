import * as T from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import {loadData,isLayers} from '../data/load.ts';
import {carGeometry,carVisualScale} from '../drive/car-model.ts';
import {lodTransition} from '../render/sectors/lod-transition.ts';
import {CAMERA_DISTANCE,fitPixels,mapViewDirection} from '../render/map-camera.ts';
import {labCity} from './lab-city.ts';
import {caseParts,has,query as urlQuery,search,setPairs,setSwitch,tuned} from '../url-state.ts';
import type {Point} from '../data/types.ts';

export async function sectorRoadLab(scenarioId:'lod'|'widths'|'sectors'){
  const el=(id:string)=>document.getElementById(id)!;
  const query=urlQuery(),host=el('view'),on=(item:string)=>has(query,'on',item);
  el('tools').hidden=true;
  const lab=await labCity(host,query);
  const {city,compact,renderer,scene,camera}=lab;
  const widths=scenarioId==='widths';
  type Section={name:string;line:Point[];cell:string;before:number;sides:number[]};
  const samples:Record<string,Section>=widths?await fetch('./data/road-width-lab/sections.json').then(r=>{if(!r.ok)throw Error('Samples missing');return r.json();}):{};
  const selected=caseParts(query)[1]??'ordinaria',section=samples[selected]??Object.values(samples)[0];
  const previous=widths&&on('before');
  const way=section??city.roads.find(r=>r.id==='30801332');
  if(!way)throw Error('The Calle San Nicolás way is missing');
  const path=way.line.map(p=>new T.Vector2(...p)),lengths=[0];
  for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+path[i-1].distanceTo(path[i]));
  const pair=new Set(section?[section.cell]:['-2_-2','-1_-2']);
  const toCamera=mapViewDirection();
  const car=new T.Mesh(carGeometry('#d8452f','#f4ead7',false),new T.MeshStandardMaterial({vertexColors:true,roughness:.8,flatShading:true}));
  car.scale.setScalar(carVisualScale);car.castShadow=true;scene.add(car);
  const ui={legacy:on('raster'),reverse:on('reverse'),drive:!on('map'),delay:on('delay'),
    pos:T.MathUtils.clamp(tuned(query,'pos',widths?50:0),0,100)};
  const lod=scenarioId==='lod';
  // `mode=current|stable|visual`: today's sectors, thresholds and priority, or thresholds with transitions.
  const transition=tuned(query,'transition',NaN);
  const options={mode:query.get('mode')??'visual',ground:!has(query,'off','ground'),objects:!has(query,'off','hatch'),
    manual:Number.isFinite(transition),progress:T.MathUtils.clamp(Number.isFinite(transition)?transition:50,0,100),
    duration:tuned(query,'duration',250),span:tuned(query,'span',185)};
  let changes=0,previousFrame=0,switchGap=0,switchNext=false;
  const ready=new Set<string>();
  const stream=lab.stream({keep:!widths&&on('whole')?undefined:id=>pair.has(id),legacyRoads:ui.legacy,
    widenedRoads:!previous,
    ...(lod?{lod:{stable:options.mode!=='current',...(options.mode==='visual'?{attach:lodTransition(options)}:{}),
      observe(){changes++;}}}:{}),
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
  const gui=new GUI({container:el('gui'),title:widths?'Road width':'Calle San Nicolás boundary'});
  function currentParams(){
    const params=new URLSearchParams(query);
    for(const [item,listed] of [['raster',ui.legacy],['reverse',ui.reverse],['map',!ui.drive],['delay',ui.delay]] as const){
      setSwitch(params,'on',item,listed);
    }
    const tune:[string,string][]=[['pos',ui.pos.toFixed(2)]];
    if(lod){
      params.set('mode',options.mode);tune.push(['span',String(options.span)],['duration',String(options.duration)]);
      setSwitch(params,'off','ground',!options.ground);setSwitch(params,'off','hatch',!options.objects);
      if(options.manual)tune.push(['transition',String(options.progress)]);
    }
    setPairs(params,'tune',tune);
    return params;
  }
  const reload=()=>{location.search=search(currentParams());};
  if(lod){
    const redrawMaterials=()=>{renderer.shadowMap.needsUpdate=true;schedule();};
    gui.add(options,'mode',{Current:'current','Thresholds and priority':'stable','Thresholds and transitions':'visual'}).name('Variant').onChange(reload);
    if(options.mode==='visual'){
      gui.add(options,'ground').name('Fade ground and roads').onChange(redrawMaterials);
      gui.add(options,'objects').name('Screen buildings and trees').onChange(redrawMaterials);
      gui.add(options,'manual').name('Inspect transition').onChange(redrawMaterials);
      gui.add(options,'progress',0,100,1).name('Transition (%)').onChange(()=>{options.manual=true;gui.controllers.forEach(c=>c.updateDisplay());redrawMaterials();});
      gui.add(options,'duration',100,600,25).name('Duration (ms)');
    }
    gui.add(options,'span',100,650,1).name('Map span (m)').onChange(()=>{ui.drive=false;schedule();});
    gui.add(ui,'delay').name('Delay east sector').onChange(reload);
    gui.add({run(){ui.delay=true;ui.pos=95;ui.reverse=true;ui.drive=false;options.span=185;reload();}},'run').name('Arrival with a still camera');
    gui.add({run(){scenario='zoom';scenarioStart=performance.now();playing=false;ui.drive=false;schedule();}},'run').name('Oscillate on the zoom');
    gui.add({run(){scenario='guida';scenarioStart=performance.now();playing=false;ui.drive=true;schedule();}},'run').name('Bend and reversal');
  }else if(widths){
    const settings={selected,previous};
    gui.add(settings,'selected',Object.keys(samples)).name('Section').onChange((value:string)=>{
      query.set('case','widths.'+value);ui.pos=50;reload();
    });
    gui.add(settings,'previous').name('Previous width').onChange((on:boolean)=>{
      setSwitch(query,'on','before',on);reload();
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
    if(renderer.domElement.width!==Math.floor(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.floor(h*renderer.getPixelRatio()))lab.game.setSize(w,h);
    camera.zoom=Math.min(w,h)/(ui.drive?(compact?62:95):(lod?options.span:185));fitPixels(camera,w,h);
    camera.position.copy(car.position).addScaledVector(toCamera,CAMERA_DISTANCE);
    camera.lookAt(car.position);camera.updateMatrixWorld();
    const changesBefore=changes;
    stream.update(camera,car.position,ui.drive);lab.render(now,car.position);
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
  el('status').textContent=section?section.name+' · '+(previous?section.before:section.sides.reduce((a,b)=>a+b,0)).toLocaleString('en')+' m at the middle of the route':'Calle San Nicolás · boundary at −240 m';
  new ResizeObserver(schedule).observe(host);draw(performance.now());lab.ambient(schedule);host.dataset.ready='true';
  return currentParams;
}
