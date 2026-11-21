import assert from 'node:assert/strict';
import {makeDriveRoute} from '../src/drive/drive-route.ts';
import {routesFrom} from '../src/drive/road-routing.ts';

const nodes = [0, 10, 40, 80].map(x => ({x,y:0,links:[],part:0,ok:true}));
nodes[0].links.push([1,10]);
nodes[1].links.push([0,10],[2,30]);
nodes[2].links.push([1,30]);
const world = {nodes,nearestNode:x=>nodes.findIndex(node=>node.x===x),free:()=>true};
const places = [
  {name:'Start',number:'01',x:0,y:0},
  {name:'Goal',number:'02',x:40,y:0},
  {name:'Disconnected',number:'03',x:80,y:0}
];
const tune = {coinStep:8,coinReach:2.6,magnet:6,maxSpeed:15,arriveReach:16,arriveBonus:10};
const route = makeDriveRoute(places,()=>0,tune,220);
const first = route.choose(world,routesFrom(nodes,0),()=>0);
assert.equal(first.target.poi.name,'Goal');
assert.deepEqual(first.path.map(node=>node.x),[0,10,40]);
assert.deepEqual(route.coins.map(coin=>coin.x),[3,11,19,27,35]);

const events = [];
const emit = event=>events.push(event);
route.advance({x:6,y:0},nodes,1/25,emit);
assert.equal(route.coins[0].x,4);
assert.equal(route.coins[1].x,10);
assert.deepEqual(events,[]);
route.advance({x:6,y:0},nodes,0,emit);
assert.deepEqual(events,[{type:'coin',coin:{x:4,y:0,z:2},points:1}]);
route.advance({x:40,y:0},nodes,0,emit);
route.advance({x:40,y:0},nodes,0,emit);
assert.deepEqual(events.map(event=>event.points),[1,10]);
assert.equal(route.choose(world,routesFrom(nodes,2),()=>0).target.poi.name,'Start');
route.clear();
assert.equal(route.target,null);
assert.equal(route.coins.length,0);
console.log('Drive route selection, coin spacing, magnet, score events and next destination passed');
