import * as T from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import type { Road } from '../data/types.ts';
import { carGeometry,carVisualScale } from '../drive/car-model.ts';
import { CAMERA_DISTANCE, fitPixels, mapViewDirection } from '../render/map-camera.ts';
import { labCity } from './lab-city.ts';
import { has, query as urlQuery, setPairs, setSwitch, tuned } from '../url-state.ts';

// Both renderings are the game's: the published sectors, once as the map draws them (carriageway meshes on the
// ground triangles) and once with the roads painted in the ground texture, as the map did before (`legacyRoads`).
const labels=['Game · geometric carriageway','Painted roads (legacy)'];
const modes=[0,1] as const;
type Mode=typeof modes[number];
const $=(id:string)=>document.getElementById(id)!;

function makeRoute(roads:Road[]){
  const points:T.Vector2[]=[];
  // Calle Pelota turns into Mendizábal, then into Lugar Mercadillos Municipales.
  for(const id of ['38040579','30913362','38062741']){
    const road=roads.find(r=>r.id===id);
    if(!road)throw Error('Update the Mercado route: an OSM way is missing.');
    const start=new T.Vector2(...road.line[0]);
    if(points.length&&!start.equals(points[points.length-1]))throw Error('The Mercado route is not continuous.');
    for(const p of road.line.slice(points.length?1:0))points.push(new T.Vector2(...p));
  }
  const lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+points[i].distanceTo(points[i-1]));
  function at(fraction:number){
    const dist=T.MathUtils.clamp(fraction,0,1)*lengths[lengths.length-1];
    let i=1;while(i<points.length-1&&lengths[i]<dist)i++;
    return points[i-1].clone().lerp(points[i],(dist-lengths[i-1])/(lengths[i]-lengths[i-1]));
  }
  return {at,points,duration:lengths[lengths.length-1]/13};
}

