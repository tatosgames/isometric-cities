import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {preview} from 'vite';

const full=process.argv.includes('--full'), out='.cache/qa-carriageways/'+(full?'city':'pilot');
await mkdir(out,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:0}});
const origin=server.resolvedUrls.local[0],browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
const summary=[];
const oldIndex=JSON.parse(execFileSync('git',['show','6bdb2da:public/data/city-index.json']));
const oldFiles=new Map();
const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];
try{
 for(const mobile of [true,false]){
  for(const legacy of [true,false]){
   const device=mobile?'mobile':'desktop',variant=legacy?'baseline':'mesh';
   const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1024,height:720},hasTouch:mobile,isMobile:mobile});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   // The reference uses the pre-migration payloads, including their original download size.
   if(legacy){
    await page.route('**/data/city-index.json',r=>r.fulfill({json:oldIndex}));
    await page.route('**/city-sectors/*.json',r=>{
     const file=new URL(r.request().url()).pathname.split('/').pop();
     if(!oldFiles.has(file))oldFiles.set(file,execFileSync('git',['show','6bdb2da:public/data/city-sectors/'+file],{maxBuffer:8e6}));
     return r.fulfill({contentType:'application/json',body:oldFiles.get(file)});
    });
   }
   await page.addInitScript(()=>{
    window.frameGaps=[];let prev;
    function sample(t){
      const raw=document.querySelector('#view')?.dataset.sectors;
      if(prev&&raw&&JSON.parse(raw).pending)window.frameGaps.push(t-prev);
      prev=t;requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
   });
   const url=origin+'lab.html?test=settori'+(legacy?'&raster=1':'')+(full?'&intera=1':'');
   const settled=()=>page.waitForFunction(()=>{
    const s=JSON.parse(document.querySelector('#view').dataset.sectors||'{}');return s.visible>0&&!s.pending;
   },null,{timeout:90000});
   await page.goto(url);await settled();
   const cold=await page.evaluate(()=>Math.max(...window.frameGaps));assert.ok(Number.isFinite(cold));
   if(!legacy)assert.ok((await page.locator('#view').getAttribute('data-mesh-cells')).includes('-2_-2'));
   const times=[];
   const scrub=page.locator('.lil-gui input').last();
   for(let lap=0;lap<5;lap++){
    const p95=await page.evaluate(async reverse=>{
     const field=[...document.querySelectorAll('.lil-gui input')].at(-1),next=()=>new Promise(r=>requestAnimationFrame(r));
     const gaps=[];let last=await next();
     for(let j=0;j<=90;j++){
      field.value=String((reverse?90-j:j)*100/90);field.dispatchEvent(new Event('input',{bubbles:true}));
      const t=await next();if(j>0)gaps.push(t-last);last=t;
     }
     const pos=Number(document.querySelector('#view').dataset.position);
     if(Math.abs(pos-(reverse?0:100))>2)throw Error('Route did not move: '+pos);
     return gaps.sort((a,b)=>a-b)[Math.ceil(.95*gaps.length)-1];
    },lap%2===1);
    times.push(p95);
   }
   for(const pos of [0,5,60]){
    await scrub.fill(String(pos));await scrub.press('Enter');
    await page.locator('#view').screenshot({path:out+'/'+device+'-'+variant+'-'+pos+'.png'});
   }
   const stats=JSON.parse(await page.locator('#view').getAttribute('data-sectors'));
   assert.ok(stats.bytes<=stats.budget);
   if(!legacy&&mobile){
    await page.goto(url+'&mappa=1&inverso=1&ritardo=1&pos=95');
    await page.waitForFunction(()=>{const s=JSON.parse(document.querySelector('#view').dataset.sectors||'{}');return s.visible>=1&&s.pending==='-1_-2';},null,{timeout:15000});
    await page.locator('#view').screenshot({path:out+'/mixed.png'});await settled();
   }
   assert.deepEqual(errors,[]);
   summary.push({device,variant,passes:times,p95:median(times),coldWorst:cold,bytes:stats.bytes});
   console.log(summary.at(-1));await writeFile(out+'/result.json',JSON.stringify(summary,null,2));await page.close();
  }
 }
 const local=await browser.newPage();
 await local.addInitScript(()=>Object.defineProperty(window,'OffscreenCanvas',{value:undefined}));
 const faults=[];
 local.on('pageerror',e=>faults.push(e.message));
 local.on('console',m=>{if(m.type()==='warning'&&m.text().startsWith('Sector '))faults.push(m.text());});
 await local.goto(origin+'lab.html?test=settori');
 await local.waitForFunction(()=>{
   const host=document.querySelector('#view'),s=JSON.parse(host.dataset.sectors||'{}');
   return s.visible===2&&!s.pending&&host.dataset.meshCells.split(',').length===2;
 },null,{timeout:60000});
 assert.deepEqual(faults,[]);
 await local.close();
 for(let i=0;i<summary.length;i+=2)assert.ok(summary[i+1].p95<=1.1*summary[i].p95,'Warm p95 exceeds +10%');
}finally{await browser.close();await server.close();}
