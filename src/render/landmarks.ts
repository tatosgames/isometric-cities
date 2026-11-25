import type { Altitude, Building, Ring } from '../data/types.ts';
import * as T from 'three';

type AddBuilding = (geometry: T.BufferGeometry, color: string, x: number, y: number) => void;


// The horizontal axis follows each mapped facade; positive depth faces its plaza.
function facade(add: AddBuilding,x: number,y: number,dx: number,dy: number,base: number){
  const angle=Math.atan2(dy,dx),cs=Math.cos(angle),sn=Math.sin(angle);
  return (geometry: T.BufferGeometry,u: number,height: number,depth: number,color: string)=>{
    const east=x+u*cs+depth*sn,north=y+u*sn-depth*cs;
    add(geometry.rotateY(angle).translate(east,base+height,-north),color,east,north);
  };
}
function arch(width: number,straight: number){
  const r=width/2,s=new T.Shape();
  s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,straight);s.absarc(0,straight,r,0,Math.PI,false);s.closePath();
  return new T.ShapeGeometry(s,8);
}

function santaAna(add: AddBuilding,altitude: Altitude){
  const stone='#928881',trim='#b5aba0',recess='#494443';
  const west=facade(add,-5.5,-477,17.4,-34.5,altitude(-5.5,-477));
  for(const u of [-18,18]){
    west(new T.BoxGeometry(7.6,26,7.6),u,13,-3,stone);
    for(const h of [10,20.5,26])west(new T.BoxGeometry(8.1,.7,8.1),u,h,-3,trim);
    west(new T.CylinderGeometry(3.7,4,2,8),u,27.25,-3,stone);
    for(let k=0;k<8;k++){
      const a=k*Math.PI/4;
      west(new T.CylinderGeometry(.55,.68,5.7,6),u+2.95*Math.cos(a),30.8,-3+2.95*Math.sin(a),trim);
    }
    west(new T.CylinderGeometry(1.05,.5,1.4,8),u,30,-3,'#51493c');
    west(new T.CylinderGeometry(3.9,3.7,1,12),u,34,-3,trim);
    west(new T.SphereGeometry(3.6,12,7,0,Math.PI*2,0,Math.PI/2).scale(1,1.35,1),u,34.4,-3,'#847e77');
    west(new T.ConeGeometry(.45,2,6),u,40,-3,stone);
  }
  for(const u of [-7,0,7]){
    west(arch(5.7,5.8),u,.25,.6,trim);
    west(arch(4.8,5.6),u,.25,.7,recess);
    west(arch(3,3.8),u,12,.7,'#565958');
  }
  for(const u of [-10.6,-3.5,3.5,10.6]){
    west(new T.CylinderGeometry(.52,.69,9,8),u,4.6,1.05,stone);
    west(new T.BoxGeometry(1.6,.65,1.5),u,9.2,1.05,trim);
  }
  west(new T.BoxGeometry(28,.85,2.1),0,9.9,.55,trim);
  west(new T.BoxGeometry(28,.65,1.6),0,19.3,.3,trim);
  for(const u of [-2.35,2.35])west(new T.BoxGeometry(1.3,5,1.4),u,21.9,.1,stone);
  west(new T.TorusGeometry(2.35,.65,6,14,Math.PI),0,24.1,.1,stone);
  const crossing=facade(add,40,-452,17.4,-34.5,altitude(40,-452));
  crossing(new T.CylinderGeometry(6.1,6.4,3.4,12),0,20.1,0,trim);
  crossing(new T.SphereGeometry(6.2,16,8,0,Math.PI*2,0,Math.PI/2),0,21.8,0,'#d8d5cb');
  crossing(new T.CylinderGeometry(.7,1,2,8),0,28.7,0,stone);

}

