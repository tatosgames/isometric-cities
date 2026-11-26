import assert from 'node:assert/strict';
import {launchBrowser,serveMap} from './qa-browser.mjs';

// Exercise the real idle render loop independently of the host display's refresh rate.
// Synthetic timestamps drive the policy. Wall-clock performance is measured separately.
const {server,origin}=await serveMap({outDir:process.argv[2]||'dist'});
const browser=await launchBrowser();
const fps=Number(process.argv[3]||60);
try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(fps=>{
    const raf=window.requestAnimationFrame.bind(window);
    let actual=-1,clock=0;
    window.requestAnimationFrame=fn=>raf(t=>{
      if(document.querySelector('#map')?.dataset.boot!=='ready'){fn(t);return;}
      if(t!==actual){clock=actual===-1?t:clock+1000/fps;actual=t;}
      fn(clock);
    });
  },fps);
  await page.goto(origin+'?area=pilot&lab=qualita');
  await page.waitForSelector('#scene[data-shadows="off"][data-aa="off"][data-dpr="1"]');
  await page.waitForSelector('#scene[data-shadows="static"][data-aa="off"][data-dpr="1"]',{timeout:30000});
  await page.waitForTimeout(4000);
  assert.equal(await page.locator('#scene').getAttribute('data-shadows'),'static');
  assert.equal(await page.locator('#scene').getAttribute('data-aa'),'off');
  const report=page.locator('#quality-diagnostics');
  await page.waitForFunction(()=>document.getElementById('quality-diagnostics')?.textContent.includes('confirm (stable)'));
  const size=await page.locator('#scene canvas').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2');
    return `${gl.drawingBufferWidth}×${gl.drawingBufferHeight}`;
  });
  assert.ok((await report.innerText()).includes(`Buffer ${size} px`));
  assert.ok((await report.innerText()).includes(`target ${fps}`));
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride',{
    width:390,height:844,mobile:true,deviceScaleFactor:.8
  });
  await page.waitForFunction(old=>document.getElementById('quality-diagnostics')?.textContent.includes(old+' → '),size);
  const resized=await page.locator('#scene canvas').evaluate(canvas=>{
    const gl=canvas.getContext('webgl2');
    return `${gl.drawingBufferWidth}×${gl.drawingBufferHeight}`;
  });
  assert.notEqual(resized,size);
  assert.ok((await report.innerText()).includes(`${size} → ${resized} px`));
  assert.deepEqual(errors,[]);
  console.log(`Mobile calibration retained static shadows at a simulated stable ${fps} Hz.`);
}finally{await browser.close();await server?.close();}
