import type { Building, CityData, Ring, RoofTones } from '../data/types.ts';
import style from '../data/road-style.json';
import type { GroundMap } from './ground-map.ts';
import {cityMaterials} from './city-materials.ts';
import { makeGroundMap } from './ground-map.ts';
import { GROUND_SURFACE, groundPatch, groundSampler } from './ground-surface.ts';
import { addLandmarks } from './landmarks.ts';
import { propParts } from './port-props.ts';
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

interface Bucket {
  parts: T.BufferGeometry[];
  vertices: number;
  material: T.Material;
  editable?: { building: Building; start: number; count: number }[];
}

export interface BuildingRange {
  mesh: T.Mesh;
  start: number;
  count: number;
}


export function makeCity(data: CityData, neutral: boolean, tones: RoofTones | null, compact=false, sharedGround: GroundMap | null=null,
  buildingRanges?: Map<Building['rings'], BuildingRange[]>) {
  const group = new T.Group();
  const groundMap=neutral?null:(sharedGround??makeGroundMap(data));
  const {mat,road,buildingMat,wood,leaf,shadeMat}=cityMaterials(neutral,groundMap);
  if(!neutral && data.carriageway?.indices.length){
    const {positions,indices}=data.carriageway,geometry=new T.BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
    const colors=new Uint8Array(positions.length),tint=new T.Color();
    const asphalt=new T.Color(style.color.street).convertLinearToSRGB();
    for(let i=0;i<positions.length;i+=3){
      const shade=groundMap?.contactAt?.(positions[i],-positions[i+2])??1;
      tint.copy(asphalt).multiplyScalar(shade).convertSRGBToLinear();
      colors.set([Math.round(tint.r*255),Math.round(tint.g*255),Math.round(tint.b*255)],i);
    }
    geometry.setAttribute('color',new T.Uint8BufferAttribute(colors,3,true));
    const mesh=new T.Mesh(geometry,road);mesh.receiveShadow=true;group.add(mesh);
  }
  const buckets = new Map<string, Bucket>();
  let editableBuilding: Building | undefined;
  function flush(bucket: Bucket){
    if(!bucket.parts.length)return;
    const geometry=mergeGeometries(bucket.parts);
    if(!geometry)throw new Error("Incompatible city geometries");
    const mesh=new T.Mesh(geometry,bucket.material);
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    if(bucket.editable && buildingRanges){
      const position = geometry.getAttribute('position');
      if(position instanceof T.BufferAttribute)position.setUsage(T.DynamicDrawUsage);
      for(const {building,start,count} of bucket.editable){
        const ranges=buildingRanges.get(building.rings) ?? [];
        if(!ranges.length)buildingRanges.set(building.rings,ranges);
        ranges.push({mesh,start,count});
      }
      bucket.editable.length=0;
    }
    bucket.parts.length=0;bucket.vertices=0;
  }
  const terrain = data.terrain;
  function altitude(x: number,y: number) {
    const col=T.MathUtils.clamp((x-terrain.origin[0])/terrain.step,0,terrain.w-1.001);
    const row=T.MathUtils.clamp((terrain.origin[1]-y)/(terrain.stepY || terrain.step),0,terrain.h-1.001);
    const i=Math.floor(row)*terrain.w+Math.floor(col);
    const v=terrain.values, u=col%1, t=row%1;
    return T.MathUtils.lerp(T.MathUtils.lerp(v[i],v[i+1],u),T.MathUtils.lerp(v[i+terrain.w],v[i+terrain.w+1],u),t);
  }
  function add(g: T.BufferGeometry,color: T.ColorRepresentation,x=0,y=0,surface: number | Uint8Array=0,wallBase: number | null=null,material=mat) {
    const geom=g.index?g.toNonIndexed():g;
    geom.deleteAttribute('uv');
    const normals=geom.attributes.normal;
    const packed=new Int8Array(normals.count*3);
    for(let i=0;i<packed.length;i++)packed[i]=Math.round(normals.array[i]*127);
    geom.setAttribute('normal',new T.BufferAttribute(packed,3,true));
    geom.setAttribute('surface',new T.BufferAttribute(typeof surface==='number'?new Uint8Array(geom.attributes.position.count).fill(surface):surface,1));
    const shade=new T.Color(neutral ? '#e4dfd3' : color);
    const rgb=new Uint8Array(geom.attributes.position.count*3);
    shade.multiplyScalar(255);
    for(let i=0;i<rgb.length;i+=3){
      const ao=compact && wallBase!==null ? .80+.20*T.MathUtils.clamp((geom.attributes.position.getY(i/3)-wallBase)/4,0,1) : 1;
      rgb[i]=shade.r*ao;rgb[i+1]=shade.g*ao;rgb[i+2]=shade.b*ao;
    }
    geom.setAttribute('color',new T.BufferAttribute(rgb,3,true));
    const key=Math.floor(x/120)+','+Math.floor(y/120)+','+material.id;
    let bucket=buckets.get(key);
    if(!bucket){bucket={parts:[],vertices:0,material};buckets.set(key,bucket);}
    const count=geom.attributes.position.count;
    if(editableBuilding && buildingRanges){
      const ranges=bucket.editable??=[];
      const previous=ranges[ranges.length-1];
      if(previous?.building===editableBuilding && previous.start+previous.count===bucket.vertices)previous.count+=count;
      else ranges.push({building:editableBuilding,start:bucket.vertices,count});
    }
    bucket.parts.push(geom);bucket.vertices+=count;
    if(bucket.vertices>=49152)flush(bucket);
  }
  function shape(rings: Ring[]) {
    const paths=rings.map(r=>r.map(([x,y])=>new T.Vector2(x,y)));
    const s=new T.Shape(paths[0]); s.holes=paths.slice(1).map(p=>new T.Path(p)); return s;
  }
  // Subdivide the ground before clipping so local relief survives triangulation.
  for(const ring of data.ground){
    const {faces,positions}=groundPatch(ring,altitude),geometry=new T.BufferGeometry();
    geometry.setIndex(faces.flat());
    geometry.setAttribute('position',new T.Float32BufferAttribute(positions.flat(),3));
    geometry.computeVertexNormals();
    add(geometry,'#ffffff',ring[0][0],ring[0][1],GROUND_SURFACE);
  }
  const boundary=data.boundary;
  for(let k=1;k<boundary.length;k++){
    const [a,b]=boundary[k-1],[c,d]=boundary[k];
    const steps=Math.ceil(Math.hypot(c-a,d-b)/12);
    for(let j=0;j<steps;j++){
      const x=T.MathUtils.lerp(a,c,j/steps),y=T.MathUtils.lerp(b,d,j/steps);
      const xx=T.MathUtils.lerp(a,c,(j+1)/steps),yy=T.MathUtils.lerp(b,d,(j+1)/steps);
      const v=[x,altitude(x,y),-y,xx,altitude(xx,yy),-yy,x,-5,-y,xx,altitude(xx,yy),-yy,xx,-5,-yy,x,-5,-y];
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();add(g,'#bb9f7d',x,y);
    }
  }
  function addBuilding(g: T.BufferGeometry,color: T.ColorRepresentation,x: number,y: number,surface=0,wallBase: number | null=null){
    add(g,color,x,y,surface,wallBase,buildingMat);
  }
  // An extrusion also closes both ends. The floor is buried and the lid lies under the roof: keep the sides.
  function wallsOnly(g: T.ExtrudeGeometry){
    const sides=g.groups.find(group=>group.materialIndex===1);
    if(!sides)return g;
    const out=new T.BufferGeometry();
    for(const name of ['position','normal'] as const){
      const a=g.attributes[name];
      out.setAttribute(name,new T.BufferAttribute(a.array.slice(sides.start*3,(sides.start+sides.count)*3),3));
    }
    g.dispose();
    return out;
  }
  // A parapet is seen from above and from the sides. On small screens it is three faces instead of a closed box.
  function parapet(length: number,height: number,depth: number): T.BufferGeometry{
    if(!compact)return new T.BoxGeometry(length,height,depth);
    const x=length/2,y=height/2,d=depth/2,g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute([
      -x,-y,d, x,-y,d, x,y,d, x,y,d, -x,y,d, -x,-y,d,
      x,-y,-d, -x,-y,-d, -x,y,-d, -x,y,-d, x,y,-d, x,-y,-d,
      -x,y,d, x,y,d, x,y,-d, x,y,-d, -x,y,-d, -x,y,d],3));
    g.setAttribute('normal',new T.Float32BufferAttribute([...Array(6).fill([0,0,1]),...Array(6).fill([0,0,-1]),...Array(6).fill([0,1,0])].flat(),3));
    return g;
  }
  const walls=['#e4d9d6','#ebe7df','#d5a79c','#d7bd9c','#b6c8c1','#f3eee6'];
  const roofs=['#dbd4be','#b37559','#e8dfc9','#d4c8b6','#c28869'];
  // A window or ledge on a party wall is buried in the neighbour. Index the footprints to ask what stands just
  // outside a wall, and up to which height. The editor moves buildings apart, so there every wall keeps its detail.
  const LOT=32,lots=new Map<string,{rings: Ring[];top: number}[]>();
  if(!buildingRanges)for(const b of data.buildings){
    const outer=b.rings[0],xs=outer.map(p=>p[0]),ys=outer.map(p=>p[1]);
    const lot={rings:b.rings,top:altitude(outer[0][0],outer[0][1])+(b.heightOverride??b.height)};
    for(let i=Math.floor(Math.min(...xs)/LOT);i<=Math.floor(Math.max(...xs)/LOT);i++)
      for(let j=Math.floor(Math.min(...ys)/LOT);j<=Math.floor(Math.max(...ys)/LOT);j++){
        const key=i+','+j,list=lots.get(key);
        if(list)list.push(lot);else lots.set(key,[lot]);
      }
  }
  function buriedTo(px: number,py: number,own: Ring[]){
    let top=-Infinity;
    for(const lot of lots.get(Math.floor(px/LOT)+','+Math.floor(py/LOT))??[]){
      if(lot.rings===own || lot.top<=top)continue;
      let inside=false;
      for(const ring of lot.rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        const [ax,ay]=ring[i],[bx,by]=ring[j];
        if((ay>py)!==(by>py) && px<(bx-ax)*(py-ay)/(by-ay)+ax)inside=!inside;
      }
      if(inside)top=lot.top;
    }
    return top;
  }
  for(const b of data.buildings){
    editableBuilding=b;
    const [x,y]=b.rings[0][0], s=shape(b.rings);
    const z=altitude(x,y), h=b.heightOverride??b.height, top=z+h;
    const g=wallsOnly(new T.ExtrudeGeometry(s,{depth:h+2,bevelEnabled:false})).translate(0,0,z-2).rotateX(-Math.PI/2);
    addBuilding(g,b.wallColor??walls[b.id%walls.length],x,y,0,z);
    const roof=new T.ShapeGeometry(s).rotateX(-Math.PI/2).translate(0,top+0.035,0);
    addBuilding(roof,tones?.[String(b.id)+(b.toneSuffix??'')] ?? roofs[b.id%roofs.length],x,y,4);
    if(b.roofFurniture!==false && b.id%6!==1){
      const {radius,rx,ry}=roofClearance(roof);
      if(radius>2.1){
        const size=Math.min(5,radius),angle=Math.atan2(b.rings[0][1][1]-y,b.rings[0][1][0]-x);
        addBuilding(new T.BoxGeometry(size,1.8,size*.72).rotateY(angle).translate(rx,top+.9,-ry),'#dcd7c9',x,y);
        addBuilding(new T.BoxGeometry(size+.25,.22,size*.72+.25).rotateY(angle).translate(rx,top+1.91,-ry),'#f3eee1',x,y);
        if(radius>3.5 && b.id%3===0) addBuilding(new T.CylinderGeometry(.65,.68,1.25,8).translate(rx+size*.65,top+.66,-ry+size*.43),'#9aaca9',x,y);
      }
    }
    // Low parapets trace the actual perimeter and distinguish adjoining roofs.
    const r=b.rings[0];
    const windows=[],sills=[];
    const winding=Math.sign(r.slice(1).reduce((sum,p,j)=>sum+r[j][0]*p[1]-p[0]*r[j][1],0));
    for(let j=1;j<r.length;j++){
      const [a,c]=r[j-1],[e,f]=r[j],len=Math.hypot(e-a,f-c);
      if(len<1)continue;
      const ux=(e-a)/len,uy=(f-c)/len;
      const nx=uy*winding,ny=-ux*winding;
      const count=Math.floor(len/4.2);
      // What stands along the whole edge: a taller neighbour swallows the ledges below its roof and the parapet.
      const shared=Math.min(...[.2,.5,.8].map(t=>buriedTo(a+(e-a)*t+nx*.5,c+(f-c)*t+ny*.5,b.rings)));
      if(b.windows!==false && len<95){
        for(let bay=0;bay<count;bay++){
          const cx=a+(bay+.5)*(e-a)/count+nx*.07;
          const cy=c+(bay+.5)*(f-c)/count+ny*.07;
          const buried=buriedTo(cx+nx*.5,cy+ny*.5,b.rings);
          for(let floor=3;floor<h-1.5;floor+=3.6){
            if(z+floor+1.95<=buried)continue;
            const left=[cx-ux*.74,z+floor,-cy+uy*.74];
            const right=[cx+ux*.74,z+floor,-cy-uy*.74];
            const tl=[left[0],left[1]+1.95,left[2]],tr=[right[0],right[1]+1.95,right[2]];
            windows.push(...left,...right,...tl,...tl,...right,...tr);
            const projection=(b.id%4===0 && bay%2===0)?.65:.22;
            const lipLeft=[left[0]+nx*projection,left[1],left[2]-ny*projection];
            const lipRight=[right[0]+nx*projection,right[1],right[2]-ny*projection];
            sills.push(...left,...right,...lipLeft,...lipLeft,...right,...lipRight);
            if(projection>.4){
              const railLeft=[lipLeft[0],lipLeft[1]+.62,lipLeft[2]],railRight=[lipRight[0],lipRight[1]+.62,lipRight[2]];
              sills.push(...lipLeft,...lipRight,...railLeft,...railLeft,...lipRight,...railRight);
            }
          }
        }
      }
      if(!compact && b.windows!==false && count>=2 && len<65){
        const rot=Math.atan2(f-c,e-a);
        for(let level=3;level<h-2;level+=3.6){
          if(z+level<=shared)continue;
          addBuilding(new T.BoxGeometry(len,.16,.38).rotateY(rot).translate((a+e)/2,z+level-.12,-(c+f)/2),'#e8e1d2',x,y);
        }
      }
      if(shared<=top+.56)addBuilding(parapet(len,0.58,0.28).rotateY(Math.atan2(f-c,e-a)).translate((a+e)/2,top+0.27,-(c+f)/2),'#eee0c7',x,y);
    }
    if(windows.length){
      const panes=new T.BufferGeometry();panes.setAttribute('position',new T.Float32BufferAttribute(windows,3));panes.computeVertexNormals();addBuilding(panes,['#4e6668','#455b60','#65634e'][b.id%3],x,y);
      const trim=new T.BufferGeometry();trim.setAttribute('position',new T.Float32BufferAttribute(sills,3));trim.computeVertexNormals();addBuilding(trim,'#ede8dc',x,y);
    }
  }
  editableBuilding=undefined;
  addLandmarks(data.buildings,addBuilding,altitude);
  for(const prop of data.props??[]){
    for(const [geometry,color] of propParts(prop,altitude(prop[1],prop[2]),true))addBuilding(geometry,color,prop[1],prop[2]);
  }
  const templates={
    crown:new T.IcosahedronGeometry(1,compact?0:1),
    trunk:new T.CylinderGeometry(.28,.35,1,6),
    shade:new T.PlaneGeometry(1,1).rotateX(-Math.PI/2)
  };
  type Kind=keyof typeof templates;
  type TreeCell={kind: Kind;items: [T.Matrix4,T.ColorRepresentation][]};
  const treeCells=new Map<string,TreeCell>(), transform=new T.Object3D();
  function instance(kind: Kind,x: number,y: number,z: number,w: number,h: number,d: number,angle: number,color: T.ColorRepresentation){
    const key=kind+Math.floor(x/320)+','+Math.floor(y/320);
    let cell=treeCells.get(key);
    if(!cell){cell={kind,items:[]};treeCells.set(key,cell);}
    transform.position.set(x,z,-y);transform.scale.set(w,h,d);transform.rotation.y=angle;transform.updateMatrix();
    cell.items.push([transform.matrix.clone(),neutral?'#e4dfd3':color]);
  }
  for(const [x,y] of data.trees){
    const z=altitude(x,y),seed=Math.abs(Math.round(x*3+y));
    if(compact)instance('shade',x,y,z+.76,7,1,6.4,seed,0);
    if(seed%5===0){
      const height=7+seed%4;
      instance('trunk',x,y,z+height/2,1.2,height,1.2,0,'#8b7756');
      // Each frond vertex records how far it sits from the trunk (128 = root, 228 = tip) so the wind can bend it.
      const leaves=[],bend: number[]=[],reachOf=(t: number)=>128+Math.round(100*Math.min(1,t));
      for(let k=0;k<(compact?8:13);k++){
        const angle=k*2.4+seed,reach=3.7+(k%3)*.7;
        const frond=(t: number,side: number)=>[x+Math.cos(angle)*reach*t-Math.sin(angle)*side,z+height+2.5*Math.sin(t*Math.PI)-1.2*t-Math.abs(side)*.65,-y+Math.sin(angle)*reach*t+Math.cos(angle)*side];
        for(let j=0;j<9;j++){
          const t=j/10,tip=(j+1.7)/11,width=.55*Math.sin((j+1)*Math.PI/11);
          for(const sign of [-1,1]){
            leaves.push(...frond(t,0),...frond(tip,width*sign),...frond(t+.11,0));
            bend.push(reachOf(t),reachOf(tip),reachOf(t+.11));
          }
        }
      }
      const fronds=new T.BufferGeometry();fronds.setAttribute('position',new T.Float32BufferAttribute(leaves,3));fronds.computeVertexNormals();add(fronds,'#628536',x,y,Uint8Array.from(bend));
      continue;
    }
    instance('trunk',x,y,z+2,1,4,1,0,'#887451');
    const palette=[['#3d533e','#59714c','#778352'],['#324d43','#4a6a53','#68805d'],['#4f6040','#687b50','#85935d']][seed%3];
    for(let k=0;k<(compact?4:7);k++){
      const angle=k*2.4+seed,rad=k===0?0:2.05,sz=2.3+(seed%7)*.14;
      instance('crown',x+Math.cos(angle)*rad,y-Math.sin(angle)*rad,z+5.3+(k===0?1.6:Math.sin(k+seed)*.65),sz,sz*1.08,sz*.86,angle,palette[k%3]);
    }
  }

  for(const bucket of buckets.values())flush(bucket);
  for(const {kind,items} of treeCells.values()){
    const shadow=kind==='shade';
    const mesh=new T.InstancedMesh(templates[kind],shadow?shadeMat:kind==='crown'?leaf:wood,items.length);
    items.forEach(([matrix,color],i)=>{
      mesh.setMatrixAt(i,matrix);
      if(!shadow)mesh.setColorAt(i,new T.Color(color));
    });
    mesh.castShadow=!shadow;mesh.receiveShadow=!shadow;mesh.computeBoundingSphere();group.add(mesh);
  }
  const sampleGround=groundSampler(()=>group.children.flatMap(mesh=>
    mesh instanceof T.Mesh && mesh.material===mat ? [mesh.geometry as T.BufferGeometry] : []),GROUND_SURFACE);
  const groundAt: typeof altitude=(x,y)=>sampleGround(x,y)??altitude(x,y);
  return {group,altitude,groundAt,groundMap,materials:{mat,road,buildingMat,wood,leaf,shadeMat}};
}

// Find the largest inscribed circle among the triangulated roof faces.
function roofClearance(roof: T.BufferGeometry){
  const pos=roof.attributes.position,idx=roof.index;
  let radius=0,rx=0,ry=0;
  if(!idx)return {radius,rx,ry};
  for(let i=0;i<idx.count;i+=3){
    const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);
    const ax=pos.getX(a),ay=-pos.getZ(a),bx=pos.getX(b),by=-pos.getZ(b),cx=pos.getX(c),cy=-pos.getZ(c);
    const wa=Math.hypot(bx-cx,by-cy),wb=Math.hypot(cx-ax,cy-ay),wc=Math.hypot(ax-bx,ay-by);
    const perimeter=wa+wb+wc;
    const size=Math.abs((bx-ax)*(cy-ay)-(cx-ax)*(by-ay))/perimeter;
    if(size>radius){
      radius=size;rx=(wa*ax+wb*bx+wc*cx)/perimeter;ry=(wa*ay+wb*by+wc*cy)/perimeter;
    }
  }
  return {radius,rx,ry};
}
