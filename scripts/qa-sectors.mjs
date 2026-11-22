import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import {buildDriveWorld} from '../src/drive/drive-world.ts';
import {preview} from 'vite';
import assert from 'node:assert/strict';

const server=process.env.MAP_URL?null:await preview({preview:{port:0,host:'127.0.0.1'}});
const origin=process.env.MAP_URL??server.resolvedUrls.local[0];
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
try{
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await p.addInitScript(()=>{
    const totals=window.sectorGpu={buffers:0,textures:0};
    const gl=WebGL2RenderingContext.prototype;
    for(const [method,key,step] of [['createBuffer','buffers',1],['deleteBuffer','buffers',-1],
      ['createTexture','textures',1],['deleteTexture','textures',-1]]){
      const original=gl[method];
      gl[method]=function(...args){totals[key]+=step;return original.apply(this,args);};
    }
  });
  const faults=[];
  p.on('pageerror',e=>faults.push(e.message));
  p.on('console',m=>{if(m.type()==='warning' && m.text().startsWith('Sector '))faults.push(m.text());});
  const host=p.locator('#scene');
  const state=async()=>JSON.parse(await host.getAttribute('data-sectors'));
  const settle=()=>p.waitForFunction(()=>{
    const e=document.querySelector('#scene');
    if(e?.dataset.moving!=='false' || !e.dataset.sectors)return false;
    const s=JSON.parse(e.dataset.sectors);
    return !s.pending && !s.fading;
  },null,{timeout:60000});
  // A sector uploads its buffers on its first drawn frame: read the counters once they stop changing.
  async function gpu(){
    let last='';
    for(let i=0;i<40;i++){
      await settle();
      const now=JSON.stringify(await p.evaluate(()=>window.sectorGpu));
      if(now===last)return JSON.parse(now);
      last=now;await p.waitForTimeout(150);
    }
    throw new Error('WebGL counters never settled');
  }
  async function select(id){
    await p.locator('#index-toggle').click();await p.locator('#places [data-place-id="'+id+'"]').click();
  }
  let unblock;
  const gate=new Promise(resolve=>unblock=resolve);
  const hit=p.waitForRequest('**/city-sectors/*.json');
  await p.route('**/city-sectors/*.json',async route=>{await gate;await route.continue().catch(()=>{});},{times:1});
  await p.goto(origin);
  await host.waitFor();await p.waitForSelector('#scene[data-view]');await hit;
  const ext=await p.evaluateHandle(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context'));
  await ext.evaluate(e=>e.loseContext());await p.locator('#status').waitFor({state:'visible'});
  unblock();await ext.evaluate(e=>e.restoreContext());
  await p.locator('#status').waitFor({state:'hidden'});await settle();
  assert.ok((await state()).visible>0);
  const stops=[];
  for(let lap=0;lap<3;lap++){
    for(const id of ['santa-ana','plaza-de-la-feria','parque-doramas','metropole']){
      await select(id);await settle();
      const counters=await gpu(),s=await state();assert.ok(s.bytes<=s.budget && s.visible>0);
      stops.push({id,...counters,bytes:s.bytes,visible:s.visible,evictions:s.evictions});
    }
  }
  assert.ok(stops.at(-1).evictions>0);
  for(const last of stops.slice(-4)){
    const previous=stops.slice(4,8).find(s=>s.id===last.id);
    assert.ok(last.buffers<=previous.buffers+24 && last.textures<=previous.textures+2,
      'WebGL resources grew on the repeated circuit: '+JSON.stringify({previous,last}));
    assert.ok(Math.abs(last.bytes-previous.bytes)<last.bytes*.15,'Circuit memory did not stabilize at '+last.id);
  }
  await p.locator('#reset').click();await p.waitForFunction(()=>JSON.parse(document.querySelector('#scene').dataset.sectors).visible===0);
  console.log('Sector circuit',JSON.stringify(stops));
  // Pick the same eligible start as production and point its route across the boundary.
  const city=JSON.parse(await readFile(new URL('../public/data/city.json',import.meta.url)));
  const world=buildDriveWorld(city,()=>0,{treeClearance:4.5,treeRadius:.3});
  const pool=world.validNodes.filter(i=>world.free(world.nodes[i].x,world.nodes[i].y,10));
  const endpoints=[[-1442.4,2575.6],[-1437.4,2576.3]];
  for(const reverse of [false,true]){
    const order=reverse?[...endpoints].reverse():endpoints;
    await p.route('**/data/poi.geojson',async route=>{
      const response=await route.fetch(),poi=await response.json();
      poi.features=poi.features.slice(0,2);
      poi.features.forEach((f,i)=>{f.properties.xy=order[i];});
      await route.fulfill({response,json:poi});
    },{times:1});
    await p.goto(origin);await p.waitForSelector('#scene[data-view]');
    const slot=pool.indexOf(world.nearestNode(...order[0]));assert.ok(slot>=0);
    await p.evaluate(sample=>{Math.random=()=>sample;},(slot+.5)/pool.length);
    await p.locator('#drive').click();
    await p.waitForFunction(()=>document.querySelector('#scene').dataset.drive?.startsWith('ready'));
    const drive=async()=>(await host.getAttribute('data-drive')).split(',');
    const start=await drive();assert.ok(Math.hypot(+start[2]-order[0][0],+start[3]-order[0][1])<1);
    const startCell=Math.floor(+start[2]/240);
    await p.keyboard.press('ArrowDown');
    await p.waitForFunction(cell=>{
      const d=document.querySelector('#scene').dataset.drive.split(',');
      return d[0]==='playing' && Math.floor(+d[2]/240)!==cell && +d[5]>0;
    },startCell,{timeout:30000});
    console.log('Drive crossed',startCell,'to',Math.floor(+(await drive())[2]/240),'with patrol active');
    await p.locator('#drive-exit').click();
  }
  assert.deepEqual(faults,[]);
}finally{await browser.close();if(server)await server.close();}
