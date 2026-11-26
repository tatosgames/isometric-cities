// The car's gun. In Node, on the pilot world: a ray finds the building it meets, a demolished building stops
// blocking and comes back when rebuilt, the slug meets cars on its way, a thrown body lands. In the browser
// (`index.html?lab=guida&area=pilot`): F or Space fires straight ahead, the ring fills inside the button and a second F
// waits for it, and a shot towards a building brings it down into pieces. Screenshot in QA_SCREENSHOT_DIR (docs/screenshots).
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import * as T from 'three';
import {TUNE} from '../src/drive/drive-tune.ts';
import {buildDriveWorld} from '../src/drive/drive-world.ts';
import {aimShot,fly,launch,segmentBox,segmentCircle} from '../src/drive/drive-weapon.ts';
import {insidePoint,pointInRing} from '../src/geometry.ts';
import {mapViewDirection} from '../src/render/map-camera.ts';
import {launchBrowser,serveMap} from './qa-browser.mjs';

const data=JSON.parse(await readFile(new URL('../public/data/pilot.json',import.meta.url),'utf8'));
const centre=ring=>{
  let x=0,y=0;for(const [a,b] of ring){x+=a;y+=b;}
  return [x/ring.length,y/ring.length];
};
// Tall plain buildings whose average corner lies inside: a ray down onto it meets its roof first.
const candidates=data.buildings.filter(b=>!b.landmark && b.height>=12 && pointInRing(b.rings[0],...centre(b.rings[0])));
assert.ok(candidates.length>20,'Too few buildings to aim at');

// ---- pure ----
{
  const world=buildDriveWorld(data,()=>0,TUNE);
  const toCamera=mapViewDirection(),down=toCamera.clone().negate();
  let met=0;
  for(const b of candidates.slice(0,40)){
    const [cx,cy]=centre(b.rings[0]),roof=new T.Vector3(cx,b.height-.5,-cy);
    const origin=roof.clone().addScaledVector(toCamera,1500);
    const hit=world.rayHit(origin,down,3000);
    if(hit.building!==b)continue;
    met++;
    const point=origin.clone().addScaledVector(down,hit.t);
    assert.ok(point.y<=b.height+1e-6 && point.y>=-2.1,'Hit off the building: '+point.y);
    // Demolished, it no longer stops the ray nor the cars; rebuilt, it does again.
    const inside=[cx,cy];
    assert.equal(world.free(...inside,TUNE.radius),false);
    world.removeBuilding(b);
    assert.notEqual(world.rayHit(origin,down,3000).building,b);
    world.restoreBuilding(b);
    assert.equal(world.rayHit(origin,down,3000).building,b);
    assert.equal(world.free(...inside,TUNE.radius),false);
    world.removeBuilding(b);
    if(!world.near(...inside,TUNE.radius))assert.ok(world.rayHit(origin,down,3000).building!==b);
    world.restoreBuilding(b);
  }
  assert.ok(met>=20,'The ray met only '+met+' of 40 roofs');
  // The gun's level ray meets a wall whatever the slope: from 40 m below a building's base it still stops there.
  let walls=0;
  for(const b of candidates){
    const [cx,cy]=insidePoint(b.rings[0]),from=[cx-30,cy];
    if(!world.free(...from,TUNE.radius))continue;
    const hit=world.rayHit(new T.Vector3(from[0],-40,-from[1]),new T.Vector3(1,0,0),60);
    assert.ok(hit.building && hit.t<=30,'A level ray crossed building '+b.id+' at '+hit.t.toFixed(1)+' m');
    walls++;
  }
  assert.ok(walls>=20,'Only '+walls+' level rays tried');
  // A building split in volumes shares its id: what comes down is all of it, and nothing beside it.
  const byId=Map.groupBy(data.buildings,b=>b.id);
  const split=[...byId.values()].find(parts=>parts.length>=3 && !parts[0].landmark);
  assert.ok(split,'No building split in volumes');
  const neighbours=data.buildings.filter(b=>b.id!==split[0].id);
  const before=neighbours.filter(b=>world.free(...insidePoint(b.rings[0]),.1)===false).length;
  const taken=world.removeUnder(split);
  assert.deepEqual(new Set(taken),new Set(split),'Not every part, or more than its parts, came down');
  assert.equal(neighbours.filter(b=>world.free(...insidePoint(b.rings[0]),.1)===false).length,before,'A neighbour lost its walls');
  for(const b of taken)world.restoreBuilding(b);
  // A block fused from neighbours (small screens) takes down the real buildings standing inside it.
  const [a]=split,others=data.buildings.filter(b=>b.id!==a.id && !b.landmark && Math.hypot(...insidePoint(b.rings[0]).map((v,i)=>v-insidePoint(a.rings[0])[i]))<25).slice(0,2);
  const box=[...a.rings[0],...others.flatMap(b=>b.rings[0])];
  const [w,so,e,n]=[Math.min(...box.map(p=>p[0]))-.5,Math.min(...box.map(p=>p[1]))-.5,Math.max(...box.map(p=>p[0]))+.5,Math.max(...box.map(p=>p[1]))+.5];
  const block={...a,rings:[[[w,so],[e,so],[e,n],[w,n],[w,so]]]};
  const under=world.removeUnder([block]);
  for(const b of [...split,...others])assert.ok(under.includes(b),'Building '+b.id+' left standing inside the fused block');
  for(const b of under)world.restoreBuilding(b);
  // The slug meets a car on its way, and a guagua's turned box.
  assert.ok(Math.abs(segmentCircle(0,0,10,0,5,.5,1)-.4134)<1e-3);
  assert.equal(segmentCircle(0,0,10,0,5,3,1),Infinity);
  assert.ok(Math.abs(segmentBox(-10,0,10,0,0,0,Math.PI/2,3.6,1.1)-.445)<1e-6);
  assert.equal(segmentBox(-10,5,10,5,0,0,0,3.6,1.1),Infinity);
  // Out of range the slug falls short and spares the building.
  const short=aimShot(0,0,1,0,500,candidates[0],TUNE.weapon.range);
  assert.equal(short.left,TUNE.weapon.range);assert.equal(short.building,null);
  // A thrown body lands, bounces once and lies flat within two seconds.
  const body={lift:0,lv:0,tumble:0,tumbleRate:0,vx:0,vy:0};
  launch(body,1,0,TUNE.weapon.launch,TUNE.weapon.lift);
  let t=0;
  while(fly(body,1/120,TUNE.weapon.gravity) && t<5)t+=1/120;
  assert.ok(t<2,'Still flying after '+t.toFixed(2)+' s');
  assert.equal(body.lift,0);assert.equal(Math.abs(Math.round(body.tumble/Math.PI)*Math.PI-body.tumble)<1e-9,true);
  console.log('Gun geometry passed ('+met+'/40 roofs met, '+walls+' level rays stopped from 40 m below, landing '+t.toFixed(2)+' s)');
}

