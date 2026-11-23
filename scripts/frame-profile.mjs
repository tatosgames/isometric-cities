// Frame pacing at one place: node scripts/frame-profile.mjs [place-id | x,y,zoom] [dist] [query]
// x and y are local metres; zoom 1.59 is the place view and 0.352 the widest view of the 390 px phone.
import {launchBrowser,serveMap} from './qa-browser.mjs';
const [place='santa-ana',dir='dist',query='']=process.argv.slice(2);
const {server}=await serveMap({env:null,outDir:dir});
const browser=await launchBrowser();
try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await page.addInitScript(()=>{
    window.stats={draws:0,tris:0};
    const p=WebGL2RenderingContext.prototype;
    for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
      const fn=p[name];p[name]=function(...args){window.stats.draws++;if(args[0]===4)window.stats.tris+=(name.includes('Arrays')?args[2]:args[1])*(name.endsWith('Instanced')?args[3]:1)/3;return fn.apply(this,args);};}
  });
  const spot=/^-?\d/.test(place)?place.split(',').map(Number):null;
  // A view by coordinates opens as a resumed session, the same path as a reload.
  if(spot)await page.addInitScript(([x,y,zoom])=>sessionStorage.setItem('map-view:'+location.pathname+location.search,JSON.stringify({target:[x,0,-y],zoom,turn:0})),spot);
  await page.goto(server.resolvedUrls.local[0]+query);await page.waitForSelector('#scene[data-view]');
  if(!spot){await page.locator('#index-toggle').click();await page.locator('#places [data-place-id="'+place+'"]').click();}
  await page.waitForFunction(()=>{const e=document.querySelector('#scene');if(e.dataset.moving!=='false')return false;const s=JSON.parse(e.dataset.sectors);return !s.pending&&!s.fading;},null,{timeout:60000});
  await page.waitForTimeout(1500);
  const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
  const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  const m0=await metrics();
  const result=await page.evaluate(async()=>{
    const tick=()=>new Promise(requestAnimationFrame),times=[],start={...window.stats};let last=await tick(),busy=0;const read=()=>JSON.parse(document.querySelector('#scene').dataset.sectors),before=read();
    for(let i=0;i<160;i++){document.querySelector('#scene').dispatchEvent(new KeyboardEvent('keydown',{key:i%2?'ArrowLeft':'ArrowRight'}));const now=await tick();times.push(now-last);last=now;if(read().pending)busy++;}
    const sorted=[...times].sort((a,b)=>a-b),at=q=>+sorted[Math.floor(sorted.length*q)].toFixed(1);
    const s=JSON.parse(document.querySelector('#scene').dataset.sectors);
    return {evictions:s.evictions-before.evictions,framesWithPending:busy,median:at(.5),p90:at(.9),p95:at(.95),max:at(.999),draws:(window.stats.draws-start.draws)/160,tris:Math.round((window.stats.tris-start.tris)/160),visible:s.visible,loaded:s.loaded,zones:s.zones.length,bytes:s.bytes,zoneBytes:s.zoneBytes,canvas:document.querySelector('canvas').width+'x'+document.querySelector('canvas').height};
  });
  const m1=await metrics();
  // Main-thread milliseconds per frame: script, layout and style. What is left of a slow frame is the GPU.
  for(const [key,name] of [['ScriptDuration','scriptMs'],['LayoutDuration','layoutMs'],['RecalcStyleDuration','styleMs'],['TaskDuration','taskMs']])result[name]=+((m1[key]-m0[key])*1000/160).toFixed(2);
  console.log(result);
}finally{await browser.close();await server.close();}
