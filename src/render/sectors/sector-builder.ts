import type { Layers, RoofTones, Terrain } from '../../data/types.ts';
import type { AttributeData, WorkerReply, WorkerRequest, WorkerResult } from './protocol.ts';
import type { GroundMap } from '../ground-map.ts';
import * as T from 'three';
import { cityMaterials } from '../city-materials.ts';
import { makeCity } from '../scene.ts';

function bitmapTexture(bitmap: ImageBitmap){
  const texture=new T.Texture(bitmap);
  texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;
  return texture;
}

// The streamer serializes builds. A cancelled result is discarded before GPU upload.
export function sectorBuilder(terrain: Terrain,compact: boolean,neutral: boolean,tones: RoofTones | null){
  let worker: Worker | null=null;
  if(typeof OffscreenCanvas!=='undefined'){
    worker=new Worker(new URL('./sector-worker.ts',import.meta.url),{type:'module'});
    const values=Float32Array.from(terrain.values);
    worker.postMessage({config:{terrain:{...terrain,values},compact,neutral,tones}} satisfies WorkerRequest,[values.buffer]);
  }
  const attr=(a: AttributeData)=>new T.BufferAttribute(a.array,a.size,a.normalized);
  return async(layers: Layers,signal: AbortSignal)=>{
    if(!worker)return makeCity({...layers,boundary:[],terrain},neutral,tones,compact);
    const activeWorker=worker;
    const result=await new Promise<WorkerResult>((resolve,reject)=>{
      activeWorker.onmessage=({data}: MessageEvent<WorkerReply>)=> "error" in data ? reject(Error(data.error)) : resolve(data);
      activeWorker.onerror=event=>{activeWorker.terminate();worker=null;reject(Error(event.message));};
      activeWorker.postMessage({layers} satisfies WorkerRequest);
    });
    if(signal.aborted){result.image?.close();return null;}
    const groundMap: GroundMap | null=result.image?{texture:bitmapTexture(result.image),bounds:new T.Vector4().fromArray(result.bounds)}:null;
    const materials=cityMaterials(neutral,groundMap);
    const geometries=result.geometries.map(record=>{
      const geometry=new T.BufferGeometry();
      if(record.index)geometry.setIndex(attr(record.index));
      for(const [key,a] of Object.entries(record.attributes))geometry.setAttribute(key,attr(a));
      return geometry;
    });
    const group=new T.Group();
    for(const m of result.meshes){
      const geometry=geometries[m.geo],material=materials[m.material];
      let mesh: T.Mesh;
      if(m.matrix){
        const instance=new T.InstancedMesh(geometry,material,m.matrix.array.length/16);
        instance.instanceMatrix=new T.InstancedBufferAttribute(m.matrix.array,16);
        if(m.color)instance.instanceColor=new T.InstancedBufferAttribute(m.color.array,3);
        instance.computeBoundingSphere();
        mesh=instance;
      }else mesh=new T.Mesh(geometry,material);
      mesh.castShadow=m.cast;mesh.receiveShadow=m.receive;group.add(mesh);
    }
    return {group,groundMap};
  };
}
