// Exercise the production controller at a fixed simulation cadence, without launching Chromium.
import assert from 'node:assert/strict';
import {Group,OrthographicCamera,Scene} from 'three';
import {makeWingTrails} from '../src/flight/wing-trails.ts';
import {makeFlightControls} from '../src/flight/controls.ts';
import {makeFlightArea} from '../src/flight/flight-area.ts';
import {makeTerrainCeiling} from '../src/flight/terrain-ceiling.ts';
import {buildDriveWorld} from '../src/drive/drive-world.ts';
import {makeFlight} from '../src/flight/flight.ts';

class Host extends EventTarget {
  clientWidth=390;
  clientHeight=844;
  style={};
  captures=new Set();
  setAttribute(){}
  append(){}
  remove(){}
  setPointerCapture(id){this.captures.add(id);}
  hasPointerCapture(id){return this.captures.has(id);}
  releasePointerCapture(id){this.captures.delete(id);}
  getBoundingClientRect(){return {left:25,top:30};}
}
globalThis.document={createElement:()=>new Host()};
globalThis.window=new EventTarget();
globalThis.HTMLInputElement=class {};
const dt=1/60;
function tick(flight,seconds,observe=()=>{}){
  let result;
  for(let i=0;i<Math.round(seconds/dt);i++){
    const event=flight.step(dt);
    observe(flight);
    if(event){assert.equal(result,undefined,'A transition emits a single event');result=event;}
  }
  return result;
}
function emit(node,type,properties){node.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),properties));}
function press(key){emit(window,'keydown',{key});}
function release(key){emit(window,'keyup',{key});}
function setup({ground=()=>0,roof=()=>-Infinity,covered=()=>true,ceiling}={}){
  const host=new Host(),scene=new Scene(),source=new OrthographicCamera(-100,100,100,-100,.1,5000);
  source.position.set(120,200,160);source.lookAt(0,0,0);source.updateMatrixWorld();
  const flight=makeFlight(host,scene,ground,roof,()=>{},covered,ceiling);
  function launch(inspect){
    flight.start(0,0,0,source);
    assert.equal(flight.phase,'launch');
    tick(flight,1.75,inspect);
    assert.equal(flight.phase,'fly');
  }
  return {flight,host,scene,launch,source};
}

// A level wing leaves no ribbon. Compare the visible trail at both rendering cadences.
for(const fps of [30,120]){
  const trails=makeWingTrails(),plane=new Group(),dt=1/fps;
  trails.update(plane,0,dt);assert.equal(trails.mesh.visible,false);
  for(let i=0;i<fps;i++){
    plane.position.x+=32*dt;
    trails.update(plane,.74,dt);
  }
  assert.ok(trails.mesh.visible);
  const vertices=trails.mesh.geometry.getAttribute('position');
  const length=vertices.getX(0)-vertices.getX(47);
  assert.ok(length>=7 && length<=8.6,`Trail length at ${fps} FPS: ${length}`);
  const head=vertices.getX(0);
  trails.update(plane,.74,0);
  assert.equal(vertices.getX(0),head);
  for(let i=0;i<fps/2;i++)trails.update(plane,0,dt);
  assert.equal(trails.mesh.visible,false);
  plane.position.x+=1000;
  trails.update(plane,.74,dt);
  assert.equal(vertices.getX(0),vertices.getX(47),'Restart at the current wingtip');
}

// Charted water may extend past the playable bounds. Pilot maps contain land only.
{
  const square=(a,b)=>[[a,a],[b,a],[b,b],[a,b],[a,a]];
  const land=square(-2,2),bounds=[-5,-5,5,5];
  const city=makeFlightArea(land,{water:[[square(-7,7),square(3,4)]]},bounds,()=>10,-.9);
  assert.ok(city.flightArea(0,0) && city.flightArea(5,0));
  assert.equal(city.flightArea(6,0),false);
  assert.equal(city.flightArea(3.5,3.5),false);
  assert.equal(city.flightGround(5,0),-.9);
  assert.equal(city.flightGround(0,0),10);
  assert.equal(makeFlightArea(land,null,bounds,()=>10,-.9).flightArea(5,0),false);
}

