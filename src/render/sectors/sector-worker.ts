import { BufferAttribute, Mesh, InstancedMesh } from 'three';
import type { BufferGeometry } from 'three';
import { makeCity } from '../scene.ts';
import type { AttributeData, GeometryData, MeshData, WorkerConfig, WorkerReply, WorkerRequest } from './protocol.ts';

const scope = self as DedicatedWorkerGlobalScope;
let config: WorkerConfig | undefined;

function send(reply: WorkerReply, transfer: Transferable[] = []) {
  scope.postMessage(reply, transfer);
}

scope.onmessage = async ({data}: MessageEvent<WorkerRequest>) => {
  if ('config' in data) {
    config = data.config;
    return;
  }
  try {
    if (!config) throw new Error('Sector worker is not initialized');
    const {compact,neutral,tones} = config;
    const result = makeCity({...data.layers,boundary:[],terrain:data.terrain},neutral,tones,compact);
    const transfer = new Set<Transferable>();
    const geometries: GeometryData[] = [];
    const ids = new Map<BufferGeometry,number>();
    function attribute(a: BufferAttribute): AttributeData {
      const buffer = a.array.buffer;
      if (!(buffer instanceof ArrayBuffer)) throw new Error('Expected a transferable sector buffer');
      transfer.add(buffer);
      return {array:a.array,size:a.itemSize,normalized:a.normalized};
    }

    const meshes = result.group.children.map((mesh): MeshData => {
      if (!(mesh instanceof Mesh)) throw new Error('Unexpected sector object ' + mesh.type);
      const instanced = mesh instanceof InstancedMesh ? mesh : null;
      const g = mesh.geometry;
      let geo = ids.get(g);
      if (geo === undefined) {
        geo = geometries.length;
        ids.set(g,geo);
        const attributes = Object.fromEntries(Object.entries(g.attributes).map(([key,value]) => {
          if (!(value instanceof BufferAttribute)) throw new Error('Unexpected sector attribute ' + key);
          return [key,attribute(value)];
        }));
        geometries.push({index:g.index ? attribute(g.index) : null,attributes});
      }
      const materials = result.materials;
      const material = (Object.keys(materials) as (keyof typeof materials)[])
        .find(key => materials[key] === mesh.material);
      if (!material) throw new Error('Unknown sector material');
      return {
        geo,material,
        matrix:instanced ? attribute(instanced.instanceMatrix) : null,
        color:instanced?.instanceColor ? attribute(instanced.instanceColor) : null,
        cast:mesh.castShadow,receive:mesh.receiveShadow
      };
    });
    if (result.groundMap) {
      const image = await createImageBitmap(result.groundMap.texture.image,{
        imageOrientation:'flipY',colorSpaceConversion:'none'
      });
      transfer.add(image);
      send({geometries,meshes,image,bounds:result.groundMap.bounds.toArray()},[...transfer]);
    } else {
      send({geometries,meshes,image:null},[...transfer]);
    }
  } catch (error) {
    send({error:String(error)});
  }
};
