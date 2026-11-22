import type { Altitude, Building, FarBlock, Point, Ring, RoofTones } from '../data/types.ts';
import type { GroundMap } from './ground-map.ts';
import { groundPatch } from './ground-surface.ts';
import * as T from 'three';

// Build only the silhouette and roof of each footprint. Keep buildings and trees in separate draw groups.
export function overviewBuildings(buildings: Building[],trees: Point[],altitude: Altitude,tones: RoofTones | null,neutral: boolean,materials: T.Material[]){
  const positions: number[]=[],colours: number[]=[],color=new T.Color();
  const point=(p: Point,h: number)=>{positions.push(p[0],h,-p[1]);colours.push(color.r*255,color.g*255,color.b*255);};
  function tint(value: string){color.set(neutral?'#e4dfd3':value);}
  for(const b of buildings){
    const base=altitude(...b.rings[0][0]),top=base+(b.heightOverride??b.height);
    const outline=b.rings.map(r=>r.slice(0,-1));
    tint(b.wallColor??['#e4d9d6','#ebe7df','#d5a79c','#d7bd9c','#b6c8c1','#f3eee6'][b.id%6]);
    for(const r of outline)for(let j=0;j<r.length;j++){
      const a=r[j],c=r[(j+1)%r.length];
      point(a,base-2);point(c,base-2);point(c,top);
      point(c,top);point(a,top);point(a,base-2);
    }
    tint(tones?.[String(b.id)+(b.toneSuffix??'')]??'#d4c8b6');
    const vectors=outline.map(r=>r.map(([x,y])=>new T.Vector2(x,y)));
    const triangles=T.ShapeUtils.triangulateShape(vectors[0],vectors.slice(1)),all=outline.flat();
    for(const t of triangles)for(const i of t)point(all[i],top);
  }
  const buildingVertices=positions.length/3;
  tint('#637b50');
  for(const [x,y] of trees){
    const z=altitude(x,y),crown: Point[]=[[x-3,y],[x,y-3],[x+3,y],[x,y+3]];
    for(let i=0;i<4;i++){point(crown[i],z+3);point(crown[(i+1)%4],z+3);point([x,y],z+8);}
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new T.Uint8BufferAttribute(colours,3,true));
  g.computeVertexNormals();
  if(buildingVertices)g.addGroup(0,buildingVertices,0);
  const treeVertices=positions.length/3-buildingVertices;
  if(treeVertices)g.addGroup(buildingVertices,treeVertices,1);
  return new T.Mesh(g,materials);
}

export function overviewGround(rings: Ring[],altitude: Altitude,map: GroundMap | null,material: T.Material){
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
  g.computeVertexNormals();
  const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;return mesh;
}

// Far level: one prism per city block. The roof sits at the mean ground height of its outline.
export function overviewBlocks(blocks: FarBlock[],altitude: Altitude,neutral: boolean,materials: T.Material[]){
  const positions: number[]=[],colours: number[]=[],color=new T.Color();
  const point=(p: Point,h: number)=>{positions.push(p[0],h,-p[1]);colours.push(color.r*255,color.g*255,color.b*255);};
  for(const b of blocks){
    const outline=b.ring.slice(0,-1),heights=outline.map(p=>altitude(...p));
    const base=Math.min(...heights)-2,top=heights.reduce((a,h)=>a+h,0)/heights.length+b.height;
    color.set(neutral?'#e4dfd3':'#e6ded6');
    for(let j=0;j<outline.length;j++){
      const a=outline[j],c=outline[(j+1)%outline.length];
      point(a,base);point(c,base);point(c,top);
      point(c,top);point(a,top);point(a,base);
    }
    color.set(neutral?'#e4dfd3':b.tone);
    for(const t of T.ShapeUtils.triangulateShape(outline.map(([x,y])=>new T.Vector2(x,y)),[]))for(const i of t)point(outline[i],top);
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new T.Uint8BufferAttribute(colours,3,true));
  g.computeVertexNormals();
  if(positions.length)g.addGroup(0,positions.length/3,0);
  return new T.Mesh(g,materials);
}
