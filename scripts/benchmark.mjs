import {chromium} from 'playwright';
import {preview} from 'vite';
const server=await preview({build:{outDir:process.argv[2]||'dist'},preview:{host:'127.0.0.1',port:0}});
const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader','--enable-precise-memory-info']});
try{
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
await page.addInitScript(()=>{
 window.stats={draws:0,buffers:0,textures:0,tris:0};
 const p=WebGL2RenderingContext.prototype;
 for(const [method,key,delta] of [['createBuffer','buffers',1],['deleteBuffer','buffers',-1],['createTexture','textures',1],['deleteTexture','textures',-1]]){
 const fn=p[method];p[method]=function(...args){window.stats[key]+=delta;return fn.apply(this,args);};}
 for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
 const fn=p[name];p[name]=function(...args){window.stats.draws++;if(args[0]===4)window.stats.tris+=(name.includes('Arrays')?args[2]:args[1])*(name.endsWith('Instanced')?args[3]:1)/3;return fn.apply(this,args);};}
});
const cdp=await page.context().newCDPSession(page);
let peak=0;const timer=setInterval(async()=>{try{const h=await cdp.send('Runtime.getHeapUsage');peak=Math.max(peak,h.usedSize+(h.backingStorageSize||0));}catch{}},40);
const t=Date.now();await page.goto(server.resolvedUrls.local[0]);await page.waitForSelector('#scene[data-view]');clearInterval(timer);
console.log({openMs:Date.now()-t,sampledHeapPeak:peak});
console.log(await page.evaluate(async()=>{
 const tick=()=>new Promise(requestAnimationFrame),times=[];let base,atEnd,calls=0,tris=0,frames=0;
 for(let n=0;n<22;n++){
 const name=n%2?'Parque de San Telmo':'Plaza de Santa Ana';
 const button=Array.from(document.querySelectorAll('#places button')).find(item=>item.textContent.trim().endsWith(name));
 button.click();await new Promise(r=>setTimeout(r,400));
 const start={...window.stats};let last=await tick();
 for(let i=0;i<8;i++){document.querySelector('#scene').dispatchEvent(new KeyboardEvent('keydown',{key:i%2?'ArrowLeft':'ArrowRight'}));const now=await tick();if(n>1){times.push(now-last);frames++;}last=now;}
 if(n>1){calls+=window.stats.draws-start.draws;tris+=window.stats.tris-start.tris;}
 if(n===1)base={...window.stats};atEnd={...window.stats};}
 const idle=window.stats.draws;await new Promise(r=>setTimeout(r,5000));times.sort((a,b)=>a-b);
 return {p95:times[Math.floor(times.length*.95)],drawsPerFrame:calls/frames,trianglesPerFrame:Math.round(tris/frames),base,atEnd,idleDraws:window.stats.draws-idle};
}));
}finally{await browser.close();await server.close();}