// ---- browser ----
const dir=process.env.QA_SCREENSHOT_DIR||'docs/screenshots';
await mkdir(dir,{recursive:true});
const {server,origin}=await serveMap();
const browser=await launchBrowser();
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(new URL('index.html?lab=guida&area=pilot&nopolice&nobuses',origin).href);
  await page.waitForSelector('#scene[data-lab-ready=true][data-drive]',{timeout:120000});
  const gun=()=>page.evaluate(()=>window.gunState());
  const button=page.locator('#drive-fire');
  assert.equal(await button.getAttribute('aria-label'),'Disparar');
  assert.ok(await button.isVisible());
  // Not before the run starts.
  await page.locator('#scene').focus();
  await page.keyboard.press('f');
  assert.equal((await gun()).cool,0);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(300);
  await page.keyboard.press('f');
  await page.waitForTimeout(100);
  const first=(await gun()).cool;
  assert.ok(first>2.5 && first<=TUNE.weapon.cooldown,'Cooldown after a shot: '+first);
  assert.match(await button.getAttribute('class')??'',/cooling/);
  assert.equal(await button.getAttribute('aria-disabled'),'true');
  // A second F during the cooldown does nothing; the ring fills, then the button is ready again.
  await page.waitForTimeout(600);
  await page.keyboard.press('f');
  await page.waitForTimeout(100);
  const second=(await gun()).cool;
  assert.ok(second<first-.4,'A second F restarted the cooldown: '+second);
  // The ring fills through a CSS transition: about a quarter drawn after 0.8 s.
  const ring=Math.round(100-await button.evaluate(b=>parseFloat(getComputedStyle(b.querySelector('circle')).strokeDashoffset)));
  assert.ok(ring>10 && ring<60,'Ring at '+ring+'%');
  await page.waitForFunction(()=>!document.querySelector('#drive-fire').classList.contains('cooling'),null,{timeout:6000});
  // Space fires too, and no longer brakes.
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  assert.ok((await gun()).cool>2.5,'Space did not fire');
  await page.waitForFunction(()=>!document.querySelector('#drive-fire').classList.contains('cooling'),null,{timeout:6000});
  // A shot at the nearest tall building brings it down.
  const at=await page.evaluate(()=>window.gunPlayer());
  const target=candidates.map(b=>({b,c:centre(b.rings[0])}))
    .map(e=>({...e,d:Math.hypot(e.c[0]-at.x,e.c[1]-at.y)})).filter(e=>e.d>15 && e.d<80).sort((a,b)=>a.d-b.d)[0];
  assert.ok(target,'No building within 80 m of the start');
  const before=await gun();
  assert.equal(await page.evaluate(([x,y])=>window.gunFireAt(x,y),target.c),true);
  await page.waitForFunction(n=>window.gunState().demolished>n,before.demolished,{timeout:8000});
  await page.waitForTimeout(450);
  const after=await gun();
  assert.ok(after.pieces>=5,'Pieces: '+after.pieces);
  assert.equal(after.ruins,before.ruins+1);
  assert.equal(after.lastDown.members,data.buildings.filter(b=>b.id===after.lastDown.id).length,'Not all the volumes of the building came down');
  await page.locator('#scene').screenshot({path:dir+'/drive-fire.png'});
  await page.keyboard.up('ArrowDown');
  assert.deepEqual(errors,[]);
  console.log('Gun in the drive passed (cooldown '+first.toFixed(2)+' s, ring '+ring+'%, building '+target.b.id+' at '+target.d.toFixed(0)+' m)');
}finally{await browser.close();if(server)await server.close();}
