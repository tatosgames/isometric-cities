// Demolition lab (`lab.html?lab=demolizione`): dynamite placed with a click brings the building down into pieces
// that fly, settle and sink, the building leaves the sector meshes, and a fast swing of the wrecking ball breaks
// another one while a slow one only leans on it. Screenshots go to QA_SCREENSHOT_DIR (docs/screenshots).
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
  const data=async key=>Number(await view.getAttribute('data-'+key));
  const settled=()=>page.waitForFunction(()=>{
    const v=document.querySelector('#view');
    return v?.dataset.ready==='true' && Number(v.dataset.buildings)>100 && v.dataset.busy==='false';
  },null,{timeout:180000});

  await page.goto(new URL('lab.html',origin).href);
  assert.equal(await page.locator('#tests a').count(),4);
  await page.getByRole('link',{name:'Demolition'}).click();
  await settled();
  assert.equal(await page.getByRole('navigation',{name:'Labs'}).locator('[aria-current=page]').textContent(),'Demolition');

  // Dynamite on the building nearest the centre: a stick, a fuse, then pieces and dust.
  await page.keyboard.press('2');
  assert.equal(await view.getAttribute('data-tool'),'dynamite');
  const first=await page.evaluate(()=>window.demolitionLab.target());
  assert.ok(first,'No building under the centre of the view');
  await page.mouse.move(first.x,first.y);
  await page.mouse.down();await page.mouse.up();
  await page.waitForFunction(()=>Number(document.querySelector('#view').dataset.demolished)>0,null,{timeout:15000});
  await page.waitForTimeout(500);
  assert.ok(await data('pieces')>=5,'Too few pieces: '+await data('pieces'));
  await view.screenshot({path:dir+'/demolition-dynamite.png'});
  // The building is gone from the sector meshes and from picking: the same point now finds something else.
  const after=await page.evaluate(()=>window.demolitionLab.target()?.id);
  assert.notEqual(after,first.id);
  // The pieces settle, sink and their meshes go; the rubble slab stays.
  await page.waitForFunction(()=>Number(document.querySelector('#view').dataset.pieces)===0,null,{timeout:20000});
  await view.screenshot({path:dir+'/demolition-rubble.png'});

  // Wrecking ball: park it beside the next building, then sweep fast across it.
  const demolished=await data('demolished');
  await page.keyboard.press('1');
  const second=await page.evaluate(()=>window.demolitionLab.target());
  assert.ok(second,'No second building');
  await page.mouse.move(second.x-260,second.y);
  await page.waitForTimeout(2500);
  for(let i=0;i<=24;i++){await page.mouse.move(second.x-260+i*22,second.y);await page.waitForTimeout(16);}
  await page.waitForFunction(n=>Number(document.querySelector('#view').dataset.demolished)>n,demolished,{timeout:8000});
  await page.waitForTimeout(400);
  await view.screenshot({path:dir+'/demolition-ball.png'});

  assert.deepEqual(errors,[]);
  console.log('demolition lab: dynamite, rubble and wrecking ball ok');
}finally{await browser.close();if(server)await server.close();}
