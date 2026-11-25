import type { Altitude, Building, Point, Ring, Road, Surface } from '../data/types.ts';
import { pointInRing } from '../geometry.ts';
import type { BuildingBlock } from './building-occlusion.ts';
import type { RoadNode } from './road-routing.ts';
import {blocksCamera} from './building-occlusion.ts';
import { routesFrom, indexRoadNodes } from './road-routing.ts';
import * as T from 'three';

export type Segment = [ax: number,ay: number,bx: number,by: number,facade: boolean];
interface Cell {segs: Segment[];trees: Point[];blocks: BuildingBlock[]}


const CELL=20;
// The city boundary has thousands of edges and is asked about every road node: index its edges by bands of
// northing so a point only meets the few edges that cross its own band.
function ringIndex(ring: Ring,band=25){
  const rows=new Map<number,number[]>();
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const ay=ring[i][1],by=ring[j][1];
    for(let k=Math.floor(Math.min(ay,by)/band);k<=Math.floor(Math.max(ay,by)/band);k++){
      const row=rows.get(k);
      if(row)row.push(i,j);else rows.set(k,[i,j]);
    }
  }
  return (x: number,y: number)=>{
    const row=rows.get(Math.floor(y/band));
    let inside=false;
    if(row)for(let k=0;k<row.length;k+=2){
      const [ax,ay]=ring[row[k]],[bx,by]=ring[row[k+1]];
      if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
    }
    return inside;
  };
}
export function inRing(ring: Ring,x: number,y: number){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [ax,ay]=ring[i],[bx,by]=ring[j];
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}

type Grid=Map<string,Cell>;
interface WorldData {boundary: Ring;roads: Road[];buildings: Building[];trees: Point[];surfaces?: Surface[]}
/** Zones whose footprints arrive later. Without it every obstacle comes with `data`. */
export interface Zoning {size: number;ids: ReadonlySet<string>}

// Ponds and fountains are solid, like the city boundary. One that a road or path runs into or over (a culvert,
// a ford, a bridge drawn as water) stays open: the way across it is real.
export function solidWater(data: Pick<WorldData,'roads'|'surfaces'>){
  const water=(data.surfaces??[]).filter(s=>s.kind==='water');
  if(!water.length)return [];
  // Points every 2 m along the ways, by cells of 50 m: each pond tests only the points around it.
  const cells=new Map<string,number[]>(),size=50;
  for(const road of data.roads)for(let i=1;i<road.line.length;i++){
    const [ax,ay]=road.line[i-1],[bx,by]=road.line[i],steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/2));
    for(let t=0;t<=steps;t++){
      const x=ax+(bx-ax)*t/steps,y=ay+(by-ay)*t/steps,key=Math.floor(x/size)+','+Math.floor(y/size);
      const list=cells.get(key);if(list)list.push(x,y);else cells.set(key,[x,y]);
    }
  }
  return water.filter(s=>{
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const [x,y] of s.rings[0]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
    for(let i=Math.floor(x0/size);i<=Math.floor(x1/size);i++)for(let j=Math.floor(y0/size);j<=Math.floor(y1/size);j++){
      const list=cells.get(i+','+j)??[];
      for(let k=0;k<list.length;k+=2){
        const x=list[k],y=list[k+1];
        if(x<x0 || x>x1 || y<y0 || y>y1)continue;
        if(pointInRing(s.rings[0],x,y) && !s.rings.slice(1).some(h=>pointInRing(h,x,y)))return false;
      }
    }
    return true;
  }).flatMap(s=>s.rings);
}

