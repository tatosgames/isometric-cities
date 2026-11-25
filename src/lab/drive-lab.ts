// Tuning panel for the drive (`index.html?lab=guida`). It edits `TUNE` in place while the real game runs:
// the changed values live in the URL and can be copied as lines for `drive-tune.ts`.
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import {SURFACES,TUNE} from '../drive/drive-tune.ts';
import type {makeDrive} from '../drive/drive.ts';
import './drive-lab.css';

type Unit={name: 'deg' | 'kmh' | '';scale: number};
// `mirror` is the patrol profile for the values patrols take from the player.
type Leaf={path: string;owner: Record<string,number>;key: string;unit: Unit;initial: number;row: HTMLElement;mirror: Record<string,number> | undefined};
const DEG: Unit={name:'deg',scale:180/Math.PI},KMH: Unit={name:'kmh',scale:3.6},RAW: Unit={name:'',scale:1};
const angles=/^(turn|turnLow|turnRamp|recover|releaseRecover|maxSlip|bonusSlip|pitch|pose(Yaw|Roll|YawLimit|Dive))$/;
const unitOf=(key: string)=>angles.test(key)?DEG:/^(baseSpeed|topSpeed)$/.test(key)?KMH:RAW;
// Not in the panel: read once when the drive world is built, a dead zone the player's keys never use (they steer
// -1, 0 or 1), and the side grip of a car rolling back from a wall, which hardly shows.
// Also out: the patrols' bonus, which is none, the isometric view, which is the map's own, and the speed and grip
// of paving, which drives as asphalt and only shakes the car.
const hidden=new Set(['treeClearance','player.steerDead','player.rollbackGrip','patrol.rollbackGrip','patrol.bonusMax',
  'cameraModes.fixed.zoom','cameraModes.fixed.framing','surfaces.paving.speed','surfaces.paving.grip']);
// Sizes, spans and durations the game divides by: their sliders stop one step above zero.
const positive=/^(radius|visualScale|viewSpan|baseSpeed|topSpeed|bonusTime|response|skidSpeed|chaserEvery|coinStep|puffLife|hitStop|pose(Release|FullSpeed)|speed|grip)/;
const folders: Record<string,string>={player:'Player',patrol:'Patrols',cameraModes:'Drive views',fixed:'Isometric',high:'Aerial',chase:'Chase',
  surfaces:'Surfaces',paving:'Paving',grass:'Grass',dirt:'Dirt',sand:'Sand'};
const groups: [title: string,keys: RegExp][]=[
  ['Impacts and braking',/^(brake|hardImpact|deflect|radius|treeRadius|bounce|wallLoss|scrape)/],
  ['Car on screen',/^(visualScale|slopeLean|roll|tailSwing|hop|playerHop|dive|skidSpeed|pose|puff|spark)/],
  ['Camera and effects',/^(zoom|paceRate|leadRate|followRate|kick|viewSpan|hitStop|stopGap)/],
  ['Chase',/^(catch|grace|chaser|wreck|stuckTime)/]
];
// Coins, goal and slope stay out: they are not handling or how the car looks.
const round=(v: number)=>Number(v.toPrecision(6));