// Lifting the stick leaves a held key down. Keyup releases it even with a modifier.
{
  const host=new Host(),controls=makeFlightControls(host,()=>{});
  controls.toggle(true);
  press('w');
  emit(host,'pointerdown',{pointerId:1,button:0,clientX:10,clientY:10});
  emit(host,'pointerup',{pointerId:1});
  assert.equal(controls.pitch,1,'Lifting the pointer cancelled a held climb key');
  emit(window,'keyup',{key:'w',ctrlKey:true});
  assert.equal(controls.pitch,0,'Modified keyup left climb engaged');
  controls.toggle(false);
}

// Launch rises above a nearby roof before crossing it. The return clears a taller roof
// along its route, and repeated landing requests cannot change the selected road.
{
  const roof=(x,y)=>Math.abs(y)<6?(x>=8 && x<=13?38:x>=46 && x<=55?74:-Infinity):-Infinity;
  const {flight,launch,scene}=setup({roof});
  const clear=f=>{
    if(Number.isFinite(roof(f.x,f.y)))assert.ok(f.target.y>roof(f.x,f.y)+1,'Assisted path clears each intervening roof');
  };
  launch(clear);
  flight.land(87,3,Math.PI/4);
  flight.land(-90,0,Math.PI);
  assert.equal(tick(flight,6,clear),'landed');
  assert.deepEqual([flight.x,flight.y,flight.h],[87,3,Math.PI/4]);
  flight.stop();
  assert.equal(scene.children.length,0);
}
// A coastal tile can be covered by a long ground triangle whose high vertex is outside
// the tile. A wider streamed ring must invalidate the ceiling already cached here.
{
  const terrain={origin:[0,64],step:16,stepY:8,w:12,h:10,values:new Int16Array(120),scale:.1};
  terrain.values[9]=900;
  const region=makeTerrainCeiling(terrain,-.9);
  assert.ok(region.ceiling(15,33,35,50)<1);
  region.include([[[0,64],[144,64],[0,0]]]);
  assert.ok(region.ceiling(15,33,35,50)>=90);
  assert.ok(region.ceiling(950,950,980,980)<1);
}
// Rooftop bounds track unloading, height overrides and footprints crossing their owner's cell.
{
  const square=(a,b)=>[[a,a],[b,a],[b,b],[a,b],[a,a]];
  const world=buildDriveWorld({boundary:square(-100,100),roads:[],trees:[],buildings:[]},()=>6,{treeRadius:0,treeClearance:0});
  world.addZone('new',[{rings:[square(-3,25),square(0,4)],height:8,heightOverride:70}],[]);
  assert.equal(world.roofCeiling(20,20,23,23),76);
  assert.equal(world.roofAt(1,1),-Infinity);
  assert.equal(world.roofCeiling(-50,-50,-45,-45),-Infinity);
  world.removeZone('new');
  assert.equal(world.roofCeiling(20,20,23,23),-Infinity);
}
// At cruise altitude on open terrain only the exact camera endpoint needs sampling.
{
  let groundReads=0,roofReads=0;
  const {flight,launch}=setup({ground:()=>{groundReads++;return 0;},roof:()=>{roofReads++;return -Infinity;},ceiling:()=>0});
  launch();groundReads=roofReads=0;
  assert.equal(tick(flight,1),undefined);
  assert.ok(groundReads<=60 && roofReads<=60);
  flight.stop();
}
// Only the outer right wing overlaps this roof. The nose, wheels and opposite wing stay clear.
{
  const roof=(x,y)=>x>=78 && x<=82 && y>=4.65 && y<=5.4?55:-Infinity;
  const {flight,scene,launch}=setup({roof,ceiling:(w,s,e,n)=>e>=78 && w<=82 && n>=4.65 && s<=5.4?55:0});
  launch();
  assert.equal(tick(flight,3),'impact');
  assert.equal(flight.phase,'crash');
  assert.equal(flight.y,0);
  assert.ok(flight.x>=78 && flight.x<=82);
  assert.equal(roof(flight.x,flight.y),-Infinity);
  assert.equal(scene.children.filter(child=>child.visible).length,1,'Only the burst remains visible');
  assert.equal(tick(flight,2),undefined);
  flight.stop();
}
// Controlled descent into the Atlantic and elevated terrain must produce the same single crash event.
for(const elevation of [-.9,48]){
  const {flight,launch}=setup({ground:()=>elevation,ceiling:()=>elevation});
  launch();
  press('s');
  assert.equal(tick(flight,5),'impact');
  assert.ok(Math.abs(flight.target.y-elevation)<2);
  release('s');flight.stop();
}
// A coastline-sized notch sits inside the rectangular simulation bounds.
// The assist must turn the aircraft before it enters that missing land.
{
  const covered=(x,y)=>!(x>97 && Math.abs(y)<98);
  const {flight,launch}=setup({covered});
  launch();
  let distance=0,lastX=flight.x,lastY=flight.y;
  assert.equal(tick(flight,12,f=>{
    assert.ok(covered(f.x,f.y));
    distance+=Math.hypot(f.x-lastX,f.y-lastY);lastX=f.x;lastY=f.y;
  }),undefined);
  assert.ok(distance>330,`The aircraft must keep moving through its boundary turn (flew ${distance.toFixed(1)} m in 12 s)`);
  flight.stop();
}
// A thin inlet between valid points must still trigger the banked boundary turn.
{
  const covered=(x,y)=>!(x>93 && x<107 && Math.abs(y)<100);
  const {flight,launch}=setup({covered});launch();
  let stalled=0,worst=0;
  tick(flight,12,f=>{
    if(f.x>92.5 && f.x<=93 && Math.abs(f.y)<100)stalled+=dt;
    else stalled=0;
    worst=Math.max(worst,stalled);
    assert.ok(covered(f.x,f.y));
  });
  assert.ok(worst<.1,`Parked for ${worst.toFixed(2)} s at the inlet`);
  flight.stop();
}
// Flying level from a high plateau over lower terrain must preserve absolute altitude.
{
  const {flight,launch}=setup({ground:x=>x<75?550:0});
  launch();const before=flight.target.y;
  tick(flight,3);
  assert.ok(flight.x>75 && Math.abs(flight.target.y-before)<.01,
    `Altitude jumped from ${before} to ${flight.target.y} m at the cliff`);
  flight.stop();
}
// Diving should reveal the route below the nose and releasing should restore cruise framing.
{
  const {flight,launch}=setup();launch();tick(flight,.8);
  const separation=()=>flight.camera.position.y-flight.target.y;
  const level=separation();
  press('s');tick(flight,1);
  assert.ok(separation()>level+8,'Camera stayed edge-on to the wing in a dive');
  release('s');tick(flight,2);
  assert.ok(Math.abs(separation()-level)<1,'Camera failed to settle after descent');
  flight.stop();
}
// A tall facade between the chase camera and the Piper must not hide the aircraft.
{
  const roof=(x,y)=>x>-19 && x<-13 && Math.abs(y)<10?110:-Infinity;
  const {flight,launch}=setup({roof,ceiling:(w,s,e,n)=>e>-19 && w< -13 && n>-10 && s<10?110:0});launch();
  for(let i=0;i<20;i++){
    const {position}=flight.camera,p=flight.target;
    for(let j=1;j<=80;j++){
      const t=j/80,x=p.x+(position.x-p.x)*t,y=-(p.z+(position.z-p.z)*t);
      assert.ok(p.y+(position.y-p.y)*t>roof(x,y),'Facade obscures the Piper');
    }
    flight.step(dt);
  }
  flight.stop();
}
// One captured pointer owns pitch/bank. An unrelated pointer cannot steer it; cancel
// or a window blur levels the aircraft. The next launch starts with a neutral stick.
{
  const {flight,host,launch}=setup();
  launch();
  emit(host,'pointerdown',{pointerId:11,button:0,clientX:120,clientY:540});
  emit(host,'pointermove',{pointerId:12,clientX:320,clientY:350});
  tick(flight,.5);assert.equal(flight.h,0);
  emit(host,'pointermove',{pointerId:11,clientX:185,clientY:475});
  const low=flight.target.y;
  tick(flight,1);assert.ok(flight.h<-.2 && flight.target.y>low+3);
  emit(host,'pointercancel',{pointerId:11});
  assert.equal(host.captures.size,0);
  tick(flight,2);const settled=flight.h,altitude=flight.target.y;
  tick(flight,1);assert.ok(Math.abs(flight.h-settled)<.01 && Math.abs(flight.target.y-altitude)<.04);
  press('a');press('a');press('w');
  tick(flight,.6);assert.ok(flight.h>settled+.1);
  window.dispatchEvent(new Event('blur'));
  tick(flight,2);const afterBlur=flight.h;
  tick(flight,.6);assert.ok(Math.abs(flight.h-afterBlur)<.01);
  flight.stop();launch();
  tick(flight,.5);assert.equal(flight.h,0);
  release('a');release('w');flight.stop();
}
console.log('Flight simulation passed: clear launch and return, wing collision, land and sea impacts, boundary turn, keyboard and touch release.');
