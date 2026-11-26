import assert from 'node:assert/strict';
import {launchBrowser,serveMap} from './qa-browser.mjs';

// Exercise the real idle render loop independently of the host display's refresh rate.
// Synthetic timestamps drive the policy. Wall-clock performance is measured separately.
const {server,origin}=await serveMap({outDir:process.argv[2]||'dist'});
const browser=await launchBrowser();
const idleDrop=process.argv[3]==='idle-drop';
const fps=idleDrop?40:Number(process.argv[3]||60);
try{
  const page=await browser.newPage(idleDrop?{viewport:{width:960,height:800}}:
    {viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(({fps,idleDrop})=>{
    const raf=window.requestAnimationFrame.bind(window);
    window.testRefreshRate=fps;
    window.testReducedFrames=[];
    let actual=-1,clock=0;
    window.requestAnimationFrame=fn=>raf(t=>{
      if(document.querySelector('#map')?.dataset.boot!=='ready'){fn(t);return;}
      if(t!==actual){clock=actual===-1?t:clock+1000/window.testRefreshRate;actual=t;window.testFrameTime=clock;}
      const scene=idleDrop?document.getElementById('scene'):null;
      const stage=scene?.dataset.qualityStage;
      fn(clock);
      const next=scene?.dataset.qualityStage;
      if(next!==stage && (next==='-1' || next==='-2')){
        const gl=scene.querySelector('canvas').getContext('webgl2');
        const pixels=new Uint8Array(4*4*4);
        gl.readPixels(Math.floor(gl.drawingBufferWidth/2)-2,Math.floor(gl.drawingBufferHeight/2)-2,
          4,4,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        window.testReducedFrames.push({stage:next,lost:gl.isContextLost(),drawn:pixels.some((value,i)=>i%4===3 && value>0)});
      }
    });
  },{fps,idleDrop});
  await page.goto(origin+'?area=pilot&lab=qualita');
  if(idleDrop){
    const scene=page.locator('#scene');
    const report=page.locator('#quality-diagnostics');
    await page.waitForSelector('#scene[data-shadows="solar"]');
    await page.waitForFunction(()=>window.testFrameTime!==undefined);
    const start=await page.evaluate(()=>window.testFrameTime);
    await page.waitForFunction(start=>window.testFrameTime>=start+7000,start);
    assert.equal(await scene.getAttribute('data-shadows'),'solar','a 40 Hz display can sustain the 30 FPS cap');
    assert.match(await report.innerText(),/Now (?:29|30|31) FPS/);
    const view=await scene.getAttribute('data-view');
    await page.evaluate(()=>{window.testRefreshRate=20;});
    await page.waitForSelector('#scene[data-shadows="static"]');
    await page.waitForSelector('#scene[data-shadows="off"]');
    assert.equal(await scene.getAttribute('data-view'),view);
    assert.match(await report.innerText(),/reduce \(slow\).*L1 static\/native → L0 off\/native · target 30 · 20 FPS/);
    await page.waitForSelector('#scene[data-quality-stage="-2"]');
    assert.deepEqual(await page.evaluate(()=>window.testReducedFrames),[
      {stage:'-1',lost:false,drawn:true},
      {stage:'-2',lost:false,drawn:true}
    ]);
    assert.deepEqual(errors,[]);
    const loss=await scene.locator('canvas').evaluateHandle(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context'));
    await loss.evaluate(ext=>ext.loseContext());
    await page.waitForFunction(()=>document.getElementById('quality-diagnostics').textContent.includes('WebGL context lost'));
    await page.waitForSelector('#status:not([hidden])');
    await loss.evaluate(ext=>ext.restoreContext());
    await page.waitForFunction(()=>document.getElementById('quality-diagnostics').textContent.includes('WebGL context restored'));
    await page.waitForSelector('#status[hidden]',{state:'attached'});
    assert.equal(await scene.getAttribute('data-view'),view);
    console.log('Desktop idle kept solar shadows at 40 Hz, rendered both DPR drops at 20 FPS, and reported forced WebGL loss and recovery.');
  }else{
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
  }
}finally{await browser.close();await server?.close();}
