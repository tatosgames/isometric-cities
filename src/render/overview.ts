import type { Altitude, Building, FarBlock, Point, Prop, Ring, RoofTones } from '../data/types.ts';
import { propParts } from './port-props.ts';
import type { GroundMap } from './ground-map.ts';
import { groundPatch } from './ground-surface.ts';
import * as T from 'three';

// The overview materials are flat shaded: the fragment shader finds the face normal by itself. A normal per vertex
// is only read by the shadow map of the desktop profile, so `normals` is false where there is none.
type Silhouettes = {blocks: FarBlock[]} | {buildings: Building[];trees: Point[];props: Prop[]};
export function overviewSilhouettes(data: Silhouettes,altitude: Altitude,tones: RoofTones | null,neutral: boolean,materials: T.Material[],normals: boolean){
  const positions: number[]=[],colours: number[]=[],color=new T.Color();
  const vertex=(x: number,y: number,z: number)=>{positions.push(x,y,z);colours.push(color.r*255,color.g*255,color.b*255);};
  const point=([x,y]: Point,h: number)=>vertex(x,h,-y);
  const tint=(value: string)=>color.set(neutral?'#e4dfd3':value);
  function prism(rings: Ring[],base: number,top: number,wall: string,roof: string){
    tint(wall);
    for(const r of rings)for(let j=0;j<r.length;j++){
      const a=r[j],c=r[(j+1)%r.length];
      point(a,base);point(c,base);point(c,top);
      point(c,top);point(a,top);point(a,base);
    }
    tint(roof);
    const [outline,...holes]=rings.map(r=>r.map(([x,y])=>new T.Vector2(x,y)));
    const triangles=T.ShapeUtils.triangulateShape(outline,holes),all=rings.flat();
    for(const t of triangles)for(const i of t)point(all[i],top);
  }
  if('blocks' in data){
    // Far roofs use mean ground height across the outline.
    for(const b of data.blocks){
      const outline=b.ring.slice(0,-1),heights=outline.map(p=>altitude(...p));
      const base=Math.min(...heights)-2,top=heights.reduce((a,h)=>a+h,0)/heights.length+b.height;
      prism([outline],base,top,'#e6ded6',b.tone);
    }
  }else{
    for(const b of data.buildings){
      const base=altitude(...b.rings[0][0]),top=base+(b.heightOverride??b.height);
      prism(b.rings.map(r=>r.slice(0,-1)),base-2,top,
        b.wallColor??['#e4d9d6','#ebe7df','#d5a79c','#d7bd9c','#b6c8c1','#f3eee6'][Math.abs(b.id)%6],
        tones?.[String(b.id)+(b.toneSuffix??'')]??'#d4c8b6');
    }
    // Port objects keep their silhouette from afar: a crane is a landmark of the skyline.
    for(const prop of data.props)for(const [geometry,value] of propParts(prop,altitude(prop[1],prop[2]),false)){
      tint(value);
      const flat=geometry.toNonIndexed().attributes.position;
      for(let i=0;i<flat.count;i++)vertex(flat.getX(i),flat.getY(i),flat.getZ(i));
    }
  }
  // Trees use a separate material group.
  const buildingVertices=positions.length/3;
  if('trees' in data){
    tint('#637b50');
    for(const [x,y] of data.trees){
      const z=altitude(x,y),crown: Point[]=[[x-3,y],[x,y-3],[x+3,y],[x,y+3]];
      for(let i=0;i<4;i++){point(crown[i],z+3);point(crown[(i+1)%4],z+3);point([x,y],z+8);}
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new T.Uint8BufferAttribute(colours,3,true));
  if(normals)g.computeVertexNormals();
  if(buildingVertices)g.addGroup(0,buildingVertices,0);
  const treeVertices=positions.length/3-buildingVertices;
  if(treeVertices)g.addGroup(buildingVertices,treeVertices,1);
  return new T.Mesh(g,materials);
}

export function overviewGround(rings: Ring[],altitude: Altitude,map: GroundMap | null,material: T.Material,normals=true){
  const xyz=[],uv=[];
  for(const ring of rings){
    const {faces,positions}=groundPatch(ring,altitude);
    for(const face of faces)for(const i of face){
      const [x,y,z]=positions[i];
      xyz.push(x,y,z);
      if(map)uv.push((x-map.bounds.x)/map.bounds.z,(-z-map.bounds.y)/map.bounds.w);
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
  if(map)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  if(normals)g.computeVertexNormals();
  const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;return mesh;
}