export async function roadLab(){
  const host=$('view'),query=urlQuery();
  const lab=await labCity(host,query);
  const {city,index,compact,renderer,scene,camera}=lab;
  const route=makeRoute(city.roads);
  // The sectors under the route and one ring around it, so the view never reaches an empty edge.
  const size=index.sectorSize,cells=new Set<string>();
  for(const p of route.points){
    const x=Math.floor(p.x/size),y=Math.floor(p.y/size);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)cells.add((x+dx)+'_'+(y+dy));
  }
  let frame=0;
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(draw);};
  const streams=modes.map(mode=>lab.stream({keep:id=>cells.has(id),legacyRoads:mode===1,
    refresh(){renderer.shadowMap.needsUpdate=true;schedule();}}));
  const car=new T.Mesh(carGeometry('#d8452f','#f4ead7',false),new T.MeshStandardMaterial({vertexColors:true,roughness:.8,flatShading:true}));
  car.scale.setScalar(carVisualScale);car.castShadow=true;car.receiveShadow=true;scene.add(car);
  const initialMode=query.get('mode')==='painted'?1:0;
  const ui={variant:labels[initialMode],distance:T.MathUtils.clamp(tuned(query,'pos',0),0,100)};
  let mode:Mode=0,playing=false,measuring=false,last=0;
  const gui=new GUI({container:$('gui'),title:'Carriageway comparison'});
  const variant=gui.add(ui,'variant',labels).name('Rendering').onChange(()=>{select(labels.indexOf(ui.variant) as Mode);schedule();});
  const scrub=gui.add(ui,'distance',0,100,.1).name('Route (%)').onChange(()=>{pause();schedule();});
  function select(n:Mode){
    mode=n;ui.variant=labels[n];variant.updateDisplay();host.dataset.roadMode=String(n);
  }
  const show=(n:Mode)=>streams.forEach((s,i)=>{s.group.visible=i===n;});
  const split=$('split') as HTMLInputElement, divider=$('divider');
  const compareInput=$('compare') as HTMLInputElement;
  compareInput.checked=has(query,'on','compare');
  split.value=String(tuned(query,'split',50));
  const compare=()=>compareInput.checked&&!measuring;
  const direction=mapViewDirection();
  function draw(time:number){
    frame=0;
    if(playing){
      ui.distance=Math.min(100,ui.distance+(time-last)/1000/route.duration*100);last=time;
      if(ui.distance>=100)pause();else schedule();
    }
    const t=ui.distance/100,p=route.at(t),heading=route.at(t+.004).sub(route.at(t-.004));
    car.position.set(p.x,streams[0].altitude(p.x,p.y)+.08,-p.y);car.rotation.y=Math.atan2(heading.y,heading.x);
    const w=host.clientWidth,h=host.clientHeight;
    if(renderer.domElement.width!==Math.floor(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.floor(h*renderer.getPixelRatio()))lab.game.setSize(w,h);
    camera.zoom=Math.min(w,h)/(compact?62:95);fitPixels(camera,w,h);
    camera.position.copy(car.position).addScaledVector(direction,CAMERA_DISTANCE);camera.lookAt(car.position);camera.updateMatrixWorld();
    // Ready once both renderings hold their sectors: before that a capture shows the overview.
    const busy=streams.map(s=>s.update(camera,car.position,true).busy).some(Boolean);
    if(!busy)host.dataset.ready='true';
    split.hidden=divider.hidden=!compare();
    if(compare()){
      const left=Math.round(w*Number(split.value)/100);
      divider.style.left=split.value+'%';renderer.setScissorTest(true);
      show(0);renderer.setScissor(0,0,left,h);lab.render(time,car.position);
      show(1);renderer.setScissor(left,0,w-left,h);lab.render(time,car.position);
      renderer.setScissorTest(false);
    }else{show(mode);lab.render(time,car.position);}
    scrub.updateDisplay();
  }
  split.oninput=schedule;compareInput.onchange=schedule;
  function drag(e:PointerEvent){
    const rect=host.getBoundingClientRect();split.value=String(100*(e.clientX-rect.left)/rect.width);schedule();
  }
  divider.onpointerdown=e=>{divider.setPointerCapture(e.pointerId);drag(e);};
  divider.onpointermove=e=>{if(divider.hasPointerCapture(e.pointerId))drag(e);};
  function pause(){playing=false;play.name('Start route');}
  const play=gui.add({play(){
    if(playing){pause();return;}
    if(ui.distance>=100)ui.distance=0;
    playing=true;last=performance.now();play.name('Pause');schedule();
  }},'play').name('Start route');
  gui.add({reset(){pause();ui.distance=0;scrub.updateDisplay();schedule();}},'reset').name('Restart from Calle Pelota');
  // The same positions with one rendering per frame, each after its sectors are in.
  async function measure(){
    if(measuring)return;pause();measuring=true;gui.domElement.inert=true;
    const panel=$('settings');
    // A shorter status message must not resize the mobile canvas mid-pass.
    panel.style.height=panel.getBoundingClientRect().height+'px';
    const savedMode=mode,savedDistance=ui.distance,rows:string[]=[];
    const w=host.clientWidth,h=host.clientHeight;
    const next=()=>new Promise<number>(resolve=>requestAnimationFrame(resolve));
    try{
      for(const n of modes){
        select(n);$('status').textContent='Measuring · '+labels[n];
        const times:number[]=[];let calls=0,tris=0,prev=await next();
        for(let i=0;i<120;i++){
          if(document.hidden||host.clientWidth!==w||host.clientHeight!==h)throw Error('Measurement interrupted. Repeat with the window visible and steady.');
          ui.distance=(i%60)*100/59;draw(prev);const now=await next();
          if(i>=60){times.push(now-prev);calls+=renderer.info.render.calls;tris+=renderer.info.render.triangles;}prev=now;
        }
        times.sort((a,b)=>a-b);
        rows.push(labels[n]+'\np95 '+times[56].toFixed(1)+' ms · '+Math.round(calls/60)+' draw · '+Math.round(tris/60)+' triangles');
      }
      $('metrics').textContent=rows.join('\n\n');$('status').textContent='Same sectors, look and quality level as the game.';
    }catch(e){$('status').textContent=String(e);}
    finally{panel.style.height='';select(savedMode);ui.distance=savedDistance;measuring=false;gui.domElement.inert=false;schedule();}
  }
  gui.add({measure},'measure').name('Measure the two renderings');
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause();});
  select(initialMode);new ResizeObserver(schedule).observe(host);schedule();
  lab.ambient(()=>{if(!measuring)schedule();});
  $('status').textContent='Calle Pelota → Calle de Mendizábal → Lugar Mercadillos Municipales';
  return ()=>{
    const params=new URLSearchParams(query);
    if(mode)params.set('mode','painted');else params.delete('mode');
    setSwitch(params,'on','compare',compareInput.checked);
    setPairs(params,'tune',[['pos',ui.distance.toFixed(2)],...compareInput.checked?[['split',split.value] as const]:[]]);
    return params;
  };
}
