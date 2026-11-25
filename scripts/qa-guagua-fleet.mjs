import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validFleetIndex,validFleetDirectory} from '../src/drive/guagua-fleet.ts';
import {validGuagua} from '../src/drive/guagua.ts';
import {busTimetable} from '../src/drive/guagua-timetable.ts';

export async function checkBusNetwork(area){
  const base=new URL('../public/data/guaguas/'+area+'/',import.meta.url);
  const read=async file=>JSON.parse(await readFile(new URL(file,base),'utf8'));
  const directory=await read('index.json'),report=await read('coverage.json');
  assert.ok(validFleetDirectory(directory),area+' directory');
  assert.equal(directory.source.sha256,report.source.sha256);
  const index={cells:{},pieces:{}},bundles=new Map();
  for(const file of Object.values(directory.zones)){
    const zone=await read(file);
    assert.ok(validFleetIndex(zone),area+' '+file);
    Object.assign(index.cells,zone.cells);Object.assign(index.pieces,zone.pieces);
  }
  const all=new Map(),intervals=new Map();
  for(const [id,piece] of Object.entries(index.pieces)){
    const key=piece.file+'#'+piece.slot;
    if(!all.has(key)){
      if(!bundles.has(piece.file))bundles.set(piece.file,await read(piece.file));
      const pack=bundles.get(piece.file),run=pack.runs[piece.slot];
      const data={...piece,path:pack.paths[run.path],stops:run.stops};
      assert.ok(validGuagua(data,0),piece.file);
      all.set(key,busTimetable(data));
    }
    intervals.set(id,[]);
  }
  for(const [cell,refs] of Object.entries(index.cells)){
    for(const [id,from,to,enter,leave] of refs){
      const {file,slot}=index.pieces[id],clock=all.get(file+'#'+slot);
      assert.ok(to<=clock.length+.001 && from>=0);
      assert.ok(Math.abs(enter-clock.timeAt(from))<.02 && Math.abs(leave-clock.timeAt(to,true))<.02,
        area+' timing '+id+' '+cell);
      intervals.get(id).push([from,to]);
    }
  }
  for(const [id,list] of intervals){
    const {file,slot}=index.pieces[id],clock=all.get(file+'#'+slot);
    let last=0;
    for(const [from,to] of list.sort((a,b)=>a[0]-b[0])){
      assert.ok(Math.abs(from-last)<.001,'Gap in indexed cells '+id);
      last=to;
    }
    assert.ok(Math.abs(last-clock.length)<.001,'Incomplete cell coverage '+id);
  }
  assert.equal(new Set(report.patterns.map(p=>p.line)).size,46);
  assert.ok(report.patterns.every(p=>p.pieces.every(s=>index.pieces[s.id] && s.osmWays.length>0)));
  console.log(area+' bus network validated: '+intervals.size+' pieces in '+Object.keys(index.cells).length+' cells');
}
