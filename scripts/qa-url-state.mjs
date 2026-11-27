// The shared query string (`src/url-state.ts`): readers, writers, and old links rewritten to the nine English names.
import assert from 'node:assert/strict';
import {caseParts,has,pairs,readAt,search,setAt,setSwitch,setTune,tuned,upgrade} from '../src/url-state.ts';

const q=s=>new URLSearchParams(s);
const now=s=>search(upgrade(q(s)));

// Readers.
assert.deepEqual(caseParts(q('case=guiniguada.1954')),['guiniguada','1954']);
assert.deepEqual(caseParts(q('')),[]);
assert.deepEqual(readAt(q('at=santa-ana')),{place:'santa-ana'});
assert.deepEqual(readAt(q('at=-60,-818')),{point:[-60,-818]});
assert.deepEqual(readAt(q('at=1,2,3.5,1,santa-ana')),{point:[1,2],zoom:3.5,turn:1,place:'santa-ana'});
assert.equal(tuned(q('tune=seed:7,player.baseSpeed:30'),'player.baseSpeed',0),30);
assert.equal(tuned(q('tune=seed:x'),'seed',1),1);
assert.equal(tuned(q('tune=pos:0'),'pos',50),0);
assert.ok(has(q('off=police,buses'),'off','buses'));
assert.deepEqual([...pairs(q('look=sole,tilt:1'),'look')],[['sole',''],['tilt','1']]);

// Writers keep the other values and leave the lists readable.
const w=q('lab=drive&tune=seed:7&off=police');
setTune(w,'speed',3);setSwitch(w,'off','buses',true);setSwitch(w,'off','police',false);setAt(w,1,-2,3);
assert.equal(search(w),'lab=drive&tune=seed:7,speed:3&off=buses&at=1.0,-2.0,3.00');
setSwitch(w,'off','buses',false);
assert.ok(!w.has('off'));

// Old links.
assert.equal(now('lab=inondazione&scenario=guiniguada&ritorno=1954'),'lab=flood&case=guiniguada.1954');
assert.equal(now('lab=inondazione&scenario=pioggia&ritorno=500&x=-150&y=0&velocita=1200&vista=pericolo&pausa=1'),
  'lab=flood&mode=hazard&at=-150,0&case=rain.500&off=play&tune=speed:1200');
assert.equal(now('lab=guida&area=pilot&stats&start=-60,-818&seed=7&nopolice&nobuses&t=chaserEvery:8'),
  'lab=drive&area=pilot&at=-60,-818&on=stats&off=police,buses&tune=seed:7,chaserEvery:8');
assert.equal(now('test=larghezze&caso=principale&prima=1'),'lab=roads&case=widths.principale&on=before');
assert.equal(now('test=lod&mappa=1&modo=visivo&noSuolo=1&transizione=40'),'lab=roads&mode=visual&case=lod&on=map&off=ground&tune=transition:40');
assert.equal(now('lab=demolizione&strumento=sparo&quota=12'),'lab=demolition&mode=gun&tune=height:12');
assert.equal(now('look=matcap&tilt&palette=cream'),'look=matcap,tilt:1,palette:cream');
assert.equal(now('sky=0&focus=parque-doramas&neutral'),'at=parque-doramas&on=neutral&off=sky');
assert.equal(now('lab=qualita&vista='+encodeURIComponent(JSON.stringify({target:[10,5,-20],zoom:2,turn:1,selected:'santa-ana'}))),
  'lab=quality&at=10,20,2,1,santa-ana');
// Links already in today's names come back unchanged.
for(const link of ['lab=flood&case=rain.500&at=-150,0&tune=speed:1200','lab=drive&area=pilot&off=police&tune=seed:7','look=sole'])
  assert.equal(now(link),link);
console.log('URL state: readers, writers and old links passed');
