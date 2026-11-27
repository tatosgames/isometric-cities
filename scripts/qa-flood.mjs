// Flood lab (`lab.html?lab=inondazione`): the Guiniguada scenario runs fast in the worker, the water reaches the
// coast between Vegueta and Triana and wets buildings, the balance of volumes stays within a few per mille, and the
// hazard view and the cloudburst scenario draw. Screenshots go to QA_SCREENSHOT_DIR (docs/screenshots).
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser,serveMap} from './qa-browser.mjs';

const dir=process.env.QA_SCREENSHOT_DIR||'docs/screenshots';
await mkdir(dir,{recursive:true});
const {server,origin}=await serveMap();
const browser=await launchBrowser();
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const view=page.locator('#view');
  const stats=()=>page.evaluate(()=>window.floodLab.stats());
  const ready=()=>page.waitForFunction(()=>{
    const v=document.querySelector('#view');
    return v?.dataset.ready==='true' && v.dataset.busy==='false' && v.dataset.time!==undefined;
  },null,{timeout:180000});

  await page.goto(new URL('lab.html',origin).href);
  await page.getByRole('link',{name:'Flood'}).click();
  await ready();
  assert.equal(await page.getByRole('navigation',{name:'Labs'}).locator('[aria-current=page]').textContent(),'Flood');

  // Ninety minutes of the Guiniguada hydrograph, as fast as the worker goes.
  await page.evaluate(()=>window.floodLab.set({speed:2000}));
  await page.waitForFunction(()=>Number(document.querySelector('#view').dataset.time)>=5400,null,{timeout:240000});
  await page.evaluate(()=>window.floodLab.set({playing:false}));
  const s=await stats();
  console.log(JSON.stringify({time:Math.round(s.time),wet:Math.round(s.wet),reached:Math.round(s.reached),toSea:Math.round(s.toSea),
    entered:Math.round(s.entered),deepest:+s.deepest.toFixed(2),wetBuildings:s.wetBuildings,damage:+s.damage.toFixed(4),balance:s.balance}));
  assert.ok(s.reached>20e4,'The flood covered only '+(s.reached/1e4).toFixed(1)+' ha');
  assert.ok(s.toSea>0,'No water reached the sea');
  assert.ok(s.wetBuildings>20,'Only '+s.wetBuildings+' buildings got wet');
  assert.ok(Math.abs(s.balance)<.005,'Volume balance off by '+s.balance);
  await page.waitForTimeout(300);
  await view.screenshot({path:dir+'/flood-guiniguada-depth.png'});
  await page.evaluate(()=>window.floodLab.set({view:'hazard'}));
  await page.waitForTimeout(600);
  await view.screenshot({path:dir+'/flood-guiniguada-hazard.png'});

  // Cloudburst over Triana.
  await page.goto(new URL('lab.html?lab=inondazione&scenario=pioggia&x=-150&y=0&velocita=1200',origin).href);
  await ready();
  await page.waitForFunction(()=>Number(document.querySelector('#view').dataset.time)>=3600,null,{timeout:240000});
  const r=await stats();
  assert.ok(r.entered>0 && r.reached>1e4,'The rain wetted only '+(r.reached/1e4).toFixed(1)+' ha');
  assert.ok(Math.abs(r.balance)<.005,'Volume balance off by '+r.balance);
  await view.screenshot({path:dir+'/flood-rain.png'});

  assert.deepEqual(errors,[]);
  console.log('flood lab: Guiniguada reaches the sea, hazard view, cloudburst, balance ok');
}finally{await browser.close();if(server)await server.close();}
