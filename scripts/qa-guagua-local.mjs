import assert from 'node:assert/strict';
import {makeLocalFleet} from '../src/drive/guagua-fleet.ts';
import {busTimetable, emptyBusState} from '../src/drive/guagua-timetable.ts';

const path = (offset = 0, length = 600) => [[offset, 0], [offset + length, 0]];
const pieceData = (offset = 0, length = 600, stops = [{id: 's1', name: 'Stop', position: [offset + 100, 0], distance: 100}]) => ({
  line: '13', direction: 'Tres Palmas', path: path(offset, length), stops,
});
const makeFixture = ({pieces = {p: {file: 'p.json', line: '13', direction: 'Tres Palmas', phase: 0, period: 120}}, cells, files = { 'p.json': pieceData() }, delay = 0} = {}) => {
  const index = {version: 1, size: 240, cells: cells ?? {'0_0': Object.keys(pieces).map(id => [id, 0, 600])}, pieces};
  for(const ref of Object.values(pieces))ref.slot=0;
  const zoneIds=Object.keys(index.cells).map(cell=>cell.split('_').map(n=>Math.floor(Number(n)/4))).map(v=>v.join('_'));
  const directory={version:1,size:240,zoneSize:960,zones:Object.fromEntries(zoneIds.map(id=>[id,'zones/'+id+'.json']))};
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push(url);
    if (delay) await new Promise(resolve => setTimeout(resolve, delay));
    if (options?.signal?.aborted) throw Error('aborted');
    const data=files[url.split('/').pop()];
    const value=url.endsWith('index.json')?directory:url.includes('/zones/')?index:
      data?{paths:[data.path],runs:[{path:0,stops:data.stops}]}:undefined;
    return {ok: !!value, status: value ? 200 : 404, json: async () => value};
  };
  return {index, calls, fetcher};
};
const noCamera = () => false;
const noOccupancy = () => false;

// Timetable contract: a real route with one stop has a three-second dwell. Empty stops remain legal.
const dwell = busTimetable(pieceData());
const atStop = emptyBusState();
dwell.sample(dwell.timeAt(100), atStop);
assert.ok(atStop.stopped > 2.9 && atStop.stopped <= 3);
const empty = busTimetable(pieceData(0, 120, []));
assert.ok(empty.duration > 0);

// Initial selection fetches only the nearby index and its referenced piece.
{
  const fixture = makeFixture();
  const fleet = makeLocalFleet('pilot', noCamera, noOccupancy, fixture.fetcher);
  await fleet.reset(0, 0);
  assert.equal(fixture.calls.filter(url => url.endsWith('index.json')).length, 1);
  assert.deepEqual(fixture.calls,['./data/guaguas/pilot/index.json','./data/guaguas/pilot/zones/0_0.json','./data/guaguas/pilot/p.json']);
  assert.ok(fleet.active.length > 0);
  fleet.dispose();
}

// Occupancy and camera visibility prevent new candidates, while the initial spawn may use the camera view.
{
  const fixture = makeFixture();
  let occupied = true;
  const fleet = makeLocalFleet('pilot', () => true, () => occupied, fixture.fetcher);
  await fleet.reset(0, 0);
  assert.equal(fleet.active.length, 0);
  occupied = false;
  await fleet.reset(0, 0);
  assert.ok(fleet.active.length > 0);
  fleet.dispose();
}

// The 300 m acquire and 450 m release hysteresis is exercised with a second scan.
{
  const fixture = makeFixture({pieces: {p: {file: 'p.json', line: '13', direction: 'Tres Palmas', phase: 0, period: 120}}, cells: {'0_0': [['p', 0, 600]], '3_0': [['p', 0, 600]]}});
  const fleet = makeLocalFleet('pilot', noCamera, noOccupancy, fixture.fetcher);
  await fleet.reset(0, 0);
  assert.ok(fleet.active.length > 0);
  fleet.step(.6, 451, 0);
  assert.equal(fleet.active.length, 0);
  fleet.dispose();
}

// Duplicate cell references and repeated long-line intervals cannot duplicate a passage.
{
  const pieces = {p: {file: 'p.json', line: '13', direction: 'Tres Palmas', phase: 0, period: 5}};
  const fixture = makeFixture({pieces, cells: {'0_0': [['p', 0, 600], ['p', 0, 600], ['p', 100, 500]], '1_0': [['p', 0, 600]]}});
  const fleet = makeLocalFleet('pilot', noCamera, noOccupancy, fixture.fetcher);
  await fleet.reset(0, 0);
  assert.equal(new Set(fleet.active.map(bus => bus.id)).size, fleet.active.length);
  fleet.step(10, 0, 0);
  assert.equal(new Set(fleet.active.map(bus => bus.id)).size, fleet.active.length);
  fleet.dispose();
}

