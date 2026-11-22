import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import './qa-drive-pose.mjs';
import './qa-drive-location.mjs';
import './qa-pedestrians.mjs';
import './qa-ground.mjs';
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
const server=process.env.MAP_URL?null:await (await import('vite')).preview({preview:{host:'127.0.0.1',port:0,open:false}});
const origin=process.env.MAP_URL||server.resolvedUrls.local[0].replace(/\/$/,'');
const dir=process.env.QA_SCREENSHOT_DIR||'docs/screenshots';
await mkdir(dir,{recursive:true});
try{
 for(const mobile of [false,true]){
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},hasTouch:mobile,isMobile:mobile});
  const faults=[];
  page.on('pageerror',e=>faults.push(e.message));
  page.on('requestfailed',r=>{
    if(/\/city-(sectors|zones)\//.test(r.url()) && r.failure()?.errorText.includes('ERR_ABORTED'))return;
    faults.push(r.url()+' '+(r.failure()?.errorText??''));
  });
  page.on('response',r=>{if(r.status()>=400||!r.url().startsWith(origin))faults.push(r.url());});
  const host=page.locator('#scene');
  async function visit(path){
    await page.goto(origin+path);await page.waitForSelector('#scene[data-view]',{timeout:60000});
  }
  const settled=()=>page.waitForFunction(()=>document.querySelector('#scene').dataset.moving==='false');
  const angle=async()=>Number(await host.getAttribute('data-map-angle'));
  const left=page.getByRole('button',{name:'Girar vista a la izquierda'});
  const right=page.getByRole('button',{name:'Girar vista a la derecha'});
  const turnRight=()=>mobile?right.tap():right.click();
  async function snap(name){
    await settled();
    await page.waitForFunction(()=>{
      const state=document.querySelector('#scene').dataset.sectors;
      return !state || !JSON.parse(state).pending;
    });
    await page.screenshot({path:dir+'/'+name+'.png'});
  }
  if(process.argv.includes('pilot')){
    if(mobile)break;
    for(const mode of ['styled','neutral']){
      await visit('/?area=pilot'+(mode==='neutral'?'&neutral':''));await page.locator('#index-toggle').click();await page.locator('#places [data-place-id="santa-ana"]').click();await page.locator('#close').click();await snap('santa-ana-'+mode);
    }
  }else{
    const start=Date.now();await visit('/');console.log(mobile?'mobile':'desktop','load ms',Date.now()-start);
    // A resting map still moves: wind in the trees and cloud shadows, with the camera untouched.
    await settled();await page.waitForFunction(()=>!JSON.parse(document.querySelector('#scene').dataset.sectors).pending);
    const restingView=await host.getAttribute('data-view'),restingFrame=await page.locator('canvas').screenshot();
    await page.waitForTimeout(800);
    assert.ok(!restingFrame.equals(await page.locator('canvas').screenshot()),'Wind and cloud shadows should keep moving on a resting map');
    assert.equal(await host.getAttribute('data-view'),restingView);
    for(const expected of [90,180,270,0]){
      await turnRight();await settled();
      assert.equal(await angle(),expected);
      assert.equal(await host.getAttribute('data-view'),restingView,'Rotation must preserve the center and zoom');
    }
    await page.evaluate(()=>{
      const right=document.getElementById('rotate-right'),left=document.getElementById('rotate-left');
      right.click();right.click();left.click();left.click();
    });
    await settled();assert.equal(await angle(),0,'Rapid clicks should count in both directions');
    await left.focus();await page.keyboard.press('Enter');await settled();assert.equal(await angle(),270);
    await turnRight();await settled();assert.equal(await angle(),0);
    if(!mobile)await snap('opening');await page.locator('#reset').click();await page.waitForFunction(()=>{const s=JSON.parse(document.querySelector('#scene').dataset.sectors);return !s.pending && s.visible===0 && document.querySelector('#scene').dataset.moving==='false';});const initial=await host.getAttribute('data-view');if(!mobile)await snap('overview');
    for(const expected of [90,180,270,0]){
      await turnRight();await page.locator('#reset').click();await settled();
      assert.equal(await angle(),expected,'Overview must keep the chosen orientation');
      // The widest view frames a district, so only part of the places is on screen.
      assert.ok(await page.locator('.pin:visible').count()>0);
      if(expected===90)await snap(mobile?'rotation-mobile':'rotation-desktop');
    }
    assert.equal(await host.getAttribute('data-view'),initial);
    const credits=page.locator('footer');
    assert.equal(await credits.isVisible(),false);
    for(let i=0;i<await page.locator('#places button').count();i++){
      await page.locator('#index-toggle').click();
      assert.equal(await credits.isVisible(),true);
      const b=page.locator('#places button').nth(i);
      await (mobile?b.tap():b.click());assert.equal(await page.locator('article').isVisible(),true);await page.waitForFunction(i=>document.querySelectorAll('#places button')[i].getAttribute('aria-pressed')==='true',i);
      assert.equal(await credits.isVisible(),true);
      const placeId=await b.getAttribute('data-place-id');
      if(!mobile&&placeId==='parque-doramas')await snap('ciudad-jardin');
      if(!mobile&&placeId==='san-telmo')await snap('san-telmo');
      if(!mobile&&placeId==='mercado-de-vegueta')await snap('mercado-teatro');
      if(mobile&&placeId==='teatro-perez-galdos')await snap('teatro-mobile');
      if(mobile&&placeId==='gabinete-literario')await snap('triana-mobile');
      await page.locator('#close').click();
      assert.equal(await credits.isVisible(),false);
    }
    await page.locator('#reset').click();await page.waitForTimeout(150);
    await page.waitForFunction(v=>document.getElementById('scene').dataset.view===v,initial);
    const rect=await host.boundingBox();
    // Start the drag on the map itself: in the whole-city view a place marker can sit under a fixed point.
    const [x,y]=await page.evaluate(r=>{
      for(const [fx,fy] of [[.4,.6],[.3,.7],[.6,.75],[.25,.5],[.7,.4],[.5,.85]]){
        const x=r.x+r.width*fx,y=r.y+r.height*fy;
        if(document.elementFromPoint(x,y)?.tagName==='CANVAS')return [x,y];
      }
      throw new Error('No free map point for the drag');
    },rect);
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+55,y+36,{steps:5});await page.mouse.up();await page.waitForTimeout(100);
    assert.notEqual(await host.getAttribute('data-view'),initial);
    const moved=await host.getAttribute('data-view');
    // The view prints zoom with two decimals: at whole-city scale one wheel notch does not reach the second one.
    for(let notch=0;notch<8 && await host.getAttribute('data-view')===moved;notch++){await page.mouse.wheel(0,-180);await page.waitForTimeout(150);}
    assert.notEqual(await host.getAttribute('data-view'),moved);
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
    await turnRight();await settled();assert.equal(await angle(),90);
    const beforeRotation=await host.getAttribute('data-view');
    const originalSize=page.viewportSize();const fullWidth=await page.locator('canvas').evaluate(c=>c.width);
    await page.setViewportSize({width:originalSize.height,height:originalSize.width});
    await page.waitForTimeout(120);assert.equal(await host.getAttribute('data-view'),beforeRotation);
    assert.equal(await angle(),90);
    if(mobile)await snap('rotation-landscape');
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
      assert.equal(await angle(),90);
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
    await page.locator('#index-toggle').click();await page.locator('#places [data-place-id="santa-ana"]').click();
    await page.waitForFunction(()=>document.querySelector('.pin[data-place-id="santa-ana"]').getAttribute('aria-pressed')==='true');
    await settled();
    await page.waitForFunction(prior=>document.querySelector('#scene').dataset.view!==prior,priorPlaceView);
    const retryView=await host.getAttribute('data-view');
    await page.evaluate(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.getByRole('button',{name:'Recargar'}).click();
    await page.waitForSelector('#scene[data-view]');
    assert.equal(await host.getAttribute('data-view'),retryView);
    assert.equal(await angle(),90);
    assert.match(await page.locator('article:visible h3').textContent(),/Santa Ana/);

  }
  if(!process.argv.includes('pilot')){
    // Driving mode: start, steer, collect, get caught, retry and leave.
    await visit('/');
    const entryAngle=((await angle())+90)%360;
    await turnRight();await settled();assert.equal(await angle(),entryAngle);
    const before=await host.getAttribute('data-view');
    const drive=async()=>(await host.getAttribute('data-drive')).split(',');
    await page.locator('#drive').click();
    await page.waitForFunction(()=>document.querySelector('#scene').dataset.drive?.startsWith('ready'));
    // Pedestrians populate the streets around the car before the run starts, none of them on top of it.
    await page.waitForFunction(()=>Number(document.querySelector('#scene').dataset.drive.split(',')[12])>0);
    assert.ok(Number((await host.getAttribute('data-drive')).split(',')[13])>=2.2,'A pedestrian stands on the car');
    assert.equal(await page.locator('#pins').isVisible(),false);
    assert.equal(await right.isVisible(),false);
    assert.equal(await page.locator('footer a[href*="openstreetmap"]').isVisible(),true);
    assert.equal(await page.locator('#hud-stats .stat').count(),2);
    assert.equal(await page.locator('#over-record').isVisible(),false);
    if(mobile){
      await page.waitForFunction(()=>Math.abs(Number(document.querySelector('#scene').dataset.drive.split(',')[8])-1)<.05);
      await page.screenshot({path:dir+'/conducir-mobile.png'});
    }
    const ready=await drive();assert.ok(Number(ready[6])>0,'Expected a coin trail');
    const initialSpawn=[ready[2],ready[3]];
    const box=await host.boundingBox();
    const waitForTurn=()=>page.waitForFunction(start=>{
      const current=document.querySelector('#scene').dataset.drive.split(',');
      return Math.sin(current[4]-start[4])>.1 && Math.hypot(current[2]-start[2],current[3]-start[3])>.3;
    },ready);
    if(mobile){
      const cdp=await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.2,y:box.y+box.height*.7,id:1}]});
      await waitForTurn();
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }else{
      await page.keyboard.down('ArrowLeft');await waitForTurn();await page.keyboard.up('ArrowLeft');
    }
    const turned=await drive();
    assert.equal(turned[0],'playing');
    assert.ok(Math.sin(turned[4]-ready[4])>.1,'Left input should turn the car anticlockwise');
    assert.ok(Math.hypot(turned[2]-ready[2],turned[3]-ready[3])>.3,'Car should move by itself');
    assert.notEqual(await host.getAttribute('data-view'),before);
    // Brake for the capture check. A free-running car can keep glancing off walls.
    const waitForCapture=async()=>{
      await page.keyboard.down('ArrowDown');
      try{
        await page.waitForFunction(()=>document.querySelector('#scene').dataset.drive?.startsWith('caught'),null,{timeout:120000});
      }finally{
        await page.keyboard.up('ArrowDown');
      }
    };
    await waitForCapture();
    const caughtScore=(await drive())[1];
    const caughtTime=await page.locator('#over-time').textContent();
    const caughtRecord=await page.locator('#over-record').textContent();
    if(!mobile){
      const ext=await page.evaluateHandle(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context'));
      await ext.evaluate(e=>e.loseContext());
      await page.locator('#status').waitFor({state:'visible'});
      assert.equal(await page.locator('#over').isVisible(),false);
      const frozen=await host.getAttribute('data-drive');
      await page.waitForTimeout(400);
      assert.equal(await host.getAttribute('data-drive'),frozen,'The capture sequence must pause with graphics lost');
      await ext.evaluate(e=>e.restoreContext());
      await page.locator('#status').waitFor({state:'hidden'});
      await ext.dispose();
    }
    await page.locator('#again').waitFor({state:'visible'});
    assert.equal(await page.locator('#over-title').innerText(),'ATRAPADO');
    assert.equal(await page.locator('#over-record').isVisible(),true);
    for(const id of ['hud-stats','drive-location','drive-camera']){
      assert.equal(await page.locator('#'+id).isVisible(),false);
    }
    assert.equal(await page.locator('footer').isVisible(),true);
    // The capture held the simulation at least once, and the camera kick has sprung back to rest.
    assert.ok(Number((await drive())[10])>=1,'Capture should hit-stop');
    await page.waitForFunction(()=>Number(document.querySelector('#scene').dataset.drive.split(',')[11])<.02,null,{timeout:6000});
    assert.equal(await page.locator('#over-coins').textContent(),caughtScore);
    assert.equal(await page.locator('#hud-time').textContent(),caughtTime);
    assert.equal(await page.locator('#over-record').textContent(),caughtRecord);
    assert.equal(await page.locator('#again').evaluate(node=>document.activeElement===node),true);
    const colorSpread=async()=>{
      const pixels=await page.screenshot({
        clip:{x:0,y:0,width:box.width,height:Math.floor(box.height*.12)},
        style:'#hud{visibility:hidden}',
      });
      return page.evaluate(async png=>{
        const image=await createImageBitmap(await (await fetch('data:image/png;base64,'+png)).blob());
        const canvas=new OffscreenCanvas(image.width,image.height),ctx=canvas.getContext('2d');
        ctx.drawImage(image,0,0);
        const {data}=ctx.getImageData(0,0,image.width,image.height);
        image.close();
        let max=0;
        for(let i=0;i<data.length;i+=4){
          max=Math.max(max,Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]));
        }
        return max;
      },pixels.toString('base64'));
    };
    let spread=await colorSpread();
    for(let attempt=0;spread>1 && attempt<3;attempt++){
      await page.waitForTimeout(250);spread=await colorSpread();
    }
    assert.ok(spread<=1,'The captured city and backdrop should be grayscale');
    await page.screenshot({path:dir+(mobile?'/conducir-fin.png':'/conducir-fin-desktop.png')});
    if(mobile){
      await page.setViewportSize({width:844,height:390});
      await page.waitForFunction(()=>document.querySelector('#scene canvas').clientWidth===844);
      const summary=await page.locator('.over-summary').boundingBox();
      const actions=await page.locator('#over-actions').boundingBox();
      const credits=await page.locator('footer').boundingBox();
      assert.ok(summary.y+summary.height<actions.y && actions.y+actions.height<credits.y,'Results fit above the credits in landscape');
      await page.screenshot({path:dir+'/conducir-fin-landscape.png'});
      await page.setViewportSize({width:390,height:844});
      await page.waitForFunction(()=>document.querySelector('#scene canvas').clientWidth===390);
    }
    await page.locator('#again').click();
    await page.waitForFunction(()=>document.querySelector('#scene').dataset.drive?.startsWith('ready'));
    const retry=await drive();
    assert.equal(retry[1],'0');
    assert.notDeepEqual([retry[2],retry[3]],initialSpawn,'Retry should use a different random start node');
    assert.ok(await colorSpread()>1,'Retry should restore the scene colors');
    // A straight start runs along the first metres of the coin trail.
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(()=>Number(document.querySelector('#scene').dataset.drive?.split(',')[1])>0,null,{timeout:20000});
    // Graphics loss while driving holds the run: same score, no restart, and it continues on the next input.
    {
      const before=await drive();
      const ext=await page.evaluateHandle(()=>document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context'));
      await ext.evaluate(e=>e.loseContext());
      await page.locator('#status').waitFor({state:'visible'});
      const frozen=await host.getAttribute('data-drive');
      await page.waitForTimeout(400);
      assert.equal(await host.getAttribute('data-drive'),frozen,'The run must not advance without graphics');
      await ext.evaluate(e=>e.restoreContext());
      await page.locator('#status').waitFor({state:'hidden'});
      await page.waitForFunction(()=>document.querySelector('#scene').dataset.drive?.startsWith('held'));
      const held=await drive();
      assert.ok(Number(held[1])>=Number(before[1]),'Score survives the loss');
      assert.equal(await page.locator('#hud').isVisible(),true);
      assert.equal(await page.locator('#pins').isVisible(),false);
      await page.waitForTimeout(300);
      assert.equal((await drive())[2],held[2],'A held run waits for input');
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(()=>document.querySelector('#scene').dataset.drive?.startsWith('playing'));
      await ext.dispose();
    }
    if(mobile){
      await waitForCapture();
      await page.locator('#leave').tap();
    }else await page.locator('#drive-exit').click();
    assert.equal(await host.getAttribute('data-drive'),null);
    assert.equal(await page.locator('#plus').isVisible(),true);
    await page.waitForFunction(v=>document.querySelector('#scene').dataset.view===v,before);
    assert.equal(await angle(),entryAngle);
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
