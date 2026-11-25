import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {launchBrowser,serveMap} from './qa-browser.mjs';

const routeData=JSON.parse(await readFile(new URL('../public/data/guaguas.json',import.meta.url),'utf8'));
const {server,origin}=await serveMap();
const browser=await launchBrowser();
const dir=new URL('../.cache/qa-guaguas/',import.meta.url);
await mkdir(dir,{recursive:true});
try {
  for (const mobile of [false,true]) {
    const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:800},isMobile:mobile,hasTouch:mobile});
    const errors=[], external=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>{
      const url=new URL(r.request().url());
      if(url.origin===new URL(origin).origin || !/^https?:$/.test(url.protocol))return r.continue();
      external.push(url.href);return r.abort();
    });
    await page.addInitScript(()=>localStorage.setItem('drive-camera','high'));
    await page.goto(new URL('index.html?lab=guida&area=pilot&start=-60,-818&nopolice&t=cameraModes.high.pitch:84',origin).href);
    const scene=page.locator('#scene[data-lab-ready=true][data-drive][data-guagua]');
    await scene.waitFor({timeout:120000});
    assert.equal(Number((await scene.getAttribute('data-drive')).split(',')[5]),0);
    await scene.focus();
    await page.keyboard.down('ArrowDown');
    for(const [index,stop] of routeData.stops.entries()){
      await page.waitForFunction(target=>{
        const bus=document.querySelector('#scene').dataset.guagua?.split(',').map(Number);
        return bus && bus[2]>=target && bus[3]>0 && bus[4]===0;
      },stop.distance+1,{timeout:60000});
      if(index===0){
        const path=fileURLToPath(new URL(mobile?'guagua-mobile.png':'guagua-desktop.png',dir));
        await page.screenshot({path,style:'#drive-lab{visibility:hidden}'});
      }
    }
    await page.keyboard.up('ArrowDown');
    const restart=page.getByRole('button',{name:'Back to start'});
    if(!await restart.isVisible())await page.locator('#drive-lab .lil-gui.root > .title').click();
    await restart.click();
    await page.waitForFunction(()=>document.querySelector('#scene').dataset.drive?.startsWith('ready'));
    await scene.waitFor({timeout:120000});
    assert.equal(Number((await scene.getAttribute('data-guagua')).split(',')[2]),0);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    await page.close();
    console.log('Guagua browser QA passed on '+(mobile?'mobile':'desktop')+' with external requests blocked');
  }
} finally {await browser.close();await server?.close();}