// Cairasco frontage: pale arcades, paired domed turrets and central clock.
function gabineteLiterario(add: AddBuilding,altitude: Altitude,gabinete: Building){
  const recess='#494443';
  const [x,y]=gabinete.rings[0][0];
  const front=facade(add,-147,-220,18,12,altitude(x,y));
  const ivory='#f2e9d8';
  for(const u of [-8.6,8.6]){
    front(new T.CylinderGeometry(1.8,2.15,3.2,10),u,17,-1.8,ivory);
    front(new T.CylinderGeometry(2.1,1.75,.4,12),u,18.8,-1.8,'#cabda7');
    front(new T.SphereGeometry(1.85,12,7,0,Math.PI*2,0,Math.PI/2).scale(1,1.45,1),u,19,-1.8,'#8a9691');
    front(new T.ConeGeometry(.22,1.2,6),u,22,-1.8,ivory);
  }
  for(const u of [-8,-4,0,4,8]){
    for(const h of [1,6.2,10.8]){
      front(arch(3,2.5),u,h,.56,ivory);
      front(arch(2.3,2.4),u,h,.60,'#59615f');
    }
  }
  for(const h of [5.8,10.5,15.6])front(new T.BoxGeometry(21,.38,1.3),0,h,.3,ivory);
  front(arch(3.3,1.2),0,15.6,.36,ivory);
  front(new T.CircleGeometry(.84,16),0,17.1,.45,'#757970');
  front(new T.CircleGeometry(.68,16),0,17.1,.5,'#eee9da');
  front(new T.BoxGeometry(.09,.56,.06),0,17.34,.56,recess);
  front(new T.BoxGeometry(.43,.09,.06),.18,17.1,.56,recess);
}

// Centre, long side and half sizes of a footprint, for models laid out on the building itself.
function frame(building: Building){
  const ring=building.rings[0].slice(0,-1);
  let cx=0,cy=0,best=0,dx=1,dy=0;
  ring.forEach(([x,y],i)=>{
    cx+=x/ring.length;cy+=y/ring.length;
    const [nx,ny]=ring[(i+1)%ring.length],length=Math.hypot(nx-x,ny-y);
    if(length>best){best=length;dx=(nx-x)/length;dy=(ny-y)/length;}
  });
  let along=0,across=0;
  for(const [x,y] of ring){
    along=Math.max(along,Math.abs((x-cx)*dx+(y-cy)*dy));across=Math.max(across,Math.abs((y-cy)*dx-(x-cx)*dy));
  }
  return {cx,cy,dx,dy,along,across};
}

// Rubble-stone fortress of La Isleta: merlons along the wall walk and the small turret with its conical cap.
// The round bastions are already in the municipal footprint; the turret place comes from the 2024 orthophoto.
// Merlons every 2.2 m along the top of a footprint's outer wall.
function merlons(add: AddBuilding,ring: Ring,top: number,stone: string){
  for(let i=1;i<ring.length;i++){
    const [ax,ay]=ring[i-1],[bx,by]=ring[i],length=Math.hypot(bx-ax,by-ay),count=Math.floor(length/2.2);
    const angle=Math.atan2(by-ay,bx-ax);
    for(let k=0;k<count;k++){
      const t=(k+.5)/count,x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
      add(new T.BoxGeometry(1,.9,.5).rotateY(angle).translate(x,top+1,-y),stone,x,y);
    }
  }
}
function castilloDeLaLuz(add: AddBuilding,altitude: Altitude,castle: Building){
  const stone='#8f867a',cap='#77736d';
  const ring=castle.rings[0],[x0,y0]=ring[0],top=altitude(x0,y0)+(castle.heightOverride??castle.height);
  merlons(add,ring,top,stone);
  const tx=-956.4,ty=4851.4;
  add(new T.CylinderGeometry(2.6,2.6,3.4,10).translate(tx,top+1.7,-ty),stone,tx,ty);
  add(new T.ConeGeometry(3.1,2.8,10).translate(tx,top+4.8,-ty),cap,tx,ty);
}

