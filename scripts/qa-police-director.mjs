import assert from 'node:assert/strict';
import {createPoliceDirector, findInterceptCandidates, POLICE} from '../src/drive/police-director.ts';

const candidate=(unitId=2, overrides={})=>({unitId,id:11,exitNode:12,distance:40,playerEta:4,unitEta:3,reactionSeconds:2,...overrides});
const units=[{id:1,distance:20},{id:2,distance:35}];

// The progression uses the authored absolute thresholds and reaches five stars once.
{
  const d=createPoliceDirector();d.setUnits(units);
  assert.equal(d.update({dt:24,closestDistance:10,anyVisible:true}).stars,1);
  assert.equal(d.update({dt:1,closestDistance:10,anyVisible:true}).stars,2);
  assert.equal(d.update({dt:30,closestDistance:10,anyVisible:true}).stars,3);
  assert.equal(d.update({dt:40,closestDistance:10,anyVisible:true}).stars,4);
  assert.equal(d.update({dt:50,closestDistance:10,anyVisible:true}).stars,5);
  for(let i=0;i<20;i++)assert.equal(d.update({dt:10,closestDistance:10,anyVisible:true}).stars,5);
  d.reset();assert.equal(d.stars,1);assert.equal(d.maxUnits,1);
}

// Arrivals advance the pursuit clock while consecutive promotions stay fifteen real seconds apart.
{
  const d=createPoliceDirector();
  const update=(dt,arrived)=>d.update({dt,arrived,closestDistance:10,anyVisible:true}).stars;
  assert.equal(update(14,true),1);
  assert.equal(update(1,false),2);
  assert.equal(update(1,true),2);
  assert.equal(update(12,true),2);
  assert.equal(update(2,false),3);
}

// A sighting is required before the three-second unseen timer can arm one six-second truce.
{
  const d=createPoliceDirector();d.setUnits(units);
  d.update({dt:0.1,closestDistance:20,anyVisible:true});
  assert.equal(d.update({dt:2.9,closestDistance:70,anyVisible:false}).truce,0);
  assert.equal(d.update({dt:0.1,closestDistance:70,anyVisible:false}).truce,6);
  assert.ok(Math.abs(d.update({dt:5.9,closestDistance:70,anyVisible:false}).truce-.1)<1e-9);
  assert.equal(d.update({dt:.1,closestDistance:70,anyVisible:false}).truce,0);
  assert.equal(d.update({dt:3,closestDistance:70,anyVisible:false}).truce,0);
  d.update({dt:0.1,closestDistance:20,anyVisible:true});
  assert.equal(d.update({dt:3,closestDistance:70,anyVisible:false}).truce,6);
}

// A candidate is selected only for a secondary unit and stays committed until its ETA window ends.
{
  const d=createPoliceDirector();d.setUnits(units);
  d.update({dt:25,closestDistance:20,anyVisible:true,candidates:[candidate()]});
  assert.equal(d.assignment(2)?.id,11);assert.equal(d.assignment(1),undefined);
  const still=d.update({dt:1,closestDistance:20,anyVisible:true,candidates:[candidate(2,{id:12})]});
  assert.equal(still.units.find(u=>u.id===2)?.role,'interceptor');assert.equal(d.assignment(2)?.id,11);
  d.update({dt:6,closestDistance:20,anyVisible:true});assert.equal(d.assignment(2),undefined);
  const blocked=d.update({dt:1,closestDistance:20,anyVisible:true,candidates:[candidate(2,{id:12})]});
  assert.equal(blocked.units.find(u=>u.id===2)?.role,'support');
  d.update({dt:5,closestDistance:20,anyVisible:true,candidates:[candidate(2,{id:12})]});
  assert.equal(d.assignment(2)?.id,12);
}

// Graph search follows the player's heading, takes the first two junctions, and rejects blocked lanes.
{
  const nodes=[
    {id:0,x:0,y:0,ok:true,links:[[1,10]]},
    {id:1,x:10,y:0,ok:true,links:[[0,10],[2,10],[3,10],[4,10]]},
    {id:2,x:20,y:0,ok:true,links:[[1,10],[5,10],[6,10]]},
    {id:3,x:10,y:10,ok:true,links:[[1,10]]},
    {id:6,x:10,y:-10,ok:true,links:[[1,10]]},
    {id:4,x:30,y:0,ok:true,links:[[2,10]]},
    {id:5,x:20,y:10,ok:true,links:[[2,10]]},
  ];
  const world={nodes,nearestNode:()=>0,free:()=>true};
  const patrols=[
    {id:1,x:-10,y:0,vx:10,vy:0,visibleFor:2,wreck:0},
    {id:2,x:10,y:10,vx:0,vy:-10,visibleFor:2,wreck:0},
  ];
  const found=findInterceptCandidates(world,{x:0,y:0,vx:10,vy:0,h:0},patrols,2,1.15);
  assert.equal(found.length,1);assert.equal(found[0].exitNode,4);
  assert.equal(found.every(c=>c.distance>0 && c.playerEta>0 && c.unitEta>0),true);
  const blocked=findInterceptCandidates({...world,free:()=>false},{x:0,y:0,vx:10,vy:0,h:0},patrols,2,1.15);
  assert.equal(blocked.length,0);
  const slow=findInterceptCandidates(world,{x:0,y:0,vx:3,vy:0,h:0},patrols,2,1.15);
  assert.equal(slow.length,0);
}

// Wrecked units cannot become pursuers or interceptors, and the director never exceeds star capacity.
{
  const d=createPoliceDirector();d.setUnits([{id:1,distance:10},{id:2,distance:20,wrecked:true},{id:3,distance:30}]);
  const s=d.update({dt:25,closestDistance:20,anyVisible:true,candidates:[candidate(3)]});
  assert.equal(s.units.length,2);assert.equal(s.units.some(u=>u.id===2),false);assert.equal(d.maxUnits,2);
}

console.log(`Police director QA passed (${POLICE.thresholds.join('/')})`);
