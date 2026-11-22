import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { barrioAt, confirmedName, indexStreets } from '../src/drive/drive-location.ts';

const crossing=indexStreets([
  {kind:'residential',name:'Calle del Sol',line:[[-20,0],[20,0]]},
  {kind:'residential',name:null,line:[[0,-20],[0,20]]}
]);
assert.equal(crossing(0,0,0),'Calle del Sol');
assert.equal(crossing(0,0,Math.PI/2),'');
assert.equal(crossing(0,0,Math.PI/4),'');
assert.equal(crossing(12,8,0),'');

const barrios=JSON.parse(readFileSync(new URL('../public/data/barrios.json',import.meta.url),'utf8'));
const {features}=JSON.parse(readFileSync(new URL('../public/data/poi.geojson',import.meta.url),'utf8'));
for(const [id,expected] of [['santa-ana','Vegueta'],['gabinete-literario','Triana']]){
  const place=features.find(f=>f.properties.id===id);
  assert.equal(barrioAt(barrios,...place.properties.xy),expected);
}
assert.equal(barrioAt(barrios,1e6,1e6),'');

const confirmed=confirmedName('Triana',700);
assert.equal(confirmed('Vegueta',0),undefined);
assert.equal(confirmed('Triana',140),undefined);
assert.equal(confirmed('Vegueta',280),undefined);
assert.equal(confirmed('Vegueta',840),undefined);
assert.equal(confirmed('Vegueta',980),'Vegueta');
assert.equal(confirmed('Vegueta',1120),undefined);
