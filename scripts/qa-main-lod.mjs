import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {preview} from 'vite';

const server=await preview({preview:{host:'127.0.0.1',port:0}});
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:510,height:850}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'||m.text().startsWith('Sector '))errors.push(m.text());});
  await page.addInitScript(()=>{
    sessionStorage.setItem('map-view:'+location.pathname+location.search,
      JSON.stringify({target:[-95,11,218],zoom:1,turn:0,selected:null}));
  });
  let release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('**/city-sectors/*.json',async route=>{await gate;await route.continue();},{times:1});
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(()=>JSON.parse(document.querySelector('#scene').dataset.sectors||'{}').pending);
  const originalView=await page.locator('#scene').getAttribute('data-view');
  await page.evaluate(()=>{
    const host=document.querySelector('#scene');
    const extension=host.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context');
    const observer=new MutationObserver(()=>{
      if(JSON.parse(host.dataset.sectors).fading){
        observer.disconnect();
        window.fadeAtView=host.dataset.view;
        extension.loseContext();
        setTimeout(()=>extension.restoreContext(),350);
      }
    });
    observer.observe(host,{attributes:true,attributeFilter:['data-sectors']});
    // Recovery can finish between two polls: let the page record that the notice was shown.
    const status=document.querySelector('#status');
    new MutationObserver(()=>{if(!status.hidden)window.statusShown=true;}).observe(status,{attributes:true,attributeFilter:['hidden']});
  });
  release();
  await page.waitForFunction(()=>window.statusShown && document.querySelector('#status').hidden);
  const settle=()=>page.waitForFunction(()=>{
    const s=JSON.parse(document.querySelector('#scene').dataset.sectors||'{}');
    return s.visible>0&&!s.pending&&s.fading===0&&s.bytes<=s.budget;
  },null,{timeout:90000});
  await settle();
  assert.equal(await page.evaluate(()=>window.fadeAtView),originalView);
  // The orthographic frustum's shorter side is viewport width here and the saved zoom is 1.
  for(const [width,near] of [[545,true],[560,true],[540,true],[585,false],[555,false],[515,true]]){
    await page.setViewportSize({width,height:850});
    await page.waitForFunction(([width,near])=>{
      const h=document.querySelector('#scene'),s=JSON.parse(h.dataset.sectors);
      return h.clientWidth===width&&s.near===near&&Number(h.dataset.view.split(',')[2])===1;
    },[width,near]);
  }
  await settle();
  await page.goto(server.resolvedUrls.local[0]+'?neutral');
  await settle();
  assert.deepEqual(errors,[]);
  console.log('Main LOD: stationary arrival, loss during fade, restoration, hysteresis, idle completion and neutral mode passed');
}finally{await browser.close();await server.close();}
