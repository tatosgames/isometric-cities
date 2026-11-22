import * as T from 'three';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import {loadData,isCity,isSectorIndex,isRoofPalette,isLayers} from '../data/load.ts';
import {ringCenter,sectorOwner} from '../data/sector-index.ts';
import {streamCity} from '../render/sectors/sector-stream.ts';
import {carGeometry,carVisualScale} from '../drive/car-model.ts';
import type {Point} from '../data/types.ts';

export async function sectorRoadLab(){
  const el=(id:string)=>document.getElementById(id)!;
  const query=new URLSearchParams(location.search),host=el('view');
  el('tools').hidden=true;
  const [city,index,palette]=await Promise.all([loadData('city.json',isCity),loadData('city-index.json',isSectorIndex),loadData('roof-tones.json',isRoofPalette)]);
  const way=city.roads.find(r=>r.id==='30801332');
  if(!way)throw Error('Tratto Calle San Nicolás assente');
  const path=way.line.map(p=>new T.Vector2(...p)),lengths=[0];
  for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+path[i-1].distanceTo(path[i]));
  const pair=new Set(['-2_-2','-1_-2']),inPair=(p:Point)=>pair.has(sectorOwner(...p,index.sectorSize));
  const layers=query.has('intera')?{...city,...index}:{...city,...index,
    buildings:city.buildings.filter((_,i)=>pair.has(index.buildingOwners[i])),buildingOwners:index.buildingOwners.filter(id=>pair.has(id)),
    trees:city.trees.filter(inPair),ground:city.ground.filter(r=>inPair(ringCenter(r))),sectors:index.sectors.filter(s=>pair.has(s.id))};
  const compact=matchMedia('(pointer:coarse)').matches||screen.width<700;
  const renderer=new T.WebGLRenderer({antialias:!compact,stencil:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,compact?1:1.75));renderer.setClearColor(0xe7e5d5);
  renderer.shadowMap.enabled=!compact;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;
  host.prepend(renderer.domElement);
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-1,1,1,-1,1,5000);
  scene.add(new T.HemisphereLight(0xf1f4ff,0x9b9dac,1.38));
  const sun=new T.DirectionalLight(0xfff6ea,2.12);sun.position.set(-550,690,-370);
  sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-850,right:850,top:850,bottom:-850,far:2200});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.00035;sun.shadow.normalBias=.4;scene.add(sun,sun.target);
  const car=new T.Mesh(carGeometry('#d8452f','#f4ead7',false),new T.MeshStandardMaterial({vertexColors:true,roughness:.8,flatShading:true}));
  car.scale.setScalar(carVisualScale);car.castShadow=true;scene.add(car);
  const ui={legacy:query.has('raster'),reverse:query.has('inverso'),drive:!query.has('mappa'),delay:query.has('ritardo'),
    pos:T.MathUtils.clamp(Number(query.get('pos'))||0,0,100)};
  const ready=new Set<string>();
  const stream=streamCity({data:layers,compact,neutral:false,tones:palette.tones,host,legacyRoads:ui.legacy,
    async loadLayers(s,signal){
      if(ui.delay&&s.id==='-1_-2')await new Promise<void>(r=>setTimeout(r,1800));
      const result=await loadData('city-sectors/'+s.file,isLayers,signal);
      if(result.carriageway)ready.add(s.id);
      return result;
    },refresh(){renderer.shadowMap.needsUpdate=true;schedule();}});
  scene.add(stream.group);
  const gui=new GUI({container:el('gui'),title:'Confine di Calle San Nicolás'});
  function reload(){for(const [key,on] of [['raster',ui.legacy],['inverso',ui.reverse],['mappa',!ui.drive],['ritardo',ui.delay]] as const){
    if(on)query.set(key,'1');else query.delete(key);
  }query.set('pos',String(ui.pos));location.search=query.toString();}
  gui.add(ui,'legacy').name('Confronto raster').onChange(reload);
  gui.add(ui,'delay').name('Ritarda settore est').onChange(reload);
  gui.add(ui,'drive').name('Camera di guida').onChange(reload);
  gui.add(ui,'reverse').name('Senso inverso').onChange(reload);
  const scrub=gui.add(ui,'pos',0,100,.1).name('Percorso (%)').onChange(()=>{playing=false;schedule();});
  gui.add({run(){playing=!playing;if(playing&&ui.pos>=100)ui.pos=0;last=performance.now();schedule();}},'run').name('Avvia / pausa');
  let playing=false,last=0,frame=0;
  function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
  function draw(now:number){
    frame=0;
    if(playing){ui.pos=Math.min(100,ui.pos+(now-last)*.014);if(ui.pos===100)playing=false;last=now;scrub.updateDisplay();}
    const dist=(ui.reverse?100-ui.pos:ui.pos)/100*lengths[lengths.length-1];
    let i=1;while(i<path.length-1&&dist>lengths[i])i++;
    const p=path[i-1].clone().lerp(path[i],(dist-lengths[i-1])/(lengths[i]-lengths[i-1]));
    car.position.set(p.x,stream.altitude(p.x,p.y)+.1,-p.y);car.rotation.y=Math.atan2(path[i].y-path[i-1].y,path[i].x-path[i-1].x)+(ui.reverse?Math.PI:0);
    car.visible=ui.drive;
    const w=host.clientWidth,h=host.clientHeight;
    if(renderer.domElement.clientWidth!==w||renderer.domElement.width!==Math.floor(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.floor(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
    Object.assign(camera,{left:-w/2,right:w/2,top:h/2,bottom:-h/2,zoom:Math.min(w,h)/(ui.drive?(compact?62:95):185)});
    camera.position.copy(car.position).addScaledVector(new T.Vector3(-.82,1.15,.68).normalize(),1500);
    camera.lookAt(car.position);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    stream.update(camera,car.position,ui.drive);renderer.render(scene,camera);
    host.dataset.position=String(ui.pos);host.dataset.meshCells=[...ready].sort().join(',');
    if(playing)schedule();
  }
  el('panel').onclick=()=>{const p=el('settings');p.hidden=!p.hidden;el('panel').setAttribute('aria-expanded',String(!p.hidden));};
  el('status').textContent='Calle San Nicolás · confine a −240 m';
  new ResizeObserver(schedule).observe(host);draw(performance.now());host.dataset.ready='true';
}
