// End-to-end flight: use the actual HUD and keyboard/touch controls over both map datasets.
import assert from 'node:assert/strict';
import {launchBrowser,serveMap} from './qa-browser.mjs';

const timeout=150000;
const {server,origin}=await serveMap();
const browser=await launchBrowser();
const cases=[
  {name:'pilot',query:'area=pilot',viewport:{width:760,height:500},touch:false},
  {name:'city',query:'',viewport:{width:390,height:844},touch:true}
];
const errors=[];
const phase=(page,name)=>page.waitForSelector('#scene[data-flight^="'+name+',"]',{timeout});
const flight=page=>page.locator('#scene').evaluate(host=>{
  const [phase,...numbers]=host.dataset.flight.split(',');
  const [x,y,altitude,h]=numbers.map(Number);
  return {phase,x,y,altitude,h};
});
async function launch(page,touch){
  const button=page.locator('#drive-flight');
  if(touch)await button.tap();else await button.click();
  await phase(page,'fly');
  assert.equal(await button.getAttribute('aria-label'),'Volver al coche');
}
async function waitForTurn(page,heading){
  await page.waitForFunction(start=>{
    const data=document.querySelector('#scene').dataset.flight?.split(',');
    if(data?.[0]!=='fly')return false;
    const angle=Number(data[4])-start;
    return Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)))>.12;
  },heading,{timeout,polling:100});
}
async function restoreGraphics(page){
  const loss=await page.evaluateHandle(()=>document.querySelector('#scene canvas').getContext('webgl2').getExtension('WEBGL_lose_context'));
  assert.ok(await loss.evaluate(ext=>!!ext),'Chrome exposes context-loss simulation');
  await loss.evaluate(ext=>ext.loseContext());
  await page.locator('#status').waitFor({state:'visible',timeout});
  const stopped=await flight(page);
  await loss.evaluate(ext=>ext.restoreContext());
  await page.locator('#status').waitFor({state:'hidden',timeout});
  await page.waitForFunction(({x,y})=>{
    const [,east,north]=document.querySelector('#scene').dataset.flight?.split(',')??[];
    return Math.hypot(Number(east)-x,Number(north)-y)>1;
  },stopped,{timeout,polling:100});
  await loss.dispose();
}
try{
  for(const run of cases){
    const page=await browser.newPage({viewport:run.viewport,hasTouch:run.touch,isMobile:run.touch});
    try{
      page.on('pageerror',error=>errors.push(run.name+' '+error.message));
      await page.goto(new URL('index.html?nopolice&'+run.query,origin).href,{waitUntil:'domcontentloaded',timeout});
      await page.waitForSelector('#map[data-boot=ready]',{timeout});
      const drive=page.locator('#drive');
      if(run.touch)await drive.tap();else await drive.click();
      await page.waitForSelector('#scene[data-drive^="ready,"]',{timeout});
      const button=page.locator('#drive-flight');
      const score=await page.locator('#hud-coins').textContent();
      await launch(page,run.touch);
      const before=await flight(page);
      assert.ok([before.x,before.y,before.altitude,before.h].every(Number.isFinite));
      if(run.touch){
        const cdp=await page.context().newCDPSession(page);
        const point={x:110,y:520,id:1};
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:190,y:475}]});
        try{await waitForTurn(page,before.h);}finally{
          await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
          await cdp.detach();
        }
        await page.setViewportSize({width:740,height:390});
        await phase(page,'fly');
      }else{
        await page.keyboard.down('ArrowRight');
        try{await waitForTurn(page,before.h);}finally{await page.keyboard.up('ArrowRight');}
        await restoreGraphics(page);
      }
      assert.equal(await page.locator('#hud-coins').textContent(),score,'Coins stay frozen in flight');
      if(run.touch)await button.tap();else await button.click();
      await page.waitForSelector('#scene:not([data-flight])[data-drive^="playing,"]',{timeout});
      assert.equal(await button.getAttribute('aria-label'),'Volar');
      assert.ok(Number(await page.locator('#hud-coins').textContent())>=Number(score),'Landing preserves coins');
      assert.equal(await page.locator('#over').isHidden(),true);
      if(!run.touch){
        await launch(page,false);
        const crashScore=await page.locator('#hud-coins').textContent();
        await page.keyboard.down('ArrowDown');
        try{await phase(page,'crash');}finally{await page.keyboard.up('ArrowDown');}
        await page.waitForSelector('#over-actions:not([hidden])',{timeout});
        assert.match(await page.locator('#over-title').textContent(),/accidente/i);
        assert.equal(await page.locator('#over-coins').textContent(),crashScore);
        await page.locator('#again').click();
        await page.waitForSelector('#scene:not([data-flight])[data-drive^="ready,"]',{timeout});
        assert.equal(await button.isVisible(),true);
      }
      console.log('Flight '+run.name+' passed');
    }finally{await page.close();}
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();await server?.close();}