// Iron market hall of 1891, after the orthophoto, the LiDAR and street photographs: ivory walls with dark
// openings, a band of louvres under the hipped roof, a canopy on dark green iron columns all around, gabled
// porches at the middle of each side and a raised octagonal lantern (walls 7 m, ridge 9 m, lantern 14 m).
function mercadoDelPuerto(add: AddBuilding,altitude: Altitude,market: Building){
  const roof='#6f6964',zinc='#aaa69d',iron='#2f4a45',louvre='#5b5550',opening='#3a403e',glass='#dfe6de';
  const {cx,cy,dx,dy,along,across}=frame(market),place=facade(add,cx,cy,dx,dy,altitude(cx,cy));
  const wall=7.4,ridge=9.2,shade=4.4,reach=3;
  // A ring of four sloping faces between two rectangles, or a closed hip when `lid` is set.
  function slopes(a: number,b: number,y0: number,c: number,d: number,y1: number,lid: boolean){
    const low=[[-a,-b],[a,-b],[a,b],[-a,b]],high=[[-c,-d],[c,-d],[c,d],[-c,d]],v: number[]=[];
    for(let i=0;i<4;i++){
      const k=(i+1)%4;
      v.push(low[i][0],y0,low[i][1],high[k][0],y1,high[k][1],low[k][0],y0,low[k][1],low[i][0],y0,low[i][1],high[i][0],y1,high[i][1],high[k][0],y1,high[k][1]);
    }
    if(lid)v.push(-c,y1,-d,-c,y1,d,c,y1,d,-c,y1,-d,c,y1,d,c,y1,-d);
    return mesh(v);
  }
  place(slopes(along+.6,across+.6,0,along*.42,across*.42,ridge-wall,true),0,wall,0,roof);
  place(slopes(along+reach,across+reach,-.6,along,across,0,false),0,shade,0,zinc);
  const radius=Math.min(along,across)*.34;
  place(new T.CylinderGeometry(radius,radius,2.6,8),0,ridge+1.1,0,glass);
  place(new T.ConeGeometry(radius+.9,2.2,8),0,ridge+3.5,0,roof);
  for(const [length,offset,turn] of [[along,across,0],[across,along,1]] as const){
    const at=(u: number,v: number)=>turn?[v,u] as const:[u,v] as const;
    const count=Math.round(length*2/4.4);
    for(const side of [-1,1]){
      const [bu,bv]=at(0,side*(offset+.12));
      place(new T.BoxGeometry(turn?.3:length*2,1.7,turn?length*2:.3),bu,wall-.9,bv,louvre);
      for(let k=0;k<=count;k++){
        const u=-length-reach+.3+k*(length*2+reach*2-.6)/count,[pu,pv]=at(u,side*(offset+reach-.3));
        place(new T.BoxGeometry(.3,shade-.6,.3),pu,(shade-.6)/2,pv,iron);
      }
      for(let k=0;k<count;k++){
        const u=-length+(k+.5)*length*2/count,[pu,pv]=at(u,side*(offset+.1));
        place(new T.BoxGeometry(turn?.2:2.2,2.7,turn?2.2:.2),pu,1.5,pv,opening);
      }
      // Gabled porch over the entrance, its ridge running out from the wall.
      const [gu,gv]=at(0,side*(offset+reach/2));
      const gable=new T.CylinderGeometry(2.6,2.6,reach+.6,3).rotateX(Math.PI/2).rotateY(turn?Math.PI/2:0).scale(1,.75,1);
      place(gable,gu,shade+.9,gv,iron);
    }
  }
}

// Sandstone concert hall on the sea front: the glazed lantern over the main hall, the octagonal tower beside it
// and the great window to the ocean. Places from the 2024 orthophoto, heights from the LiDAR (lantern to 48 m).
function auditorioAlfredoKraus(add: AddBuilding,altitude: Altitude,hall: Building){
  const stone='#c9a973',glass='#7fa9a6',pale='#eceae4',dark='#3f4b4d';
  const [x0,y0]=hall.rings[0][0],base=altitude(x0,y0),top=base+(hall.heightOverride??hall.height);
  const lx=-3331.4,ly=2809;
  add(new T.CylinderGeometry(5.2,5.2,14,8).translate(lx,top+7,-ly),glass,lx,ly);
  add(new T.CylinderGeometry(5.6,5.6,.8,8).translate(lx,top+14.2,-ly),stone,lx,ly);
  add(new T.ConeGeometry(5.6,4.6,8).translate(lx,top+16.9,-ly),pale,lx,ly);
  const tx=-3309,ty=2828;
  add(new T.CylinderGeometry(7.4,7.4,3,8).translate(tx,top+1.5,-ty),stone,tx,ty);
  // The window sits on the wall of the footprint that faces the ocean: the long side nearest to this point.
  const ring=hall.rings[0],{cx,cy}=frame(hall);
  let wall=[0,0,1,0],nearest=Infinity;
  for(let i=1;i<ring.length;i++){
    const [ax,ay]=ring[i-1],[bx,by]=ring[i],mx=(ax+bx)/2,my=(ay+by)/2,away=Math.hypot(mx+3328,my-2832.6);
    if(Math.hypot(bx-ax,by-ay)>12 && away<nearest){nearest=away;wall=[ax,ay,bx,by];}
  }
  const [ax,ay,bx,by]=wall,mx=(ax+bx)/2,my=(ay+by)/2,length=Math.hypot(bx-ax,by-ay),ux=(bx-ax)/length,uy=(by-ay)/length;
  // `facade` pushes positive depth to the right of the heading: turn the heading so that side is the outside.
  const outward=(mx-cx)*uy-(my-cy)*ux>0?1:-1,sea=facade(add,mx,my,ux*outward,uy*outward,base);
  const width=Math.min(16,length-3);
  sea(new T.BoxGeometry(width,14,.5),0,15,.3,dark);
  for(const u of [-width/3,0,width/3])sea(new T.BoxGeometry(.5,14,.3),u,15,.7,stone);
}

