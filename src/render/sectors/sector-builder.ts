import type { Layers, RoofTones, Terrain } from '../../data/types.ts';
import type { AttributeData, WorkerReply, WorkerRequest, WorkerResult } from './protocol.ts';
import type { GroundMap } from '../ground-map.ts';
import * as T from 'three';
import { cityMaterials } from '../city-materials.ts';
import { makeCity, packRanges, type BuildingRange } from '../scene.ts';
import { heightWindow } from '../../geometry.ts';

function bitmapTexture(bitmap: ImageBitmap){
  const texture=new T.Texture(bitmap);
  texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;texture.needsUpdate=true;
  return texture;
}

// Heights are read under ground, footprints, trees and objects, and a landmark model reads a few more beside its
// building: metres of grid kept around all of them.
const TERRAIN_MARGIN=60;
function extent(layers: Layers): [number,number,number,number]{
  let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
  const add=(x: number,y: number)=>{west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,y);north=Math.max(north,y);};
  for(const ring of layers.ground)for(const [x,y] of ring)add(x,y);
  for(const b of layers.buildings)for(const [x,y] of b.rings[0])add(x,y);
  for(const [x,y] of layers.trees)add(x,y);
  for(const prop of layers.props??[])add(prop[1],prop[2]);
  // An empty sector reads no height: any window will do.
  return west<=east?[west,south,east,north]:[0,0,0,0];
}

/** Where each building lies in the merged meshes of a sector, by building id. */
export type SectorBuildings=Map<number,BuildingRange[]>;

/** Decodes `packRanges`. The positions of those meshes will be rewritten: they are uploaded as dynamic. */
function unpackRanges(r: Int32Array,group: T.Group): SectorBuildings {
  const buildings: SectorBuildings=new Map();
  for(let k=0;k<r.length;k+=4){
    const mesh=group.children[r[k+1]];
    if(!(mesh instanceof T.Mesh))continue;
    let list=buildings.get(r[k]);
    if(!list){
      buildings.set(r[k],list=[]);
      mesh.geometry.getAttribute('position').setUsage(T.DynamicDrawUsage);
    }
    list.push({mesh,start:r[k+2],count:r[k+3]});
  }
  return buildings;
}

// The streamer serializes builds. A cancelled result is discarded before GPU upload. `track` also returns, for the
// demolition lab, where each building lies in the merged meshes.
export function sectorBuilder(terrain: Terrain,compact: boolean,neutral: boolean,tones: RoofTones | null,track=false){
  const timeoutMs=10000;
  let worker: Worker | null=null;
  if(typeof OffscreenCanvas!=='undefined'){
    try {
      worker=new Worker(new URL('./sector-worker.ts',import.meta.url),{type:'module'});
      worker.postMessage({config:{compact,neutral,tones,track}} satisfies WorkerRequest);
    } catch (error) {
      worker?.terminate();
      worker=null;
      console.info('Sector worker unavailable',error);
    }
  }
  const attr=(a: AttributeData)=>new T.BufferAttribute(a.array,a.size,a.normalized);
  return async(layers: Layers,signal: AbortSignal)=>{
    if(signal.aborted)return null;
    const buildLocally=()=>{
      const tracked=track?new Map<Layers['buildings'][number]['rings'],BuildingRange[]>():undefined;
      const city=makeCity({...layers,boundary:[],terrain},neutral,tones,compact,null,tracked);
      return {...city,buildings:tracked?unpackRanges(packRanges(layers.buildings,tracked,city.group.children),city.group):null};
    };
    if(!worker)return buildLocally();
    const activeWorker=worker;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let result: WorkerResult;
    try {
      result=await new Promise<WorkerResult>((resolve,reject)=>{
        timeout=setTimeout(()=>reject(new Error('Sector worker timed out')),timeoutMs);
        activeWorker.onmessage=({data}: MessageEvent<WorkerReply>)=>
          'error' in data ? reject(new Error(data.error)) : resolve(data);
        activeWorker.onerror=event=>{
          event.preventDefault();
          reject(new Error(event.message));
        };
        activeWorker.onmessageerror=()=>reject(new Error('Invalid sector worker message'));
        const window=heightWindow(terrain,extent(layers),TERRAIN_MARGIN);
        activeWorker.postMessage({layers,terrain:window} satisfies WorkerRequest,[window.values.buffer]);
      });
    } catch (error) {
      activeWorker.terminate();
      worker=null;
      console.info('Sector worker fallback',error);
      return signal.aborted ? null : buildLocally();
    } finally {
      clearTimeout(timeout);
      activeWorker.onmessage=activeWorker.onerror=activeWorker.onmessageerror=null;
    }
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
    return {group,groundMap,materials,buildings:result.ranges?unpackRanges(result.ranges,group):null};
  };
}