export function driveLab({drive,host,compact,begin}: {drive: ReturnType<typeof makeDrive>;host: HTMLElement;compact: boolean;begin: () => void}){
  // Only the view span of this screen does anything here.
  hidden.add(compact?'viewSpanWide':'viewSpanCompact');
  const query=new URLSearchParams(location.search);
  const leaves: Leaf[]=[];
  // The panel shows degrees and km/h; `TUNE` keeps radians and metres per second.
  const shown: Record<string,number>={};
  const panel=document.createElement('aside');panel.id='drive-lab';
  const readout=document.createElement('output');
  const gui=new GUI({container:panel,title:'Drive · tuning'});
  panel.append(readout);document.body.append(panel);

  const differs=(leaf: Leaf)=>Math.abs(leaf.owner[leaf.key]-leaf.initial)>1e-9*Math.max(1,Math.abs(leaf.initial));
  const mark=(leaf: Leaf)=>leaf.row.classList.toggle('changed',differs(leaf));
  function add(folder: GUI,owner: Record<string,number>,key: string,path: string,mirror?: Record<string,number>){
    const unit=unitOf(key),initial=owner[key];
    shown[path]=round(initial*unit.scale);
    const top=Math.abs(shown[path])||1;
    const step=10**Math.floor(Math.log10(top))/100;
    const controller=folder.add(shown,path,positive.test(key)?step:0,round(top*3),step)
      .name(key+(unit.name?' ('+(unit.name==='deg'?'°':'km/h')+')':''))
      .onChange((value: number)=>{owner[key]=value/unit.scale;if(mirror)mirror[key]=owner[key];drive.retune();mark(leaf);});
    const leaf: Leaf={path,owner,key,unit,initial,row:controller.domElement,mirror};
    leaves.push(leaf);
    return controller;
  }
  const controllers=new Map<string,ReturnType<typeof add>>();
  function walk(folder: GUI,node: Record<string,unknown>,prefix: string){
    for(const [key,value] of Object.entries(node)){
      if(typeof value==='number'){if(!hidden.has(prefix+key))controllers.set(prefix+key,add(folder,node as Record<string,number>,key,prefix+key));}
      else if(value && typeof value==='object'){
        // A folder whose values are all hidden is left out.
        const inside=Object.entries(value).some(([k,v])=>typeof v!=='number' || !hidden.has(prefix+key+'.'+k));
        if(inside)walk(folder.addFolder(folders[key]??key).close(),value as Record<string,unknown>,prefix+key+'.');
      }
    }
  }
  const state={police:!query.has('nopolice')};
  gui.add(state,'police').name('Police').onChange((on: boolean)=>drive.setPolice(on));
  gui.add({run(){drive.respawn();}},'run').name('Back to start');
  const tree=TUNE as unknown as Record<string,unknown>;
  // Patrols take most of their values from the player, as in `drive-tune.ts`: their folder lists only their own,
  // and a player value they share moves both.
  const player=TUNE.player as Record<string,number>,patrol=TUNE.patrol as Record<string,number>;
  const playerFolder=gui.addFolder(folders.player).close(),patrolFolder=gui.addFolder(folders.patrol).close();
  for(const key of Object.keys(player)){
    if(!hidden.has('player.'+key))controllers.set('player.'+key,add(playerFolder,player,key,'player.'+key,patrol[key]===player[key]?patrol:undefined));
    if((patrol[key]!==player[key] || key==='steerDead') && !hidden.has('patrol.'+key))controllers.set('patrol.'+key,add(patrolFolder,patrol,key,'patrol.'+key));
  }
  for(const [title,keys] of groups){
    const folder=gui.addFolder(title).close();
    for(const [key,value] of Object.entries(tree)){
      if(typeof value==='number' && keys.test(key) && !hidden.has(key))controllers.set(key,add(folder,tree as Record<string,number>,key,key));
    }
  }
  const surfaceFolder=gui.addFolder(folders.surfaces).close();
  controllers.set('roughDrag',add(surfaceFolder,tree as Record<string,number>,'roughDrag','roughDrag'));
  walk(surfaceFolder,tree.surfaces as Record<string,unknown>,'surfaces.');
  walk(gui.addFolder(folders.cameraModes).close(),tree.cameraModes as Record<string,unknown>,'cameraModes.');

  // Written when a change ends, not on every step of a drag: browsers limit how often the URL may change.
  function store(){
    const values=leaves.filter(differs).map(leaf=>leaf.path+':'+shown[leaf.path]).join(',');
    if(values)query.set('t',values);else query.delete('t');
    if(state.police)query.delete('nopolice');else query.set('nopolice','1');
    history.replaceState(null,'','?'+query.toString().replaceAll('%3A',':').replaceAll('%2C',','));
  }
  function set(leaf: Leaf,value: number){
    leaf.owner[leaf.key]=value;if(leaf.mirror)leaf.mirror[leaf.key]=value;shown[leaf.path]=round(value*leaf.unit.scale);
    controllers.get(leaf.path)?.updateDisplay();mark(leaf);
  }
  // The changed values as they are written in `drive-tune.ts`, one profile or one value per line.
  function source(){
    const lines=new Map<string,string[]>();
    for(const leaf of leaves.filter(differs)){
      const at=leaf.path.lastIndexOf('.'),owner=at<0?'':leaf.path.slice(0,at);
      const value=leaf.unit.name?leaf.unit.name+'('+shown[leaf.path]+')':String(shown[leaf.path]);
      lines.set(owner,[...(lines.get(owner)??[]),leaf.key+':'+value]);
    }
    return [...lines].map(([owner,values])=>(owner?owner+': ':'')+values.join(', ')).join('\n')||'No value changed';
  }
  let copied='';
  gui.add({run(){
    copied=source();
    navigator.clipboard?.writeText(copied).catch(()=>{});
  }},'run').name('Copy values');
  gui.add({run(){for(const leaf of leaves)set(leaf,leaf.initial);copied='';drive.retune();}},'run').name('Reset');
  // The panel keeps the keyboard after a click or a drag: give it back to the car, except while typing a value.
  const release=()=>{(document.activeElement as HTMLElement | null)?.blur();host.focus({preventScroll:true});};
  gui.onFinishChange(()=>{store();release();});
  panel.addEventListener('click',e=>{
    if(e.target instanceof HTMLInputElement && e.target.type!=='checkbox')return;
    store();release();
  });

  for(const entry of (query.get('t')??'').split(',')){
    const [path,value]=entry.split(':'),leaf=leaves.find(l=>l.path===path);
    if(leaf && value && Number.isFinite(Number(value)))set(leaf,Number(value)/leaf.unit.scale);
  }
  drive.retune();
  let text='';
  function telemetry(){
    requestAnimationFrame(telemetry);
    let next='Press Play to drive';
    if(drive.active){
      const car=drive.player,speed=Math.hypot(car.vx,car.vy);
      const angle=car.h-Math.atan2(car.vy,car.vx);
      const slip=speed>.5?Math.atan2(Math.sin(angle),Math.cos(angle))*180/Math.PI:0;
      // A car that has not moved yet has no gear: it starts in the base one.
      next=(speed*3.6).toFixed(0).padStart(3)+' km/h · gear '+(Math.max(car.gear,TUNE.player.baseSpeed)*3.6).toFixed(0)
        +'\nslip '+slip.toFixed(0).padStart(3)+'° · slide '+car.drifted.toFixed(1)+' s'
        +'\n'+SURFACES[car.ground]+' · patrols '+drive.patrols+(copied?'\n\n'+copied:'');
      host.dataset.lab=[(speed*3.6).toFixed(1),slip.toFixed(1),drive.patrols,car.ground].join(',');
    }
    if(next!==text)readout.textContent=text=next;
  }
  telemetry();
  begin();
  host.dataset.labReady='true';
}