// Bastioned enclosure of the old city wall, after its OpenStreetMap outline: merlons along the rampart.
// The municipal layer does not map it; footprint and estimated heights come from the catalogue `osmBuildings`.
function castilloDeMata(add: AddBuilding,altitude: Altitude,castle: Building){
  const ring=castle.rings[0],[x0,y0]=ring[0];
  merlons(add,ring,altitude(x0,y0)+(castle.heightOverride??castle.height),'#a59a88');
}

// Football stadium of Siete Palmas. The OpenStreetMap footprint of the stands already leaves the pitch out.
// The extruded footprint is only the low podium (`heightOverride`); the raked stands rise from it, from the pitch
// edge to the outer wall at the catalogue `height`, and the pitch lies in the middle. The roofs over parts of the
// stands are left out: their extent is not mapped.
function estadioDeGranCanaria(add: AddBuilding,altitude: Altitude,stands: Building){
  // The extrusion stands on the ground under its first corner, and so do the stands; the pitch lies on the ground below.
  const ring=stands.rings[0],{cx,cy,dx,dy}=frame(stands),base=altitude(ring[0][0],ring[0][1]);
  const podium=stands.heightOverride??4,crest=stands.height;
  const reach=ring.map(([x,y])=>Math.hypot(x-cx,y-cy)),near=Math.min(...reach),far=Math.max(...reach),middle=(near+far)/2;
  const rise=(x: number,y: number)=>base+podium+.05+(crest-podium)*T.MathUtils.clamp((Math.hypot(x-cx,y-cy)-near)/(far-near),0,1);
  // Seating: the footprint triangulated once, each corner lifted by its distance from the pitch.
  const seats=new T.ShapeGeometry(new T.Shape(ring.slice(0,-1).map(([x,y])=>new T.Vector2(x,y)))).rotateX(-Math.PI/2);
  const at=seats.getAttribute('position');
  for(let k=0;k<at.count;k++)at.setY(k,rise(at.getX(k),-at.getZ(k)));
  seats.computeVertexNormals();
  add(seats,'#8e9396',cx,cy);
  let along=0,across=0;
  const wall: number[]=[];
  for(let i=1;i<ring.length;i++){
    const [ax,ay]=ring[i-1],[bx,by]=ring[i],mx=(ax+bx)/2,my=(ay+by)/2,length=Math.hypot(bx-ax,by-ay);
    if(length<.3)continue;
    if(Math.hypot(mx-cx,my-cy)>=middle){
      // Outer wall from the podium up to the seats, so the stands read as one closed bowl from outside.
      const a=base+podium,ta=rise(ax,ay),tb=rise(bx,by);
      wall.push(ax,a,-ay,bx,a,-by,bx,tb,-by,ax,a,-ay,bx,tb,-by,ax,ta,-ay);
      continue;
    }
    for(const [x,y] of [[ax,ay],[bx,by]]){
      along=Math.max(along,Math.abs((x-cx)*dx+(y-cy)*dy));across=Math.max(across,Math.abs((y-cy)*dx-(x-cx)*dy));
    }
  }
  add(mesh(wall),stands.wallColor??'#d9d4c8',cx,cy);
  // The pitch fills most of the space the stands enclose, short of the track around it.
  facade(add,cx,cy,dx,dy,altitude(cx,cy))(new T.BoxGeometry(Math.max(10,along*2-14),.12,Math.max(10,across*2-14)),0,.15,0,'#5f8f4e');
}

// Iron warehouse of 1904 on the Parque Santa Catalina: white walls under two red gabled roofs side by side, their
// ridges along the long side, after the 2024 orthophoto. The municipal height is the ridge; the walls are lower
// (`heightOverride`, an estimate from street photographs).
function edificioMiller(add: AddBuilding,altitude: Altitude,miller: Building){
  const {cx,cy,dx,dy,along,across}=frame(miller),[x0,y0]=miller.rings[0][0];
  const place=facade(add,cx,cy,dx,dy,altitude(x0,y0)),wall=miller.heightOverride??9,rise=Math.max(1.5,miller.height-wall);
  for(const side of [-1,1])place(pitchedRoof(along*2,across,rise),0,wall,side*across/2,'#b0634a');
}

