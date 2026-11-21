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
  const settled=()=>page.waitForFunction(()=>document.querySelector('#scene').dataset.moving==='false');
  async function snap(name){
    await settled();
    await page.screenshot({path:dir+'/'+name+'.png'});
  }
  if(process.argv.includes('pilot')){
    if(mobile)break;
    for(const mode of ['styled','neutral']){
      await visit('/?area=pilot'+(mode==='neutral'?'&neutral':''));await page.locator('#index-toggle').click();await page.locator('#places [data-place-id="santa-ana"]').click();await page.locator('#close').click();await snap('santa-ana-'+mode);
    }
  }else{
    const start=Date.now();await visit('/');console.log(mobile?'mobile':'desktop','load ms',Date.now()-start);
    if(!mobile)await snap('opening');await page.locator('#reset').click();await page.waitForTimeout(200);const initial=await host.getAttribute('data-view');if(!mobile)await snap('overview');
    for(let i=0;i<await page.locator('#places button').count();i++){
      await page.locator('#index-toggle').click();
      const b=page.locator('#places button').nth(i);
      await (mobile?b.tap():b.click());assert.equal(await page.locator('article').isVisible(),true);await page.waitForFunction(i=>document.querySelectorAll('#places button')[i].getAttribute('aria-pressed')==='true',i);
      const placeId=await b.getAttribute('data-place-id');
      if(!mobile&&placeId==='san-telmo')await snap('san-telmo');
      if(!mobile&&placeId==='mercado-de-vegueta')await snap('mercado-teatro');
      if(mobile&&placeId==='teatro-perez-galdos')await snap('teatro-mobile');
      if(mobile&&placeId==='gabinete-literario')await snap('triana-mobile');
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
    // Hold one gesture across two slow sampling windows, then release it.
    if(mobile){
      const width=await page.locator('canvas').evaluate(c=>c.width);
      await page.mouse.move(x,y);await page.mouse.down();
      for(let i=0;i<70;i++){
        await page.mouse.move(x+(i%2?12:0),y);
        await page.waitForTimeout(40);
      }
      await page.waitForFunction(w=>document.querySelector('canvas').width===Math.floor(w*.85),width);
      await page.mouse.up();
      await page.waitForFunction(w=>document.querySelector('canvas').width===w,width);
      await page.locator('#reset').click();
    }
    if(mobile){
      const cdp=await page.context().newCDPSession(page);
      const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
      const pair=d=>[{x:x-d,y,id:1},{x:x+d,y,id:2}];
      await touch('touchStart',pair(20));await touch('touchMove',pair(45));await touch('touchMove',pair(68));await touch('touchEnd',[]);
      await page.waitForTimeout(180);assert.ok(Number((await host.getAttribute('data-view')).split(',')[2])>Number(initial.split(',')[2]));
      await page.locator('#reset').click();
    }
    await page.waitForFunction(v=>document.getElementById('scene').dataset.view===v,initial);await page.locator('.pin[data-place-id="san-telmo"]').waitFor({state:'visible'});await page.locator('.pin[data-place-id="san-telmo"]').focus();await page.keyboard.press('Enter');assert.match(await page.locator('h3').textContent(),/San Telmo/);
    await page.waitForFunction(()=>document.querySelector('.pin[data-place-id="san-telmo"]').getAttribute('aria-pressed')==='true');
    await settled();
    const beforeRotation=await host.getAttribute('data-view');
    const originalSize=page.viewportSize();const fullWidth=await page.locator('canvas').evaluate(c=>c.width);
    await page.setViewportSize({width:originalSize.height,height:originalSize.width});
    await page.waitForTimeout(120);assert.equal(await host.getAttribute('data-view'),beforeRotation);
    await page.setViewportSize(originalSize);
    await page.waitForFunction(w=>document.querySelector('canvas').width===w,fullWidth);
    for(let cycle=0;cycle<3;cycle++){
      const ext=await page.evaluateHandle(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context'));
      if(cycle===0){
        await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+15,y+8,{steps:3});
      }
      if(cycle===1){
        await page.locator('#plus').click();
      }
      const savedView=await ext.evaluate(e=>{
        const view=document.querySelector('#scene').dataset.view;e.loseContext();return view;
      });
      await page.locator('#status').waitFor({state:'visible'});
      if(cycle===0)await page.mouse.up();
      await ext.evaluate(e=>e.restoreContext());
      await page.locator('#status').waitFor({state:'hidden'});
      assert.equal(await host.getAttribute('data-view'),savedView);
      assert.equal(await page.locator('article').isVisible(),true);
      if(cycle>=1)assert.ok(await page.locator('canvas').evaluate(c=>c.width)<fullWidth);
      // Inspect the central map without the DOM controls: a cleared canvas is a failure.
      const rect=await host.boundingBox();
      const png=await page.screenshot({clip:{x:rect.x+rect.width/2-80,y:rect.y+rect.height/2-80,width:160,height:160}});
      const colours=await page.evaluate(async base64=>{
        const img=new Image();img.src='data:image/png;base64,'+base64;await img.decode();
        const c=document.createElement('canvas');c.width=c.height=160;
        const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
        const pixels=ctx.getImageData(0,0,160,160).data;
        return new Set(new Uint32Array(pixels.buffer)).size;
      },png.toString('base64'));
      assert.ok(colours>150,'Expected rendered map after restoration, got '+colours+' colours');
      await ext.dispose();
    }
    if(mobile){
      const cdp=await page.context().newCDPSession(page);
      const prior=await host.getAttribute('data-view');
      for(const [type,d] of [['touchStart',15],['touchMove',25],['touchMove',45],['touchEnd',0]]){
        await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:d?[{x:x-d,y,id:1},{x:x+d,y,id:2}]:[]});
      }
      await page.waitForFunction(v=>document.querySelector('#scene').dataset.view!==v,prior);
    }
    const priorPlaceView=await host.getAttribute('data-view');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#index-toggle').click();await page.locator('#places [data-place-id="santa-ana"]').click();
    await page.waitForFunction(()=>document.querySelector('.pin[data-place-id="santa-ana"]').getAttribute('aria-pressed')==='true');
    assert.equal(await host.getAttribute('data-moving'),'false');
    await page.waitForFunction(prior=>document.querySelector('#scene').dataset.view!==prior,priorPlaceView);
    const retryView=await host.getAttribute('data-view');
    await page.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.getByRole('button',{name:'Recargar'}).click();
    await page.waitForSelector('#scene[data-view]');
    assert.equal(await host.getAttribute('data-view'),retryView);
    assert.match(await page.locator('article:visible h3').textContent(),/Santa Ana/);

  }
  if(!mobile && !process.argv.includes('pilot')){
    let reorder=false;
    await page.route('**/data/poi.geojson',async route=>{
      const response=await route.fetch();
      const data=await response.json();
      const sample=structuredClone(data.features[0]);
      Object.assign(sample.properties,{id:'test-seventh',name:'Test place',areas:['city'],markerHeight:7});
      data.features.push(sample);
      if(reorder)data.features.reverse();
      await route.fulfill({response,json:data});
    });
    await visit('/');
    await page.locator('#index-toggle').click();
    await page.locator('#places [data-place-id="test-seventh"]').click();
    await settled();
    reorder=true;
    await page.reload();await page.waitForSelector('#scene[data-view]');
    assert.equal(await page.locator('article:visible h3').textContent(),'Test place');
    assert.equal(await page.locator('.pin[data-place-id="test-seventh"]').getAttribute('aria-pressed'),'true');
    await visit('/?area=pilot');
    assert.equal(await page.locator('#places [data-place-id="test-seventh"]').count(),0);
    assert.ok(await page.locator('#places [data-place-id="casa-de-colon"]').count());
  }
  assert.deepEqual(faults,[]);await page.close();
 }
}finally{await browser.close();if(server)await server.close();}
