import assert from 'node:assert/strict';
import {launchBrowser,serveMap} from './qa-browser.mjs';

const start=process.argv[2]??'120,120';
const {server,origin}=await serveMap();
const browser=await launchBrowser();
const percentile=(values,p)=>values.sort((a,b)=>a-b)[Math.floor(values.length*p)];
const results=[];
try{
  // Alternate order so browser warmup does not consistently favour one configuration.
  for(const enabled of [false,true,true,false]){
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await page.addInitScript(()=>{
      let seed=451725;
      Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
      window.drawCalls=0;
      const gl=WebGL2RenderingContext.prototype;
      for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
        const original=gl[method];
        gl[method]=function(...args){window.drawCalls++;return original.apply(this,args);};
      }
    });
    await page.goto(new URL('?lab=drive&at='+start+'&off=police'+(enabled?'':',buses'),origin).href);
    const host=page.locator('#scene[data-guaguas]');
    await host.waitFor({timeout:120000});
    await host.focus();await page.keyboard.down('ArrowUp');
    const samples=await page.evaluate(async()=>{
      const tick=()=>new Promise(requestAnimationFrame);
      for(let i=0;i<20;i++)await tick();
      const scene=document.querySelector('#scene'),samples=[];
      let last=await tick(),draws=window.drawCalls;
      for(let i=0;i<100;i++){
        const now=await tick(),fleet=JSON.parse(scene.dataset.guaguas);
        if(fleet.errors.length)throw Error(fleet.errors.join(','));
        samples.push([now-last,window.drawCalls-draws,fleet.cpuMs,fleet.active.length]);
        last=now;draws=window.drawCalls;
      }
      return samples;
    });
    await page.keyboard.up('ArrowUp');await page.close();
    results.push({enabled,samples});
  }
  const summaries=[false,true].map(enabled=>{
    const samples=results.filter(r=>r.enabled===enabled).flatMap(r=>r.samples);
    return {enabled,frameP90:percentile(samples.map(r=>r[0]),.9),drawP90:percentile(samples.map(r=>r[1]),.9),
      fleetCpuP90:percentile(samples.map(r=>r[2]),.9),maxActive:Math.max(...samples.map(r=>r[3]))};
  });
  console.table(summaries);
  assert.equal(summaries[0].maxActive,0);
  assert.ok(summaries[1].maxActive>0 && summaries[1].maxActive<=6);
  assert.ok(summaries[1].fleetCpuP90<=1,'Fleet CPU p90 exceeds 1 ms');
  assert.ok(summaries[1].frameP90<=summaries[0].frameP90*1.10,'Frame p90 exceeds +10%');
}finally{await browser.close();await server?.close();}
