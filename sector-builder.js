import * as T from 'three';
import { cityMaterials } from './city-materials.js';
import { makeCity } from './scene.js';

export function bitmapTexture(bitmap){
  const texture=new T.Texture(bitmap);
  texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;
  return texture;
}

// The streamer serializes builds. A cancelled result is discarded before GPU upload.
export function sectorBuilder(terrain,compact,neutral,tones){
  let worker=null;
  if(typeof OffscreenCanvas!=='undefined'){
    worker=new Worker(new URL('./sector-worker.js',import.meta.url),{type:'module'});
    const values=Float32Array.from(terrain.values);
    worker.postMessage({config:{terrain:{...terrain,values},compact,neutral,tones}},[values.buffer]);
  }
  const attr=a=>new T.BufferAttribute(a.array,a.size,a.normalized);
  return async(layers,roof,signal)=>{
    const atlas={tones,bounds:layers.roofBounds};
    if(!worker)return makeCity({...layers,boundary:[],terrain},neutral,roof,atlas,compact);
    const result=await new Promise((resolve,reject)=>{
      worker.onmessage=({data})=>data.error?reject(Error(data.error)):resolve(data);
      worker.onerror=event=>{worker.terminate();worker=null;reject(Error(event.message));};
      worker.postMessage({layers});
    });
    if(signal.aborted){result.image?.close();return null;}
    const groundMap=result.image?{texture:bitmapTexture(result.image),bounds:new T.Vector4().fromArray(result.bounds)}:null;
    const materials=cityMaterials(neutral,groundMap,roof,atlas);
    const geometries=result.geometries.map(record=>{
      const geometry=new T.BufferGeometry();
      if(record.index)geometry.setIndex(attr(record.index));
      for(const [key,a] of Object.entries(record.attributes))geometry.setAttribute(key,attr(a));
      return geometry;
    });
    const group=new T.Group();
    for(const m of result.meshes){
      const geometry=geometries[m.geo],material=materials[m.material];
      let mesh;
      if(m.matrix){
        mesh=new T.InstancedMesh(geometry,material,m.matrix.array.length/16);
        mesh.instanceMatrix=new T.InstancedBufferAttribute(m.matrix.array,16);
        if(m.color)mesh.instanceColor=new T.InstancedBufferAttribute(m.color.array,3);
        mesh.computeBoundingSphere();
      }else mesh=new T.Mesh(geometry,material);
      mesh.castShadow=m.cast;mesh.receiveShadow=m.receive;group.add(mesh);
    }
    return {group,groundMap};
  };
}
