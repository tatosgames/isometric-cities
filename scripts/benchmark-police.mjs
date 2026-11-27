import assert from 'node:assert/strict';
import {launchBrowser,serveMap} from './qa-browser.mjs';

// Pass the previous production dist as argv[2]. Measure actual rAF cadence after warmup.
const baseline=process.argv[2];
assert.ok(baseline,'Supply the baseline build directory');
const browser=await launchBrowser();
const before=await serveMap({env:'',outDir:baseline}),after=await serveMap({env:''});
try{
  for(const [version,server] of [['base',before],['candidate',after]]){
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await page.addInitScript(()=>{let s=7;Math.random=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);});
    // Both runs hold the player at the same start and use the pilot without bus traffic.
    await page.goto(new URL('?lab=drive&area=pilot&off=buses&at=-60,-818&tune=seed:7,chaserEvery:8',server.origin).href);
    const scene=page.locator('#scene[data-drive][data-lab-ready]');
    await scene.waitFor({timeout:120000});await scene.focus();await page.keyboard.down('ArrowDown');
    if(version==='candidate'){
      await page.evaluate(()=>window.policeAdvance(150,0,true));
      await page.keyboard.press('ArrowDown');
    }
    await page.waitForFunction(()=>+document.querySelector('#scene').dataset.drive.split(',')[5]>=5,null,{timeout:120000});
    const frames=await page.evaluate(async()=>{
      const tick=()=>new Promise(requestAnimationFrame),samples=[];
      let last=await tick();
      for(let i=0;i<60;i++){
        const now=await tick(),cars=+document.querySelector('#scene').dataset.drive.split(',')[5];
        if(i>=5 && cars===5)samples.push(now-last);
        last=now;
      }
      return samples.sort((a,b)=>a-b);
    });
    assert.ok(frames.length>5,'Too few frames with five patrol bodies');
    console.log(version,JSON.stringify({frames:frames.length,medianMs:frames[Math.floor(frames.length/2)],p90Ms:frames[Math.floor(frames.length*.9)]}));
    await page.close();
  }
}finally{await browser.close();await before.server?.close();await after.server?.close();}
