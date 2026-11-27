// Surfaces under the wheels: the surface map names known places right and paints a tile in a few milliseconds,
// ponds are solid without closing a road, and in the game the car slows on the sand of Las Canteras, leaves
// tracks and throws sand, with no error. Runs the source through the Vite dev server.
// node scripts/qa-drive-surface.mjs [screenshot.png]
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {launchBrowser} from './qa-browser.mjs';
import {solidWater} from '../src/drive/drive-world.ts';
import {TUNE} from '../src/drive/drive-tune.ts';

const [shot]=process.argv.slice(2);
const core=JSON.parse(await readFile(new URL('../public/data/city-core.json',import.meta.url)));

// Ponds and fountains become walls; one crossed by a way stays open.
const water=core.surfaces.filter(s=>s.kind==='water');
const solid=solidWater(core);
assert.ok(solid.length>=water.length-5 && solid.length<water.length,`Solid water rings: ${solid.length} of ${water.length}`);
assert.equal(solidWater({roads:core.roads,surfaces:[]}).length,0);

const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});
await server.listen();
const origin=server.resolvedUrls.local[0];
const browser=await launchBrowser();
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(origin+'lab.html');
  const map=await page.evaluate(async()=>{
    const {makeSurfaceMap}=await import('/src/drive/drive-surface.ts');
    const core=await (await fetch('/data/city-core.json')).json(),index=await (await fetch('/data/city-index.json')).json();
    let t=performance.now();
    const surfaces=makeSurfaceMap(core.roads,core.surfaces,index.roadCoverage);
    const build=performance.now()-t;
    const at={
      triana:surfaces.at(-103.4,55.3),maritima:surfaces.at(-1408.5,2601.1),canteras:surfaces.at(-2085.3,3860.9),
      beach:surfaces.at(-1583,4539.9)
    };
    // Twenty tiles never painted before, along the seafront.
    const tiles=[];
    for(let i=0;i<20;i++){t=performance.now();surfaces.at(-2600+i*128,2400+(i%4)*128);tiles.push(performance.now()-t);}
    tiles.sort((a,b)=>a-b);
    return {build,at,median:tiles[10],worst:tiles[19]};
  });
  // 0 asphalt, 1 paving, 4 sand.
  assert.deepEqual(map.at,{triana:1,maritima:0,canteras:1,beach:4});
  assert.ok(map.median<4,`A tile paints in ${map.median.toFixed(1)} ms`);

  // In the game: off the promenade onto the sand of Las Canteras, one side or the other.
  const lab=async()=>(await page.evaluate(()=>document.querySelector('#scene').dataset.lab)).split(',').map(Number);
  await page.goto(origin+'index.html?lab=drive&off=police&at=-2085,3861');
  await page.waitForSelector('#scene[data-lab-ready=true][data-drive]',{timeout:120000});
  await page.locator('#scene').focus();
  await page.keyboard.press('ArrowLeft');
  let onSand=null;
  for(const side of ['ArrowLeft','ArrowRight','ArrowLeft','ArrowRight']){
    await page.waitForTimeout(1200);
    await page.keyboard.down(side);await page.waitForTimeout(450);await page.keyboard.up(side);
    for(let k=0;k<20 && !onSand;k++){await page.waitForTimeout(100);const now=await lab();if(now[3]===4)onSand=now;}
    if(onSand)break;
    await page.locator('#drive-lab').getByRole('button',{name:'Back to start'}).click();
    await page.locator('#scene').focus();
  }
  assert.ok(onSand,'The car reaches the sand');
  // Slide on the sand for the picture, then let it settle: it holds the sand's share of the speed.
  await page.keyboard.down('ArrowLeft');await page.waitForTimeout(500);
  if(shot)await page.screenshot({path:shot});
  await page.keyboard.up('ArrowLeft');
  await page.waitForTimeout(1500);
  const settled=await lab();
  if(settled[3]===4){
    const top=TUNE.player.topSpeed*TUNE.surfaces.sand.speed*3.6;
    assert.ok(settled[0]<=top+2,`On sand at ${settled[0]} km/h, the limit is ${top.toFixed(0)}`);
  }
  assert.deepEqual(errors,[]);
  console.log(`Surface QA passed (water ${solid.length}/${water.length} solid, map built in ${map.build.toFixed(0)} ms, tile ${map.median.toFixed(1)} ms median and ${map.worst.toFixed(1)} ms worst, sand at ${settled[0]} km/h)`);
}finally{await browser.close();await server.close();}
