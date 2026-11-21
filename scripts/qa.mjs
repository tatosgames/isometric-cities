import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
const server=process.env.MAP_URL?null:await (await import('vite')).preview({preview:{host:'127.0.0.1',port:0,open:false}});
const origin=process.env.MAP_URL||server.resolvedUrls.local[0].replace(/\/$/,'');
const dir='docs/screenshots';
await mkdir(dir,{recursive:true});
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},hasTouch:mobile,isMobile:mobile});
  const faults=[];
  page.on('pageerror',e=>faults.push(e.message));
  page.on('requestfailed',r=>faults.push(r.url()));
  page.on('response',r=>{if(r.status()>=400||!r.url().startsWith(origin))faults.push(r.url());});
  const host=page.locator('#scene');
  async function visit(path){
    await page.goto(origin+path);await page.waitForSelector('#scene[data-view]',{timeout:60000});
  }
  const snap=name=>page.screenshot({path:dir+'/'+name+'.png'});
  if(process.argv.includes('pilot')){
    if(mobile)break;
    for(const mode of ['styled','neutral']){
      await visit('/?area=pilot'+(mode==='neutral'?'&neutral':''));await page.locator('#index-toggle').click();await page.locator('#places button').first().click();await page.locator('#close').click();await snap('santa-ana-'+mode);
    }
  }else{
    const start=Date.now();await visit('/');console.log(mobile?'mobile':'desktop','load ms',Date.now()-start);
    if(!mobile)await snap('opening');await page.locator('#reset').click();await page.waitForTimeout(200);const initial=await host.getAttribute('data-view');if(!mobile)await snap('overview');
    for(let i=0;i<6;i++){
      await page.locator('#index-toggle').click();
      const b=page.locator('#places button').nth(i);
      await (mobile?b.tap():b.click());assert.equal(await page.locator('article').isVisible(),true);await page.waitForFunction(i=>document.querySelectorAll('#places button')[i].getAttribute('aria-pressed')==='true',i);
      if(!mobile&&i===5)await snap('san-telmo');
      if(!mobile&&i===2)await snap('mercado-teatro');
      if(mobile&&i===4)await snap('triana-mobile');
      await page.locator('#close').click();
    }
    await page.locator('#reset').click();await page.waitForTimeout(150);
    await page.waitForFunction(v=>document.getElementById('scene').dataset.view===v,initial);
    const rect=await host.boundingBox();const x=rect.x+rect.width*.4,y=rect.y+rect.height*.6;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+55,y+36,{steps:5});await page.mouse.up();await page.waitForTimeout(100);
    assert.notEqual(await host.getAttribute('data-view'),initial);
    const moved=await host.getAttribute('data-view');await page.mouse.wheel(0,-180);await page.waitForTimeout(150);assert.notEqual(await host.getAttribute('data-view'),moved);
    await host.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.waitForTimeout(150);assert.notEqual(await host.getAttribute('data-view'),initial);
    await page.locator('#reset').click();
    if(mobile){
      const cdp=await page.context().newCDPSession(page);
      const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
      const pair=d=>[{x:x-d,y,id:1},{x:x+d,y,id:2}];
      await touch('touchStart',pair(20));await touch('touchMove',pair(45));await touch('touchMove',pair(68));await touch('touchEnd',[]);
      await page.waitForTimeout(180);assert.ok(Number((await host.getAttribute('data-view')).split(',')[2])>Number(initial.split(',')[2]));
      await page.locator('#reset').click();
    }
    await page.locator('.pin').last().focus();await page.keyboard.press('Enter');assert.match(await page.locator('h3').textContent(),/San Telmo/);
  }
  assert.deepEqual(faults,[]);await page.close();
 }
}finally{await browser.close();if(server)await server.close();}




