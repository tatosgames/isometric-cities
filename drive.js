import { routesFrom, indexRoadNodes } from './road-routing.js';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Every gameplay number lives here. Metres, seconds, radians.
export const TUNE={
  maxSpeed:15, accel:9, turn:2.6, grip:7.5, driftGrip:3.2, driftDrag:.035, brake:16, brakeGrip:2.2,
  // Juice: visual only, no effect on collisions.
  deflect:4.5,
  roll:.035, tailSwing:.3, hop:.5, dive:.09, shake:.55, magnet:6,
  // Camera: slow, small and never driven by single hits, so it reads as breathing rather than pumping.
  zoomSpeed:.1, zoomThreat:.08, zoomCaught:.14, zoomRate:1.1, paceRate:.7, leadRate:2.4, followRate:9,
  radius:1.15, treeRadius:.3, treeClearance:4.5, bounce:.3, wallLoss:.6, visualScale:1.3,
  catchRatio:.3, catchReach:4, grace:2.5,
  chaserEvery:18, chaserSpeed:1.04, chaserSpeedStep:.02, chaserSpeedMax:1.16, chaserTurn:.8, chaserSight:45, chaserLost:170, wreckImpact:11.5, wreckTime:3, stuckTime:2,
  coinStep:8, coinReach:2.6, arriveReach:16, arriveBonus:10, wreckBonus:2,
  viewSpanCompact:62, viewSpanWide:95, lookAhead:.42
};
const CELL=20, SKIDS=600, DUST=48, COINS=220;
const el=id=>document.getElementById(id);
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

