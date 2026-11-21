import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {preview} from 'vite';

const server = process.env.MAP_URL ? null : await preview({preview:{host:'127.0.0.1',port:0}});
const browser = await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
try {
  const origin = process.env.MAP_URL ?? server.resolvedUrls.local[0];
  const viewport = {width:390,height:844};
  for (const [file, field] of [['city.json','roads'],['poi.geojson','features']]) {
    const page = await browser.newPage({viewport,hasTouch:true,isMobile:true});
    const errors = [];
    page.on('pageerror', error=>errors.push(error.message));
    await page.route('**/data/'+file, async route=>{
      const response=await route.fetch();
      const payload=await response.json();
      payload[field]=[];
      await route.fulfill({response,json:payload});
    });
    await page.goto(origin);
    await page.waitForSelector('#scene[data-view]');
    await page.locator('#drive').tap();
    assert.equal(await page.locator('#drive').getAttribute('aria-disabled'),'true');
    assert.equal(await page.locator('#hud').isHidden(),true);
    assert.equal(await page.locator('#scene').getAttribute('data-drive'),null);
    await page.locator('#reset').tap();
    await page.waitForFunction(()=>document.querySelector('#scene').dataset.moving==='false');
    assert.deepEqual(errors,[]);
    await page.close();
    console.log('Map remains usable with no '+field);
  }

  const indexPage = await browser.newPage({viewport});
  await indexPage.route('**/data/city-index.json', async route=>{
    const response=await route.fetch();
    const payload=await response.json();
    payload.buildingOwners.pop();
    await route.fulfill({response,json:payload});
  });
  const validation = indexPage.waitForEvent('console', {
    predicate: message=>message.type()==='error' && message.text().includes('assign one sector to each building')
  });
  await indexPage.goto(origin);
  await validation;
  assert.equal(await indexPage.locator('#scene canvas').count(),0);
  await indexPage.close();
  console.log('Inconsistent city index rejected before renderer startup');

  for (const cancel of [false,true]) {
    const page = await browser.newPage({viewport,hasTouch:true,isMobile:true});
    await page.addInitScript(()=>{
      const send=Worker.prototype.postMessage;
      Worker.prototype.postMessage=function(message,...args) {
        if ('layers' in message) return;
        return send.call(this,message,...args);
      };
    });
    const fallback=page.waitForEvent('console',{
      predicate:message=>message.text().includes('Sector worker timed out'),
      timeout:30000
    });
    await page.goto(origin);
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#scene').dataset.sectors||'{}').pending);
    if (cancel) await page.locator('#reset').tap();
    await fallback;
    if (cancel) {
      await page.waitForFunction(()=>{
        const state=JSON.parse(document.querySelector('#scene').dataset.sectors);
        return !state.pending && state.loaded===0;
      });
      await page.locator('#index-toggle').tap();
      await page.locator('#places [data-place-id="santa-ana"]').tap();
    }
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#scene').dataset.sectors).visible>0);
    assert.equal(page.workers().length,0);
    await page.close();
    console.log(cancel ? 'Worker timeout releases cancelled work and future sectors load' : 'Worker timeout rebuilds requested sector locally');
  }
} finally {
  await browser.close();
  await server?.close();
}
