import * as T from 'three';
import type { Altitude, Bounds, Building, CityData, Point, Ring, Road } from '../data/types.ts';
import type { SceneStudy } from '../render/scene-study.ts';
import { surfaceStencil } from '../render/building-stencil.ts';
import { breezy } from '../render/wind.ts';
import { makeCity } from '../render/scene.ts';
import { makeGroundMap } from '../render/ground-map.ts';

export const defaults = {osm:false, grain:.65, steps:false, frontage:false, bay:3.3, shared:false,
  roof:0, area:240, furniture:true, slope:false, contact:false, canopy:false, radius:.22, height:.18};
export type Options = typeof defaults;
export const presets = {
  Originale:{}, Suolo:{osm:true,steps:true}, Facciate:{frontage:true,shared:true},
  Tetti:{roof:.65,furniture:false}, Pendio:{slope:true,contact:true}, Verde:{canopy:true}
};
type Edge = [street:number, overlaps:[number,number,number][]] | null;
export interface Sample {
  buildings:[number,number,number][]; treePositions:Point[]; focus:number;
  center:Point; bounds:Bounds; roofBounds:Bounds; faces:Record<string,Edge[]>;
  trees:Record<string,[number,string|null,string|null]>; surfaces:Record<string,string>;
}
export function subset(city:CityData,s:Sample):CityData {
  const [x,y,u,v]=s.bounds;
  // Include crossing features even when both endpoints lie outside the sample.
  function overlaps(r:Ring){
    return ![r.every(p=>p[0]<x),r.every(p=>p[0]>u),r.every(p=>p[1]<y),r.every(p=>p[1]>v)].some(Boolean);
  }
  const buildings=Object.keys(s.faces).map(i=>city.buildings[+i]),trees=Object.keys(s.trees).map(i=>city.trees[+i]);
  const stale=buildings.some((b,i)=>!b || b.id!==s.buildings[i][0] || b.rings[0][0].some((v,j)=>v!==s.buildings[i][j+1]))
    || trees.some((p,i)=>!p || p.some((v,j)=>v!==s.treePositions[i][j]));
  if(stale)throw Error('Dati della città aggiornati. Rigenerare i campioni con python scripts/lab-samples.py.');
  return {...city,boundary:[],textureBounds:s.bounds,buildings,trees,
    ground:city.ground.filter(overlaps),roads:city.roads.filter(r=>overlaps(r.line)),surfaces:city.surfaces.filter(p=>overlaps(p.rings[0]))};
}
function perimeter(r:Ring){
  const points:Point[]=[];
  for(let i=1;i<r.length;i++){
    const a=r[i-1],b=r[i],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4));
    for(let k=0;k<n;k++)points.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);
  }
  return points;
}
export function foundation(b:Building,alt:Altitude){
  const contours=b.rings.map(perimeter);
  const heights=contours[0].map(p=>alt(...p)).sort((a,b)=>a-b);
  const base=(heights[Math.floor((heights.length-1)/2)]+heights[Math.floor(heights.length/2)])/2;
  const vertices:number[]=[],top=base+(b.heightOverride??b.height);
  for(const ring of contours)for(let i=0;i<ring.length;i++){
    const a=ring[i],c=ring[(i+1)%ring.length],za=Math.min(alt(...a)-.25,top),zc=Math.min(alt(...c)-.25,top);
    vertices.push(a[0],za,-a[1],c[0],zc,-c[1],c[0],top,-c[1],a[0],za,-a[1],c[0],top,-c[1],a[0],top,-a[1]);
  }
  const walls=new T.BufferGeometry();
  walls.setAttribute('position',new T.Float32BufferAttribute(vertices,3));walls.computeVertexNormals();
  return {base,walls};
}
const palette:Record<string,string>={asphalt:'#62636b',paving_stones:'#c6bba9',sett:'#a5988e',unhewn_cobblestone:'#a5988e',compacted:'#b59c7e'};
function paintRoad(s:Sample,o:Options):SceneStudy['road'] {
  const patterns=new Map<string,CanvasPattern>();
  function texture(ctx:CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D,surface:string){
    const previous=patterns.get(surface);if(previous)return previous;
    const tile=document.createElement('canvas');tile.width=tile.height=32;
    const ink=tile.getContext('2d')!;
    if(surface==='asphalt'||surface==='compacted'){
      ink.fillStyle=surface==='asphalt'?'#474951':'#7d6c59';
      for(let i=0;i<48;i++){
        const x=(i*19+Math.floor(i/5))%32,y=(i*13+Math.floor(i/7)*3)%32;
        ink.fillRect(x,y,surface==='asphalt'?1:2,2);
      }
    }else{
      const rows=surface==='paving_stones'?4:8;
      ink.fillStyle='#786c60';
      for(let row=0;row<rows;row++){
        const h=32/rows,w=2*h;
        ink.fillRect(0,row*h,32,1);
        for(let x=(row%2)*w/2;x<32;x+=w)ink.fillRect(x,row*h,1,h);
      }
    }
    const pattern=ctx.createPattern(tile,'repeat')!;
    pattern.setTransform(new DOMMatrix().scale(.18));patterns.set(surface,pattern);
    return pattern;
  }
  return (ctx,road:Road & {id?:string})=>{
    const surface=s.surfaces[road.id??''],color=palette[surface];
    ctx.save();
    if(o.osm && color){
      ctx.strokeStyle=color;ctx.stroke();
      ctx.globalAlpha=o.grain;ctx.strokeStyle=texture(ctx,surface);ctx.stroke();
    }
    if(o.steps && road.kind==='steps'){
      ctx.lineCap='butt';ctx.globalAlpha=.85;ctx.strokeStyle='#80796c';ctx.setLineDash([.28,.78]);ctx.stroke();
    }
    ctx.restore();
  };
}
function roofLayer(data:CityData,s:Sample,photo:HTMLImageElement,o:Options){
  const [x,y,u,v]=s.roofBounds;
  const mask=document.createElement('canvas');mask.width=photo.width;mask.height=photo.height;
  const ctx=mask.getContext('2d')!;
  ctx.setTransform(1,0,0,-1,-x,v);
  const eligible=new Set<Building>();
  for(const b of data.buildings){
    const area=b.rings.reduce((sum,r,i)=>sum+(i===0?1:-1)*Math.abs(T.ShapeUtils.area(r.map(p=>new T.Vector2(...p)))),0);
    if(area<o.area)continue;
    eligible.add(b);ctx.beginPath();
    for(const r of b.rings){ctx.moveTo(...r[0]);for(const p of r.slice(1))ctx.lineTo(...p);ctx.closePath();}
    ctx.fillStyle='white';ctx.fill('evenodd');ctx.lineWidth=3;ctx.strokeStyle='black';ctx.stroke();
  }
  const maskTex=new T.CanvasTexture(mask),photoTex=new T.Texture(photo);
  photoTex.colorSpace=T.SRGBColorSpace;photoTex.needsUpdate=true;
  const strength={value:o.roof};
  const mat=new T.MeshStandardMaterial({...surfaceStencil(true),vertexColors:true,roughness:1,side:T.DoubleSide,flatShading:true});
  mat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{roofPhoto:{value:photoTex},roofMask:{value:maskTex},roofExtent:{value:new T.Vector4(x,y,u-x,v-y)},strength});
    shader.vertexShader='varying vec2 roofXY;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nroofXY=vec2(position.x,-position.z);');
    shader.fragmentShader='varying vec2 roofXY; uniform vec4 roofExtent; uniform sampler2D roofPhoto,roofMask; uniform float strength;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 uv=(roofXY-roofExtent.xy)/roofExtent.zw;
      float coverage=texture2D(roofMask,uv).r;
      diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(roofPhoto,uv).rgb,strength*coverage);`);
  };
  breezy(mat);
  return {eligible,mat,strength,dispose(){photoTex.dispose();maskTex.dispose();mat.dispose();}};
}
export function buildStudy(data:CityData,s:Sample,photo:HTMLImageElement,tones:Record<string,string>,compact:boolean,o:Options){
  const faceKeys=Object.keys(s.faces),treeKeys=Object.keys(s.trees);
  const faces=new Map(data.buildings.map((b,i)=>[b,s.faces[faceKeys[i]]]));
  const trees=new Map(data.trees.map((p,i)=>[p.join(','),s.trees[treeKeys[i]]]));
  const roof=o.roof>0?roofLayer(data,s,photo,o):null;
  const study:SceneStudy={furniture:o.furniture};
  if(o.osm||o.steps)study.road=paintRoad(s,o)!;
  if(o.slope)study.foundation=(b,alt)=>b.landmark?undefined:foundation(b,alt);
  if(roof)study.roof=b=>roof.eligible.has(b)?roof.mat:undefined;
  if(o.frontage)study.frontage=(b,j)=>!b.landmark&&faces.get(b)?.[j]?.[0]?o.bay:undefined;
  if(o.shared)study.covered=(b,j,a,c,top)=>!b.landmark&&!!faces.get(b)?.[j]?.[1].some(([lo,hi,z])=>lo<=a&&hi>=c&&z>=top);
  if(o.canopy)study.tree=(x,y)=>{
    const [context,leaf,species]=trees.get([x,y].join(','))!;
    const factor=context===1?.12:context===2?-.65:Math.sin(x+y);
    const size={width:1+factor*o.radius,height:1+(context===2?Math.sin(x+y):factor)*o.height};
    if(species&&/phoenix|washingtonia/i.test(species))return {...size,palm:true};
    return leaf==='broadleaved'||leaf==='needleleaved'?{...size,palm:false}:size;
  };
  const city=makeCity(data,false,tones,compact,null,study);
  if(o.contact){
    const xyz:number[]=[];
    const target=data.buildings[faceKeys.indexOf(String(s.focus))];
    for(const r of target.rings){
      const p=perimeter(r),base=city.altitude(...target.rings[0][0])-2;
      for(let i=0;i<p.length;i++)for(const q of [p[i],p[(i+1)%p.length]])xyz.push(q[0],(o.slope&&!target.landmark?city.altitude(...q)-.25:base)+.12,-q[1]);
    }
    const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(xyz,3));
    const line=new T.LineSegments(geometry,new T.LineBasicMaterial({color:0xf25428,depthTest:false}));line.renderOrder=9;city.group.add(line);
  }
  return {...city, hasRoof:!!roof, live(key:'grain'|'roof',value:number){
    o[key]=value;
    if(key==='roof'&&roof)roof.strength.value=value;
    if(key==='grain'&&city.groundMap){
      const map=makeGroundMap(data,study.road);
      city.groundMap.texture.image=map.texture.image;city.groundMap.texture.needsUpdate=true;map.texture.dispose();
    }
  },dispose(){
    const mats=new Set<T.Material>(Object.values(city.materials));
    city.group.traverse(n=>{if(n instanceof T.Mesh||n instanceof T.LineSegments){n.geometry.dispose();mats.add(n.material);if(n instanceof T.InstancedMesh)n.dispose();}});
    if(roof)mats.delete(roof.mat);
    mats.forEach(m=>m.dispose());city.groundMap?.texture.dispose();roof?.dispose();
  }};
}