// El Muelle shopping centre. The municipal record extrudes the whole complex to its highest roof; the catalogue
// splits off the glazed half-round atrium and the forecourt, and this model draws over them what the 2024
// orthophoto shows: the glass vault on its half ring, the glazed front along its straight side and the white steel
// pergola falling towards the street. Places from the orthophoto; the heights are estimates until the LiDAR is read.
function elMuelle(add: AddBuilding,altitude: Altitude){
  const cx=-1202,cy=4044,inner=29,outer=48.5,base=altitude(cx,cy),glass='#8fb2c0',steel='#f1f1ee';
  const low=base+22,high=base+30,steps=18,v: number[]=[];
  const at=(r: number,a: number,z: number)=>[cx+r*Math.cos(a),z,-(cy+r*Math.sin(a))];
  for(let k=0;k<steps;k++){
    const a0=Math.PI*k/steps,a1=Math.PI*(k+1)/steps;
    const p=at(outer,a0,high),q=at(outer,a1,high),r=at(inner,a1,low),s=at(inner,a0,low);
    v.push(...p,...q,...r,...p,...r,...s);
    // The outer wall of the vault, glazed down to the forecourt level.
    const pb=at(outer,a0,base+6),qb=at(outer,a1,base+6);
    v.push(...pb,...q,...p,...pb,...qb,...q);
  }
  add(mesh(v),glass,cx,cy);
  // Glazed front along the straight side, from the forecourt up under the vault.
  add(new T.BoxGeometry(outer*2,low-base-6,.4).translate(cx,base+6+(low-base-6)/2,-cy),glass,cx,cy);
  // Pergola: a level grid of thin white beams over the forecourt, on posts along its edge.
  const west=-1236,east=-1146,south=3999,north=cy-1,top=base+13,step=6.5;
  for(let x=west;x<=east+.1;x+=(east-west)/Math.round((east-west)/step))
    add(new T.BoxGeometry(.35,.35,north-south).translate(x,top,-(north+south)/2),steel,x,(north+south)/2);
  for(let y=south;y<=north+.1;y+=(north-south)/Math.round((north-south)/step))
    add(new T.BoxGeometry(east-west,.35,.35).translate((west+east)/2,top,-y),steel,(west+east)/2,y);
  for(let x=west;x<=east+.1;x+=(east-west)/Math.round((east-west)/13))
    for(const y of [south,north])add(new T.BoxGeometry(.45,top-base-6,.45).translate(x,base+6+(top-base-6)/2,-y),steel,x,y);
}

// White membrane over the Santa Catalina bus station, on its OpenStreetMap outline (building=roof): the corners
// furthest from the middle are the high points held by masts, the edges between them sag. The extruded footprint
// is only a sliver (`heightOverride`); the heights are estimates from the 2024 orthophoto.
function carpaSantaCatalina(add: AddBuilding,altitude: Altitude,tent: Building){
  const ring=tent.rings[0].slice(0,-1),{cx,cy}=frame(tent),base=altitude(cx,cy),peak=tent.height;
  const reach=ring.map(([x,y])=>Math.hypot(x-cx,y-cy)),far=Math.max(...reach);
  const z=(i: number)=>base+3.5+(peak-3.5)*(reach[i]/far)**3,middle=base+peak*.62,v: number[]=[];
  ring.forEach(([x,y],i)=>{
    const k=(i+1)%ring.length,[nx,ny]=ring[k];
    v.push(cx,middle,-cy,x,z(i),-y,nx,z(k),-ny);
  });
  add(mesh(v),'#f4f3ef',cx,cy);
  ring.forEach(([x,y],i)=>{
    if(reach[i]>far*.9)add(new T.CylinderGeometry(.25,.3,z(i)-base+1.5,6).translate(x,base+(z(i)-base+1.5)/2,-y),'#cfd0cc',x,y);
  });
}

