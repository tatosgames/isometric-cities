// Tuning panel for the drive (`index.html?lab=guida`). It edits `TUNE` in place while the real game runs:
// the changed values live in the URL and can be copied as lines for `drive-tune.ts`.
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import {TUNE} from '../drive/drive-tune.ts';
import type {makeDrive} from '../drive/drive.ts';
import './drive-lab.css';

type Unit={name: 'deg' | 'kmh' | '';scale: number};
type Leaf={path: string;owner: Record<string,number>;key: string;unit: Unit;initial: number};
const DEG: Unit={name:'deg',scale:180/Math.PI},KMH: Unit={name:'kmh',scale:3.6},RAW: Unit={name:'',scale:1};
const angles=/^(turn|turnLow|turnRamp|recover|driftRecover|releaseRecover|maxSlip|bonusSlip|pitch|pose(Yaw|Roll|YawLimit|Lift|Dive))$/;
const unitOf=(key: string)=>angles.test(key)?DEG:/^(baseSpeed|topSpeed)$/.test(key)?KMH:RAW;
// Read once when the drive world is built: changing them here would do nothing.
const fixed=new Set(['treeClearance']);
const nested: Record<string,string>={player:'Giocatore',patrol:'Pattuglie',slope:'Pendenza',cameraModes:'Viste di guida',fixed:'Isométrica',high:'Aérea',chase:'Seguimiento'};
const groups: [title: string,keys: RegExp][]=[
  ['Urti e frenata',/^(brake|deflect|radius|treeRadius|bounce|wallLoss|scrape)/],
  ['Auto a schermo',/^(visualScale|roll|tailSwing|hop|playerHop|dive|skidSpeed|pose|puff|spark)/],
  ['Camera ed effetti',/^(zoom|paceRate|leadRate|followRate|kick|viewSpan|stop)/],
  ['Inseguimento',/^(catch|grace|chaser|wreck|stuckTime)/],
  ['Monete e meta',/^(coin|magnet|arrive)/]
];
const round=(v: number)=>Number(v.toPrecision(6));

