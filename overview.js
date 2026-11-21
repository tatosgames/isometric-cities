import * as T from 'three';

// Build only the silhouette and roof of each footprint. One mesh per sector.
export function overviewBuildings(buildings,trees,altitude,tones,neutral,material){
  const positions=[],colours=[],color=new T.Color();
  const point=(p,h)=>{positions.push(p[0],h,-p[1]);colours.push(color.r*255,color.g*255,color.b*255);};
  function tint(value){color.set(neutral?'#e4dfd3':value);}
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
  tint('#637b50');
  for(const [x,y] of trees){
    const z=altitude(x,y),crown=[[x-3,y],[x,y-3],[x+3,y],[x,y+3]];
    for(let i=0;i<4;i++){point(crown[i],z+3);point(crown[(i+1)%4],z+3);point([x,y],z+8);}
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new T.Uint8BufferAttribute(colours,3,true));
  g.computeVertexNormals();
  return new T.Mesh(g,material);
}

export function overviewGround(rings,altitude,map,material){
  const xyz=[],uv=[];
  for(const ring of rings){
    const points=ring.slice(0,-1).map(([x,y])=>new T.Vector2(x,y));
    const triangles=T.ShapeUtils.triangulateShape(points,[]);
    for(const t of triangles)for(const i of t){
      const {x,y}=points[i];xyz.push(x,altitude(x,y),-y);
      if(map)uv.push((x-map.bounds.x)/map.bounds.z,(y-map.bounds.y)/map.bounds.w);
    }
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
  if(map)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();
  const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;return mesh;
}
