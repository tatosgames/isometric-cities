// Tuning panel for the drive (`index.html?lab=drive`; `tune=path:value,…` keeps the changes). It edits `TUNE` in place while the real game runs:
// the changed values live in the URL and can be copied as lines for `drive-tune.ts`.
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import {SURFACES,TUNE} from '../drive/drive-tune.ts';
import {FLIGHT_TUNE} from '../flight/flight.ts';
import type {makeDrive} from '../drive/drive.ts';
import './drive-lab.css';
import {has,pairs,search,setPairs,setSwitch} from '../url-state.ts';

type Unit={name: 'deg' | 'kmh' | '';scale: number};
// `mirror` is the patrol profile for the values patrols take from the player.
type Leaf={path: string;owner: Record<string,number>;key: string;unit: Unit;initial: number;row: HTMLElement;mirror: Record<string,number> | undefined;range?: readonly [number,number]};
const DEG: Unit={name:'deg',scale:180/Math.PI},KMH: Unit={name:'kmh',scale:3.6},RAW: Unit={name:'',scale:1};
const angles=/^(turn|turnLow|turnRamp|recover|releaseRecover|maxSlip|bonusSlip|pitch|pose(Yaw|Roll|YawLimit|Dive))$/;
const unitOf=(key: string)=>angles.test(key)?DEG:/^(baseSpeed|topSpeed)$/.test(key)?KMH:RAW;
// Not in the panel: read once when the drive world is built, a dead zone the player's keys never use (they steer
// -1, 0 or 1), and the side grip of a car rolling back from a wall, which hardly shows.
// Also out: the patrols' bonus, which is none, the isometric view, which is the map's own, and the speed and grip
// of paving, which drives as asphalt and only shakes the car.
// Also out, as shaping values of a control that stays: the camera kick spring (kick and its limit stay), the least
// gap between two hit-stops, the gap between sparks, the limit of the pose yaw, the shortest drift that earns a bonus
// and the hop per m/s of impact (the hop's limit stays).
const hidden=new Set(['treeClearance','player.steerDead','player.rollbackGrip','patrol.rollbackGrip','patrol.bonusMax',
  'cameraModes.fixed.zoom','cameraModes.fixed.framing','surfaces.paving.speed','surfaces.paving.grip',
  'kickStiff','stopGap','sparkGap','poseYawLimit','player.bonusLeast','playerHopGain']);
// Sizes, spans and durations the game divides by: their sliders stop one step above zero.
const positive=/^(radius|visualScale|viewSpan|baseSpeed|topSpeed|bonusTime|response|skidSpeed|coinStep|puffLife|hitStop|pose(Release|FullSpeed)|speed|grip)/;
const folders: Record<string,string>={player:'Player',patrol:'Patrols',fixed:'Isometric view',high:'Aerial view',chase:'Chase view',
  surfaces:'Surfaces',paving:'Paving',grass:'Grass',dirt:'Dirt',sand:'Sand'};
// The player's values, by what they shape.
const playerGroups: [title: string,keys: RegExp][]=[
  ['Speed',/^(baseSpeed|topSpeed|gearAccel|accel|cruiseShare|coast|steerPush)$/],
  ['Steering',/^(turn|turnLow|turnRamp|turnRelease)$/],
  ['Slide',/^(recover|releaseRecover|maxSlip)$/],
  ['Drift bonus',/^bonus/]
];
const groups: [title: string,keys: RegExp][]=[
  ['Impacts and braking',/^(brake|hardImpact|hitStop|deflect|radius|treeRadius|bounce|wallLoss|scrape)/],
  ['Player car on screen',/^(visualScale|slopeLean|playerHop|skidSpeed|pose|puff|spark)/],
  ['Patrol cars on screen',/^(roll|tailSwing|hop|dive)$/],
  ['Camera',/^(zoom|paceRate|leadRate|followRate|kick|viewSpan)/],
  ['Police chase',/^(catch|grace|chaser|wreck|stuckTime)/]
];
// Drive views: pitch is an angle above the ground, not a multiple of the default.
const viewFields: Record<string,{unit:Unit;range:readonly [number,number];label:string}>={
  pitch:{unit:DEG,range:[20,89],label:'pitch'},zoom:{unit:RAW,range:[.5,3],label:'zoom'},framing:{unit:RAW,range:[0,.3],label:'framing'}
};
// Coins, goal and slope stay out: they are not handling or how the car looks.
const round=(v: number)=>Number(v.toPrecision(6));