function inRing(ring,x,y){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [ax,ay]=ring[i],[bx,by]=ring[j];
    if((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}
function tint(geometry,color){
  const c=new T.Color(color),n=geometry.attributes.position.count,a=new Float32Array(n*3);
  for(let i=0;i<n;i++)a.set([c.r,c.g,c.b],i*3);
  geometry.setAttribute('color',new T.BufferAttribute(a,3));
  return geometry;
}
function carGeometry(body,top,police){
  const parts=[
    tint(new T.BoxGeometry(3,.7,1.5).translate(0,.6,0),body),
    tint(new T.BoxGeometry(1.5,.55,1.3).translate(-.2,1.2,0),top)
  ];
  for(const x of [-.95,.95])for(const z of [-.72,.72])parts.push(tint(new T.BoxGeometry(.62,.5,.26).translate(x,.25,z),'#22252b'));
  if(police){
    parts.push(tint(new T.BoxGeometry(.9,.72,1.52).translate(1.06,.6,0),'#1f4a8f'));
    parts.push(tint(new T.BoxGeometry(.25,.2,.95).translate(-.2,1.57,0),'#3d7bff'));
  }
  return mergeGeometries(parts);
}

export function makeDrive({scene,camera,host,data,locations,altitude,view,compact,onExit}){
  // ---- static world: collision grid, road graph ----
  let world=null;
  function build(){
    const grid=new Map();
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
      for(let cx=x0;cx<=x1;cx++)for(let cy=y0;cy<=y1;cy++)cell(cx,cy).blocks.push(b.rings[0]);
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
    world={grid,nodes};
    // Only free-standing trees are solid: a trunk beside a facade would wedge the cars.
    for(const [x,y] of data.trees.filter(([x,y])=>!near(x,y,TUNE.treeClearance)))cell(Math.floor(x/CELL),Math.floor(y/CELL)).trees.push([x,y]);
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
    world.index=indexRoadNodes(nodes);
  }
  function near(x,y,r){
    const g=world.grid;
    for(let cx=Math.floor((x-r)/CELL);cx<=Math.floor((x+r)/CELL);cx++)for(let cy=Math.floor((y-r)/CELL);cy<=Math.floor((y+r)/CELL);cy++){
      const c=g.get(cx+','+cy);
      if(!c)continue;
      for(const s of c.segs){
        const dx=s[2]-s[0],dy=s[3]-s[1];
        const t=T.MathUtils.clamp(((x-s[0])*dx+(y-s[1])*dy)/(dx*dx+dy*dy),0,1);
        if(Math.hypot(x-s[0]-dx*t,y-s[1]-dy*t)<r)return true;
      }
      for(const t of c.trees)if(Math.hypot(x-t[0],y-t[1])<r+TUNE.treeRadius)return true;
    }
    return false;
  }
  function free(x,y,r){
    if(!inRing(data.boundary,x,y) || near(x,y,r))return false;
    const c=world.grid.get(Math.floor(x/CELL)+','+Math.floor(y/CELL));
    return !c || !c.blocks.some(ring=>inRing(ring,x,y));
  }
  function sight(ax,ay,bx,by){
    const d=Math.hypot(bx-ax,by-ay),steps=Math.ceil(d/1.8);
    for(let i=1;i<steps;i++)if(near(ax+(bx-ax)*i/steps,ay+(by-ay)*i/steps,1))return false;
    return true;
  }
  function nearestNode(x,y){return world.index.nearest(x,y);}
  function routes(source){
    if(field?.source!==source)field=routesFrom(world.nodes,source);
    return field;
  }

  // ---- physics ----
  function steerBody(b,steer,brake,max,dt,agility=1){
    const speed=Math.hypot(b.vx,b.vy);
    b.h+=steer*TUNE.turn*agility*Math.min(1,.35+speed/8)*dt;
    const fx=Math.cos(b.h),fy=Math.sin(b.h);
    let forward=b.vx*fx+b.vy*fy,side=-b.vx*fy+b.vy*fx;
    forward=brake?Math.max(0,forward-TUNE.brake*dt):forward>max?Math.max(max,forward-TUNE.brake*dt):Math.min(max,forward+TUNE.accel*dt);
    b.wayHold-=dt;b.dive+=((brake?1:0)-b.dive)*Math.min(1,dt*8);
    b.hold=steer?Math.min(1,b.hold+dt*2.2):Math.max(0,b.hold-dt*6);
    b.steer+=(steer-b.steer)*Math.min(1,dt*9);
    side*=Math.exp(-(brake?TUNE.brakeGrip:T.MathUtils.lerp(TUNE.grip,TUNE.driftGrip,b.hold))*dt);
    forward*=1-TUNE.driftDrag*Math.abs(side)*dt;
    b.slip=Math.abs(side);b.side=side;
    b.vx=fx*forward-fy*side;b.vy=fy*forward+fx*side;
    b.x+=b.vx*dt;b.y+=b.vy*dt;
  }
  function push(b,px,py,r){
    let nx=b.x-px,ny=b.y-py;const d=Math.hypot(nx,ny);
    if(d>=r || d<1e-5)return 0;
    nx/=d;ny/=d;b.x=px+nx*r;b.y=py+ny*r;
    // Glance off: a nose pointing into the obstacle swings towards the wall line, so cars keep rolling.
    const fx=Math.cos(b.h),fy=Math.sin(b.h),into=fx*nx+fy*ny;
    if(into<0){
      const cross=fx*ny-fy*nx;
      if(b.wayHold<=0)b.way=Math.abs(cross)>.08?-Math.sign(cross):(b.steer<0?-1:1);
      b.wayHold=.5;const way=b.way;
      b.h+=way*Math.min(TUNE.deflect/120,Math.acos(Math.max(-1,into))-Math.PI/2+.02);
    }
    const vn=b.vx*nx+b.vy*ny;
    if(vn>=0)return 0;
    b.vx-=(1+TUNE.bounce)*vn*nx;b.vy-=(1+TUNE.bounce)*vn*ny;
    return -vn;
  }
  function collide(b){
    const r=TUNE.radius;let hit=0;
    for(let cx=Math.floor((b.x-r)/CELL);cx<=Math.floor((b.x+r)/CELL);cx++)for(let cy=Math.floor((b.y-r)/CELL);cy<=Math.floor((b.y+r)/CELL);cy++){
      const c=world.grid.get(cx+','+cy);
      if(!c)continue;
      for(const s of c.segs){
        const dx=s[2]-s[0],dy=s[3]-s[1];
        const t=T.MathUtils.clamp(((b.x-s[0])*dx+(b.y-s[1])*dy)/(dx*dx+dy*dy),0,1);
        hit=Math.max(hit,push(b,s[0]+dx*t,s[1]+dy*t,r));
      }
      for(const t of c.trees)hit=Math.max(hit,push(b,t[0],t[1],r+TUNE.treeRadius));
    }
    if(hit){const k=1-TUNE.wallLoss*Math.min(1,hit/8);b.vx*=k;b.vy*=k;}
    return hit;
  }

  // ---- scene objects ----
  const group=new T.Group();
  const paint=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.8});
  const playerGeometry=carGeometry('#d8452f','#f4ead7',false),policeGeometry=carGeometry('#f3f3ee','#2b3440',true);
  const wreckPaint=new T.MeshStandardMaterial({color:'#3a3a3a',flatShading:true,roughness:1});
  const blobGeometry=new T.CircleGeometry(2.3,16).rotateX(-Math.PI/2);
  const blobMaterial=new T.MeshBasicMaterial({color:'#15170f',transparent:true,opacity:.26,depthWrite:false});
  function vehicle(geometry){
    const mesh=new T.Mesh(geometry,paint),blob=new T.Mesh(blobGeometry,blobMaterial);
    mesh.scale.setScalar(TUNE.visualScale);group.add(mesh,blob);
    mesh.rotation.order='YXZ';
    return {x:0,y:0,h:0,vx:0,vy:0,slip:0,side:0,hold:0,steer:0,hop:0,dive:0,way:1,wayHold:0,light:null,mesh,blob,wreck:0,stuck:0,max:0,trail:null,puff:0,node:-1};
  }
  const lightGeometry=new T.BoxGeometry(.3,.24,1.05).translate(-.2,1.66,0);
  const lightRed=new T.MeshBasicMaterial({color:'#ff3b30'}),lightBlue=new T.MeshBasicMaterial({color:'#2f7bff'});
  function patrol(){
    const c=vehicle(policeGeometry);
    c.light=new T.Mesh(lightGeometry,lightRed);c.mesh.add(c.light);
    return c;
  }
  const player=vehicle(playerGeometry);
  const beacon=new T.Mesh(new T.CylinderGeometry(3.2,3.2,26,20,1,true).translate(0,13,0),new T.MeshBasicMaterial({color:'#ffd84a',transparent:true,opacity:.22,depthWrite:false,side:T.DoubleSide}));
  group.add(beacon);
  // Drawn through buildings so the car stays readable in narrow streets.
  const nose=new T.Shape();
  nose.moveTo(2.24,0);
  nose.lineTo(.5,.95);
  nose.lineTo(.95,0);
  nose.lineTo(.5,-.95);
  nose.closePath();
  const arrow=new T.ShapeGeometry(nose);
  const inset=arrow.clone().translate(-1.25,0,0).scale(.70,.65,1).translate(1.25,0,0);
  const marker=mergeGeometries([tint(new T.RingGeometry(2.3,2.75,28),'#fff7d6'),
    tint(arrow,'#263831'),tint(inset,'#fff7d6')]);
  const halo=new T.Mesh(marker.rotateX(-Math.PI/2),new T.MeshBasicMaterial({
    vertexColors:true,transparent:true,opacity:.9,depthTest:false,depthWrite:false
  }));
  halo.renderOrder=10;group.add(halo);
  const dummy=new T.Object3D();
  const coinMesh=new T.InstancedMesh(new T.CylinderGeometry(1.15,1.15,.24,14).rotateX(Math.PI/2),new T.MeshStandardMaterial({color:'#ffcf24',emissive:'#b07a00',roughness:.4,flatShading:true}),COINS);
  coinMesh.frustumCulled=false;coinMesh.count=0;group.add(coinMesh);
  const skidPositions=new Float32Array(SKIDS*18);
  const skidGeometry=new T.BufferGeometry();skidGeometry.setAttribute('position',new T.BufferAttribute(skidPositions,3));
  const skidMesh=new T.Mesh(skidGeometry,new T.MeshBasicMaterial({color:'#1d1c1f',transparent:true,opacity:.34,depthWrite:false,side:T.DoubleSide}));
  skidMesh.frustumCulled=false;group.add(skidMesh);
  const dustMesh=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),new T.MeshBasicMaterial({transparent:true,opacity:.5,depthWrite:false}),DUST);
  dustMesh.frustumCulled=false;group.add(dustMesh);
  const dust=Array.from({length:DUST},()=>({x:0,y:0,z:0,life:0}));
  const dustColour=new T.Color('#d8cdbb'),smokeColour=new T.Color('#3b3836');
  let skidAt=0,dustAt=0;
  function puff(x,y,dark){
    const p=dust[dustAt];
    Object.assign(p,{x,y,z:altitude(x,y)+1,life:1});
    dustMesh.setColorAt(dustAt,dark?smokeColour:dustColour);dustMesh.instanceColor.needsUpdate=true;
    dustAt=(dustAt+1)%DUST;
  }
  function skid(b){
    const fx=Math.cos(b.h),fy=Math.sin(b.h),now=[];
    for(const side of [-.7,.7]){
      const x=b.x-fx*1.1-fy*side,y=b.y-fy*1.1+fx*side;
      now.push([x,altitude(x,y)+.78,-y]);
    }
    if(b.trail){
      for(let k=0;k<2;k++){
        const [ax,ay,az]=b.trail[k],[bx,by,bz]=now[k],w=.14;
        skidPositions.set([ax-w,ay,az,ax+w,ay,az,bx+w,by,bz,ax-w,ay,az,bx+w,by,bz,bx-w,by,bz],skidAt*18);
        skidAt=(skidAt+1)%SKIDS;
      }
      skidGeometry.attributes.position.needsUpdate=true;
    }
    b.trail=now;
  }
  function place(b){
    const z=altitude(b.x,b.y);
    // Tail swings out with the steering, the body rolls with the slide and hops after a hit.
    b.mesh.position.set(b.x,z+.72+b.hop,-b.y);
    b.mesh.rotation.set(T.MathUtils.clamp(b.side*TUNE.roll,-.32,.32),b.h+b.steer*TUNE.tailSwing*Math.min(1,b.slip/5+.25),-b.dive*TUNE.dive);
    b.blob.position.set(b.x,z+.76,-b.y);
  }

  // ---- game state ----
  let state='off',score=0,time=0,round=0,record=0,raf=0,last=0,acc=0,grace=0,spin=0,routeAge=1,field=null,brakeHint=0,learned=false,overAt=0;
  let coins=[],target=null,chasers=[],shake=0,zoomNow=1,paceEase=0,threat=0;
  const lead=new T.Vector3(),screen=new T.Vector3();
  const focus=new T.Vector3();
  const pois=locations.map((f,i)=>({name:f.properties.name,number:String(i+1).padStart(2,'0'),x:f.properties.xy[0],y:f.properties.xy[1]}));
  try{record=Number(localStorage.getItem('drive-record'))||0;learned=localStorage.getItem('drive-learned')==='1';}catch{}
  const clock=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  const guide=el('guide'),zones={left:guide.querySelector('.left'),right:guide.querySelector('.right'),both:guide.querySelector('.both')};
  // Screen position of a map point, in CSS pixels of the host.
  function project(x,y,lift){
    screen.set(x,altitude(x,y)+lift,-y).project(camera);
    return [(screen.x+1)*host.clientWidth/2,(1-screen.y)*host.clientHeight/2];
  }
  function pop(x,y,amount,icon,big){
    const [px,py]=project(x,y,3),node=document.createElement('span');
    node.className='pop'+(big?' big':'');node.style.left=px+'px';node.style.top=py+'px';
    node.innerHTML='<svg class="ic"><use href="#i-'+icon+'"/></svg>+'+amount;
    node.onanimationend=()=>node.remove();el('pops').append(node);
  }
  function gain(amount){
    score+=amount;const chip=el('stat-coins');
    chip.classList.remove('bump');void chip.offsetWidth;chip.classList.add('bump');
  }
  const buzz=ms=>{try{navigator.vibrate?.(ms);}catch{}};
  function trail(){
    const from=nearestNode(player.x,player.y),options=pois.filter(p=>p!==target?.poi);
    const {prev,dist}=routes(from);
    const reachable=options.map(poi=>({poi,node:nearestNode(poi.x,poi.y)})).filter(o=>o.node!==from && Number.isFinite(dist[o.node]));
    target=reachable[Math.floor(Math.random()*reachable.length)] ?? null;
    coins=[];
    if(!target)return null;
    const path=[];
    for(let n=target.node;n>=0;n=prev[n])path.push(world.nodes[n]);
    path.reverse();
    // The first coin sits right ahead of the car, the rest follow at a regular step.
    let carry=3;
    for(let i=1;i<path.length && coins.length<COINS;i++){
      const a=path[i-1],b=path[i],len=Math.hypot(b.x-a.x,b.y-a.y);
      for(;carry<len && coins.length<COINS;carry+=TUNE.coinStep){
        const x=a.x+(b.x-a.x)*carry/len,y=a.y+(b.y-a.y)*carry/len;
        if(free(x,y,1.2))coins.push({x,y,z:altitude(x,y)+2});
      }
      carry-=len;
    }
    const end=world.nodes[target.node];
    beacon.position.set(end.x,altitude(end.x,end.y),-end.y);
    el('goal').querySelector('b').textContent=target.poi.number;
    el('hud-live').textContent='Destino: '+target.poi.name;
    return path;
  }
  function spawnChaser(c){
    const all=world.index.valid;
    const ring=all.filter(i=>{
      const d=Math.hypot(world.nodes[i].x-player.x,world.nodes[i].y-player.y);
      return d>75 && d<120;
    });
    // Half of the patrols come from where the player is heading.
    const ahead=ring.filter(i=>(world.nodes[i].x-player.x)*player.vx+(world.nodes[i].y-player.y)*player.vy>0);
    const pool=ahead.length && Math.random()<.5?ahead:ring.length?ring:all;
    const index=pool[Math.floor(Math.random()*pool.length)],n=world.nodes[index];
    const next=world.nodes[field?.prev[index]] ?? player;
    Object.assign(c,{x:n.x,y:n.y,vx:0,vy:0,h:Math.atan2(next.y-n.y,next.x-n.x),wreck:0,stuck:0,trail:null,node:index,hold:0,steer:0,side:0});
    c.max=TUNE.maxSpeed*Math.min(TUNE.chaserSpeedMax,TUNE.chaserSpeed+TUNE.chaserSpeedStep*Math.floor(time/TUNE.chaserEvery));
    c.mesh.material=paint;c.mesh.visible=c.blob.visible=true;
  }
  function restart(){
    for(const c of chasers)group.remove(c.mesh,c.blob);
    chasers=[];score=0;time=0;grace=TUNE.grace;acc=0;routeAge=1;field=null;target=null;
    skidPositions.fill(0);skidGeometry.attributes.position.needsUpdate=true;
    for(const p of dust)p.life=0;
    const poi=pois[round++%pois.length],n=world.nodes[nearestNode(poi.x,poi.y)];
    Object.assign(player,{x:n.x,y:n.y,vx:0,vy:0,h:0,trail:null,hold:0,steer:0,side:0,hop:0,dive:0});
    brakeHint=0;paceEase=0;threat=0;lead.set(0,0,0);el('pops').replaceChildren();
    const path=trail();
    if(path?.[1])player.h=Math.atan2(path[1].y-n.y,path[1].x-n.x);
    focus.set(player.x,altitude(player.x,player.y),-player.y);
    el('over').hidden=true;guide.className='ready';
    state='ready';
  }
  function caught(){
    state='caught';buzz(140);shake=1;guide.className='';
    for(let k=0;k<6;k++)puff(player.x+Math.cos(k)*1.5,player.y+Math.sin(k)*1.5,false);
    const best=score>record;
    if(best){record=score;try{localStorage.setItem('drive-record',String(record));}catch{}}
    el('over-coins').textContent=String(score);el('over-time').textContent=clock(time);el('over-record').textContent=String(record);
    el('over-record').parentElement.classList.toggle('new',best);
    el('hud-live').textContent='Atrapado. '+score+' monedas en '+Math.round(time)+' segundos.'+(best?' Nuevo récord.':'');
    // A beat on the frozen scene before the result slides in.
    overAt=performance.now()+420;
  }

  // ---- input ----
  const pointers=new Map(),keys=new Set();
  function input(){
    let left=keys.has('ArrowLeft')||keys.has('a'),right=keys.has('ArrowRight')||keys.has('d');
    for(const p of pointers.values()){if(p.side<0)left=true;else right=true;}
    return {steer:(left?1:0)-(right?1:0),brake:(left&&right)||keys.has(' ')||keys.has('ArrowDown')};
  }
  function go(){if(state==='ready'){state='playing';guide.className='play';}}
  function down(e){
    if(state==='off')return;
    const box=host.getBoundingClientRect();
    pointers.set(e.pointerId,{side:e.clientX<box.left+box.width/2?-1:1,anchor:e.clientX});
    go();e.preventDefault();
  }
  function move(e){
    const p=pointers.get(e.pointerId);
    if(!p)return;
    // A horizontal swipe overrides the half of the screen where the finger landed.
    if(Math.abs(e.clientX-p.anchor)>24){p.side=Math.sign(e.clientX-p.anchor);p.anchor=e.clientX;}
  }
  const up=e=>pointers.delete(e.pointerId);
  function key(e){
    const k=e.key.length===1?e.key.toLowerCase():e.key;
    if(e.type==='keyup'){keys.delete(k);return;}
    if(k==='Escape'){onExit();return;}
    if(!['ArrowLeft','ArrowRight','ArrowDown','a','d',' '].includes(k) || e.target instanceof HTMLButtonElement)return;
    keys.add(k);go();e.preventDefault();
  }

  // ---- simulation ----
  function step(dt){
    time+=dt;grace=Math.max(0,grace-dt);
    const {steer,brake}=input();
    // One contextual lesson: after a few seconds of driving, show that both sides together brake.
    if(!learned){
      brakeHint+=dt;
      if(brake && brakeHint>.3){learned=true;guide.className='play';try{localStorage.setItem('drive-learned','1');}catch{}}
      else if(brakeHint>4 && brakeHint<10)guide.className='teach';
      else if(brakeHint>=10)guide.className='play';
    }
    steerBody(player,steer,brake,TUNE.maxSpeed,dt);
    const knock=collide(player);
    if(knock>3)player.hop=Math.min(TUNE.hop,knock*.05);
    if(knock>6)shake=Math.max(shake,Math.min(1,knock/14));
    if(knock>6)buzz(18);
    const speed=Math.hypot(player.vx,player.vy);
    routeAge+=dt;
    if(routeAge>.6){routeAge=0;field=routes(nearestNode(player.x,player.y));}
    const wanted=Math.min(compact?6:8,1+Math.floor(time/TUNE.chaserEvery));
    while(chasers.length<wanted){const c=patrol();chasers.push(c);spawnChaser(c);}
    for(const c of chasers){
      if(c.wreck>0){
        c.wreck-=dt;c.puff-=dt;c.h+=dt*14*Math.max(0,c.wreck-TUNE.wreckTime+.45);
        if(c.puff<=0){c.puff=.12;puff(c.x,c.y,true);}
        if(c.wreck<=0)spawnChaser(c);
        continue;
      }
      let tx=player.x+player.vx*.4,ty=player.y+player.vy*.4;
      const gap=Math.hypot(player.x-c.x,player.y-c.y);
      if(gap>TUNE.chaserLost){spawnChaser(c);continue;}
      if(gap>TUNE.chaserSight || !sight(c.x,c.y,player.x,player.y)){
        // Follow the road graph node by node: straight lines between nodes stay clear of buildings.
        let n=world.nodes[c.node];
        if(!n || Math.hypot(n.x-c.x,n.y-c.y)>60){c.node=nearestNode(c.x,c.y);n=world.nodes[c.node];}
        for(let hop=0;hop<3 && field.prev[c.node]>=0 && Math.hypot(n.x-c.x,n.y-c.y)<5;hop++){c.node=field.prev[c.node];n=world.nodes[c.node];}
        tx=n.x;ty=n.y;
      }else c.node=-1;
      let turn=T.MathUtils.clamp(wrap(Math.atan2(ty-c.y,tx-c.x)-c.h)*2.5,-1,1);
      for(const side of [-1,1])if(near(c.x+Math.cos(c.h+side*.45)*6,c.y+Math.sin(c.h+side*.45)*6,1.2))turn-=side*.9;
      const ahead=near(c.x+Math.cos(c.h)*4,c.y+Math.sin(c.h)*4,1.1);
      steerBody(c,T.MathUtils.clamp(turn,-1,1),ahead && Math.hypot(c.vx,c.vy)>8,c.max,dt,TUNE.chaserTurn);
      const hit=collide(c),pace=Math.hypot(c.vx,c.vy);
      if(hit>3)c.hop=Math.min(TUNE.hop,hit*.05);
      c.stuck=pace<1.5?c.stuck+dt:0;
      if(hit>TUNE.wreckImpact)wreck(c);
      else if(c.stuck>TUNE.stuckTime)spawnChaser(c);
    }
    for(let i=0;i<chasers.length;i++){
      const a=chasers[i];
      for(let j=i+1;j<chasers.length;j++){
        const impact=bump(a,chasers[j]);
        if(impact>TUNE.wreckImpact && !a.wreck && !chasers[j].wreck){wreck(a);wreck(chasers[j]);}
      }
      bump(a,player);
      // Close enough counts as contact: a tree or a corner must not save a stopped car.
      if(!a.wreck && !grace && speed<TUNE.maxSpeed*TUNE.catchRatio && Math.hypot(a.x-player.x,a.y-player.y)<TUNE.catchReach){caught();return;}
    }
    for(let i=coins.length-1;i>=0;i--){
      const coin=coins[i],dx=player.x-coin.x,dy=player.y-coin.y,gap=Math.hypot(dx,dy);
      if(gap<TUNE.coinReach){pop(coin.x,coin.y,1,'coin',false);coins.splice(i,1);gain(1);buzz(8);}
      // Nearby coins are pulled in, so a close pass is enough.
      else if(gap<TUNE.magnet){const pull=Math.min(gap,(TUNE.maxSpeed+10)*dt);coin.x+=dx/gap*pull;coin.y+=dy/gap*pull;}
    }
    if(target && Math.hypot(world.nodes[target.node].x-player.x,world.nodes[target.node].y-player.y)<TUNE.arriveReach){
      pop(player.x,player.y,TUNE.arriveBonus,'coin',true);gain(TUNE.arriveBonus);buzz(40);
      for(let k=0;k<8;k++)puff(player.x+Math.cos(k*.8)*2.5,player.y+Math.sin(k*.8)*2.5,false);
      trail();
    }
    for(const b of [player,...chasers]){
      if(b.wreck>0 || b.slip<4){b.trail=null;continue;}
      skid(b);b.puff-=dt;
      if(b.puff<=0){b.puff=.07;puff(b.x-Math.cos(b.h)*1.3,b.y-Math.sin(b.h)*1.3,false);}
    }
  }
  // Returns the closing speed, or -1 when the two cars do not touch.
  function bump(a,b){
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),reach=TUNE.radius*2;
    if(d>=reach || d<1e-5)return -1;
    const nx=dx/d,ny=dy/d,overlap=(reach-d)/2;
    a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
    const closing=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
    if(closing<=0)return 0;
    a.vx-=closing*nx*.6;a.vy-=closing*ny*.6;b.vx+=closing*nx*.6;b.vy+=closing*ny*.6;
    return closing;
  }
  function wreck(c){
    c.wreck=TUNE.wreckTime;c.vx=c.vy=0;c.trail=null;c.mesh.material=wreckPaint;c.hop=TUNE.hop;
    if(Math.hypot(c.x-player.x,c.y-player.y)<40)shake=Math.max(shake,.5);
    for(let k=0;k<6;k++)puff(c.x+Math.cos(k)*1.4,c.y+Math.sin(k)*1.4,true);
    pop(c.x,c.y,TUNE.wreckBonus,'crash',false);gain(TUNE.wreckBonus);
  }

  function frame(now){
    raf=requestAnimationFrame(frame);
    const dt=Math.min(.05,(now-last)/1000||0);last=now;
    if(state==='playing'){
      acc+=dt;
      for(;acc>=1/120 && state==='playing';acc-=1/120)step(1/120);
    }
    spin+=dt*4;
    for(const b of [player,...chasers])b.hop=Math.max(0,b.hop-dt*2.2);
    place(player);
    halo.position.copy(player.blob.position);
    halo.rotation.y=player.mesh.rotation.y;
    chasers.forEach((c,i)=>{place(c);c.light.visible=!c.wreck;c.light.material=(Math.floor(now/140)+i)%2?lightRed:lightBlue;});
    beacon.scale.set(1+Math.sin(spin*.8)*.08,1,1+Math.sin(spin*.8)*.08);beacon.visible=!!target;
    coinMesh.count=coins.length;
    coins.forEach((c,i)=>{
      dummy.position.set(c.x,c.z+Math.sin(spin+i)*.15,-c.y);dummy.rotation.set(0,spin+i*.7,0);dummy.scale.setScalar(1);
      dummy.updateMatrix();coinMesh.setMatrixAt(i,dummy.matrix);
    });
    coinMesh.instanceMatrix.needsUpdate=true;
    dust.forEach((p,i)=>{
      p.life=Math.max(0,p.life-dt*1.5);
      dummy.position.set(p.x,p.z+(1-p.life)*1.6,-p.y);dummy.rotation.set(0,0,0);dummy.scale.setScalar(p.life?.5+(1-p.life)*1.5:0);
      dummy.updateMatrix();dustMesh.setMatrixAt(i,dummy.matrix);
    });
    dustMesh.instanceMatrix.needsUpdate=true;
    // Camera. The look-ahead is smoothed on its own so a wall hit never yanks the view;
    // the follow itself is tight, which keeps the car steady on screen.
    lead.lerp(new T.Vector3(player.vx,0,-player.vy).multiplyScalar(TUNE.lookAhead),Math.min(1,dt*TUNE.leadRate));
    const cx=player.x+lead.x,cy=player.y-lead.z;
    focus.lerp(new T.Vector3(cx,altitude(player.x,player.y),-cy),Math.min(1,dt*TUNE.followRate));
    shake=Math.max(0,shake-dt*4);
    const jolt=shake*shake*TUNE.shake;
    const nearest=Math.min(999,...chasers.filter(c=>!c.wreck).map(c=>Math.hypot(c.x-player.x,c.y-player.y)));
    paceEase+=(Math.hypot(player.vx,player.vy)/TUNE.maxSpeed-paceEase)*Math.min(1,dt*TUNE.paceRate);
    threat+=(T.MathUtils.clamp((45-nearest)/30,0,1)-threat)*Math.min(1,dt*TUNE.paceRate);
    // Zoom: a little wider with speed and with patrols closing in, a slow push-in when caught.
    const wantZoom=state==='caught'?1+TUNE.zoomCaught:1-TUNE.zoomSpeed*paceEase-TUNE.zoomThreat*threat;
    zoomNow+=(wantZoom-zoomNow)*Math.min(1,dt*TUNE.zoomRate);
    const base=Math.min(host.clientWidth,host.clientHeight)/(compact?TUNE.viewSpanCompact:TUNE.viewSpanWide);
    view(focus.clone().add(new T.Vector3((Math.random()-.5)*jolt,0,(Math.random()-.5)*jolt)),base*zoomNow);
    // HUD
    el('hud-coins').textContent=String(score);
    el('hud-time').textContent=clock(time);
    const {steer,brake}=input();
    zones.left.classList.toggle('on',state==='playing' && (steer>0 || brake));
    zones.right.classList.toggle('on',state==='playing' && (steer<0 || brake));
    zones.both.classList.toggle('on',state==='playing' && brake);
    const goal=el('goal');goal.hidden=!target || state==='caught';
    if(target){
      // The destination chip sits over the place, or slides along the screen edge and points at it.
      const end=world.nodes[target.node],[gx,gy]=project(end.x,end.y,14);
      const w=host.clientWidth,h=host.clientHeight,pad=34,top=88,bottom=h-150;
      const px=T.MathUtils.clamp(gx,pad,w-pad),py=T.MathUtils.clamp(gy,top,bottom),off=px!==gx || py!==gy;
      goal.style.transform='translate('+px.toFixed(1)+'px,'+py.toFixed(1)+'px)';
      goal.classList.toggle('near',!off);
      goal.style.setProperty('--turn',(Math.atan2(gy-py,gx-px)+Math.PI/2).toFixed(2)+'rad');
    }
    if(state==='caught' && overAt && now>=overAt){overAt=0;el('over').hidden=false;el('again').focus({preventScroll:true});}
    host.dataset.drive=[state,score,player.x.toFixed(1),player.y.toFixed(1),wrap(player.h).toFixed(2),chasers.length,coins.length,nearest.toFixed(0),zoomNow.toFixed(3)].join(',');
  }

  el('again').onclick=()=>restart();
  el('leave').onclick=()=>onExit();
  return {
    get active(){return state!=='off';},
    enter(){
      if(state!=='off')return;
      if(!world)build();
      scene.add(group);pointers.clear();keys.clear();
      host.addEventListener('pointerdown',down);host.addEventListener('pointermove',move);
      for(const type of ['pointerup','pointercancel','pointerleave'])host.addEventListener(type,up);
      window.addEventListener('keydown',key);window.addEventListener('keyup',key);
      el('hud').hidden=false;
      restart();
      // Glide in from the map zoom instead of cutting to the play zoom.
      zoomNow=T.MathUtils.clamp(camera.zoom/(Math.min(host.clientWidth,host.clientHeight)/(compact?TUNE.viewSpanCompact:TUNE.viewSpanWide)),.35,1.6);
      focus.copy(camera.position).addScaledVector(camera.getWorldDirection(new T.Vector3()),1500);
      last=0;raf=requestAnimationFrame(frame);
    },
    exit(){
      if(state==='off')return;
      state='off';cancelAnimationFrame(raf);scene.remove(group);
      host.removeEventListener('pointerdown',down);host.removeEventListener('pointermove',move);
      for(const type of ['pointerup','pointercancel','pointerleave'])host.removeEventListener(type,up);
      window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);
      el('hud').hidden=el('over').hidden=true;guide.className='';el('pops').replaceChildren();
      delete host.dataset.drive;
    }
  };
}
