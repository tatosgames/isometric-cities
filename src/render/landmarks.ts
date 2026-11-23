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
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();
    return g;
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
  const outer=new T.BufferGeometry();outer.setAttribute('position',new T.Float32BufferAttribute(wall,3));outer.computeVertexNormals();
  add(outer,stands.wallColor??'#d9d4c8',cx,cy);
  // The pitch fills most of the space the stands enclose, short of the track around it.
  facade(add,cx,cy,dx,dy,altitude(cx,cy))(new T.BoxGeometry(Math.max(10,along*2-14),.12,Math.max(10,across*2-14)),0,.15,0,'#5f8f4e');
}

const models: Partial<Record<string,(add: AddBuilding, altitude: Altitude, building: Building) => void>>={'santa-ana':santaAna,'gabinete-literario':gabineteLiterario,'castillo-de-la-luz':castilloDeLaLuz,
  'mercado-del-puerto':mercadoDelPuerto,'auditorio-alfredo-kraus':auditorioAlfredoKraus,
  'castillo-de-mata':castilloDeMata,'estadio-de-gran-canaria':estadioDeGranCanaria};

export function addLandmarks(buildings: Building[],add: AddBuilding,altitude: Altitude){
  const built=new Set();
  for(const building of buildings){
    const key=building.landmark;
    const model=key && models[key];
    if(key && model && !built.has(key)){
      model(add,altitude,building);built.add(key);
    }
  }
}
