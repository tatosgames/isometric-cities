import * as T from 'three';

// The horizontal axis follows each mapped facade; positive depth faces its plaza.
function facade(add,x,y,dx,dy,base){
  const angle=Math.atan2(dy,dx),cs=Math.cos(angle),sn=Math.sin(angle);
  return (geometry,u,height,depth,color)=>{
    const east=x+u*cs+depth*sn,north=y+u*sn-depth*cs;
    add(geometry.rotateY(angle).translate(east,base+height,-north),color,east,north);
  };
}
function arch(width,straight){
  const r=width/2,s=new T.Shape();
  s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,straight);s.absarc(0,straight,r,0,Math.PI,false);s.closePath();
  return new T.ShapeGeometry(s,8);
}

function santaAna(add,altitude){
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
function gabineteLiterario(add,altitude,gabinete){
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

const models={'santa-ana':santaAna,'gabinete-literario':gabineteLiterario};

export function addLandmarks(buildings,add,altitude){
  const built=new Set();
  for(const building of buildings){
    const key=building.landmark;
    if(models[key] && !built.has(key)){
      models[key](add,altitude,building);built.add(key);
    }
  }
}
