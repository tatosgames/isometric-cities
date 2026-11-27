// Checks of the flood solver (`src/flood/flood-solver.ts`) on synthetic grids, without a browser:
// still water stays still over a stepped bed and against walls, a dam break conserves its volume and spreads,
// water that runs downhill into the sea is booked as gone, and the impact curves keep their published values.
import assert from 'node:assert/strict';
import {makeFlood} from '../src/flood/flood-solver.ts';
import {makeFloodSim} from '../src/flood/flood-sim.ts';
import {hydrograph,rationalFlood,GUINIGUADA,riseTo,designRain} from '../src/flood/flood-hydrology.ts';
import {buildingState} from '../src/flood/flood-impact.ts';
import {damageShare,hazardClass,hazardRating} from '../src/flood/flood-impact.ts';
import {fillPolygon} from '../src/flood/flood-grid.ts';

function grid(w,h,ground=()=>0){
  const n=w*h,z=new Float32Array(n);
  for(let r=0;r<h;r++)for(let c=0;c<w;c++)z[r*w+c]=ground(c,r);
  return {w,h,dx:5,dy:5,z,wall:new Uint8Array(n),sea:new Uint8Array(n)};
}
const dry={inflow:0,rain:0};
// The edges of these grids are closed by a ring of walls, so only the scheme moves water.
function closed(g){
  for(let r=0;r<g.h;r++)for(let c=0;c<g.w;c++)if(!r||!c||r===g.h-1||c===g.w-1)g.wall[r*g.w+c]=1;
  return g;
}

{
  // Lake at rest over a bed with 1 m steps (the DEM is in whole metres) and a building in the middle.
  const g=closed(grid(40,30,c=>Math.floor(c/8)));
  for(let r=12;r<18;r++)for(let c=18;c<24;c++)g.wall[r*g.w+c]=1;
  const f=makeFlood(g,[]);
  for(let i=0;i<g.w*g.h;i++)if(!g.wall[i])f.depth[i]=Math.max(0,6-g.z[i]);
  const before=f.volume();
  for(let k=0;k<2000;k++)f.step(10,dry);
  let still=0;for(let i=0;i<g.w*g.h;i++)still=Math.max(still,Math.abs(f.qx[i]),Math.abs(f.qy[i]));
  assert.ok(still<1e-9,'Still water moved: '+still);
  assert.ok(Math.abs(f.volume()-before)<1e-6*before);
}
{
  // Dam break on a flat closed basin: the column spreads, the volume stays, the surface flattens to the mean.
  const g=closed(grid(60,20));
  const f=makeFlood(g,[]);
  for(let r=1;r<19;r++)for(let c=1;c<20;c++)f.depth[r*g.w+c]=3;
  const before=f.volume();
  f.advance(1800,()=>dry);
  assert.ok(Math.abs(f.volume()-before)/before<1e-9,'Volume changed by '+(f.volume()-before));
  const mean=before/(58*18*25);
  let spread=0;for(let r=1;r<19;r++)for(let c=1;c<59;c++)spread=Math.max(spread,Math.abs(f.depth[r*g.w+c]-mean));
  assert.ok(spread<.02,'The basin did not settle: '+spread);
}
{
  // A sloping valley that ends in the sea: a hydrograph enters upstream and every m³ is booked.
  const g=grid(80,30,(c,r)=>(80-c)*.2+Math.abs(r-15)*.4);
  for(let r=0;r<30;r++)for(let c=74;c<80;c++){g.sea[r*80+c]=1;g.z[r*80+c]=0;}
  const owner=new Int32Array(80*30);
  for(let r=8;r<12;r++)for(let c=40;c<44;c++){g.wall[r*80+c]=1;owner[r*80+c]=1;}
  const sources=[15*80+2,14*80+2,16*80+2];
  const sim=makeFloodSim({...g,owner},1,sources,{peak:40,rise:300,start:0,shape:3,culvert:0,rain:20,rainFor:600,runoff:.9});
  sim.advance(3600);
  const s=sim.stats();
  assert.ok(s.toSea>.5*s.entered,'Little water reached the sea: '+s.toSea.toFixed(0)+' of '+s.entered.toFixed(0));
  assert.ok(Math.abs(s.balance)<1e-6,'Water balance off by '+s.balance);
  assert.ok(s.reached>0 && s.deepest>=0);
  const packed=sim.pack('depth');
  assert.equal(packed.length,80*30*4);
  // Integrated inflow matches the hydrograph's integral, Qp·tp·Γ(4)·e³/3⁴.
  const expected=40*300*6*Math.exp(3)/81;
  const entered=sim.flood.ledger.inflow;
  assert.ok(Math.abs(entered-expected)/expected<.02,'Hydrograph volume '+entered.toFixed(0)+' vs '+expected.toFixed(0));
}
{
  // Published curves.
  assert.equal(damageShare(0),0);assert.equal(damageShare(1),.4);assert.equal(damageShare(2.5),.675);assert.equal(damageShare(9),1);
  assert.equal(hazardClass(hazardRating(.2,.5)),1);
  assert.equal(hazardClass(hazardRating(.5,1)),3);
  assert.equal(hazardClass(hazardRating(1,2)),4);
  assert.ok(Math.abs(hydrograph(300,10,300)-10)<1e-9);
  // Norma 5.2-IC on the Guiniguada, checked by hand: tc 6.09 h, Kt 1.406, KA 0.879, T100 281 m³/s, T500 367 m³/s.
  const t100=rationalFlood(GUINIGUADA,GUINIGUADA.rainfall[100]),t500=rationalFlood(GUINIGUADA,GUINIGUADA.rainfall[500]);
  assert.ok(Math.abs(t100.concentration-6.09)<.01 && Math.abs(t100.uniformity-1.406)<.001 && Math.abs(t100.areal-.879)<.001);
  assert.equal(Math.round(t100.peak),281);assert.equal(Math.round(t500.peak),367);
  assert.ok(Math.abs(hydrograph(riseTo(.1,3600),1,3600)-.1)<1e-6);
  assert.equal(designRain(GUINIGUADA,142.63,1,1.64).toFixed(1),'46.9');
  // Clausen & Clark: partial damage from d·v 3, collapse from d·v 7 at 2 m/s or more.
  assert.equal(buildingState(.05,0,0),'dry');assert.equal(buildingState(1.5,2,1.3),'flooded');
  assert.equal(buildingState(2,4,2),'damaged');assert.equal(buildingState(4,8,2),'collapsed');assert.equal(buildingState(8,8,1),'damaged');
  // Scan-line fill: a 20 m square with a 10 m hole on a 5 m grid.
  const out=new Uint8Array(100);
  fillPolygon([[[0,0],[20,0],[20,-20],[0,-20]],[[5,-5],[15,-5],[15,-15],[5,-15]]],{w:10,h:10,dx:5,dy:5,west:-2.5,north:2.5},out,1);
  assert.equal(out.reduce((a,b)=>a+b,0),16-4);
}
console.log('flood solver: lake at rest, dam break, valley to the sea, impact curves, Norma 5.2-IC ok');
