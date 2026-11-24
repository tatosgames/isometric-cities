// Map camera: the shared pixel frustum, the view offset beside a place card, zoom to the cursor, the glide after a
// drag, and frame-rate independent smoothing.
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {approach} from '../src/geometry.ts';
import {CAMERA_DISTANCE,fitPixels,makeMapCamera,mapViewDirection,screenOffsetOnGround} from '../src/render/map-camera.ts';
import {launchBrowser,serveMap} from './qa-browser.mjs';

// Pure geometry first: with the offset, the target lands `shift` pixels from the centre, and the ground point
// `screenOffsetOnGround` gives for the opposite shift lands on the centre itself.
{
  const camera=makeMapCamera(),toCamera=mapViewDirection(),width=1000,height=700,zoom=3.2;
  const shift={x:180,y:-60},target=new Vector3(120,14,-340);
  const onScreen=point=>{
    const p=point.clone().project(camera);
    return {x:(p.x+1)*width/2-width/2,y:(1-p.y)*height/2-height/2};
  };
  camera.zoom=zoom;fitPixels(camera,width,height,shift);
  camera.position.copy(target).addScaledVector(toCamera,CAMERA_DISTANCE);camera.lookAt(target);camera.updateMatrixWorld();
  const placed=onScreen(target);
  assert.ok(Math.abs(placed.x-shift.x)<1e-6 && Math.abs(placed.y-shift.y)<1e-6,'The target sits at the offset');
  const middle=screenOffsetOnGround(new Vector3(),target,-shift.x,-shift.y,zoom,toCamera);
  const centred=onScreen(middle);
  assert.ok(Math.hypot(centred.x,centred.y)<1e-6,'The rebased target is the centre of the screen');
  assert.equal(middle.y,target.y);
  fitPixels(camera,width,height);
  assert.equal(camera.view?.enabled??false,false,'No shift clears the view offset');
}
// The same chase reaches the same place after one second at 30, 60 or 144 frames a second.
{
  const after=rate=>{let x=0;for(let i=0;i<rate;i++)x+=(1-x)*approach(9,1/rate);return x;};
  assert.ok(Math.abs(after(30)-after(144))<1e-9 && Math.abs(after(60)-(1-Math.exp(-9)))<1e-9);
}

const browser=await launchBrowser();
const {server,origin}=await serveMap();
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.setDefaultTimeout(240000);
  const faults=[];
  page.on('pageerror',e=>faults.push(e.message));
  const host=page.locator('#scene');
  const view=async()=>(await host.getAttribute('data-view')).split(',').map(Number);
  const settled=()=>page.waitForFunction(()=>document.querySelector('#scene').dataset.moving==='false');
  // Pins are anchored at the middle of their bottom edge.
  const pin=async id=>{
    const box=await page.locator('.pin[data-place-id="'+id+'"]').boundingBox();
    return {x:box.x+box.width/2,y:box.y+box.height};
  };
  await page.goto(origin);
  await page.waitForFunction(()=>document.getElementById('map').dataset.boot==='ready');
  await settled();

  // Zoom to the cursor: the place under the wheel stays under it. Aim at a pin away from the centre.
  const aim=await page.evaluate(()=>{
    const scene=document.getElementById('scene').getBoundingClientRect();
    const pins=[...document.querySelectorAll('.pin:not([hidden])')].map(p=>{const r=p.getBoundingClientRect();
      return {id:p.dataset.placeId,d:Math.hypot(r.x-scene.width/2,r.y-scene.height/2),in:r.x>80&&r.x<scene.width-80&&r.y>80&&r.y<scene.height-80};});
    return pins.filter(p=>p.in).sort((a,b)=>b.d-a.d)[0]?.id;
  });
  assert.ok(aim,'A pin to zoom towards');
  const before=await pin(aim),[,,zoom0]=await view();
  // Just below the pin's anchor: the pin itself takes the pointer events.
  const cursor={x:before.x,y:before.y+8};
  await page.mouse.move(cursor.x,cursor.y);
  await page.mouse.wheel(0,-240);
  await page.waitForFunction(z=>Number(document.querySelector('#scene').dataset.view.split(',')[2])>z*1.05,zoom0);
  await page.waitForTimeout(400);
  const after=await pin(aim),k=(await view())[2]/zoom0;
  const expected={x:cursor.x+(before.x-cursor.x)*k,y:cursor.y+(before.y-cursor.y)*k};
  assert.ok(Math.hypot(after.x-expected.x,after.y-expected.y)<3,'The wheel zooms towards the pointer: '+JSON.stringify({before,after,expected}));

  // A drag glides on after the release, then rests.
  await page.mouse.move(700,450);await page.mouse.down();
  for(let i=1;i<=6;i++)await page.mouse.move(700+i*30,450,{steps:1});
  await page.mouse.up();
  const released=await host.getAttribute('data-view');
  await page.waitForTimeout(250);
  assert.notEqual(await host.getAttribute('data-view'),released,'The map glides on after a drag');
  await page.waitForFunction(()=>{
    const s=document.querySelector('#scene');
    const v=s.dataset.view;return new Promise(r=>setTimeout(()=>r(s.dataset.view===v),300));
  });

  // The card: the place lands in the middle of what the panel leaves free, and stays there through a rotation.
  await page.locator('#index-toggle').click();await page.locator('#places [data-place-id="santa-ana"]').click();
  await settled();
  const free=await page.evaluate(()=>{
    const card=document.querySelector('article'),scene=document.getElementById('scene').getBoundingClientRect();
    const right=card.getBoundingClientRect().right;
    return {x:(right+scene.right)/2,y:scene.top+scene.height/2};
  });
  const framed=await pin('santa-ana');
  assert.ok(Math.hypot(framed.x-free.x,framed.y-free.y)<3,'The place sits beside the card: '+JSON.stringify({framed,free}));
  await page.getByRole('button',{name:'Girar vista a la derecha'}).click();await settled();
  const turned=await pin('santa-ana');
  assert.ok(Math.hypot(turned.x-framed.x,turned.y-framed.y)<3,'A rotation turns about the place beside the card');
  await page.locator('#plus').click();await settled();
  const zoomed=await pin('santa-ana');
  assert.ok(Math.hypot(zoomed.x-framed.x,zoomed.y-framed.y)<3,'Zooming keeps the place beside the card');

  // Closing the card moves nothing on screen; the saved view is the centre of the screen throughout.
  const open=await host.getAttribute('data-view');
  await page.locator('#close').click();await page.waitForTimeout(150);
  const closed=await pin('santa-ana');
  assert.ok(Math.hypot(closed.x-zoomed.x,closed.y-zoomed.y)<1.5,'Closing the card leaves the picture still');
  assert.equal(await host.getAttribute('data-view'),open);
  assert.deepEqual(faults,[]);
  console.log('Map camera checks passed');
}finally{
  await browser.close();
  await server?.close();
}
