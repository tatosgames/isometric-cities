// Compare identical mobile cameras against an unmodified build or a fixed quality level.
// node scripts/qa-quality-views.mjs [dist] [before|base|static|fxaa|auto] [output directory]
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {launchBrowser,serveMap} from './qa-browser.mjs';

const [build='dist',profile='auto',directory='.cache/quality-views']=process.argv.slice(2);
const views=[['plaza',-38,-490,2.6],['calle',66,-391,3.25],['sectores',0,-480,1.75]];
const {server,origin}=await serveMap({env:null,outDir:build});
const browser=await launchBrowser();
try{
  await mkdir(directory,{recursive:true});
  for(const [name,x,y,zoom] of views){
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    await page.addInitScript(({x,y,zoom})=>{
      window.qualityHistory=[];
      new MutationObserver(()=>{
        const scene=document.getElementById('scene');
        if(!scene?.dataset.dpr)return;
        const snapshot=[scene.dataset.shadows,scene.dataset.aa,scene.dataset.dpr].join('/');
        if(window.qualityHistory.at(-1)!==snapshot)window.qualityHistory.push(snapshot);
      }).observe(document,{attributes:true,subtree:true,attributeFilter:['data-dpr','data-aa','data-shadows']});
      sessionStorage.setItem('map-view:'+location.pathname+location.search,JSON.stringify({target:[x,0,-y],zoom,turn:0}));
    },{x,y,zoom});
    const query=profile==='before'||profile==='auto'?'':'?lab=qualita&preview='+profile;
    await page.goto(origin+query);
    await page.waitForSelector('#scene[data-view]',{timeout:90000});
    await page.waitForFunction(()=>{
      const scene=document.querySelector('#scene'), sectors=JSON.parse(scene.dataset.sectors);
      return !sectors.pending&&!sectors.fading&&scene.dataset.moving==='false';
    },null,{timeout:90000});
    if(profile==='auto'){
      await page.waitForTimeout(6500);
      const history=await page.evaluate(()=>window.qualityHistory);
      assert.equal(history[0],'off/off/1','mobile first paint');
      console.log(name,'automatic quality',history);
    }else await page.waitForTimeout(1200);
    if(profile!=='auto'&&profile!=='before'){
      assert.equal(await page.locator('#scene').getAttribute('data-shadows'),profile==='base'?'off':'static');
      assert.equal(await page.locator('#scene').getAttribute('data-aa'),profile==='fxaa'?'fxaa':'off');
      const stats=JSON.parse(await page.locator('#scene').getAttribute('data-sectors'));
      assert.equal(stats.shadowBytes>0,profile!=='base');
      assert.ok(stats.shadowBytes<=stats.shadowBudget);
    }
    await page.screenshot({path:directory+'/'+name+'-'+profile+'.png'});
    if(name==='plaza'){
      async function measure(pan){
        return page.evaluate(async pan=>{
          const scene=document.querySelector('#scene'), intervals=[];
          const tick=()=>new Promise(requestAnimationFrame);
          let time=await tick();
          for(let i=0;i<120;i++){
            if(pan)scene.dispatchEvent(new KeyboardEvent('keydown',{key:i%2?'ArrowRight':'ArrowLeft'}));
            const next=await tick();intervals.push(next-time);time=next;
          }
          intervals.sort((a,b)=>a-b);
          const fps=1000*intervals.length/intervals.reduce((a,b)=>a+b);
          return {fps:+fps.toFixed(1),p95:+intervals[113].toFixed(1),canvas:document.querySelector('#scene canvas').width,shadows:scene.dataset.shadows,aa:scene.dataset.aa};
        },pan);
      }
      console.log(profile,'pan',await measure(true));
      await page.locator('#drive').click();
      await page.waitForFunction(()=>document.querySelector('#scene').dataset.drive?.startsWith('ready'),null,{timeout:90000});
      await page.keyboard.press('ArrowLeft');
      await page.waitForFunction(()=>document.querySelector('#scene').dataset.drive?.startsWith('playing'));
      console.log(profile,'drive',await measure(false));
    }
    assert.deepEqual(errors,[]);
    await page.close();
  }
}finally{await browser.close();await server?.close();}
