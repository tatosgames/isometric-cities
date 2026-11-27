import assert from 'node:assert/strict';
import {launchBrowser,serveMap} from './qa-browser.mjs';

const {server,origin}=await serveMap();
const browser=await launchBrowser();
try{
  for(const mobile of [false,true]){
    const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
    const traffic=[],errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(/^https?:$/.test(url.protocol) && url.origin!==new URL(origin).origin){errors.push(url.href);return route.abort();}
      if(url.pathname.includes('/data/guaguas'))traffic.push(url.pathname);
      return route.continue();
    });
    const host=page.locator('#scene');
    await page.goto(new URL('?area=pilot',origin).href);
    await page.locator('#scene[data-view]').waitFor({timeout:120000});
    assert.deepEqual(traffic,[]);
    const visit=async query=>{
      traffic.length=0;
      await page.goto(new URL('?lab=drive&'+query+(query.includes('off=')?'':'&off=police'),origin).href);
      await page.locator('#scene[data-guaguas]').waitFor({timeout:120000});
      const state=JSON.parse(await host.getAttribute('data-guaguas'));
      assert.deepEqual(state.errors,[]);
      assert.ok(state.active.length<=6);
      assert.equal(new Set(state.active.map(b=>b.id)).size,state.active.length);
      return state.active;
    };
    const pilot='area=pilot&at=-60,-818';
    const first=await visit(pilot);
    assert.ok(first.some(b=>b.line==='13' && b.direction==='Tres Palmas'));
    assert.ok(traffic.every(p=>p.includes('/guaguas/pilot/')));
    assert.deepEqual(await visit(pilot),first,'Fresh run reproduces initial fleet');
    await page.locator('#drive-exit').click();
    await page.waitForFunction(()=>!document.querySelector('#scene').hasAttribute('data-guaguas'));
    assert.deepEqual(await visit(pilot+'&off=police,buses'),[]);
    assert.deepEqual(traffic,[]);
    const city=await visit('at='+(process.argv[2]??'-360,-3720'));
    assert.ok(city.length,'Expected city service near the selected start');
    const [, ,x,y]=(await host.getAttribute('data-drive')).split(',').map(Number);
    assert.ok(city.every(b=>Math.hypot(b.x-x,b.y-y)<=301),'Only nearby city buses should spawn');
    assert.ok(traffic.every(p=>p.includes('/guaguas/city/')));
    assert.deepEqual(await visit('at=-1040,6048'),[],'No route within 300 m of Calle Coronel Rocha');
    await host.focus();await page.keyboard.down('ArrowDown');
    await page.waitForFunction(()=>document.querySelector('#scene').dataset.drive.startsWith('playing'));
    const empty=JSON.parse(await host.getAttribute('data-guaguas'));
    assert.equal(empty.steps,0,'Distant vehicles must receive no simulation steps');
    await page.keyboard.up('ArrowDown');
    if(!mobile){
      await page.route('**/guaguas/pilot/roads/*.json',route=>route.fulfill({status:404,body:'missing'}));
      await page.goto(new URL('?lab=drive&area=pilot&at=-60,-818',origin).href);
      await page.locator('#scene[data-guaguas]').waitFor({timeout:120000});
      assert.ok(JSON.parse(await host.getAttribute('data-guaguas')).errors.length,'Missing local pack reported');
      await host.focus();await page.keyboard.down('ArrowDown');
      await page.waitForFunction(()=>document.querySelector('#scene').dataset.drive.startsWith('playing'));
      await page.keyboard.up('ArrowDown');
    }
    assert.deepEqual(errors,[]);
    await page.close();
    console.log('Local bus network verified on '+(mobile?'emulated phone':'desktop'));
  }
}finally{await browser.close();await server?.close();}
