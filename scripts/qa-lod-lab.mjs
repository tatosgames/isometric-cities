import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {launchBrowser,serveMap} from './qa-browser.mjs';

const city=process.argv.includes('--citta');
const out=city?'.cache/qa-lod/citta':'.cache/qa-lod',results=[];
await mkdir(out,{recursive:true});
const {server}=await serveMap({env:null});
const browser=await launchBrowser();
const percentile=(a,q)=>a.toSorted((x,y)=>x-y)[Math.ceil(a.length*q)-1];
try{
 for(const mobile of (city?[true]:[true,false])){
  for(const mode of ['current','stable','visual']){
   const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1024,height:720},isMobile:mobile,hasTouch:mobile});
   const errors=[];
   page.on('console',m=>{if(m.type()==='error'||m.text().startsWith('Sector '))errors.push(m.text());});
   page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    window.frames=[];let prev=0;
    function measure(t){
      const v=document.querySelector('#view');
      if(prev&&v?.dataset.sectors)window.frames.push({gap:t-prev,changes:+v.dataset.lodChanges,visible:JSON.parse(v.dataset.sectors).visible});
      prev=t;requestAnimationFrame(measure);
    }
    requestAnimationFrame(measure);
   });
   await page.goto(server.resolvedUrls.local[0]+'lab.html?lab=roads&case=lod&on=map,delay,reverse'+(city?',whole':'')+'&tune=pos:95&mode='+mode);
   const settled=()=>page.waitForFunction(city=>{
    const s=JSON.parse(document.querySelector('#view').dataset.sectors||'{}');
    return (city?s.visible>0:s.visible===2)&&!s.pending;
   },city,{timeout:60000});
   await settled();await page.waitForTimeout(400);
   const sample=()=>page.evaluate(()=>({frames:window.frames.splice(0),changes:+document.querySelector('#view').dataset.lodChanges,
     stats:JSON.parse(document.querySelector('#view').dataset.sectors)}));
   const cold=await sample();
   const switchFrames=cold.frames.flatMap((f,i,a)=>i&&f.changes>a[i-1].changes?[f.gap]:[]);
   let swaps=0;
   if(!city){
    assert.equal(cold.changes,2);
    await page.getByRole('button',{name:'Oscillate on the zoom'}).click();
    await page.waitForTimeout(5600);
    const zoom=await sample();swaps=zoom.changes-cold.changes;
    if(mode==='current')assert.ok(swaps>=4,'Oscillation should cross default threshold');
    else assert.equal(swaps,0);
   }
   await page.getByRole('button',{name:'Bend and reversal'}).click();
   await page.waitForTimeout(5600);await settled();
   const drive=await sample();
   const p95=percentile(drive.frames.map(f=>f.gap),.95);
   assert.ok(drive.stats.bytes<=drive.stats.budget);
   const device=mobile?'mobile':'desktop';
   await page.locator('#view').screenshot({path:out+'/'+device+'-'+mode+'.png'});
   const drawCalls=async()=>Number((await page.locator('#metrics').textContent()).match(/(\d+) draw call/)[1]);
   const settledCalls=await drawCalls();let halfCalls=null;
   if(mode==='visual'){
    const view=page.locator('#view');
    const check=text=>page.getByText(text,{exact:true}).locator('..').locator('input');
    await check('Inspect transition').check();
    const both=await view.screenshot({path:out+'/'+device+'-meta.png'});
    halfCalls=await drawCalls();
    await check('Screen buildings and trees').uncheck();
    const ground=await view.screenshot({path:out+'/'+device+'-suolo.png'});
    await check('Screen buildings and trees').check();
    await check('Fade ground and roads').uncheck();
    const objects=await view.screenshot({path:out+'/'+device+'-retino.png'});
    assert.ok(!both.equals(ground),'Object dithering should change the image');
    assert.ok(!both.equals(objects),'Ground blending should change the image');
   }
   assert.deepEqual(errors,[]);
   results.push({device,mode,zoomSwaps:swaps,arrivalFrameMs:switchFrames.map(Math.round),driveP95:+p95.toFixed(1),driveSwaps:drive.changes-cold.changes-swaps,evictions:drive.stats.evictions,settledCalls,halfCalls,bytes:drive.stats.bytes});
   console.log(results.at(-1));await page.close();
  }
 }
 await writeFile(out+'/results.json',JSON.stringify(results,null,2));
}finally{await browser.close();await server.close();}
