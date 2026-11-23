import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {launchBrowser} from './qa-browser.mjs';
import { BufferGeometry, Float32BufferAttribute, Mesh, OrthographicCamera, Vector3 } from 'three';
import { previewBuilding } from '../src/editor/building-drag.ts';
import { createServer } from 'vite';
import { applyPilotEdits, isFixedBuilding, readPilotEdits } from '../src/data/pilot-edits.ts';
import { ringCenter } from '../src/data/sector-index.ts';
import { buildDriveWorld } from '../src/drive/drive-world.ts';

const geometry = new BufferGeometry();
const positions = new Float32BufferAttribute([1,2,3, 4,5,6, 7,8,9],3);
geometry.setAttribute('position',positions);
const mesh = new Mesh(geometry);
const preview = previewBuilding([{mesh,start:1,count:1}]);
preview.move(8,2,-3);
assert.deepEqual([...positions.array],[1,2,3, 12,7,3, 7,8,9]);
preview.hide();
assert.deepEqual([...positions.array],[1,2,3, 0,0,0, 7,8,9]);
preview.restore();
assert.deepEqual([...positions.array],[1,2,3, 4,5,6, 7,8,9]);
assert.equal(mesh.frustumCulled,true);

const bytes = await readFile(new URL('../public/data/pilot.json',import.meta.url));
const data = JSON.parse(bytes), hash = createHash('sha256').update(bytes).digest('hex');
const base = { data,hash };
const empty = { version:1,base:hash,footprints:[],props:[] };
const file = value => ({ name:'corrections.json',mimeType:'application/json',buffer:Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) });
const server = process.env.MAP_URL ? null : await createServer({ server:{ host:'127.0.0.1',port:0 } });
await server?.listen();
const mapRoot = (process.env.MAP_URL || server.resolvedUrls.local[0]).replace(/\/?$/,'/');
let browser;
try {
  browser = await launchBrowser();
  const page = await browser.newPage({ viewport:{width:1400,height:950} });
  const faults = [];
  const observe = page => {
    page.on('pageerror',error => faults.push(error.message));
    page.on('console',entry => { if (entry.type() === 'error') faults.push(entry.text()); });
  };
  observe(page);
  const button = (label,pageRef = page) => pageRef.getByRole('button',{ name:label,exact:true });
  const status = () => page.locator('#message').textContent();
  async function open(page) {
    await page.goto(new URL('editor.html',mapRoot).href);
    await page.waitForFunction(() => !document.querySelector('#save').disabled && document.querySelector('canvas')?.clientWidth > 300);
  }
  async function save(page) {
    const [download] = await Promise.all([page.waitForEvent('download'),button('Download JSON',page).click()]);
    const path = await download.path();
    return JSON.parse(await readFile(path,'utf8'));
  }
  async function importFile(page,value) {
    await page.locator('#file').setInputFiles(file(value));
    await page.waitForFunction(() => !document.querySelector('#open').disabled && !!document.querySelector('#message').textContent);
  }

  await open(page);
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  const bounds = await page.locator('canvas').boundingBox();
  const { width,height } = bounds;
  const [x,y] = ringCenter(data.boundary);
  const center = new Vector3(x,0,-y);
  const camera = new OrthographicCamera(-width/2,width/2,height/2,-height/2,1,3000);
  camera.zoom = Math.min(width/980,height/790);
  camera.position.copy(center).add(new Vector3(-490,690,410));
  camera.lookAt(center); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  const screen = ([x,y],z) => {
    const p = new Vector3(x,z,-y).project(camera);
    return [bounds.x+(p.x+1)*width/2,bounds.y+(1-p.y)*height/2];
  };
  function altitude(x,y) {
    const {origin:[tx,ty],step,stepY,w,values} = data.terrain;
    const col = (x-tx)/step, row = (ty-y)/(stepY || step);
    const i = Math.floor(col)+Math.floor(row)*w, u=col%1, t=row%1;
    const top = values[i]*(1-u)+values[i+1]*u, bottom = values[i+w]*(1-u)+values[i+w+1]*u;
    return top*(1-t)+bottom*t;
  }
  const tune = {treeClearance:1,treeRadius:.5};
  const originalWorld = buildDriveWorld(data,altitude,tune);
  const centerOf = ring => ringCenter(ring);
  const distance = ([x,y],[a,b]) => Math.hypot(x-a,y-b);
  const translated = (building,dx,dy) => building.rings.map(ring => ring.map(([x,y]) => [x+dx,y+dy]));
  let chosen;
  for (const [part,building] of data.buildings.entries()) {
    if (building.rings.length < 2 || isFixedBuilding(data,part)
      || data.buildings.filter(b => b.id === building.id).length > 1) continue;
    const center = centerOf(building.rings[0]);
    if (distance(center,[x,y]) > 260) continue;
    const roof = altitude(...building.rings[0][0])+(building.heightOverride ?? building.height);
    const [clickX,clickY] = screen(building.rings[0][1],roof-.4);
    if (clickX < bounds.x+10 || clickX > bounds.x+width-10 || clickY < bounds.y+10 || clickY > bounds.y+height-10) continue;
    await page.mouse.click(clickX,clickY);
    if (await page.locator('#object-name').textContent() !== `Building ${building.id}` || !await page.locator('#selection').isVisible()) continue;
    for (const [dx,dy] of [[60,0],[-60,0],[0,60],[0,-60]]) {
      const proposed = { ...empty,footprints:[{part,id:building.id,rings:translated(building,dx,dy)}] };
      try { readPilotEdits(base,proposed); } catch { continue; }
      const world = buildDriveWorld(applyPilotEdits(data,proposed),altitude,tune);
      const p = building.rings[0][1], q = [p[0]+dx,p[1]+dy];
      if (!originalWorld.near(...p,.15) || originalWorld.near(...q,.15) || world.near(...p,.15) || !world.near(...q,.15)) continue;
      const [hole,second] = proposed.footprints[0].rings[1];
      const point = [hole[0]+(second[0]-hole[0])*.1,hole[1]+(second[1]-hole[1])*.1];
      const rings = proposed.footprints[0].rings.map((r,i) => i === 1 ? [point,...r.slice(1,-1),point] : r);
      try { readPilotEdits(base,{...proposed,footprints:[{part,id:building.id,rings}]}); } catch { continue; }
      chosen = {part,building,center:[center[0]+dx,center[1]+dy],point,p,q,grab:[clickX,clickY],grabPoint:building.rings[0][1],roof};
      break;
    }
    if (chosen) break;
  }
  assert.ok(chosen,'A selectable building with a courtyard and an unobstructed new wall position');

  const start = ringCenter(chosen.building.rings[0]);
  const roof = altitude(...chosen.building.rings[0][0])+(chosen.building.heightOverride ?? chosen.building.height)+.18;
  const shaft = height/camera.zoom/4*.35;
  const from = screen([start[0]+shaft,start[1]],roof);
  const to = screen([start[0]+shaft+10,start[1]],roof);
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to,{steps:5});
  await page.mouse.up();
  const dragged = (await save(page)).footprints[0];
  assert.equal(dragged?.part,chosen.part);
  assert.ok(Math.abs(ringCenter(dragged.rings[0])[0]-start[0]-10) < .1,'The X-axis gizmo moves the footprint');
  await button('Undo').click();

  const directMove = async () => {
    await page.keyboard.press('Escape');
    const [x,y] = chosen.grabPoint;
    const end = screen([x+8,y],chosen.roof-.4);
    await page.mouse.move(...chosen.grab);
    await page.mouse.down();
    await page.mouse.move(...end,{steps:6});
    await page.locator('#viewport[data-dragging="true"]').waitFor();
    assert.ok(Math.abs(Number(await page.locator('#east').inputValue())-start[0]-8) < .15);
  };
  await directMove();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  assert.equal((await save(page)).footprints.length,0);

  await directMove();
  await page.mouse.up();
  const directlyMoved = (await save(page)).footprints[0];
  assert.ok(Math.abs(ringCenter(directlyMoved.rings[0])[0]-start[0]-8) < .15);
  await button('Undo').click();
  const canvas = page.locator('canvas');
  const overview = await canvas.screenshot();
  await button('Frame').click();
  const framed = await canvas.screenshot();
  assert.ok(!overview.equals(framed),'Frame changes the view');
  const bounds3D = chosen.building.rings[0];
  const eastings = bounds3D.map(point => point[0]), northings = bounds3D.map(point => point[1]);
  const height3D = chosen.building.heightOverride ?? chosen.building.height;
  const baseHeight = altitude(...bounds3D[0]);
  const span = Math.max(Math.max(...eastings)-Math.min(...eastings),Math.max(...northings)-Math.min(...northings),height3D,5);
  const focused = new Vector3(start[0],baseHeight+height3D/2,-start[1]);
  camera.position.copy(focused).add(new Vector3(-490,690,410));
  camera.lookAt(focused);
  camera.zoom = Math.min(80,Math.min(width,height)*.52/span);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  await button('Vertices').click();
  await page.locator('#vertex').selectOption({label:'Courtyard 1 · 1'});
  const [corner,neighbor] = chosen.building.rings[1];
  const target = corner.map((value,i) => value+(neighbor[i]-value)*.3);
  const top = baseHeight+height3D+.18;
  await page.mouse.move(...screen(corner,top));
  await page.mouse.down();
  await page.mouse.move(...screen(target,top),{steps:5});
  await page.locator('#viewport[data-dragging="true"]').waitFor();
  await page.mouse.up();
  const draggedRing = (await save(page)).footprints[0].rings[1];
  assert.ok(distance(draggedRing[0],target) < .1,'The courtyard handle moves directly');
  assert.deepEqual(draggedRing[0],draggedRing.at(-1));
  await button('Undo').click();
  await button('Move').click();
  await button('Overview').click();
  camera.position.copy(center).add(new Vector3(-490,690,410));
  camera.lookAt(center); camera.zoom = Math.min(width/980,height/790);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();

  await page.locator('#east').fill(String(chosen.center[0]));
  await page.locator('#north').fill(String(chosen.center[1]));
  await button('Apply').click();
  await button('Vertices').click();
  await page.locator('#vertex').selectOption({label:'Courtyard 1 · 1'});
  await page.locator('#east').fill(String(chosen.point[0]));
  await page.locator('#north').fill(String(chosen.point[1]));
  await button('Apply').click();
  assert.equal(await status(),'');

  const placePoints = [[x,y],[x+140,y-130]];
  for (const [i,p] of placePoints.entries()) {
    await page.locator('#catalog').selectOption(i === 0 ? 'planter' : 'bench');
    await button('Place on map').click();
    await page.mouse.click(...screen(p,altitude(...p)));
    await page.getByRole('heading',{name:i === 0 ? 'Planter' : 'Bench',exact:true}).waitFor();
  }
  await button('Rotate').click();
  await page.locator('#yaw').fill('45');
  await button('Apply').click();
  await button('Remove').click();
  await button('Undo').click();
  const restored = await save(page);
  assert.equal(restored.props.length,2);
  assert.equal(restored.props.find(prop => prop.kind === 'bench').yaw,Math.PI/4);
  await button('Redo').click();
  const patch = await save(page);
  assert.equal(patch.footprints.length,1);
  assert.equal(patch.footprints[0].part,chosen.part);
  assert.deepEqual(patch.footprints[0].rings[1][0],chosen.point);
  assert.deepEqual(patch.footprints[0].rings[1].at(-1),chosen.point);
  assert.deepEqual(patch.props.map(p => p.kind),['planter']);

  const fresh = await browser.newPage({ viewport:{width:1400,height:950} });
  observe(fresh);
  await open(fresh);
  await importFile(fresh,patch);
  assert.deepEqual(await save(fresh),patch);
  const bow = structuredClone(patch);
  const [a,b] = bow.footprints[0].rings[0][0];
  bow.footprints[0].rings = [[[a,b],[a+3,b+3],[a-2,b+3],[a+3,b],[a,b]]];
  for (const [invalid,expected] of [['{','valid JSON'],[{...patch,base:'other'},'different version'],[bow,'footprint']]) {
    await importFile(fresh,invalid);
    assert.match(await fresh.locator('#message').textContent(),new RegExp(expected));
    assert.deepEqual(await save(fresh),patch);
  }
  const world = buildDriveWorld(applyPilotEdits(data,readPilotEdits(base,patch)),altitude,tune);
  const wallHit = (world,[x,y]) => world.visitObstacles({x,y},.15,
    (_body,[a,b,c,d]) => (a===x && b===y || c===x && d===y) ? 1 : 0,()=>0);
  assert.ok(wallHit(originalWorld,chosen.p));
  assert.equal(wallHit(world,chosen.p),0);
  assert.ok(wallHit(world,chosen.q));

  const [viewer] = await Promise.all([
    fresh.waitForEvent('popup'),fresh.getByRole('link',{name:'Test Drive'}).click()
  ]);
  observe(viewer);
  assert.equal(viewer.url(),new URL('?area=pilot&editorPreview',mapRoot).href);
  await viewer.getByLabel('Load pilot map edits').setInputFiles(file({...patch,base:'other'}));
  await viewer.getByText(/different version/).waitFor();
  await viewer.getByLabel('Load pilot map edits').setInputFiles(file(patch));
  await viewer.locator('#scene[data-view]').waitFor({timeout:60000});
  await button('Play',viewer).click();
  await viewer.locator('#map.driving').waitFor({timeout:15000});
  assert.deepEqual(faults,[]);
  console.log(`Editor QA passed · building ${chosen.building.id}, courtyard round trip, props, validation and Conducir`);
} finally {
  await browser?.close();
  await server?.close();
}
