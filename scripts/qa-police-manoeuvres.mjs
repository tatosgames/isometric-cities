import assert from 'node:assert/strict';
import {makeDrivePhysics,restBody} from '../src/drive/drive-physics.ts';
import {TUNE,wrap} from '../src/drive/drive-tune.ts';
import {buildDriveWorld} from '../src/drive/drive-world.ts';
import {chaseSteer} from '../src/drive/drive-chase.ts';

const dt=1/120,horizon=10;
const rectangle=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]];
const layouts=[
  ['straight',[[-25,0],[0,0],[38,0],[150,0]],[],rectangle(-40,-12,200,24)],
  ['corner',[[-25,0],[0,0],[38,0],[38,55]],[rectangle(48,9,35,50)],rectangle(-35,-15,130,90)],
  ['double bend',[[-25,0],[0,0],[38,0],[38,25],[85,25]],[rectangle(48,-9,35,25)],rectangle(-35,-15,150,75)],
  ['square',[[-25,0],[0,0],[38,0],[65,0],[65,30],[8,30]],[],rectangle(-40,-40,140,95)],
  ['narrow',[[-25,0],[0,0],[38,0],[100,0]],[],rectangle(-35,-4,160,8)]
];
function run([name,line,blocks,boundary],evade){
  const world=buildDriveWorld({roads:[{line,kind:'residential'}],boundary,trees:[],
    buildings:blocks.map(ring=>({rings:[ring],height:8}))},()=>0,TUNE);
  const physics=makeDrivePhysics(TUNE);
  const player={...restBody(),x:0,y:0,vx:17},cop={...restBody(),x:38,y:0,h:Math.PI,vx:-16,node:-1};
  let waypoint=2,field,near=Infinity;
  for(let step=0;step<horizon/dt;step++){
    const t=step*dt,point=line[waypoint];
    const gap=Math.hypot(point[0]-player.x,point[1]-player.y);
    const correction=wrap(Math.atan2(point[1]-player.y,point[0]-player.x)-player.h);
    let steer=Math.abs(correction)>.07?Math.sign(correction):0;
    if(evade && t<.9)steer=t<.46?1:0;
    physics.steerPlayer(player,steer,false,dt);physics.collide(player,world);
    if(gap<5 && waypoint+1<line.length)waypoint++;
    if(step%30===0)field=world.patrolRoutesFrom(world.nearestNode(player.x,player.y));
    const turn=chaseSteer(cop,player,world,field.prev,TUNE);
    if(turn===null)break;
    physics.steerPatrol(cop,turn,world,dt);physics.collide(cop,world);
    near=Math.min(near,Math.hypot(cop.x-player.x,cop.y-player.y));
    if(near<TUNE.catchReach)return t;
  }
  return horizon;
}
const delays=layouts.map(layout=>{const straight=run(layout,false),evade=run(layout,true);return {scene:layout[0],straight,evade,delay:evade-straight};});
console.table(delays);
assert.ok(delays.filter(r=>r.delay>=2).length>=3,'A steering feint should buy at least two seconds in three layouts');
const physics=makeDrivePhysics(TUNE),clear={near:()=>false};
function profileRun(profile,corner){
  const car={...restBody(),vx:corner?18:0};
  for(let i=0;i<(corner?48:3600);i++)physics.steerPatrol(car,corner?1:0,clear,dt,profile);
  return car;
}
const fast={...TUNE.patrol,topSpeed:TUNE.patrol.topSpeed*1.08,turn:TUNE.patrol.turn*.85};
assert.ok(profileRun(fast,false).x>profileRun(TUNE.patrol,false).x+10);
assert.ok(profileRun(fast,true).h<profileRun(TUNE.patrol,true).h);