function mesh(v: number[]){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();
  return g;
}
// Eaves lie at y = 0; hip pulls both ridge ends in along x.
function pitchedRoof(length: number,width: number,rise: number,hip=0){
  const a=length/2,b=width/2,r=a-hip;
  return mesh([-a,0,-b, a,0,-b, r,rise,0, -a,0,-b, r,rise,0, -r,rise,0,
    a,0,b, -a,0,b, -r,rise,0, a,0,b, -r,rise,0, r,rise,0,
    -a,0,b, -a,0,-b, -r,rise,0, a,0,-b, a,0,b, r,rise,0]);
}
function roof(add: AddBuilding,cx: number,cy: number,angle: number,length: number,width: number,z: number,rise: number,color: string,hip?: number){
  add(pitchedRoof(length,width,rise,hip).rotateY(angle).translate(cx,z,-cy),color,cx,cy);
}
function block(add: AddBuilding,cx: number,cy: number,angle: number,length: number,width: number,z: number,height: number,color: string){
  add(new T.BoxGeometry(length,height,width).rotateY(angle).translate(cx,z+height/2,-cy),color,cx,cy);
}
// The box around a footprint, turned along its longest side: true centre, heading and full sizes.
function bounds(building: Building){
  const {dx,dy}=frame(building);
  let a0=Infinity,a1=-Infinity,c0=Infinity,c1=-Infinity;
  for(const [x,y] of building.rings[0]){
    const a=x*dx+y*dy,c=y*dx-x*dy;
    a0=Math.min(a0,a);a1=Math.max(a1,a);c0=Math.min(c0,c);c1=Math.max(c1,c);
  }
  const a=(a0+a1)/2,c=(c0+c1)/2;
  return {cx:a*dx-c*dy,cy:a*dy+c*dx,angle:Math.atan2(dy,dx),length:a1-a0,width:c1-c0};
}
// Height of the extruded walls above sea level, and what the model may add up to the mapped height.
const top=(altitude: Altitude,building: Building)=>altitude(building.rings[0][0][0],building.rings[0][0][1])+(building.heightOverride??building.height);
const crest=(building: Building,least: number)=>Math.max(least,building.height-(building.heightOverride??building.height));
const tile='#ad6249';

// Tiled bands along every wall of a footprint, patios included: a small ridge `depth` wide, as on a Canarian house.
function eaves(add: AddBuilding,building: Building,z: number,depth: number,rise: number,color: string){
  const v: number[]=[];
  for(const [n,full] of building.rings.entries()){
    const ring=full.slice(0,-1).filter(([x,y],i,all)=>{
      const [px,py]=all[(i+all.length-1)%all.length];
      return Math.hypot(x-px,y-py)>.8;
    });
    if(ring.length<3)continue;
    let area=0;
    ring.forEach(([x,y],i)=>{const [nx,ny]=ring[(i+1)%ring.length];area+=x*ny-nx*y;});
    // Left of the direction of travel is inside a counter-clockwise outline; a patio pushes the other way.
    const inward=Math.sign(area)*(n?-1:1);
    const shift=ring.map(([x,y],i)=>{
      const [px,py]=ring[(i+ring.length-1)%ring.length],[nx,ny]=ring[(i+1)%ring.length];
      const a=Math.atan2(y-py,x-px),b=Math.atan2(ny-y,nx-x),ox=-Math.sin(a)-Math.sin(b),oy=Math.cos(a)+Math.cos(b),l=Math.hypot(ox,oy)||1;
      return [inward*ox/l,inward*oy/l];
    });
    ring.forEach(([x,y],i)=>{
      const k=(i+1)%ring.length,[nx,ny]=ring[k],[sx,sy]=shift[i],[tx,ty]=shift[k],h=depth/2;
      const mx=x+sx*h,my=y+sy*h,ox=nx+tx*h,oy=ny+ty*h,ix=x+sx*depth,iy=y+sy*depth,jx=nx+tx*depth,jy=ny+ty*depth;
      v.push(x,z,-y,nx,z,-ny,ox,z+rise,-oy, x,z,-y,ox,z+rise,-oy,mx,z+rise,-my,
        mx,z+rise,-my,ox,z+rise,-oy,jx,z,-jy, mx,z+rise,-my,jx,z,-jy,ix,z,-iy);
    });
  }
  const [x,y]=building.rings[0][0];
  add(mesh(v),color,x,y);
}

// Theatre of 1888 by the mouth of the Guiniguada. The catalogue lowers the auditorium and splits off the stage
// house; this model closes the stage house with the hipped roof of the 2024 orthophoto, up to the municipal
// height, and marks the entrance front at the opposite end: three arched doors under two cornices.
function teatroPerezGaldos(add: AddBuilding,altitude: Altitude,stage: Building){
  const {cx,cy,angle,length,width}=bounds(stage);
  roof(add,cx,cy,angle,length+.8,width+.8,top(altitude,stage),crest(stage,2),'#9a6250',width*.42);
  const stone='#f4ecd9',front=facade(add,69.1,-119.4,-19.2,-14.2,altitude(69.1,-119.4));
  for(const u of [-5,0,5]){
    front(arch(3.6,4.2),u,.3,.25,stone);front(arch(2.8,4),u,.3,.32,'#4a4743');front(arch(2.2,2.6),u,8.8,.3,'#59615f');
  }
  for(const h of [7.6,13.4])front(new T.BoxGeometry(22,.5,1),0,h,.3,stone);
}

