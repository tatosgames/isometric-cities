import * as T from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { isCity,isRoofPalette,loadData } from '../data/load.ts';
import { buildStudy,defaults,presets,subset,type Options,type Sample } from './variants.ts';
import { limits,parseRecipe,views,zones,type Pose,type Recipe } from './recipe.ts';

const element=<E extends HTMLElement>(id:string)=>document.getElementById(id) as E;
const status=element('status'),host=element('view'),panel=element('settings');
const frame=()=>new Promise<number>(resolve=>requestAnimationFrame(resolve));
function download(blob:Blob,name:string){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
async function start(){
  const [city,{tones}]=await Promise.all([loadData('city.json',isCity),loadData('roof-tones.json',isRoofPalette)]);
  if(!tones)throw Error('Palette tetti mancante.');
  const compact=matchMedia('(pointer:coarse)').matches||screen.width<700;
  const renderer=new T.WebGLRenderer({antialias:!compact,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,compact?1:1.75));renderer.setClearColor(0xe7e5d5);
  renderer.shadowMap.enabled=!compact;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  host.prepend(renderer.domElement);
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,1,5000);
  scene.add(new T.HemisphereLight(0xf1f4ff,0x9b9dac,1.38));
  const sun=new T.DirectionalLight(0xfff6ea,2.12);
  sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-850,right:850,top:850,bottom:-850,far:2200});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00035;sun.shadow.normalBias=.4;scene.add(sun,sun.target);
  const orbit=new OrbitControls(camera,renderer.domElement);orbit.maxPolarAngle=Math.PI*.475;orbit.enableDamping=false;
  const gui=new GUI({container:element('gui'),title:'Confronto visivo'});
  const capture=element<HTMLCanvasElement>('capture'),ctx=capture.getContext('2d')!,divider=element('divider'),slider=element<HTMLInputElement>('split');
  let a={...defaults};const b={...defaults},ui={zone:'mercado',view:'Isometrica',preset:'Originale'};
  type Model=ReturnType<typeof buildStudy>;
  let reference:Model|null=null,variant:Model|null=null, sample:Sample,data:ReturnType<typeof subset>,photo:HTMLImageElement;
  let generation=0,mode='split',moving=false,scheduled=false,busy=false,loading=true,baselineMs=0,variantMs=0;
  const key='las-palmas:visual-lab:v1';
  function pose():Pose{return {position:camera.position.toArray(),target:orbit.target.toArray(),span:Math.min(host.clientWidth,host.clientHeight)/camera.zoom};}
  function save(){if(loading||busy)return;try{localStorage.setItem(key,JSON.stringify(recipe()));}catch{/* optional persistence */}}
  function recipe():Recipe{return {version:1,zone:ui.zone,view:ui.view,camera:pose(),a:{...a},b:{...b}};}
  function compare(){
    const show=!moving&&!loading&&!busy&&mode!=='B';
    capture.hidden=!show;divider.hidden=!show||mode!=='split';
    capture.style.clipPath=mode==='split'?'inset(0 '+(100-Number(slider.value))+'% 0 0)':'none';
    divider.style.left=slider.value+'%';slider.hidden=mode!=='split';
    for(const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===mode));
  }
  function render(model:Model,shadow=true){
    if(reference)reference.group.visible=model===reference;
    if(variant)variant.group.visible=model===variant;
    if(shadow)renderer.shadowMap.needsUpdate=true;
    renderer.render(scene,camera);
  }
  let captured='';
  function paint(){
    if(!variant||!reference||loading||busy)return;
    const signature=JSON.stringify([pose(),renderer.domElement.width,renderer.domElement.height]);
    if(!moving&&captured!==signature){
      render(reference);captured=signature;capture.width=renderer.domElement.width;capture.height=renderer.domElement.height;
      ctx.drawImage(renderer.domElement,0,0);
    }
    render(variant);compare();
  }
  function requestPaint(){
    if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;paint();});
  }
  function restore(p:Pose){
    orbit.target.fromArray(p.target);camera.position.fromArray(p.position);
    camera.zoom=Math.min(host.clientWidth,host.clientHeight)/p.span;camera.updateProjectionMatrix();orbit.update();
  }
  const chooseView=()=>{
    if(!variant)return;
    const [x,y]=sample.center,alt=variant.altitude(x,y);
    const direction=ui.view==='Dall’alto'?new T.Vector3(-.05,1,.04):new T.Vector3(-.82,1.15,.68);
    const target=new T.Vector3(x,alt+(ui.view==='Guida'?5:0),-y);
    restore({target:target.toArray(),position:target.clone().addScaledVector(direction.normalize(),1500).toArray(),span:ui.view==='Guida'?(compact?62:95):ui.view==='Dall’alto'?235:165});
    requestPaint();save();
  };
  let lastShort=0;
  function resize(){
    const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
    const short=Math.min(w,h);if(lastShort)camera.zoom*=short/lastShort;lastShort=short;
    Object.assign(camera,{left:-w/2,right:w/2,top:h/2,bottom:-h/2});camera.updateProjectionMatrix();
    renderer.setSize(w,h,false);requestPaint();
  }
  new ResizeObserver(resize).observe(host);resize();
  orbit.addEventListener('start',()=>{moving=true;compare();requestPaint();});
  orbit.addEventListener('change',requestPaint);
  orbit.addEventListener('end',()=>{moving=false;requestPaint();save();});
  function replace(side:'a'|'b'){
    const before=performance.now(),next=buildStudy(data,sample,photo,tones!,compact,{...(side==='a'?a:b)});
    const old=side==='a'?reference:variant;
    if(old){scene.remove(old.group);old.dispose();}
    scene.add(next.group);
    if(side==='a'){captured='';reference=next;baselineMs=performance.now()-before;}else{variant=next;variantMs=performance.now()-before;}
  }
  function refreshGui(){gui.controllersRecursive().forEach(c=>c.updateDisplay());}
  function dirty(){ui.preset='Personalizzato';element('metrics').textContent='';refreshGui();}
  function rebuild(){if(loading||busy)return;replace('b');requestPaint();save();}
  async function loadZone(cameraPose?:Pose){
    const token=++generation;loading=true;compare();orbit.enabled=false;host.dataset.ready='false';status.textContent='Caricamento campione…';
    const id=ui.zone;
    try{
      const img=new Image();img.src=new URL(`./samples/${id}.webp`,import.meta.url).href;
      const [meta]=await Promise.all([fetch(new URL(`./samples/${id}.json`,import.meta.url)).then(r=>{if(!r.ok)throw Error('Campione mancante');return r.json() as Promise<Sample>;}),img.decode()]);
      if(token!==generation)return;
      sample=meta;photo=img;data=subset(city,meta);
      const [x,y]=meta.center;sun.target.position.set(x,0,-y);sun.position.set(x-550,690,-y-370);
      replace('a');replace('b');loading=false;orbit.enabled=true;
      if(cameraPose)restore(cameraPose);else chooseView();
      paint();save();refreshGui();host.dataset.ready='true';host.dataset.zone=id;
      status.textContent=data.buildings.length+' parti di edificio · '+data.trees.length+' alberi';element('metrics').textContent='';
    }catch(e){if(token===generation){status.textContent=String(e);host.dataset.ready='error';}}
  }
  function applyOptions(values:Partial<Options>){Object.assign(b,defaults,values);refreshGui();rebuild();element('metrics').textContent='';}
  gui.add(ui,'zone',zones).name('Zona').onChange(()=>void loadZone());
  gui.add(ui,'view',Array.from(views)).name('Inquadratura').onChange(chooseView);
  gui.add(ui,'preset',[...Object.keys(presets),'Suolo + facciate','Combinato','Personalizzato']).name('Variante B').onChange((v:string)=>{
    if(v==='Personalizzato')return;
    applyOptions(v==='Suolo + facciate'?{...presets.Suolo,...presets.Facciate}:v==='Combinato'?Object.assign({},...Object.values(presets),{contact:false}):presets[v as keyof typeof presets]);
  });
  function action(folder:GUI,label:string,fn:()=>unknown){folder.add({run:fn},'run').name(label);}
  const groups:[string,[keyof Options,string][]][]=[
    ['Suolo',[['osm','Materiali OSM'],['grain','Trama'],['steps','Segno dei gradini']]],
    ['Facciate',[['frontage','Fronte strada'],['bay','Passo campate (m)'],['shared','Ometti aperture coperte']]],
    ['Tetti',[['roof','Intensità PNOA'],['area','Area minima (m²)'],['furniture','Arredi procedurali']]],
    ['Pendio',[['slope','Base aderente'],['contact','Profilo di contatto']]],
    ['Verde illustrativo',[['canopy','Portamento per contesto'],['radius','Variazione raggio'],['height','Variazione altezza']]]
  ];
  for(const [name,fields] of groups){
    const folder=gui.addFolder(name).close();
    for(const [k,label] of fields){
      const range=limits[k as keyof typeof limits];
      const c=range?folder.add(b,k as keyof typeof limits,range[0],range[1],k==='area'?1:.01):folder.add(b,k as Exclude<keyof Options,keyof typeof limits>);
      c.name(label);
      if(k==='grain'||k==='roof'){

        c.onChange(()=>{if(loading||busy)return;dirty();
          if(k==='roof'&&(b.roof>0)!==variant?.hasRoof){replace('b');}
          else variant?.live(k,b[k]);
          requestPaint();});
        c.onFinishChange(()=>{save();});
      }else c.onFinishChange(()=>{dirty();rebuild();});
    }
    action(folder,'Ripristina gruppo',()=>{for(const [k] of fields)Object.assign(b,{[k]:defaults[k]});dirty();rebuild();});
  }
  action(gui,'Usa B come riferimento',()=>{if(loading||busy)return;a={...b};replace('a');requestPaint();save();element('metrics').textContent='';});
  action(gui,'Ripristina originale',()=>{a={...defaults};ui.preset='Originale';if(!loading)replace('a');applyOptions({});});
  async function measure(){
    if(busy||loading||!reference||!variant)return;
    busy=true;gui.domElement.inert=true;orbit.enabled=false;compare();
    const initial=pose(),rows:string[]=[],scores:number[][]=[];
    const width=renderer.domElement.width,height=renderer.domElement.height;
    try{
      for(const [label,model,ms] of [['A',reference,baselineMs],['B',variant,variantMs]] as const){
        status.textContent='Misurazione '+label+'…';restore(initial);render(model);
        const intervals:number[]=[];let previous=await frame(),calls=0,tris=0;
        for(let i=0;i<48;i++){
          if(document.hidden||width!==renderer.domElement.width||height!==renderer.domElement.height){
            status.textContent='Misura interrotta: ripetere con finestra visibile e dimensioni stabili.';return;
          }
          const dx=12*Math.sin(2*Math.PI*i/24);camera.position.x=initial.position[0]+dx;orbit.target.x=initial.target[0]+dx;orbit.update();
          render(model,false);const now=await frame();
          if(i>=24){intervals.push(now-previous);calls+=renderer.info.render.calls;tris+=renderer.info.render.triangles;}previous=now;
        }
        intervals.sort((a,b)=>a-b);
        const values=[intervals[Math.ceil(intervals.length*.95)-1],calls/24,tris/24,ms];
        scores.push(values);rows.push(label+'   '+values.map((v,i)=>i===0||i===3?v.toFixed(1):Math.round(v)).join('  /  '));
      }
      rows.push('Δ   '+scores[1].map((v,i)=>(v-scores[0][i]).toFixed(i===0||i===3?1:0)).join('  /  '));
      element('metrics').textContent='p95 ms / draw call / triangoli / build CPU ms\n'+rows.join('\n');
      status.textContent='Misura completata';
    }finally{restore(initial);busy=false;gui.domElement.inert=false;orbit.enabled=true;paint();}
  }
  action(gui,'Misura A/B',()=>void measure());
  action(gui,'Esporta ricetta',()=>download(new Blob([JSON.stringify(recipe(),null,2)],{type:'application/json'}),ui.zone+'.json'));
  const file=element<HTMLInputElement>('file');
  action(gui,'Importa ricetta',()=>file.click());
  async function applyRecipe(r:Recipe){ui.zone=r.zone;ui.view=r.view;ui.preset='Personalizzato';a={...r.a};Object.assign(b,r.b);await loadZone(r.camera);}
  file.onchange=async()=>{try{if(file.files?.[0])await applyRecipe(parseRecipe(await file.files[0].text()));}catch(e){status.textContent=String(e);}finally{file.value='';}};
  action(gui,'Scarica confronto PNG',()=>{
    if(loading||busy||!variant)return;
    paint();const canvas=document.createElement('canvas');canvas.width=capture.width;canvas.height=capture.height;
    const out=canvas.getContext('2d')!;out.drawImage(renderer.domElement,0,0);
    if(mode!=='B'){out.save();out.beginPath();out.rect(0,0,canvas.width*(mode==='A'?1:+slider.value/100),canvas.height);out.clip();out.drawImage(capture,0,0);out.restore();}
    if(mode==='split'){out.fillStyle='#faf8ee';out.fillRect(canvas.width*(+slider.value/100)-1,0,2,canvas.height);}
    const caption=[ui.zone+' · '+(mode==='split'?'A | B':mode),'Comune di Las Palmas · © OpenStreetMap contributors','PNOA / MDT05 © IGN'];
    out.font='12px sans-serif';
    const lines=out.measureText(caption.join(' · ')).width+12<=canvas.width?[caption.join(' · ')]:caption;
    const bar=lines.length*16+6;
    out.fillStyle='#faf8ee';out.fillRect(0,canvas.height-bar,canvas.width,bar);out.fillStyle='#27342c';
    lines.forEach((text,i)=>out.fillText(text,6,canvas.height-bar+15+i*16));
    canvas.toBlob(blob=>{if(blob)download(blob,ui.zone+'-confronto.png');});
  });
  host.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(btn=>btn.onclick=()=>{mode=btn.dataset.mode!;compare();});
  slider.oninput=compare;
  function dragDivider(e:PointerEvent){
    const rect=host.getBoundingClientRect();
    slider.value=String(T.MathUtils.clamp(100*(e.clientX-rect.left)/rect.width,0,100));compare();
  }
  divider.onpointerdown=e=>{divider.setPointerCapture(e.pointerId);dragDivider(e);};
  divider.onpointermove=e=>{if(divider.hasPointerCapture(e.pointerId))dragDivider(e);};
  const panelButton=element('panel');panelButton.onclick=()=>{panel.hidden=!panel.hidden;panelButton.setAttribute('aria-expanded',String(!panel.hidden));};
  let saved:Recipe|null=null;try{const raw=localStorage.getItem(key);if(raw)saved=parseRecipe(raw);}catch{/* stale recipe */}
  if(saved)await applyRecipe(saved);else await loadZone();
}
const run=new URLSearchParams(location.search).get('test')==='strade'
  ? import('./road-lab.ts').then(m=>m.roadLab()) : start();
run.catch(e=>{status.textContent=String(e);console.error(e);});
