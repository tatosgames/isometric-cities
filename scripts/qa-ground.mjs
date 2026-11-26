import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {makeCity} from '../src/render/scene.ts';
import {streamCity} from '../src/render/sectors/sector-stream.ts';
import {coreWithTerrain} from '../src/data/load.ts';
import * as T from 'three';
import { ringCenter, sectorOwner, zoneOfSector } from '../src/data/sector-index.ts';
import { groundPatch } from '../src/render/ground-surface.ts';

// Ground data can repeat consecutive points. Keep the faces used by the carriageway bake.
const repeated = [[0,0],[0,15],[0,15],[15,15],[15,0],[0,0]];
const shape = new T.ShapeGeometry(new T.Shape(repeated.map(p=>new T.Vector2(...p))));
const patch = groundPatch(repeated,()=>0);
assert.deepEqual(patch.faces.flat(),Array.from(shape.index.array));
shape.dispose();

const read = async file => JSON.parse(await readFile(new URL('../public/data/'+file,import.meta.url)));
{
  const [index,pilot,coreFile] = await Promise.all([
    read('city-index.json'), read('pilot.json'), read('city-core.json')
  ]);
  const terrain = await readFile(new URL('../public/data/'+coreFile.terrain.file,import.meta.url));
  const core = coreWithTerrain(coreFile,terrain.buffer.slice(terrain.byteOffset,terrain.byteOffset+terrain.byteLength));
  const point = [-1270,1055];
  const id = sectorOwner(...point,index.sectorSize), zoneId = zoneOfSector(id,index);
  const sector = index.sectors.find(s=>s.id===id), zone = index.zones.find(z=>z.id===zoneId);
  const data = {...core,...index,sectors:[sector],zones:[zone],boundary:[],
    far:{[zoneId]:{...core.far[zoneId],blocks:[]}}};
  const [{ground:rings},{ground:detailGround}] = await Promise.all([
    read('city-zones/'+zone.file),read('city-sectors/'+sector.file)
  ]);
  const ground = rings.filter(r=>sectorOwner(...ringCenter(r),index.sectorSize)===id);
  const layers = {ground,buildings:[],trees:[],surfaces:[],roads:[]};

  function rayHeight(group,[x,y]) {
    group.updateMatrixWorld(true);
    const ray = new T.Raycaster(new T.Vector3(x,10000,-y),new T.Vector3(0,-1,0));
    const meshes = [];
    group.traverseVisible(object=>{if(object.isMesh)meshes.push(object);});
    return ray.intersectObjects(meshes,false)[0]?.point.y;
  }
  function match(city,point) {
    const expected = rayHeight(city.group,point);
    assert.ok(Number.isFinite(expected),'Missing ground triangle at '+point);
    const sampled = city.groundAt(...point);
    assert.ok(Math.abs(sampled-expected)<.01,'Ground height differs from the rendered triangle at '+point);
    return sampled;
  }
  const pilotCity = makeCity({...pilot,buildings:[],trees:[],boundary:[]},true,null);
  const pilotRing = pilot.ground.find(r=>r.length===5);
  // The diagonal of the first square patch runs through its centre.
  match(pilotCity,ringCenter(pilotRing));
  assert.equal(pilotCity.groundAt(100000,100000),pilotCity.altitude(100000,100000));

  const gate = Promise.withResolvers();
  const host = {dataset:{}};
  const stream = streamCity({
    data,host,compact:true,neutral:true,tones:null,refresh(){},
    async loadZone(){return {...layers,owners:[]};},
    async loadLayers(){await gate.promise;return {...layers,ground:detailGround};}
  });
  const far = match(stream,point);
  const target = new T.Vector3(point[0],far,-point[1]);
  const camera = new T.OrthographicCamera(-50,50,50,-50,1,5000);
  camera.position.copy(target).add(new T.Vector3(-500,900,500));
  camera.lookAt(target);camera.updateMatrixWorld(true);
  const update = ()=>stream.update(camera,target,true);
  update();
  await new Promise(setImmediate);
  update();
  assert.equal(JSON.parse(host.dataset.sectors).pending,id);
  const before = match(stream,point);
  assert.ok(before-stream.altitude(...point)>3,'Fixture no longer reproduces the original penetration');

  const east = (Math.floor(point[0]/index.sectorSize)+1)*index.sectorSize;
  const seam = ground.map(r=>r.filter(p=>p[0]===east)).find(p=>p.length>=2 && p[0][1]!==p[1][1]);
  const edge = [east,(seam[0][1]+seam[1][1])/2];
  match(stream,edge);
  gate.resolve();
  await new Promise(setImmediate);
  update();
  assert.equal(JSON.parse(host.dataset.sectors).visible,1);
  assert.ok(Math.abs(match(stream,point)-before)<.01);
  match(stream,edge);
  console.log('Ground QA passed (mesh vs DEM: '+(before-stream.altitude(...point)).toFixed(2)+' m, steady during detail load)');
}
