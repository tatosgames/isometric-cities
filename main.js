import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeCity } from './scene.js';

const el=id=>document.getElementById(id);
async function start(){
  const query=new URLSearchParams(location.search);
  const pilot=query.get('area')==='pilot';
  const load=async path=>{const r=await fetch('./data/'+path);if(!r.ok)throw Error(path);return r.json();};
  const neutral=query.has('neutral');
  const [data,poi,roofColours,roofTones]=await Promise.all([load((pilot?'pilot':'city')+'.json'),load('poi.geojson'),
    neutral?null:new T.TextureLoader().loadAsync('./data/roof-colours.webp'),neutral?{}:load('roof-tones.json')]);
  if(roofColours)roofColours.colorSpace=T.SRGBColorSpace;
  const scene=new T.Scene(),host=el('scene'),camera=new T.OrthographicCamera(-1,1,1,-1,1,5000);
  const renderer=new T.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  host.append(renderer.domElement);
  const {group,altitude}=makeCity(data,neutral,roofColours,roofTones);scene.add(group);
  scene.add(new T.HemisphereLight(0xf1f4ff,0x9b9dac,1.38));
  const sun=new T.DirectionalLight(0xfff6ea,2.12);sun.position.set(-550,690,-370);
  sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-850,right:850,top:850,bottom:-850,far:2200});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.00035;sun.shadow.normalBias=.4;scene.add(sun);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableRotate=false;controls.screenSpacePanning=false;controls.enableDamping=false;
  controls.mouseButtons.LEFT=T.MOUSE.PAN;controls.touches.ONE=T.TOUCH.PAN;controls.touches.TWO=T.TOUCH.DOLLY_PAN;
  const direction=new T.Vector3(-.82,1.15,.68).normalize();
  const locations=poi.features.slice(0,pilot?2:6);
  const card=document.querySelector('article'),nav=document.querySelector('nav');
  const toggle=el('index-toggle');
  function menu(open){nav.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));}
  toggle.onclick=()=>menu(!nav.classList.contains('open'));
  let selected=-1,returnTo,frame=0,fit=1;
  const pins=locations.map((f,i)=>{
    const p=f.properties, btn=document.createElement('button'), pin=document.createElement('button');
    const num=String(i+1).padStart(2,'0');
    btn.innerHTML='<b>'+num+'</b>';btn.append(p.name);pin.textContent=num;pin.className='pin';pin.setAttribute('aria-label',p.name);
    el('places').append(btn);el('pins').append(pin);
    const [x,y]=p.xy,point=new T.Vector3(x,altitude(x,y)+(i===0||i===5?2:18),-y);
    for(const button of [btn,pin])button.onclick=()=>{
      returnTo=button;menu(false);selected=i;card.hidden=false;
      document.querySelector('h3').textContent=p.name;
      view(point,Math.max(fit,Math.min(host.clientWidth,host.clientHeight)/245));el('close').focus({preventScroll:true});
    };
    return {btn,pin,point};
  });
  function close(){selected=-1;card.hidden=true;draw();}
  el('close').onclick=()=>{close();(returnTo?.classList.contains('pin')?returnTo:toggle)?.focus();};
  function view(target,zoom){camera.zoom=zoom;camera.updateProjectionMatrix();controls.target.copy(target);camera.position.copy(target).addScaledVector(direction,1500);controls.update();draw();}
  const border=data.boundary.map(([x,y])=>new T.Vector3(x,altitude(x,y),-y));
  const center=new T.Box3().setFromPoints(border).getCenter(new T.Vector3());
  const bounds=new T.Box3().setFromPoints(border);
  function reset(){
    close();const w=host.clientWidth,h=host.clientHeight;
    camera.left=-w/2;camera.right=w/2;camera.top=h/2;camera.bottom=-h/2;
    view(center,1);camera.updateMatrixWorld();
    const box=new T.Box3().setFromPoints(border.map(p=>p.clone().applyMatrix4(camera.matrixWorldInverse)));
    fit=Math.min(w/(box.max.x-box.min.x+60),h/(box.max.y-box.min.y+65))*.92;
    controls.minZoom=fit*.8;controls.maxZoom=Math.max(fit*12,4);
    view(center,fit);
  }
  function draw(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{
      frame=0;
      const constrained=controls.target.clone().clamp(bounds.min,bounds.max);
      camera.position.add(constrained.clone().sub(controls.target));controls.target.copy(constrained);
      camera.updateMatrixWorld();
      renderer.render(scene,camera);
      pins.forEach(({pin,btn,point},i)=>{
        const v=point.clone().project(camera);pin.style.left=(v.x+1)*50+'%';pin.style.top=(1-v.y)*50+'%';
        pin.hidden=Math.abs(v.x)>1||Math.abs(v.y)>1;pin.setAttribute('aria-pressed',String(i===selected));btn.setAttribute('aria-pressed',String(i===selected));
      });
      host.dataset.view=[controls.target.x,controls.target.z,camera.zoom].map(v=>v.toFixed(2)).join(',');
    });
  }
  function zoom(k){camera.zoom=T.MathUtils.clamp(camera.zoom*k,controls.minZoom,controls.maxZoom);camera.updateProjectionMatrix();draw();}
  el('plus').onclick=()=>zoom(1.4);el('minus').onclick=()=>zoom(1/1.4);el('reset').onclick=reset;
  host.onkeydown=e=>{
    if(e.key==='Home')reset();else if(['+','='].includes(e.key))zoom(1.4);else if(e.key==='-')zoom(1/1.4);
    else if(e.key.startsWith('Arrow')){
      const right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
      const up=new T.Vector3().crossVectors(new T.Vector3(0,1,0),right);
      const delta=(['ArrowLeft','ArrowRight'].includes(e.key)?right:up).multiplyScalar((['ArrowLeft','ArrowDown'].includes(e.key)?-1:1)*50/camera.zoom);
      view(controls.target.clone().add(delta),camera.zoom);
    }else return;e.preventDefault();
  };
  controls.addEventListener('change',draw);
  let firstView=true;
  new ResizeObserver(()=>{renderer.setSize(host.clientWidth,host.clientHeight);reset();if(firstView){firstView=false;const start=pilot?pins[0].point:new T.Vector3(-95,11,218);view(start,Math.max(host.clientWidth/340,host.clientHeight/225));}}).observe(host);
  el('status').hidden=true;
}
start().catch(e=>{console.error(e);el('status').textContent='No se pudo abrir el mapa. Comprueba WebGL y los datos locales.';});