export function driveLab({drive,host,compact,mount,begin}: {
  drive:ReturnType<typeof makeDrive>;host:HTMLElement;compact:boolean;mount:HTMLElement;begin:()=>void;
}){
  // Only the view span of this screen does anything here.
  hidden.add(compact?'viewSpanWide':'viewSpanCompact');
  const query=new URLSearchParams(location.search);
  Object.assign(window,{
    policeTrace:()=>drive.policeTrace(),
    policeRun:()=>({build:import.meta.url,settings:location.href,inputs:drive.inputLog(),samples:drive.policeTrace()}),
    policeRestart:()=>drive.respawn(),
    policeRoadRun:(x:number,y:number,h:number,stars:number)=>drive.roadRunLab(x,y,h,stars),
    policeAdvance:(seconds:number,steer=0,brake=false)=>drive.advanceLab(seconds,steer,brake),
    policeInputs:()=>drive.inputLog(),
    replayPolice:(inputs:Parameters<typeof drive.replayInputs>[0])=>drive.replayInputs(inputs),
    // The gun (`scripts/qa-drive-fire.mjs`): a shot at a map point, and what it did.
    gunFireAt:(x:number,y:number)=>drive.fireAt(x,y),
    gunState:()=>drive.gun,
    gunPlayer:()=>({x:drive.player.x,y:drive.player.y,h:drive.player.h})
  });
  const leaves: Leaf[]=[];
  // The panel shows degrees and km/h; `TUNE` keeps radians and metres per second.
  const shown: Record<string,number>={};
  const panel=document.createElement('aside');panel.id='drive-lab';
  const readout=document.createElement('output');
  const gui=new GUI({container:panel,title:'Tuning'});
  panel.append(readout);mount.prepend(panel);

  const differs=(leaf: Leaf)=>Math.abs(leaf.owner[leaf.key]-leaf.initial)>1e-9*Math.max(1,Math.abs(leaf.initial));
  const mark=(leaf: Leaf)=>leaf.row.classList.toggle('changed',differs(leaf));
  function add(folder: GUI,owner: Record<string,number>,key: string,path: string,mirror?: Record<string,number>,
    field?:{unit:Unit;range:readonly [number,number];label:string}){
    const unit=field?.unit??unitOf(key),initial=owner[key];
    shown[path]=round(initial*unit.scale);
    const top=Math.abs(shown[path])||1;
    const step=10**Math.floor(Math.log10(top))/100;
    const controller=folder.add(shown,path,field?.range[0]??(positive.test(key)?step:0),field?.range[1]??round(top*3),step)
      .name((field?.label??key)+(unit.name?' ('+(unit.name==='deg'?'°':'km/h')+')':''))
      .onChange((value: number)=>{owner[key]=value/unit.scale;if(mirror)mirror[key]=owner[key];drive.retune();mark(leaf);});
    const leaf: Leaf={path,owner,key,unit,initial,row:controller.domElement,mirror,...(field && {range:field.range})};
    leaves.push(leaf);
    return controller;
  }
  const controllers=new Map<string,ReturnType<typeof add>>();
  function walk(folder: GUI,node: Record<string,unknown>,prefix: string){
    for(const [key,value] of Object.entries(node)){
      if(typeof value==='number'){
        const field=prefix.startsWith('cameraModes.')?viewFields[key]:undefined;
        if(!hidden.has(prefix+key))controllers.set(prefix+key,add(folder,node as Record<string,number>,key,prefix+key,undefined,field));
      }
      else if(value && typeof value==='object'){
        // A folder whose values are all hidden is left out.
        const inside=Object.entries(value).some(([k,v])=>typeof v!=='number' || !hidden.has(prefix+key+'.'+k));
        if(inside)walk(folder.addFolder(folders[key]??key).close(),value as Record<string,unknown>,prefix+key+'.');
      }
    }
  }
  const state={police:!has(query,'off','police')};
  gui.add(state,'police').name('Police').onChange((on: boolean)=>drive.setPolice(on));
  gui.add({run(){drive.respawn();}},'run').name('Back to start');
  const tree=TUNE as unknown as Record<string,unknown>;
  // Patrols take most of their values from the player, as in `drive-tune.ts`: their folder lists only their own,
  // and a player value they share moves both.
  const player=TUNE.player as Record<string,number>,patrol=TUNE.patrol as Record<string,number>;
  const playerFolder=gui.addFolder(folders.player).close(),patrolFolder=gui.addFolder(folders.patrol).close();
  const playerParts=playerGroups.map(([title,keys])=>[playerFolder.addFolder(title).close(),keys] as const);
  for(const key of Object.keys(player)){
    const part=playerParts.find(([,keys])=>keys.test(key))?.[0]??playerFolder;
    if(!hidden.has('player.'+key))controllers.set('player.'+key,add(part,player,key,'player.'+key,patrol[key]===player[key]?patrol:undefined));
    if((patrol[key]!==player[key] || key==='steerDead') && !hidden.has('patrol.'+key))controllers.set('patrol.'+key,add(patrolFolder,patrol,key,'patrol.'+key));
  }
  const groupFolders=new Map<string,GUI>();
  for(const [title,keys] of groups){
    const folder=gui.addFolder(title).close();groupFolders.set(title,folder);
    for(const [key,value] of Object.entries(tree)){
      if(typeof value==='number' && keys.test(key) && !hidden.has(key))controllers.set(key,add(folder,tree as Record<string,number>,key,key));
    }
  }
  // The isometric view is the map's own: the aerial and chase views sit in the camera folder.
  walk(groupFolders.get('Camera')!,tree.cameraModes as Record<string,unknown>,'cameraModes.');
  const surfaceFolder=gui.addFolder(folders.surfaces).close();
  controllers.set('roughDrag',add(surfaceFolder,tree as Record<string,number>,'roughDrag','roughDrag'));
  walk(surfaceFolder,tree.surfaces as Record<string,unknown>,'surfaces.');
  walk(gui.addFolder('Gun').close(),tree.weapon as Record<string,unknown>,'weapon.');
  const flightFolder=gui.addFolder('Flight').close();
  const flightFields=[
    ['cruiseSpeed','Cruise speed',KMH,65,180],['bankLimit','Bank limit',DEG,10,55],
    ['pitchLimit','Pitch limit',DEG,10,40],['fov','Camera FOV (°)',RAW,35,75],
    ['viewScale','View distance (×)',RAW,.5,2.5]
  ] as const;
  for(const [key,label,unit,min,max] of flightFields){
    const path='flight.'+key;
    controllers.set(path,add(flightFolder,FLIGHT_TUNE,key,path,undefined,{unit,range:[min,max],label}));
  }

  // Written when a change ends, not on every step of a drag: browsers limit how often the URL may change.
  function store(){
    // Other `tune` values, such as the run's `seed`, stay as they are.
    const others=[...pairs(query,'tune')].filter(([path])=>!leaves.some(leaf=>leaf.path===path));
    setPairs(query,'tune',[...others,...leaves.filter(differs).map(leaf=>[leaf.path,String(shown[leaf.path])] as const)]);
    setSwitch(query,'off','police',!state.police);
    history.replaceState(null,'','?'+search(query));
  }
  function set(leaf: Leaf,value: number){
    const scale=leaf.unit.scale;
    if(leaf.range)value=Math.max(leaf.range[0],Math.min(leaf.range[1],value*scale))/scale;
    leaf.owner[leaf.key]=value;if(leaf.mirror)leaf.mirror[leaf.key]=value;shown[leaf.path]=round(value*scale);
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

  for(const [path,value] of pairs(query,'tune')){
    const leaf=leaves.find(l=>l.path===path);
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
        +'\n'+SURFACES[car.ground]+' · patrols '+drive.patrols;
      if(host.dataset.flight){
        const [phase,,,altitude,heading]=host.dataset.flight.split(',');
        next=`Flight · ${phase}\n${altitude} m · heading ${Math.round(Number(heading)*DEG.scale)}°`
          +(host.dataset.flightHorizon?`\nhorizon ${host.dataset.flightHorizon} m`:'');
      }
      host.dataset.lab=[(speed*3.6).toFixed(1),slip.toFixed(1),drive.patrols,car.ground].join(',');
    }
    if(copied)next+='\n\n'+copied;
    if(next!==text)readout.textContent=text=next;
  }
  telemetry();
  begin();
  host.dataset.labReady='true';
}
