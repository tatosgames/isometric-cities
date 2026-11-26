// node scripts/benchmark-flight.mjs [dist] [--half-resolution] [--shots=directory]
// Repeats the same flight in one WebGL session, keeping the renderer and sector caches alive.
import {launchBrowser,serveMap} from './qa-browser.mjs';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const args=process.argv.slice(2);
const outDir=args.find(arg=>!arg.startsWith('--'))??'dist';
const half=args.includes('--half-resolution');
const shots=args.find(arg=>arg.startsWith('--shots='))?.slice(8);
const {origin,server}=await serveMap({outDir});
const browser=await launchBrowser();
try{
  if(shots)await mkdir(shots,{recursive:true});
  const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:half ? .5 : 1});
  const faults=[];page.on('pageerror',error=>faults.push(error.message));
  await page.addInitScript(()=>{
    const stats={draws:0,triangles:0};
    window.flightDraws=stats;
    const gl=WebGL2RenderingContext.prototype;
    for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
      const draw=gl[method];
      gl[method]=function(...a){
        stats.draws++;
        if(a[0]===this.TRIANGLES){
          const count=method.includes('Arrays')?a[2]:a[1];
          stats.triangles+=count*(method.endsWith('Instanced')?a[method.includes('Arrays')?3:4]:1)/3;
        }
        return draw.apply(this,a);
      };
    }
  });
  await page.goto(origin+'?lab=guida&start=186.5,-1011&seed=1&nopolice&nobuses',
    {waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForSelector('#scene[data-drive^="ready,"]',{timeout:120000});
  const gpu=await page.evaluate(()=>{
    const gl=document.querySelector('#scene canvas').getContext('webgl2');
    const ext=gl.getExtension('WEBGL_debug_renderer_info');
    return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  });
  console.log(JSON.stringify({gpu,cssViewport:'1920x1080',devicePixelRatio:half ? .5 : 1}));
  for(const pass of ['first','warm']){
    if(pass==='warm'){
      await page.evaluate(()=>window.policeRestart());
      await page.waitForSelector('#scene:not([data-flight])[data-drive^="ready,"]',{timeout:120000});
    }
    const rows=await page.evaluate(async pass=>{
      const host=document.querySelector('#scene'),canvas=host.querySelector('canvas');
      const button=document.querySelector('#drive-flight');
      const stats=window.flightDraws;
      const raf=()=>new Promise(requestAnimationFrame);
      const rows=[];
      function input(type,key){window.dispatchEvent(new KeyboardEvent(type,{key,bubbles:true,cancelable:true}));}
      function pose(){
        const [phase,...v]=(host.dataset.flight??'off').split(',');
        const [x,y,altitude,heading]=v.map(Number);
        return {phase,x,y,altitude,heading};
      }
      async function segment(name,done,begin){
        const times=[];let last=await raf(),started=last,draws=stats.draws,tris=stats.triangles,observed=draws;
        begin?.();
        let final;
        do{
          const time=await raf();
          if(time-started>60000)throw new Error('Timeout '+name+' '+host.dataset.flight);
          if(observed===stats.draws)continue;
          observed=stats.draws;times.push(time-last);last=time;
          final=pose();
          if(final.phase==='crash')throw new Error('Unexpected crash during '+name+' '+host.dataset.flight);
        }while(!final || !done(final,last-started));
        times.sort((a,b)=>a-b);
        const percentile=f=>+times[Math.ceil(times.length*f)-1].toFixed(2);
        const stream=JSON.parse(host.dataset.sectors);
        rows.push({pass,name,frames:times.length,p50:percentile(.5),p95:percentile(.95),max:percentile(1),
          draws:Math.round((observed-draws)/times.length),triangles:Math.round((stats.triangles-tris)/times.length),
          buffer:[canvas.width,canvas.height],shadows:host.dataset.shadows,detail:stream.visible,
          zones:stream.zones.length,mode:host.dataset.qualityMode??null,stage:host.dataset.qualityStage??null,dpr:host.dataset.dpr,aa:host.dataset.aa,
          pose:host.dataset.flight??host.dataset.drive.slice(0,45)});
        return final;
      }
      await segment('street',(_,ms)=>ms>=1200);
      const launch=await segment('launch',p=>p.phase==='fly',()=>button.click());
      await segment('climb',p=>p.altitude>=launch.altitude+22,()=>input('keydown','w'));
      input('keyup','w');
      const start=pose();
      await segment('cruise',p=>Math.hypot(start.x-p.x,start.y-p.y)>=132);
      const left=pose().heading;
      await segment('turn',p=>Math.abs(Math.atan2(Math.sin(p.heading-left),Math.cos(p.heading-left)))>=.95,()=>input('keydown','d'));
      input('keyup','d');
      const high=pose().altitude;
      await segment('dive',p=>p.altitude<high-13,()=>input('keydown','s'));
      input('keyup','s');
      return rows;
    },pass);
    for(const row of rows)console.log(JSON.stringify(row));
    if(shots)await page.screenshot({path:join(shots,'piper-'+pass+'-dive.png'),style:'.lab-runtime,#drive-lab{visibility:hidden}'});
  }
  if(faults.length)throw new Error(faults.join('\n'));
}finally{await browser.close();await server?.close();}
