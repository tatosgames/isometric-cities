import * as T from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { loadData,isCity,isRoofPalette } from '../data/load.ts';
import type { Bounds,Ring,Road } from '../data/types.ts';
import { carGeometry,carVisualScale } from '../drive/car-model.ts';
import { makeCity } from '../render/scene.ts';
import { makeGroundMap } from '../render/ground-map.ts';
import { cityMaterials } from '../render/city-materials.ts';
import { breezy } from '../render/wind.ts';
import { subset,type Sample } from './variants.ts';

const labels=['Attuale','Texture 4 px/m pulita','Carreggiata geometrica'];
const modes=[0,1,2] as const;
const asphalt=new T.Color('#626575');
type Mode=typeof modes[number];
interface Carriageway {vertices:number[];outlines:Ring[][]}
const $=(id:string)=>document.getElementById(id)!;
async function asset<A>(url:URL){
  const res=await fetch(url);if(!res.ok)throw Error('Dati del test non disponibili');return res.json() as Promise<A>;
}
function makeMask(outlines:Ring[][],[x,y,u,v]:Bounds){
  const canvas=document.createElement('canvas');
  canvas.width=(u-x)*4;canvas.height=(v-y)*4;
  const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='black';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.setTransform(4,0,0,-4,-x*4,v*4);ctx.fillStyle='white';
  for(const polygon of outlines){
    ctx.beginPath();for(const ring of polygon){ctx.moveTo(...ring[0]);for(const p of ring.slice(1))ctx.lineTo(...p);ctx.closePath();}
    ctx.fill('evenodd');
  }
  // Single-channel coverage at the target density; no RGBA colour atlas for the mask.
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const bytes=new Uint8Array(canvas.width*canvas.height);
  for(let i=0;i<bytes.length;i++)bytes[i]=rgba[i*4];
  const texture=new T.DataTexture(bytes,canvas.width,canvas.height,T.RedFormat);
  texture.flipY=true;texture.generateMipmaps=true;texture.magFilter=T.LinearFilter;
  texture.minFilter=T.LinearMipmapLinearFilter;texture.needsUpdate=true;
  return texture;
}
function makeRoute(roads:Road[]){
  const points:T.Vector2[]=[];
  // Calle Pelota turns into Mendizábal, then into Lugar Mercadillos Municipales.
  for(const id of ['38040579','30913362','38062741']){
    const road=roads.find(r=>(r as Road & {id:string}).id===id);
    if(!road)throw Error('Aggiornare il percorso Mercado: tratto OSM mancante.');
    const start=new T.Vector2(...road.line[0]);
    if(points.length&&!start.equals(points[points.length-1]))throw Error('Percorso Mercado discontinuo.');
    for(const p of road.line.slice(points.length?1:0))points.push(new T.Vector2(...p));
  }
  const lengths=[0];
  for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+points[i].distanceTo(points[i-1]));
  function at(fraction:number){
    const dist=T.MathUtils.clamp(fraction,0,1)*lengths[lengths.length-1];
    let i=1;while(i<points.length-1&&lengths[i]<dist)i++;
    return points[i-1].clone().lerp(points[i],(dist-lengths[i-1])/(lengths[i]-lengths[i-1]));
  }
  return {at,duration:lengths[lengths.length-1]/13};
}
export async function roadLab(){
  $('tools').hidden=true;$('capture').hidden=true;$('divider').hidden=true;
  const link=$('road-test') as HTMLAnchorElement;link.textContent='Laboratorio A/B';link.href='./lab.html';
  $('title').textContent='Test strade · Mercado';
  const [city,palette,sample,surface]=await Promise.all([
    loadData('city.json',isCity),loadData('roof-tones.json',isRoofPalette),
    asset<Sample>(new URL('./samples/mercado.json',import.meta.url)),
    asset<Carriageway>(new URL('./mercado-carriageway.json',import.meta.url))
  ]);
  const host=$('view'),data=subset(city,sample),route=makeRoute(data.roads);
  const compact=matchMedia('(pointer:coarse)').matches||screen.width<700;
  const renderer=new T.WebGLRenderer({antialias:!compact,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,compact?1:1.75));renderer.setClearColor(0xe7e5d5);
  renderer.shadowMap.enabled=!compact;renderer.shadowMap.type=T.PCFShadowMap;host.prepend(renderer.domElement);
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,1,5000);
  scene.add(new T.HemisphereLight(0xf1f4ff,0x9b9dac,1.38));
  const sun=new T.DirectionalLight(0xfff6ea,2.12);
  sun.target.position.set(sample.center[0],0,-sample.center[1]);sun.position.copy(sun.target.position).add(new T.Vector3(-550,690,-370));
  sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-850,right:850,top:850,bottom:-850,far:2200});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00035;sun.shadow.normalBias=.4;scene.add(sun,sun.target);
  const original=makeCity(data,false,palette.tones,compact);scene.add(original.group);
  const footways=new Set(['steps','footway','path','pedestrian','cycleway']);
  const base={...data,roads:data.roads.filter(r=>footways.has(r.kind))};
  const raster=makeGroundMap(base,undefined,4),vector=makeGroundMap(base);
  raster.flatRoad={mask:makeMask(surface.outlines,sample.bounds),color:asphalt};
  const materials=[original.materials.mat,cityMaterials(false,raster).mat,cityMaterials(false,vector).mat];
  const targets:T.Mesh[]=[];
  original.group.traverse(obj=>{if(obj instanceof T.Mesh && obj.material===original.materials.mat)targets.push(obj);});
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(surface.vertices,3));geometry.computeVertexNormals();
  const pavement=new T.Mesh(geometry,breezy(new T.MeshStandardMaterial({color:asphalt,flatShading:true,roughness:1,side:T.DoubleSide,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})));
  pavement.receiveShadow=true;scene.add(pavement);
  const car=new T.Mesh(carGeometry('#d8452f','#f4ead7',false),new T.MeshStandardMaterial({vertexColors:true,roughness:.8,flatShading:true}));
  car.scale.setScalar(carVisualScale);car.castShadow=true;car.receiveShadow=true;scene.add(car);
  const ui={variant:labels[0],distance:0};
  let mode:Mode=0,playing=false,measuring=false,last=0,animation=0;
  const gui=new GUI({container:$('gui'),title:'Confronto carreggiata'});
  const variant=gui.add(ui,'variant',labels).name('Resa').onChange(()=>{select(labels.indexOf(ui.variant) as Mode);draw();});
  const scrub=gui.add(ui,'distance',0,100,.1).name('Percorso (%)').onChange(()=>{pause();draw();});
  function select(n:Mode){
    mode=n;ui.variant=labels[n];variant.updateDisplay();host.dataset.roadMode=String(n);
    for(const mesh of targets)mesh.material=materials[n];
    pavement.visible=n===2;
  }
  function draw(){
    const t=ui.distance/100,p=route.at(t),heading=route.at(t+.004).sub(route.at(t-.004));
    car.position.set(p.x,original.altitude(p.x,p.y)+.08,-p.y);car.rotation.y=Math.atan2(heading.y,heading.x);
    camera.position.copy(car.position).addScaledVector(direction,1500);camera.lookAt(car.position);renderer.render(scene,camera);
    scrub.updateDisplay();
  }
  const direction=new T.Vector3(-.82,2.28,.68).normalize();
  function size(){
    const w=host.clientWidth,h=host.clientHeight;
    Object.assign(camera,{left:-w/2,right:w/2,top:h/2,bottom:-h/2,zoom:Math.min(w,h)/(compact?62:95)});
    camera.updateProjectionMatrix();renderer.setSize(w,h,false);draw();
  }
  function pause(){playing=false;cancelAnimationFrame(animation);play.name('Avvia percorso');}
  function tick(now:number){
    if(!playing)return;
    ui.distance=Math.min(100,ui.distance+(now-last)/1000/route.duration*100);last=now;draw();
    if(ui.distance>=100)pause();else animation=requestAnimationFrame(tick);
  }
  const play=gui.add({play(){
    if(playing){pause();return;}
    if(ui.distance>=100)ui.distance=0;
    playing=true;last=performance.now();play.name('Pausa');animation=requestAnimationFrame(tick);
  }},'play').name('Avvia percorso');
  gui.add({reset(){pause();ui.distance=0;draw();}},'reset').name('Riparti da Calle Pelota');
  // Compare the same set of positions with one active road representation per frame.
  async function measure(){
    if(measuring)return;pause();measuring=true;gui.domElement.inert=true;
    const savedMode=mode,savedDistance=ui.distance,rows:string[]=[];
    const w=host.clientWidth,h=host.clientHeight;
    const next=()=>new Promise<number>(resolve=>requestAnimationFrame(resolve));
    try{
      for(const n of modes){
        select(n);$('status').textContent='Misurazione · '+labels[n];
        const times:number[]=[];let calls=0,tris=0,prev=await next();
        for(let i=0;i<120;i++){
          if(document.hidden||host.clientWidth!==w||host.clientHeight!==h)throw Error('Misura interrotta. Ripetere con la finestra visibile e stabile.');
          ui.distance=(i%60)*100/59;draw();const now=await next();
          if(i>=60){times.push(now-prev);calls+=renderer.info.render.calls;tris+=renderer.info.render.triangles;}prev=now;
        }
        times.sort((a,b)=>a-b);
        const map=[original.groundMap!,raster,vector][n],im=map.texture.image;
        const maskBytes=n===1?im.width*im.height:0;
        const meshBytes=n===2?(geometry.attributes.position.array.byteLength+geometry.attributes.normal.array.byteLength):0;
        const bytes=(im.width*im.height*4+maskBytes)*4/3+meshBytes;
        rows.push(labels[n]+'\np95 '+times[56].toFixed(1)+' ms · '+Math.round(calls/60)+' draw · '+Math.round(tris/60)+' triangoli · '+(bytes/1048576).toFixed(2)+' MiB suolo');
      }
      $('metrics').textContent=rows.join('\n\n');$('status').textContent='Memoria stimata dei dati del suolo attivi, inclusi mipmap e mesh stradale.';
    }catch(e){$('status').textContent=String(e);}
    finally{select(savedMode);ui.distance=savedDistance;measuring=false;gui.domElement.inert=false;draw();}
  }
  gui.add({measure},'measure').name('Misura le tre rese');
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing)pause();});
  $('panel').onclick=()=>{const el=$('settings');el.hidden=!el.hidden;$('panel').setAttribute('aria-expanded',String(!el.hidden));};
  select(0);size();new ResizeObserver(size).observe(host);
  $('status').textContent='Calle Pelota → Calle de Mendizábal → Lugar Mercadillos Municipales';
  host.dataset.ready='true';
}