// The road graph covers the whole city. Walls, roofs and trees live in one layer per zone, so they can
// come and go with the zones the map has loaded; the boundary and anything in `data` form the base layer.
export function buildDriveWorld(data: WorldData,altitude: Altitude,tune: {treeClearance: number;treeRadius: number},zoning?: Zoning){
  const layers=new Map<string,Grid>();
  const inCity=ringIndex(data.boundary);
  let stack: Grid[]=[];
  let highestRoof=-Infinity;
  const span=(a: number,b: number)=>[Math.floor(Math.min(a,b)/CELL),Math.floor(Math.max(a,b)/CELL)];
  function addLayer(id: string,buildings: Building[],trees: Point[],boundary?: Ring,water: Ring[]=[]){
    const grid: Grid=new Map();
    const cell=(cx: number,cy: number)=>{
      const k=cx+','+cy;
      let entry=grid.get(k);
      if(!entry){entry={segs:[],trees:[],blocks:[]};grid.set(k,entry);}
      return entry;
    };
    function wall(ring: Ring,facade: boolean){
      for(let i=1;i<ring.length;i++){
        const [ax,ay]=ring[i-1],[bx,by]=ring[i];
        if(ax===bx && ay===by)continue;
        const [x0,x1]=span(ax,bx),[y0,y1]=span(ay,by),seg: Segment=[ax,ay,bx,by,facade];
        for(let cx=x0;cx<=x1;cx++)for(let cy=y0;cy<=y1;cy++)cell(cx,cy).segs.push(seg);
      }
    }
    for(const b of buildings){
      for(const ring of b.rings)wall(ring,true);
      const xs=b.rings[0].map(p=>p[0]),ys=b.rings[0].map(p=>p[1]);
      const [x0,x1]=span(Math.min(...xs),Math.max(...xs)),[y0,y1]=span(Math.min(...ys),Math.max(...ys));
      const base=altitude(...b.rings[0][0]);
      const block={rings:b.rings,base:base-2,top:base+(b.heightOverride??b.height)};
      highestRoof=Math.max(highestRoof,block.top);
      for(let cx=x0;cx<=x1;cx++)for(let cy=y0;cy<=y1;cy++)cell(cx,cy).blocks.push(block);
    }
    if(boundary)wall(boundary,false);
    for(const ring of water)wall(ring,false);
    // Only free-standing trees are solid: a trunk beside a facade would wedge the cars.
    // Judged against the walls of the same layer, so the result does not depend on arrival order.
    stack=[grid];
    const solid=trees.filter(([x,y])=>!near(x,y,tune.treeClearance));
    for(const [x,y] of solid)cell(Math.floor(x/CELL),Math.floor(y/CELL)).trees.push([x,y]);
    layers.set(id,grid);stack=[...layers.values()];
  }
  const zoneKey=(x: number,y: number)=>zoning?Math.floor(x/zoning.size)+'_'+Math.floor(y/zoning.size):'';
  const unloaded=(x: number,y: number)=>{
    if(!zoning)return false;
    const key=zoneKey(x,y);
    return zoning.ids.has(key) && !layers.has(key);
  };
  // Road graph: OSM vertices are already rounded to 0.1 m, so shared nodes share a key.
  const index=new Map<string,number>(),nodes: RoadNode[]=[];
  const node=(x: number,y: number)=>{
    const k=x+','+y;
    const known=index.get(k);
    if(known!==undefined)return known;
    const id=nodes.length;
    index.set(k,id);nodes.push({x,y,links:[],ok:false,part:-1});
    return id;
  };
  for(const road of data.roads){
    if(road.kind==='steps')continue;
    for(let i=1;i<road.line.length;i++){
      const a=node(...road.line[i-1]),b=node(...road.line[i]);
      if(a===b)continue;
      const d=Math.hypot(nodes[a].x-nodes[b].x,nodes[a].y-nodes[b].y);
      nodes[a].links.push([b,d]);nodes[b].links.push([a,d]);
    }
  }
  addLayer('',data.buildings,data.trees,data.boundary,solidWater(data));
  const sizes=[];
  for(const start of nodes){
    if(start.part>=0)continue;
    const id=sizes.length,queue=[start];let count=0;start.part=id;
    while(queue.length){
      const n=queue.pop();
      if(!n)break;
      count++;
      for(const [m] of n.links)if(nodes[m].part<0){nodes[m].part=id;queue.push(nodes[m]);}
    }
    sizes.push(count);
  }
  const main=sizes.indexOf(Math.max(...sizes));
  // A node is usable while nothing loaded stands on it; a zone revises its own nodes when it arrives.
  const usable=(n: RoadNode)=>n.part===main && clear(n.x,n.y,1.7);
  for(const n of nodes)n.ok=usable(n);
  const roadIndex=indexRoadNodes(nodes);
  const zoneNodes=new Map<string,RoadNode[]>();
  if(zoning)for(const n of nodes){
    const key=zoneKey(n.x,n.y),list=zoneNodes.get(key);
    if(list)list.push(n);else zoneNodes.set(key,[n]);
  }
  function addZone(id: string,buildings: Building[],trees: Point[]){
    if(layers.has(id))return;
    addLayer(id,buildings,trees);
    for(const n of zoneNodes.get(id)??[])n.ok=usable(n);
  }
  function removeZone(id: string){
    if(!id || !layers.delete(id))return;
    stack=[...layers.values()];
    for(const n of zoneNodes.get(id)??[])n.ok=usable(n);
  }
  function near(x: number,y: number,r: number){
    for(let cx=Math.floor((x-r)/CELL);cx<=Math.floor((x+r)/CELL);cx++)for(let cy=Math.floor((y-r)/CELL);cy<=Math.floor((y+r)/CELL);cy++){
      const key=cx+','+cy;
      for(const grid of stack){
        const c=grid.get(key);
        if(!c)continue;
        for(const s of c.segs){
          const dx=s[2]-s[0],dy=s[3]-s[1];
          const t=T.MathUtils.clamp(((x-s[0])*dx+(y-s[1])*dy)/(dx*dx+dy*dy),0,1);
          if(Math.hypot(x-s[0]-dx*t,y-s[1]-dy*t)<r)return true;
        }
        for(const t of c.trees)if(Math.hypot(x-t[0],y-t[1])<r+tune.treeRadius)return true;
      }
    }
    return false;
  }
  function clear(x: number,y: number,r: number){
    if(!inCity(x,y) || near(x,y,r))return false;
    const key=Math.floor(x/CELL)+','+Math.floor(y/CELL);
    return !stack.some(grid=>grid.get(key)?.blocks.some(b=>inRing(b.rings[0],x,y)));
  }
  // Ground whose footprints have not arrived counts as occupied: nothing starts or steps there.
  function free(x: number,y: number,r: number){
    return !unloaded(x,y) && clear(x,y,r);
  }
  function sight(ax: number,ay: number,bx: number,by: number){
    const d=Math.hypot(bx-ax,by-ay),steps=Math.ceil(d/1.8);
    for(let i=1;i<steps;i++)if(near(ax+(bx-ax)*i/steps,ay+(by-ay)*i/steps,1))return false;
    return true;
  }
  function nearestNode(x: number,y: number){return roadIndex.nearest(x,y);}
  const checked=new Set<BuildingBlock>();
  function occluded(x: number,y: number,height: number,dx: number,dy: number){
    const distance=highestRoof-height;
    if(distance<=0)return false;
    const ex=x+dx*distance,ey=y+dy*distance;
    checked.clear();
    for(let cx=Math.floor(Math.min(x,ex)/CELL);cx<=Math.floor(Math.max(x,ex)/CELL);cx++){
      for(let cy=Math.floor(Math.min(y,ey)/CELL);cy<=Math.floor(Math.max(y,ey)/CELL);cy++){
        const key=cx+','+cy;
        for(const grid of stack){
          const cell=grid.get(key);
          if(!cell)continue;
          for(const block of cell.blocks){
            if(checked.has(block))continue;
            checked.add(block);
            if(blocksCamera(block,x,y,height,dx,dy))return true;
          }
        }
      }
    }
    return false;
  }
  // A contact may move the body into the next cell during this visit.
  function visitObstacles<B extends {x: number;y: number}>(body: B,radius: number,
    wallContact: (body: B, segment: Segment, radius: number) => number,
    treeContact: (body: B, tree: Point, radius: number) => number){
    let hit=0;
    for(let cx=Math.floor((body.x-radius)/CELL);cx<=Math.floor((body.x+radius)/CELL);cx++){
      for(let cy=Math.floor((body.y-radius)/CELL);cy<=Math.floor((body.y+radius)/CELL);cy++){
        const key=cx+','+cy;
        for(const grid of stack){
          const cell=grid.get(key);
          if(!cell)continue;
          for(const segment of cell.segs)hit=Math.max(hit,wallContact(body,segment,radius));
          for(const tree of cell.trees)hit=Math.max(hit,treeContact(body,tree,radius));
        }
      }
    }
    return hit;
  }
  return {
    nodes,validNodes:roadIndex.valid,nearestNode,near,free,sight,occluded,visitObstacles,addZone,removeZone,
    routesFrom:(source: number)=>routesFrom(nodes,source)
  };
}
