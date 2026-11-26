// Two opposite drives per measured street on the full city, with the production camera and physics.
import assert from 'node:assert/strict';
import {launchBrowser,serveMap} from './qa-browser.mjs';

const streets=[
  ['Schamann','Calle Doña Perfecta',[-1466.8,775.2],[-2457.8,188.6]],
  ['Ciudad del Mar','Avenida Alcalde José Ramírez Bethencourt',[-136,814.4],[-619.7,1540.9]],
  ['La Isleta','Calle Juan Rejón',[-1400.8,4825],[-404.2,5026.4]],
  ['Guanarteme','Calle Fernando Guanarteme',[-2486.6,3080.6],[-1903.4,3642.4]],
  ['Santa Catalina-Canteras','Calle General Vives',[-1568.5,3417.6],[-1611.7,4120.8]],
];
const baseline=process.argv.includes('--baseline');
const camera=process.argv.includes('--aerial')?'high':'fixed';
const level=process.argv.includes('--two-stars')?2:4;
const {server,origin}=await serveMap({outDir:process.env.POLICE_DIST});
const browser=await launchBrowser();
try{
  const errors=[],runs=[];
  for(const [district,street,a,b] of streets){
    for(const [index,[from,to]] of [[a,b],[b,a]].entries()){
      const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(mode=>localStorage.setItem('drive-camera',mode),camera);
      try{
        const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy),h=Math.atan2(dy,dx);
        const offset=level===2 && district!=='Santa Catalina-Canteras'?135:10;
        const x=from[0]+dx*offset/length,y=from[1]+dy*offset/length;
        const url=new URL('?lab=guida&nobuses',origin);
        url.searchParams.set('start',[x,y].join(','));url.searchParams.set('seed',String(701+index));
        await page.goto(url.href);
        await page.waitForSelector('#scene[data-lab-ready=true][data-drive]',{timeout:120000});
        const stats=await page.evaluate(async({x,y,h,length,level})=>{
          const frame=()=>new Promise(requestAnimationFrame);
          window.policeRoadRun(x,y,h,level);
          const fx=Math.cos(h),fy=Math.sin(h);
          // Return control to the ordinary city streamer between fixed simulation bursts.
          const seconds=Math.min(32,(length-25)/30);
          for(let i=0;i<seconds;i++){
            window.policeAdvance(Math.min(1,seconds-i),0,false);
            await frame();await frame();
          }
          const trace=window.policeTrace();
          let first,previous=trace[0].time,dark=0,longest=0,fast=0,seen=0,forward=0,onscreen=0;
          for(const s of trace){
            const dt=s.time-previous;previous=s.time;
            const px=s.player.x-x,py=s.player.y-y,along=px*fx+py*fy,side=Math.abs(px*fy-py*fx);
            if(along>length-15 || along< -2 || side>7 || s.player.speed<20){dark=0;continue;}
            forward=Math.max(forward,along);fast+=dt;
            // A single glimpse at the edge of the frame does not end the empty stretch.
            if(s.patrols.some(p=>!p.wreck && p.visibleFor>=.3)){
              seen+=dt;first??=s.time-trace[0].time;dark=0;onscreen++;
            }else{
              dark+=dt;longest=Math.max(longest,dark);
            }
          }
          const initial=trace[0];
          return {fast,seen,first:first??null,longest,forward,onscreen,stars:initial.level,camera:initial.camera,
            initialSpeed:initial.player.speed,headingError:Math.abs(Math.atan2(Math.sin(initial.player.h-h),Math.cos(initial.player.h-h)))};
        },{x,y,h,length:length-offset,level});
        runs.push({district,street,direction:index,...stats});
        console.log(district,street,index,JSON.stringify(stats));
      }finally{await page.close();}
    }
  }
  assert.deepEqual(errors,[]);
  for(const r of runs){
    const name=r.district+' '+r.street+' '+r.direction;
    assert.equal(r.stars,level,name);
    assert.equal(r.camera,camera,name);
    assert.ok(r.initialSpeed>=24 && r.headingError<.04,name+' failed to start at speed in the road direction');
    assert.ok(r.fast>=8 && r.forward>=240,name+' needs a sustained high-speed run');
    if(!baseline){
      assert.ok(r.onscreen>0,name+' never saw an approaching patrol');
      assert.ok(r.longest<=13,name+' had more than 13 s without a readable patrol');
    }
  }
}finally{await browser.close();await server?.close();}
