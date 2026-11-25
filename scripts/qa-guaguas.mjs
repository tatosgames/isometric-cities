// Static Guaguas Municipal data contract and gameplay-route sanity checks.
// The game deliberately consumes a local snapshot so browser tests never depend
// on the open-data portal being reachable.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../public/data/guaguas.json', import.meta.url), 'utf8'));
assert.equal(typeof data.line, 'string', 'Guaguas line is required');
assert.equal(typeof data.direction, 'string', 'Guaguas direction is required');
assert.ok(Array.isArray(data.path) && data.path.length >= 2, 'Guaguas path needs two points');
assert.ok(Array.isArray(data.stops) && data.stops.length >= 2, 'Guaguas needs two stops');

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
let length = 0;
for (let i = 0; i < data.path.length; i++) {
  const point = data.path[i];
  assert.ok(Array.isArray(point) && point.length === 2, `Invalid route point ${i}`);
  assert.ok(point.every(Number.isFinite), `Route point ${i} must be finite`);
  if (i) length += distance(data.path[i - 1], point);
}
assert.ok(length > 20, 'Guaguas path is too short to affect gameplay');

let previous = -Infinity;
for (const [i, stop] of data.stops.entries()) {
  assert.equal(typeof stop.id, 'string', `Stop ${i} needs an id`);
  assert.equal(typeof stop.name, 'string', `Stop ${i} needs the source name`);
  assert.ok(Array.isArray(stop.position) && stop.position.length === 2, `Invalid stop ${i}`);
  assert.ok(stop.position.every(Number.isFinite), `Stop ${i} position must be finite`);
  assert.ok(Number.isFinite(stop.distance), `Stop ${i} needs route distance`);
  assert.ok(stop.distance > previous, `Stops must follow stop_sequence at ${i}`);
  assert.ok(stop.distance >= 0 && stop.distance <= length, `Stop ${i} lies outside the route`);
  previous = stop.distance;
}

console.log(`Guaguas data QA passed (${data.line}, ${data.direction}, ${data.path.length} route points, ${data.stops.length} stops, ${Math.round(length)} m)`);
