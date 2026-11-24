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

  // While the button is held the ground follows the pointer one to one, across and up the screen.
  {
    const grab=await pin(aim);
    await page.mouse.move(grab.x,grab.y+8);await page.mouse.down();
    await page.mouse.move(grab.x+60,grab.y+8+80,{steps:8});
    await page.waitForTimeout(150);
    // Read the pin from a frame drawn after the last move.
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const held=await pin(aim);
    await page.mouse.up();
    assert.ok(Math.hypot(held.x-grab.x-60,held.y-grab.y-80)<3,'The map follows the mouse one to one: '+JSON.stringify({grab,held}));
    await page.waitForTimeout(100);
    assert.ok(Math.hypot((await pin(aim)).x-held.x,(await pin(aim)).y-held.y)<1,'A pointer that rested before the release does not glide');
  }


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

  // On a phone the ground stays under the finger, vertical moves included.
  {
    await page.close();
    const phone=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    phone.setDefaultTimeout(240000);
    phone.on('pageerror',e=>faults.push(e.message));
    await phone.goto(origin);
    await phone.waitForFunction(()=>document.getElementById('map').dataset.boot==='ready');
    await phone.waitForFunction(()=>document.querySelector('#scene').dataset.moving==='false');
    // Bring a place into view and close its card before the drag.
    await phone.locator('#index-toggle').tap();await phone.locator('#places [data-place-id="san-telmo"]').tap();
    await phone.waitForFunction(()=>document.querySelector('#scene').dataset.moving==='false');
    await phone.locator('#close').tap();await phone.locator('article').waitFor({state:'hidden'});
    const anchor=()=>phone.evaluate(()=>{
      const visible=[...document.querySelectorAll('.pin:not([hidden])')].map(p=>({id:p.dataset.placeId,r:p.getBoundingClientRect()}))
        .filter(({r})=>r.x>60 && r.x<330 && r.y>120 && r.y<600);
      return visible[0]?{id:visible[0].id,x:visible[0].r.x+visible[0].r.width/2,y:visible[0].r.bottom}:null;
    });
    const start=await anchor();
    assert.ok(start,'A pin in the middle of the phone screen');
    const at=id=>phone.evaluate(id=>{const r=document.querySelector('.pin[data-place-id="'+id+'"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.bottom};},id);
    const cdp=await phone.context().newCDPSession(phone);
    const touch=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,id:1}]});
    const x0=start.x,y0=start.y+10;
    // Compare with where the browser says the finger went: a busy page may drop the first touch move.
    await phone.evaluate(()=>{
      const scene=document.getElementById('scene');window.finger=[];
      for(const type of ['pointerdown','pointermove'])scene.addEventListener(type,e=>window.finger.push([e.clientX,e.clientY]),{capture:true});
    });
    await touch('touchStart',x0,y0);
    for(let i=1;i<=8;i++)await touch('touchMove',x0+i*5,y0+i*12);
    await phone.waitForTimeout(150);
    await phone.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const moved=await at(start.id),[down,...moves]=await phone.evaluate(()=>window.finger),lift=moves.at(-1);
    await touch('touchEnd');
    assert.ok(lift && lift[1]-down[1]>=60,'The finger moved up the screen: '+JSON.stringify({down,lift}));
    assert.ok(Math.hypot(moved.x-start.x-(lift[0]-down[0]),moved.y-start.y-(lift[1]-down[1]))<3,'The map follows the finger one to one: '+JSON.stringify({start,moved,down,lift}));
    // A flick, timed as a finger at 60 Hz, glides on after the release and then rests. The times are explicit:
    // a slow test machine delivers the events late, as a hitching phone would.
    const base=Date.now()/1000;
    const flick=(type,i,y)=>cdp.send('Input.dispatchTouchEvent',{type,timestamp:base+i*.016,touchPoints:type==='touchEnd'?[]:[{x:200,y,id:1}]});
    await flick('touchStart',0,560);
    for(let i=1;i<=8;i++)await flick('touchMove',i,560-i*20);
    await flick('touchEnd',9);
    const released=await phone.locator('#scene').getAttribute('data-view');
    await phone.waitForTimeout(300);
    assert.notEqual(await phone.locator('#scene').getAttribute('data-view'),released,'The map glides on after a flick');
    await phone.waitForFunction(()=>document.querySelector('#scene').dataset.moving==='false');
    await phone.close();
  }
  assert.deepEqual(faults,[]);
  console.log('Map camera checks passed');
}finally{
  await browser.close();
  await server?.close();
}
