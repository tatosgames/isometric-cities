// Patrol chases on the real streets of the Vegueta pilot: each patrol starts 150 to 300 m of road away
// from a parked player and has to reach them without wrecking itself or getting stuck.
import {readFile} from 'node:fs/promises';
import {TUNE} from '../src/drive/drive-tune.ts';
import {makeDrivePhysics,restBody} from '../src/drive/drive-physics.ts';
import {buildDriveWorld} from '../src/drive/drive-world.ts';
import {chaseSteer} from '../src/drive/drive-chase.ts';

export async function chaseRuns(physics=makeDrivePhysics(TUNE),body=restBody,runs=40){
  const data=JSON.parse(await readFile(new URL('../public/data/pilot.json',import.meta.url),'utf8'));
  const world=buildDriveWorld(data,()=>0,TUNE);
  const valid=world.validNodes.filter(i=>world.free(world.nodes[i].x,world.nodes[i].y,TUNE.radius+.5));
  const dt=1/120,results=[];
  for(let run=0;run<runs;run++){
    const target=valid[Math.floor((run+.5)/runs*valid.length)],field=world.routesFrom(target);
    const far=valid.filter(i=>field.dist[i]>150 && field.dist[i]<300
      && Math.hypot(world.nodes[i].x-world.nodes[target].x,world.nodes[i].y-world.nodes[target].y)<TUNE.chaserLost-20);
    if(!far.length)continue;
    const start=far[(run*7919)%far.length],n=world.nodes[start],next=world.nodes[field.prev[start]];
    const player={...body(),x:world.nodes[target].x,y:world.nodes[target].y};
    const c={...body(),x:n.x,y:n.y,h:Math.atan2(next.y-n.y,next.x-n.x),node:start};
    let time=0,stuck=0,hits=0,outcome='late';
    for(;time<60;time+=dt){
      const turn=chaseSteer(c,player,world,field.prev,TUNE);
      if(turn===null){outcome='lost';break;}
      physics.steerPatrol(c,turn,world,dt);
      const hit=physics.collide(c,world);
      if(hit>3)hits++;
      stuck=Math.hypot(c.vx,c.vy)<1.5?stuck+dt:0;
      if(hit>TUNE.wreckImpact){outcome='wreck';break;}
      if(stuck>TUNE.stuckTime){outcome='stuck';break;}
      if(Math.hypot(c.x-player.x,c.y-player.y)<TUNE.catchReach){outcome='reached';break;}
    }
    results.push({outcome,time,road:field.dist[start],hits});
  }
  const reached=results.filter(r=>r.outcome==='reached');
  const count=o=>results.filter(r=>r.outcome===o).length;
  return {runs:results.length,reached:reached.length,wreck:count('wreck'),stuck:count('stuck'),late:count('late'),
    pace:reached.reduce((s,r)=>s+r.road,0)/reached.reduce((s,r)=>s+r.time,0)*3.6,
    hits:results.reduce((s,r)=>s+r.hits,0)/results.length};
}