// Eight independent nearby passages are capped at six, and following vehicles never overlap.
{
  const pieces = Object.fromEntries(Array.from({length: 8}, (_, i) => ['p' + i, {file: 'p' + i + '.json', line: String(10 + i), direction: 'north', phase: 0, period: 120}]));
  const files = Object.fromEntries(Object.keys(pieces).map((id, i) => [id + '.json', pieceData(i * 8)]));
  const fixture = makeFixture({pieces, files, cells: {'0_0': Object.keys(pieces).map(id => [id, 0, 600])}});
  const fleet = makeLocalFleet('pilot', noCamera, noOccupancy, fixture.fetcher);
  await fleet.reset(0, 0);
  assert.equal(fleet.active.length, 6);
  fleet.step(.5, 0, 0);
  for (let i = 0; i < fleet.active.length; i++) for (let j = i + 1; j < fleet.active.length; j++) {
    const a = fleet.active[i].state, b = fleet.active[j].state;
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 0.1, 'following/crossing bodies must separate');
  }
  fleet.dispose();
}

// A distant reset does not load a nearby piece. Missing files are reported, and disposal wins races.
{
  const distant = makeFixture({cells: {'0_0': [['p', 0, 600]]}});
  const fleet = makeLocalFleet('city', noCamera, noOccupancy, distant.fetcher);
  await fleet.reset(5000, 5000);
  assert.deepEqual(distant.calls, ['./data/guaguas/city/index.json']);
  fleet.dispose();

  const missing = makeFixture({files: {}});
  const broken = makeLocalFleet('city', noCamera, noOccupancy, missing.fetcher);
  await broken.reset(0, 0);
  assert.ok(broken.errors.some(error => error.includes('p.json')));
  broken.dispose();

  const slow = makeFixture({delay: 10});
  const raced = makeLocalFleet('city', noCamera, noOccupancy, slow.fetcher);
  const pending = raced.reset(0, 0);
  raced.dispose();
  await pending;
  assert.equal(raced.active.length, 0);
  assert.equal(raced.errors.length, 0);
}

