// Thirty drives on ten fixed road nodes, using the production lab and its 120 Hz simulation.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {buildDriveWorld} from '../src/drive/drive-world.ts';
import {TUNE} from '../src/drive/drive-tune.ts';
import {launchBrowser,serveMap} from './qa-browser.mjs';

const data=JSON.parse(await readFile(new URL('../public/data/pilot.json',import.meta.url)));
const world=buildDriveWorld(data,()=>0,TUNE);
const starts=world.validNodes.filter(i=>world.nodes[i].links.length>=2 &&
  world.free(world.nodes[i].x,world.nodes[i].y,TUNE.radius+.5));
const reports=[],browser=await launchBrowser(),{server,origin}=await serveMap();
try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const faults=[];
  page.on('pageerror',error=>faults.push(error.message));
  for(let seed=1;seed<=10;seed++){
    const {x,y}=world.nodes[starts[Math.floor((seed-.5)*starts.length/10)]];
    const url=new URL('?lab=drive&area=pilot&off=buses',origin);
    url.searchParams.set('tune','seed:'+seed);url.searchParams.set('at',[x,y].join(','));
    await page.goto(url.href);
    await page.waitForSelector('#scene[data-drive][data-lab-ready]');
    for(const policy of ['straight','evasive','poi']){
      const result=await page.evaluate(policy=>{
        window.policeRestart();
        const initial=window.policeAdvance(.2,0,false);
        let sample=initial,lastTurn=0;
        while(sample.time<175){
          let steer=0;
          if(policy==='poi' && sample.coin){
            const delta=Math.atan2(sample.coin.y-sample.player.y,sample.coin.x-sample.player.x)-sample.player.h;
            const turn=Math.atan2(Math.sin(delta),Math.cos(delta));
            if(Math.abs(turn)>.12)steer=Math.sign(turn);
          }
          if(policy==='evasive'){
            const close=sample.patrols.filter(p=>!p.wreck).map(p=>({dx:p.x-sample.player.x,dy:p.y-sample.player.y}))
              .sort((a,b)=>Math.hypot(a.dx,a.dy)-Math.hypot(b.dx,b.dy))[0];
            if(close && Math.hypot(close.dx,close.dy)<25 && sample.time-lastTurn>1.3){
              const side=close.dy*Math.cos(sample.player.h)-close.dx*Math.sin(sample.player.h);
              steer=side>=0?-1:1;lastTurn=sample.time;
            }else if(sample.player.speed<3)steer=1;
          }
          sample=window.policeAdvance(policy==='straight'?4:.5,steer,false);
        }
        const bins=Array.from({length:5},()=>({samples:0,close:0,crossings:0,active:0}));
        let previous=0,order=null,monotone=true;
        for(const s of window.policeTrace()){
          const bin=bins[s.level-1],active=s.patrols.filter(p=>!p.wreck);
          const cross=active.find(p=>p.role==='interceptor')?.id??null;
          bin.samples++;bin.active+=active.length;
          if(active.some(p=>Math.hypot(p.x-s.player.x,p.y-s.player.y)<25))bin.close++;
          if(cross!==null && cross!==order)bin.crossings++;
          order=cross;monotone&&=s.level>=previous && active.length<=s.level;previous=s.level;
        }
        return {initial:initial.level,final:sample.level,monotone,bins};
      },policy);
      assert.ok(result.initial===1 && result.final===5 && result.monotone && result.bins.every(b=>b.samples>0));
      reports.push({seed,policy,start:[x,y],...result});
    }
    console.log('Completed seed',seed);
  }
  await page.goto(new URL('?lab=drive&area=pilot&off=police,buses',origin).href);
  await page.waitForSelector('#scene[data-drive][data-lab-ready]');
  const off=await page.evaluate(()=>({sample:window.policeAdvance(3,0,false),hidden:document.querySelector('#wanted-stars').hidden}));
  assert.ok(off.hidden && !off.sample.patrols.length && off.sample.level===0);
  assert.deepEqual(faults,[]);
  if(process.env.POLICE_REPORT)await writeFile(process.env.POLICE_REPORT,JSON.stringify(reports,null,2));
  for(const policy of ['straight','evasive','poi']){
    const group=reports.filter(r=>r.policy===policy);
    const levels=Array.from({length:5},(_,i)=>{
      const sum=key=>group.reduce((n,r)=>n+r.bins[i][key],0);
      return {stars:i+1,under25mPct:Math.round(100*sum('close')/sum('samples')),crossings:sum('crossings')};
    });
    assert.ok(levels[4].under25mPct>levels[0].under25mPct,policy+' should face greater pressure at five stars');
    assert.ok(levels.some(l=>l.crossings>0),policy+' should encounter a lateral interception');
    console.log(policy,JSON.stringify(levels));
  }
}finally{await browser.close();await server?.close();}
