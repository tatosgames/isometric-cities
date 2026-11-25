import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validGuagua} from '../src/drive/guagua.ts';

const data=JSON.parse(await readFile(new URL('../public/data/guaguas.json',import.meta.url),'utf8'));
assert.ok(validGuagua(data),'Invalid local guagua extract');
assert.deepEqual([data.line,data.direction],['13','Tres Palmas']);
assert.deepEqual(data.stops.map(s=>s.id),['73','75']);
assert.equal(data.source.shape,'013_A');
assert.match(data.source.sha256,/^[0-9a-f]{64}$/);
assert.deepEqual(data.source.osmWays,['30913504']);
console.log('Guagua data QA passed (line 13, consecutive GTFS stops 73 and 75)');
