import {blocksCamera} from './building-occlusion.js';
import { routesFrom, indexRoadNodes } from './road-routing.js';
import * as T from 'three';

const CELL=20;
function inRing(ring,x,y){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [ax,ay]=ring[i],[bx,by]=ring[j];
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}

export function buildDriveWorld(data,altitude,tune){
  const grid=new Map();
  let highestRoof=-Infinity;
  const cell=(cx,cy)=>{
    const k=cx+','+cy;
    if(!grid.has(k))grid.set(k,{segs:[],trees:[],blocks:[]});
    return grid.get(k);
  };
  const span=(a,b)=>[Math.floor(Math.min(a,b)/CELL),Math.floor(Math.max(a,b)/CELL)];
  function wall(ring){
    for(let i=1;i<ring.length;i++){
      const [ax,ay]=ring[i-1],[bx,by]=ring[i];
      if(ax===bx && ay===by)continue;
      const [x0,x1]=span(ax,bx),[y0,y1]=span(ay,by),seg=[ax,ay,bx,by];
      for(let cx=x0;cx<=x1;cx++)for(let cy=y0;cy<=y1;cy++)cell(cx,cy).segs.push(seg);
    }
  }
  for(const b of data.buildings){
    for(const ring of b.rings)wall(ring);
    const xs=b.rings[0].map(p=>p[0]),ys=b.rings[0].map(p=>p[1]);
    const [x0,x1]=span(Math.min(...xs),Math.max(...xs)),[y0,y1]=span(Math.min(...ys),Math.max(...ys));
    const base=altitude(...b.rings[0][0]);
    const block={rings:b.rings,base:base-2,top:base+(b.heightOverride??b.height)};
    highestRoof=Math.max(highestRoof,block.top);
    for(let cx=x0;cx<=x1;cx++)for(let cy=y0;cy<=y1;cy++)cell(cx,cy).blocks.push(block);
  }
  wall(data.boundary);
  // Road graph: OSM vertices are already rounded to 0.1 m, so shared nodes share a key.
  const index=new Map(),nodes=[];
  const node=(x,y)=>{
    const k=x+','+y;
    if(!index.has(k)){index.set(k,nodes.length);nodes.push({x,y,links:[],ok:false,part:-1});}
    return index.get(k);
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
  // Only free-standing trees are solid: a trunk beside a facade would wedge the cars.
  for(const [x,y] of data.trees.filter(([x,y])=>!near(x,y,tune.treeClearance)))cell(Math.floor(x/CELL),Math.floor(y/CELL)).trees.push([x,y]);
  const sizes=[];
  for(const start of nodes){
    if(start.part>=0)continue;
    const id=sizes.length,queue=[start];let count=0;start.part=id;
    while(queue.length){
      const n=queue.pop();count++;
      for(const [m] of n.links)if(nodes[m].part<0){nodes[m].part=id;queue.push(nodes[m]);}
    }
    sizes.push(count);
  }
  const main=sizes.indexOf(Math.max(...sizes));
  for(const n of nodes)n.ok=n.part===main && free(n.x,n.y,1.7);
  const roadIndex=indexRoadNodes(nodes);
  function near(x,y,r){
    for(let cx=Math.floor((x-r)/CELL);cx<=Math.floor((x+r)/CELL);cx++)for(let cy=Math.floor((y-r)/CELL);cy<=Math.floor((y+r)/CELL);cy++){
      const c=grid.get(cx+','+cy);
      if(!c)continue;
      for(const s of c.segs){
        const dx=s[2]-s[0],dy=s[3]-s[1];
        const t=T.MathUtils.clamp(((x-s[0])*dx+(y-s[1])*dy)/(dx*dx+dy*dy),0,1);
        if(Math.hypot(x-s[0]-dx*t,y-s[1]-dy*t)<r)return true;
      }
      for(const t of c.trees)if(Math.hypot(x-t[0],y-t[1])<r+tune.treeRadius)return true;
    }
    return false;
  }
  function free(x,y,r){
    if(!inRing(data.boundary,x,y) || near(x,y,r))return false;
    const c=grid.get(Math.floor(x/CELL)+','+Math.floor(y/CELL));
    return !c || !c.blocks.some(b=>inRing(b.rings[0],x,y));
  }
  function sight(ax,ay,bx,by){
    const d=Math.hypot(bx-ax,by-ay),steps=Math.ceil(d/1.8);
    for(let i=1;i<steps;i++)if(near(ax+(bx-ax)*i/steps,ay+(by-ay)*i/steps,1))return false;
    return true;
  }
  function nearestNode(x,y){return roadIndex.nearest(x,y);}
  const checked=new Set();
  function occluded(x,y,height,dx,dy){
    const distance=highestRoof-height;
    if(distance<=0)return false;
    const ex=x+dx*distance,ey=y+dy*distance;
    checked.clear();
    for(let cx=Math.floor(Math.min(x,ex)/CELL);cx<=Math.floor(Math.max(x,ex)/CELL);cx++){
      for(let cy=Math.floor(Math.min(y,ey)/CELL);cy<=Math.floor(Math.max(y,ey)/CELL);cy++){
        const cell=grid.get(cx+','+cy);
        if(!cell)continue;
        for(const block of cell.blocks){
          if(checked.has(block))continue;
          checked.add(block);
          if(blocksCamera(block,x,y,height,dx,dy))return true;
        }
      }
    }
    return false;
  }
  // A contact may move the body into the next cell during this visit.
  function visitObstacles(body,radius,wallContact,treeContact){
    let hit=0;
    for(let cx=Math.floor((body.x-radius)/CELL);cx<=Math.floor((body.x+radius)/CELL);cx++){
      for(let cy=Math.floor((body.y-radius)/CELL);cy<=Math.floor((body.y+radius)/CELL);cy++){
        const cell=grid.get(cx+','+cy);
        if(!cell)continue;
        for(const segment of cell.segs)hit=Math.max(hit,wallContact(body,segment,radius));
        for(const tree of cell.trees)hit=Math.max(hit,treeContact(body,tree,radius));
      }
    }
    return hit;
  }
  return {
    nodes,validNodes:roadIndex.valid,nearestNode,near,free,sight,occluded,visitObstacles,
    routesFrom:source=>routesFrom(nodes,source)
  };
}