export function driveLab({drive,host,begin}: {drive: ReturnType<typeof makeDrive>;host: HTMLElement;begin: () => void}){
  const query=new URLSearchParams(location.search);
  const leaves: Leaf[]=[];
  // The panel shows degrees and km/h; `TUNE` keeps radians and metres per second.
  const shown: Record<string,number>={};
  const panel=document.createElement('aside');panel.id='drive-lab';
  const readout=document.createElement('output');
  const gui=new GUI({container:panel,title:'Guida · taratura'});
  panel.append(readout);document.body.append(panel);
  const controllers=new Map<string,ReturnType<GUI['add']>>();

  function add(folder: GUI,owner: Record<string,number>,key: string,path: string){
    const unit=unitOf(key),initial=owner[key];
    leaves.push({path,owner,key,unit,initial});
    shown[path]=round(initial*unit.scale);
    const top=Math.abs(shown[path])||1;
    const step=10**Math.floor(Math.log10(top))/100;
    const controller=folder.add(shown,path,0,round(top*3),step).name(key+(unit.name?' ('+(unit.name==='deg'?'°':'km/h')+')':''))
      .onChange((value: number)=>{owner[key]=value/unit.scale;changed();});
    controllers.set(path,controller);
  }
  function walk(folder: GUI,node: Record<string,unknown>,prefix: string){
    for(const [key,value] of Object.entries(node)){
      if(typeof value==='number'){if(!fixed.has(key))add(folder,node as Record<string,number>,key,prefix+key);}
      else if(value && typeof value==='object')walk(folder.addFolder(nested[key]??key).close(),value as Record<string,unknown>,prefix+key+'.');
    }
  }
  const state={police:!query.has('nopolice')};
  gui.add(state,'police').name('Polizia').onChange((on: boolean)=>{drive.setPolice(on);store();});
  gui.add({run(){drive.respawn();host.focus({preventScroll:true});}},'run').name('Torna al via');
  const tree=TUNE as unknown as Record<string,unknown>;
  for(const key of ['player','patrol'])walk(gui.addFolder(nested[key]).close(),tree[key] as Record<string,unknown>,key+'.');
  for(const [title,keys] of groups){
    const folder=gui.addFolder(title).close();
    for(const [key,value] of Object.entries(tree))if(typeof value==='number' && keys.test(key) && !fixed.has(key))add(folder,tree as Record<string,number>,key,key);
  }
  for(const key of ['slope','cameraModes'])walk(gui.addFolder(nested[key]).close(),tree[key] as Record<string,unknown>,key+'.');

  const differs=(leaf: Leaf)=>Math.abs(leaf.owner[leaf.key]-leaf.initial)>1e-9*Math.max(1,Math.abs(leaf.initial));
  function store(){
    const values=leaves.filter(differs).map(leaf=>leaf.path+':'+shown[leaf.path]).join(',');
    if(values)query.set('t',values);else query.delete('t');
    if(state.police)query.delete('nopolice');else query.set('nopolice','1');
    history.replaceState(null,'','?'+query.toString().replaceAll('%3A',':').replaceAll('%2C',','));
  }
  function changed(){
    drive.retune();store();
    for(const leaf of leaves)controllers.get(leaf.path)?.domElement.classList.toggle('changed',differs(leaf));
  }
  function set(leaf: Leaf,value: number){
    leaf.owner[leaf.key]=value;shown[leaf.path]=round(value*leaf.unit.scale);
    controllers.get(leaf.path)?.updateDisplay();
  }
  // The changed values as they are written in `drive-tune.ts`, one profile or one value per line.
  function source(){
    const lines=new Map<string,string[]>();
    for(const leaf of leaves.filter(differs)){
      const at=leaf.path.lastIndexOf('.'),owner=at<0?'':leaf.path.slice(0,at);
      const value=leaf.unit.name?leaf.unit.name+'('+shown[leaf.path]+')':String(shown[leaf.path]);
      lines.set(owner,[...(lines.get(owner)??[]),leaf.key+':'+value]);
    }
    return [...lines].map(([owner,values])=>(owner?owner+': ':'')+values.join(', ')).join('\n')||'Nessun valore cambiato';
  }
  let copied='';
  gui.add({run(){
    copied=source();
    navigator.clipboard?.writeText(copied).catch(()=>{});
  }},'run').name('Copia valori');
  gui.add({run(){for(const leaf of leaves)set(leaf,leaf.initial);copied='';changed();}},'run').name('Ripristina');
  // The panel keeps the keyboard after a click or a drag: give it back to the car, except while typing a value.
  const release=()=>{(document.activeElement as HTMLElement | null)?.blur();host.focus({preventScroll:true});};
  gui.onFinishChange(release);
  panel.addEventListener('click',e=>{if(!(e.target instanceof HTMLInputElement && e.target.type!=='checkbox'))release();});

  for(const entry of (query.get('t')??'').split(',')){
    const [path,value]=entry.split(':'),leaf=leaves.find(l=>l.path===path);
    if(leaf && value && Number.isFinite(Number(value)))set(leaf,Number(value)/leaf.unit.scale);
  }
  changed();
  function telemetry(){
    requestAnimationFrame(telemetry);
    if(!drive.active){readout.textContent='Premi Play per guidare';return;}
    const car=drive.player,speed=Math.hypot(car.vx,car.vy);
    const angle=car.h-Math.atan2(car.vy,car.vx);
    const slip=speed>.5?Math.atan2(Math.sin(angle),Math.cos(angle))*180/Math.PI:0;
    readout.textContent=(speed*3.6).toFixed(0).padStart(3)+' km/h · marcia '+(car.gear*3.6).toFixed(0)
      +'\nslittamento '+slip.toFixed(0).padStart(3)+'° · derapata '+car.drifted.toFixed(1)+' s'
      +'\npattuglie '+drive.patrols+(copied?'\n\n'+copied:'');
    host.dataset.lab=[(speed*3.6).toFixed(1),slip.toFixed(1),drive.patrols].join(',');
  }
  telemetry();
  begin();
  host.dataset.labReady='true';
}
