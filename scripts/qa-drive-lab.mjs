// Driving lab (`index.html?lab=guida&area=pilot`): the panel opens on the running game, a slider changes the
// handling at once, the values survive a reload through the URL, and patrols can be turned off and on.
import assert from 'node:assert/strict';
import {launchBrowser,serveMap} from './qa-browser.mjs';

const {server,origin}=await serveMap();
const browser=await launchBrowser();
try{
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const lab=()=>page.evaluate(()=>document.querySelector('#scene').dataset.lab.split(',').map(Number));
  const ready=()=>page.waitForSelector('#scene[data-lab-ready=true][data-drive]',{timeout:120000});
  // The catalogue of the lab links to it.
  await page.goto(new URL('lab.html',origin).href);
  assert.equal(await page.locator('#tests a').count(),3);
  await page.getByRole('link',{name:'Driving & flight'}).click();
  await ready();
  assert.equal(new URL(page.url()).searchParams.get('area'),'pilot');
  const titles=await page.locator('#drive-lab .title').allTextContents();
  for(const title of ['Player','Patrols','Impacts and braking','Car on screen','Camera and effects','Chase','Surfaces','Drive views','Flight']){
    assert.ok(titles.includes(title),'Missing folder '+title);
  }
  assert.equal(await page.getByRole('navigation',{name:'Labs'}).locator('[aria-current=page]').textContent(),'Driving & flight');
  await page.getByText('Diagnostics',{exact:true}).click();
  await page.locator('#quality-diagnostics').waitFor();
  assert.match(await page.locator('#quality-diagnostics').innerText(),/WebGL active/);
  await page.getByText('Diagnostics',{exact:true}).click();

  // Straight line up to the base speed, 90 km/h by default.
  const scene=page.locator('#scene');
  await scene.focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(()=>Number(document.querySelector('#scene').dataset.lab?.split(',')[0])>20,null,{timeout:30000});

  // A slider acts on the car that is already driving: a lower base speed caps it within a few seconds.
  await page.locator('#drive-lab .title',{hasText:'Player'}).click();
  await page.evaluate(()=>{
    const row=[...document.querySelectorAll('#drive-lab .controller')].find(c=>c.querySelector('.name').textContent==='baseSpeed (km/h)');
    const input=row.querySelector('input');
    // The URL is written when the change ends, as it does when the field loses the keyboard.
    input.focus();input.value='30';input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();
  });
  await page.waitForURL(url=>/t=player\.baseSpeed:30/.test(decodeURIComponent(url.search)));
  // A drag is hundreds of steps: the URL is written once at its end, and a duration cannot reach zero.
  const drag=await page.evaluate(()=>{
    const row=[...document.querySelectorAll('#drive-lab .controller')].find(c=>c.querySelector('.name').textContent==='bonusTime');
    const input=row.querySelector('input'),replace=history.replaceState.bind(history);
    let writes=0;
    history.replaceState=(...args)=>{writes++;return replace(...args);};
    input.focus();
    for(let i=300;i>=0;i--){input.value=String(i/100);input.dispatchEvent(new Event('input',{bubbles:true}));}
    const during=writes;
    input.blur();
    history.replaceState=replace;
    return {during,after:writes,search:decodeURIComponent(location.search)};
  });
  assert.equal(drag.during,0);
  assert.equal(drag.after,1);
  assert.match(drag.search,/player\.bonusTime:0\.01/);
  await page.waitForFunction(()=>{const v=Number(document.querySelector('#scene').dataset.lab.split(',')[0]);return v>5 && v<45;},null,{timeout:30000});
  await page.waitForTimeout(3000);
  assert.ok((await lab())[0]<45,'The lowered base speed must hold');

  // Patrols: on by default, they leave when turned off and the choice is in the URL.
  await page.waitForFunction(()=>Number(document.querySelector('#scene').dataset.lab.split(',')[2])>0,null,{timeout:30000});
  await page.locator('#drive-lab').getByLabel('Police').uncheck();
  await page.waitForFunction(()=>Number(document.querySelector('#scene').dataset.lab.split(',')[2])===0);
  assert.ok(new URL(page.url()).searchParams.has('nopolice'));

  // Copy gives the changed values as they are written in drive-tune.ts.
  await page.locator('#drive-lab').getByRole('button',{name:'Copy values'}).click();
  await page.waitForFunction(()=>document.querySelector('#drive-lab output').textContent.includes('player: baseSpeed:kmh(30)'));

  // The URL carries the values: after a reload the panel and the car start from them.
  await page.reload();
  await ready();
  assert.equal(await page.evaluate(()=>[...document.querySelectorAll('#drive-lab .controller')]
    .find(c=>c.querySelector('.name').textContent==='baseSpeed (km/h)').querySelector('input').value),'30');
  assert.equal(await page.locator('#drive-lab').getByLabel('Police').isChecked(),false);

  // Flight tuning uses the same URL and controls without changing ordinary gameplay defaults.
  const flightUrl=new URL(page.url());
  flightUrl.searchParams.append('diagnostics','1');
  flightUrl.searchParams.set('t',(flightUrl.searchParams.get('t')??'')+',flight.fov:200');
  await page.goto(flightUrl.href);
  await ready();
  await page.locator('#drive-lab .title',{hasText:'Flight'}).click();
  const fov=page.locator('#drive-lab .controller').filter({hasText:'Camera FOV'}).locator('input');
  assert.equal(await fov.inputValue(),'75');
  await fov.fill('60');await fov.press('Enter');
  await page.waitForURL(url=>/flight\.fov:60/.test(decodeURIComponent(url.search)));

  // Outside the lab the same parameter is ignored: the published game keeps its own values.
  await page.goto(new URL('index.html?area=pilot&t=player.baseSpeed:30',origin).href);
  await page.waitForSelector('#map[data-boot=ready]',{timeout:120000});
  assert.equal(await page.locator('#drive-lab').count(),0);
  assert.deepEqual(errors,[]);
  console.log('Drive lab QA passed (panel, live slider, police switch, copy, URL round trip)');
}finally{
  await browser.close();
  await server?.close();
}