// Market of 1854: a low ring of stalls around three raised halls. The halls, their headings and sizes come from
// the 2024 orthophoto (two white pitched roofs and a lower grey one); the ring height is an estimate.
function mercadoDeVegueta(add: AddBuilding,altitude: Altitude,market: Building){
  const z=top(altitude,market),rise=crest(market,3),along=19.4*Math.PI/180,across=-64.9*Math.PI/180;
  for(const [x,y,angle,length,width] of [[175.8,-256.5,across,32,13],[149,-275,along,26,14]]){
    block(add,x,y,angle,length,width,z,rise-2.2,'#efebe1');
    roof(add,x,y,angle,length+.6,width+.6,z+rise-2.2,2.2,'#f6f4ee');
  }
  block(add,162.5,-264,across,24,8,z,1.6,'#a3a4a1');
}

// Casa de Colón: houses of Vegueta around three patios. Tiled bands follow every wall, patios included.
function casaDeColon(add: AddBuilding,altitude: Altitude,house: Building){
  eaves(add,house,top(altitude,house),3.2,1.1,tile);
}

// Churches: the nave under its pitched roof, placed after the 2024 orthophoto. Walls at the catalogue
// `heightOverride` (an estimate), ridge at the municipal height.
function santoDomingo(add: AddBuilding,altitude: Altitude,church: Building){
  roof(add,-93.8,-729,0,44,18.4,top(altitude,church),crest(church,2),tile);
}
function parroquiaSanCristobal(add: AddBuilding,altitude: Altitude,church: Building){
  roof(add,-23,-3036.5,2.7*Math.PI/180,35.8,14.3,top(altitude,church),crest(church,2),'#8f9499');
}
// A roof over the whole footprint, for a body that is one plain rectangle; `hip` is a share of its width.
const pitched=(color: string,hip: number)=>(add: AddBuilding,altitude: Altitude,body: Building)=>{
  const {cx,cy,angle,length,width}=bounds(body);
  roof(add,cx,cy,angle,length+.6,width+.6,top(altitude,body),crest(body,1.5),color,hip*width);
};

// Bandstand of the Parque de San Telmo, on its OpenStreetMap outline: thin iron columns and the green octagonal roof.
function quioscoDeLaMusica(add: AddBuilding,altitude: Altitude,kiosk: Building){
  const ring=kiosk.rings[0].slice(0,-1),{cx,cy}=bounds(kiosk),base=altitude(cx,cy),eave=base+4.2,peak=base+kiosk.height,v: number[]=[];
  ring.forEach(([x,y],i)=>{
    const [nx,ny]=ring[(i+1)%ring.length],px=cx+(x-cx)*.82,py=cy+(y-cy)*.82;
    v.push(cx,peak,-cy,x,eave,-y,nx,eave,-ny);
    add(new T.CylinderGeometry(.14,.14,eave-base,6).translate(px,base+(eave-base)/2,-py),'#3f5f52',px,py);
  });
  add(mesh(v),'#4f8a68',cx,cy);
}
// Art nouveau kiosk of 1923 at the corner of the park: a projecting eave and the dark red dome of the orthophoto.
function quioscoModernista(add: AddBuilding,altitude: Altitude,kiosk: Building){
  const {cx,cy,length}=bounds(kiosk),z=top(altitude,kiosk),r=length/2;
  add(new T.CylinderGeometry(r+.9,r+.9,.25,16).translate(cx,z+.12,-cy),'#f4efe2',cx,cy);
  add(new T.SphereGeometry(r*.72,14,7,0,Math.PI*2,0,Math.PI/2).translate(cx,z+.25,-cy),'#9c4f3f',cx,cy);
  add(new T.ConeGeometry(.3,1.1,6).translate(cx,z+.25+r*.72+.5,-cy),'#f4efe2',cx,cy);
}
// Basalt obelisk of 1957: a tapering square shaft and its point, 25 m with the plinth (height from OpenStreetMap).
function elObelisco(add: AddBuilding,altitude: Altitude,plinth: Building){
  const {cx,cy,angle,length}=bounds(plinth),z=top(altitude,plinth),point=2.4,shaft=plinth.height-(plinth.heightOverride??0)-point;
  const turn=angle+Math.PI/4,low=length*.36,high=length*.2,stone=plinth.wallColor??'#a46a6a';
  add(new T.CylinderGeometry(high,low,shaft,4).rotateY(turn).translate(cx,z+shaft/2,-cy),stone,cx,cy);
  add(new T.ConeGeometry(high,point,4).rotateY(turn).translate(cx,z+shaft+point/2,-cy),stone,cx,cy);
}