async function twoBuses(paths){
  const pieces={},files={};
  for(const [id,[path,stops]] of Object.entries(paths)){
    pieces[id]={file:id+'.json',line:id,direction:'test',phase:0,period:90};
    files[id+'.json']={line:id,direction:'test',path,stops};
  }
  const fixture=makeFixture({pieces,files,cells:{'0_0':Object.keys(pieces).map(id=>[id,0,60])}});
  const fleet=makeLocalFleet('pilot',()=>true,noOccupancy,fixture.fetcher);
  await fleet.reset(0,0);
  assert.equal(fleet.active.length,2);
  return fleet;
}
{
  const queue=await twoBuses({front:[[[0,0],[100,0]],[{id:'stop',name:'Stop',position:[30,0],distance:30}]],
                             rear:[[[-12,0],[90,0]],[]]});
  for(let i=0;i<14*120;i++){
    queue.step(1/120,0,0);
    const front=queue.active.find(b=>b.line==='front').state,rear=queue.active.find(b=>b.line==='rear').state;
    assert.ok(front.x-rear.x>=7.2,'Queued buses touch');
    assert.equal(front.stopped,0,'The service stop should never cause a dwell in Conducir');
  }
  assert.ok(queue.active.find(b=>b.line==='rear').state.x>30,'Both buses should clear the stop');
  queue.dispose();
}
{
  const route=pieceData(0,24,[{id:'s1',name:'Stop',position:[12,0],distance:12}]);
  const fixture=makeFixture({cells:{'0_0':[['p',0,24]]},files:{'p.json':route}});
  const fleet=makeLocalFleet('pilot',()=>true,noOccupancy,fixture.fetcher);
  await fleet.reset(0,0);
  const bus=fleet.active[0];
  for(let i=1;i<=12;i++){
    const before=bus.state.x;
    fleet.step(1,0,0);
    assert.equal(fleet.active[0],bus,'Keep the same bus through visible turnarounds');
    assert.equal(bus.state.x,24-Math.abs((i*6)%48-24));
    assert.equal(bus.state.speed,6);
    assert.equal(bus.state.stopped,0);
    assert.equal(Math.sign(Math.cos(bus.state.h)),Math.sign(bus.state.x-before));
  }
  fleet.dispose();
}
{
  const crossing=await twoBuses({east:[[[-20,0],[50,0]],[]],north:[[[0,-20],[0,50]],[]]});
  for(let i=0;i<12*120;i++){
    crossing.step(1/120,0,0);
    const east=crossing.active.find(b=>b.line==='east').state,north=crossing.active.find(b=>b.line==='north').state;
    assert.ok(Math.abs(east.x)>=4.7 || Math.abs(north.y)>=4.7,'Crossing buses overlap');
  }
  assert.ok(crossing.active.every(b=>b.state.distance>40),'Both routes should clear the intersection');
  crossing.dispose();
}
{
  const fleet=await twoBuses({east:[[[0,0],[100,0]],[]],west:[[[100,0],[0,0]],[]]});
  let crossedHeadings=false,resumed=false;
  for(let i=0;i<15*120;i++){
    fleet.step(1/120,0,0);
    const east=fleet.active.find(b=>b.line==='east').state,west=fleet.active.find(b=>b.line==='west').state;
    assert.ok(west.x-east.x>=7.2,'Head-on buses must not touch');
    if(east.speed===0 && west.speed===0)crossedHeadings=true;
    if(crossedHeadings && east.speed>0 && west.speed>0)resumed=true;
  }
  assert.ok(resumed,'Head-on buses should find room to turn and clear the blockage');
  fleet.dispose();
}
{
  const route={...pieceData(0,24,[]),path:[[0,0],[12,0],[12,12],[0,12],[0,0]]};
  const fixture=makeFixture({cells:{'0_0':[['p',0,48]]},files:{'p.json':route}});
  const fleet=makeLocalFleet('pilot',()=>true,noOccupancy,fixture.fetcher);
  await fleet.reset(0,0);
  const bus=fleet.active[0];
  for(let i=0;i<9;i++)fleet.step(1,0,0);
  assert.equal(fleet.active[0],bus);
  assert.deepEqual([bus.state.x,bus.state.y,bus.state.h],[6,0,0],'Closed routes continue forward across the seam');
  fleet.dispose();
}
async function resumeOnReturn(){
  const fixture=makeFixture();
  let onScreen=false;
  const fleet=makeLocalFleet('pilot',()=>onScreen,noOccupancy,fixture.fetcher);
  await fleet.reset(0,0);
  for(let i=0;i<240;i++)fleet.step(1/120,0,0);
  const original=fleet.active[0];
  onScreen=true;fleet.step(.5,1500,0);
  assert.equal(fleet.active[0].id,original.id,'A visible bus survives the release radius');
  onScreen=false;fleet.step(.5,1500,0);
  assert.equal(fleet.active.length,0);
  const farPose={...original.state};
  for(let i=0;i<120;i++)fleet.step(1/120,1500,0);
  assert.deepEqual(original.state,farPose,'Released bus gets zero updates');
  onScreen=true;fleet.step(.51,0,0);await new Promise(setImmediate);
  assert.equal(fleet.active.length,0,'Returning should not pop a bus into view');
  onScreen=false;fleet.step(.51,0,0);await new Promise(setImmediate);
  assert.equal(fleet.active[0].id,original.id);
  const clock=busTimetable(pieceData()),expected=clock.sample(5.02,emptyBusState());
  assert.ok(Math.abs(fleet.active[0].state.distance-expected.distance)<.001,'Re-entry reconstructs current service time');
  fleet.dispose();
}
await resumeOnReturn();

// Cross both a sector and zone boundary along one passage. The same vehicle
// must keep moving as neighbouring cells report overlapping schedule intervals.
{
  const route=pieceData(0,1800,[]),clock=busTimetable(route),phase=180-clock.timeAt(940);
  const cells={};
  for(let i=0;i<8;i++)cells[i+'_0']=[['p',i*240,Math.min((i+1)*240,1800)]];
  const fixture=makeFixture({pieces:{p:{file:'p.json',line:'13',direction:'test',phase,period:180}},cells,files:{'p.json':route}});
  const fleet=makeLocalFleet('city',noCamera,noOccupancy,fixture.fetcher);
  await fleet.reset(940,0);
  const bus=fleet.active[0];
  assert.ok(Math.abs(bus.state.x-940)<1e-6);
  for(let i=0;i<600;i++){
    fleet.step(1/120,bus.state.x,0);
    assert.ok(fleet.active.includes(bus));
    assert.equal(fleet.active.filter(other=>other.id===bus.id).length,1);
  }
  assert.ok(bus.state.x>960);
  assert.equal(fixture.calls.filter(url=>url.endsWith('/p.json')).length,1);
  fleet.dispose();
}
console.log('Guagua local fleet QA passed (continuous motion, turnarounds, crossings, zone transition, offscreen return and disposal)');
