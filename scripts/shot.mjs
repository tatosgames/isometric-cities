// Same-camera captures for before/after comparisons: node scripts/shot.mjs out.png x,y,zoom[,turn] [mobile|desktop] [dist]
import {launchBrowser,serveMap} from './qa-browser.mjs';
const [out,spot,form='mobile',dir='dist']=process.argv.slice(2);
const [x,y,zoom,turn=0]=spot.split(',').map(Number);
const {server,origin}=await serveMap({env:null,outDir:dir});
const browser=await launchBrowser();
try{
  const viewport=form==='mobile'?{width:390,height:844}:{width:1440,height:900};
  const page=await browser.newPage({viewport,isMobile:form==='mobile',hasTouch:form==='mobile',deviceScaleFactor:2});
  await page.addInitScript(v=>sessionStorage.setItem('map-view:'+location.pathname+location.search,JSON.stringify(v)),{target:[x,0,-y],zoom,turn});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.waitForSelector('#scene[data-view]');
  await page.waitForFunction(()=>{const e=document.querySelector('#scene');if(e.dataset.moving!=='false')return false;const s=JSON.parse(e.dataset.sectors);return !s.pending&&!s.fading;},null,{timeout:90000});
  await page.waitForTimeout(2500);
  await page.screenshot({path:out});
  if(errors.length){console.log(errors);process.exitCode=1;}
}finally{await browser.close();await server?.close();}