// Las Arenas shopping centre: the five square glass pyramids over its atria, on their OpenStreetMap outlines.
function lasArenas(add: AddBuilding,altitude: Altitude,mall: Building){
  const z=top(altitude,mall),turn=Math.atan2(-14.9,6.4)+Math.PI/4;
  for(const [x,y,rise] of [[-3278.8,2614.1,6],[-3247.7,2601.9,6],[-3309.6,2626.2,6],[-3363.4,2670.9,9],[-3200.1,2572.1,6]])
    add(new T.ConeGeometry(11.4,rise,4).rotateY(turn).translate(x,z+rise/2,-y),'#6aa392',x,y);
}
// Hospital Insular: the helipad on the roof, where OpenStreetMap and the 2024 orthophoto place it.
function hospitalInsular(add: AddBuilding,altitude: Altitude,hospital: Building){
  const x=-244.6,y=-2455,z=top(altitude,hospital);
  add(new T.CylinderGeometry(13,13,.5,24).translate(x,z+.25,-y),'#8f918d',x,y);
  add(new T.RingGeometry(8.6,9.6,24).rotateX(-Math.PI/2).translate(x,z+.56,-y),'#f2f2ee',x,y);
  for(const [u,w,l] of [[-2.2,1,7],[2.2,1,7],[0,4.4,1]])add(new T.BoxGeometry(w,.08,l).translate(x+u,z+.58,-y),'#f2f2ee',x+u,y);
}

const models: Partial<Record<string,(add: AddBuilding, altitude: Altitude, building: Building) => void>>={'santa-ana':santaAna,'gabinete-literario':gabineteLiterario,'castillo-de-la-luz':castilloDeLaLuz,
  'mercado-del-puerto':mercadoDelPuerto,'auditorio-alfredo-kraus':auditorioAlfredoKraus,
  'castillo-de-mata':castilloDeMata,'estadio-de-gran-canaria':estadioDeGranCanaria,
  'edificio-miller':edificioMiller,'el-muelle':elMuelle,'carpa-santa-catalina':carpaSantaCatalina,
  'carpa-estadio-insular-1':carpaSantaCatalina,'carpa-estadio-insular-2':carpaSantaCatalina,
  'teatro-perez-galdos':teatroPerezGaldos,'mercado-de-vegueta':mercadoDeVegueta,'casa-de-colon':casaDeColon,
  'santo-domingo':santoDomingo,'parroquia-san-cristobal':parroquiaSanCristobal,
  'ermita-de-san-telmo':pitched(tile,0),'iglesia-san-francisco-javier':pitched(tile,.35),
  'quiosco-de-la-musica':quioscoDeLaMusica,'quiosco-modernista':quioscoModernista,'el-obelisco':elObelisco,
  'las-arenas':lasArenas,'hospital-insular':hospitalInsular};

// The camera always looks down on the city: a face that looks straight down (the underside of a box, a cornice
// or a cylinder) is never on screen. Dropping those faces changes no pixel.
function seen(geometry: T.BufferGeometry){
  const flat=geometry.index?geometry.toNonIndexed():geometry,p=flat.getAttribute('position'),n=flat.getAttribute('normal');
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),position: number[]=[],normal: number[]=[];
  for(let i=0;i<p.count;i+=3){
    a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
    const down=b.sub(a).cross(c.sub(a)).normalize().y;
    // Both windings count: the material draws both sides, so a single sheet lying flat has to stay.
    if(Math.abs(down)>.999 && n.getY(i)<-.999 && n.getY(i+1)<-.999 && n.getY(i+2)<-.999)continue;
    for(let k=i;k<i+3;k++){position.push(p.getX(k),p.getY(k),p.getZ(k));normal.push(n.getX(k),n.getY(k),n.getZ(k));}
  }
  if(position.length===p.count*3)return geometry;
  const out=new T.BufferGeometry();
  out.setAttribute('position',new T.Float32BufferAttribute(position,3));out.setAttribute('normal',new T.Float32BufferAttribute(normal,3));
  if(flat!==geometry)flat.dispose();
  geometry.dispose();
  return out;
}

export function addLandmarks(buildings: Building[],addAll: AddBuilding,altitude: Altitude){
  const add: AddBuilding=(geometry,color,x,y)=>addAll(seen(geometry),color,x,y);
  const built=new Set();
  for(const building of buildings){
    const key=building.landmark;
    const model=key && models[key];
    if(key && model && !built.has(key)){
      model(add,altitude,building);built.add(key);
    }
  }
}
