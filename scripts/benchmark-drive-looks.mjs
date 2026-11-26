// node scripts/benchmark-drive-looks.mjs [URL or dist] [output directory] [rounds] [start x,y]
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {serveMap} from './qa-browser.mjs';

const [target='dist',out='.cache/drive-look-comparison',rounds='3',start='-96.5,-377.3']=process.argv.slice(2);
const {server,origin}=/^https?:\/\//.test(target)?{origin:target}:await serveMap({outDir:target,env:null});
const browser=await chromium.launch({channel:'chrome'});
const looks=[['base','&look=base'],['sole','&look=sole'],['matcap','&look=matcap'],['matcap-tilt','&look=matcap&tilt']];
const report={target:origin,start,viewport:[1440,900],dpr:1,framesPerRun:180,simulationHz:60,rows:[]};
const shotStyle='#drive-lab{visibility:hidden}';

try{
  await mkdir(out,{recursive:true});
  for(let round=0;round<Number(rounds);round++){
    const order=round%2?[...looks].reverse():looks;
    for(const [look,query] of order){
      const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
      const faults=[];
      page.on('pageerror',e=>faults.push(e.message));
      page.on('console',m=>{if(m.type()==='error')faults.push(m.text());});
      await page.addInitScript(()=>{
        let seed=7;
        Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
        const bench=window.driveLookBenchmark={frames:[],gpu:[],capture:false,paused:false,done:false};
        const nativeRaf=window.requestAnimationFrame.bind(window),pending=[];
        let gl,ext,activeQuery,draws=0,triangles=0,sampleNext=false,previousReal=-1,virtual=0;
        const methods=['clear','drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'];
        for(const name of methods){
          const original=WebGL2RenderingContext.prototype[name];
          WebGL2RenderingContext.prototype[name]=function(...args){
            if(this!==gl || !bench.capture)return original.apply(this,args);
            if(ext && !activeQuery && sampleNext && pending.length<16){
              activeQuery=gl.createQuery();
              if(activeQuery)gl.beginQuery(ext.TIME_ELAPSED_EXT,activeQuery);
            }
            if(name!=='clear'){
              draws++;
              if(args[0]===gl.TRIANGLES){
                const arrays=name.includes('Arrays');
                triangles+=args[arrays?2:1]*(name.endsWith('Instanced')?args[arrays?3:4]:1)/3;
              }
            }
            return original.apply(this,args);
          };
        }
        function poll(){
          if(!ext || !pending.length)return;
          const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT);
          while(pending.length && (disjoint || gl.getQueryParameter(pending[0],gl.QUERY_RESULT_AVAILABLE))){
            const query=pending.shift();
            if(!disjoint)bench.gpu.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);
            gl.deleteQuery(query);
          }
        }
        window.requestAnimationFrame=callback=>nativeRaf(real=>{
          if(real!==previousReal){
            if(bench.capture || bench.done)poll();
            if(!bench.paused)virtual=previousReal<0?real:virtual+1000/60;
            previousReal=real;
          }
          draws=triangles=0;
          sampleNext=bench.capture && bench.frames.length%3===0;
          try{callback(virtual);}
          finally{
            if(activeQuery){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(activeQuery);activeQuery=null;}
            if(bench.capture && draws){
              bench.frames.push({real,draws,triangles,stage:document.getElementById('scene').dataset.qualityStage});
              if(bench.frames.length>=180){bench.capture=false;bench.done=bench.paused=true;}
            }
          }
        });
        bench.start=()=>{
          gl=document.querySelector('#scene canvas').getContext('webgl2');
          ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
          bench.capture=true;
        };
        bench.pending=()=>pending.length;
      });
      await page.goto(new URL(`?lab=guida&area=pilot&stats&start=${start}&seed=7&nopolice&nobuses${query}`,origin).href,
        {waitUntil:'domcontentloaded',timeout:90000});
      await page.waitForSelector('#scene[data-lab-ready="true"][data-drive^="ready,"]',{timeout:90000});
      await page.waitForFunction(()=>document.querySelector('#scene').dataset.shadows!=='off');
      const cdp=await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');
      const task=async()=>(await cdp.send('Performance.getMetrics')).metrics.find(m=>m.name==='TaskDuration').value;
      const environment=await page.evaluate(()=>{
        const gl=document.querySelector('#scene canvas').getContext('webgl2');
        const ext=gl.getExtension('WEBGL_debug_renderer_info');
        return {gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
          timer:!!gl.getExtension('EXT_disjoint_timer_query_webgl2'),app:[...document.scripts].find(s=>s.type==='module'&&s.src)?.src};
      });
      report.environment=environment;
      await page.waitForTimeout(1400);
      const taskStart=await task();
      // Start and end on rendered-frame boundaries. Synthetic app timestamps keep the route and quality
      // level aligned. Actual rAF timestamps below measure the delivered cadence.
      await page.evaluate(()=>new Promise(resolve=>{
        requestAnimationFrame(()=>{
          const bench=window.driveLookBenchmark;
          window.policeRestart();
          window.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));
          window.dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));
          bench.start();
          const finish=()=>bench.done?resolve():requestAnimationFrame(finish);
          requestAnimationFrame(finish);
        });
      }));
      const elapsedTask=(await task()-taskStart)*1000;
      await page.waitForFunction(()=>window.driveLookBenchmark.pending()===0,null,{timeout:5000});
      const result=await page.evaluate(()=>{
        const scene=document.getElementById('scene'),canvas=scene.querySelector('canvas');
        const {frames,gpu}=window.driveLookBenchmark;
        return {frames,gpu,pose:scene.dataset.drive,view:scene.dataset.view,buffer:[canvas.width,canvas.height],
          shadows:scene.dataset.shadows};
      });
      const {frames,gpu,...state}=result;
      const gaps=frames.slice(1).map((frame,i)=>frame.real-frames[i].real);
      assert.ok(gaps.every(gap=>gap>0),'One rendered frame per rAF timestamp is required');
      const stages=[...new Set(frames.map(frame=>frame.stage))],matcap=look.startsWith('matcap');
      assert.equal(state.shadows,matcap?'static':'solar');
      assert.ok(stages.length===1 && (stages[0]==='3' || (matcap && stages[0]==='1')), 'Quality must hold at the top level');
      assert.equal(state.pose.split(',')[0],'playing');
      assert.deepEqual(faults,[]);
      const quantile=(samples,p)=>samples.length?+[...samples].sort((a,b)=>a-b)[Math.ceil(samples.length*p)-1].toFixed(2):null;
      const span=gaps.reduce((total,value)=>total+value,0);
      const row={round:round+1,look,...state,fps:+(gaps.length*1000/span).toFixed(1),
        frameP95:quantile(gaps,.95),cpuTaskMs:+(elapsedTask/frames.length).toFixed(2),
        gpuP50:quantile(gpu,.5),gpuP95:quantile(gpu,.95),gpuSamples:gpu.length,
        draws:quantile(frames.map(frame=>frame.draws),.5),triangles:quantile(frames.map(frame=>frame.triangles),.5),
        gaps,gpu};
      report.rows.push(row);
      await writeFile(join(out,'measurements.json'),JSON.stringify(report,null,2));
      const {gaps:_,gpu:__,...summary}=row;
      console.log(JSON.stringify(summary));
      if(round===0){
        await page.screenshot({path:join(out,look+'-isometric.png'),style:shotStyle});
        await page.evaluate(()=>{document.getElementById('drive-camera').click();window.driveLookBenchmark.paused=false;});
        await page.evaluate(()=>new Promise(resolve=>{
          let remaining=50;
          const wait=()=>{if(--remaining)requestAnimationFrame(wait);else{window.driveLookBenchmark.paused=true;resolve();}};
          requestAnimationFrame(wait);
        }));
        assert.equal(await page.locator('#drive-camera').getAttribute('data-mode'),'high');
        await page.screenshot({path:join(out,look+'-aerial.png'),style:shotStyle});
      }
      await page.close();
    }
  }
}finally{
  await browser.close();
  await server?.close();
}
