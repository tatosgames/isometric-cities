import { Mesh, InstancedMesh } from 'three';
import { makeCity } from './scene.js';

let config;
self.onmessage=async({data})=>{
  if(data.config){config=data.config;return;}
  try{
    const {terrain,compact,neutral,tones}=config;
    const result=makeCity({...data.layers,boundary:[],terrain},neutral,null,
      {tones,bounds:data.layers.roofBounds},compact);
    const transfer=new Set(),geometries=[],ids=new Map();
    function attribute(a){
      if(!a)return null;
      transfer.add(a.array.buffer);
      return {array:a.array,size:a.itemSize,normalized:a.normalized};
    }
    const meshes=result.group.children.map(mesh=>{
      if(!(mesh instanceof Mesh))throw Error("Unexpected sector object "+mesh.type);
      const instanced=mesh instanceof InstancedMesh?mesh:null;
      const g=mesh.geometry;
      if(!ids.has(g)){
        ids.set(g,geometries.length);
        geometries.push({index:attribute(g.index),attributes:Object.fromEntries(
          Object.entries(g.attributes).map(([k,v])=>[k,attribute(v)]))});
      }
      return {geo:ids.get(g),material:Object.keys(result.materials).find(k=>result.materials[k]===mesh.material),
        matrix:attribute(instanced?.instanceMatrix),color:attribute(instanced?.instanceColor),
        cast:mesh.castShadow,receive:mesh.receiveShadow};
    });
    let image=null;
    if(result.groundMap){
      image=await createImageBitmap(result.groundMap.texture.image,{imageOrientation:'flipY',colorSpaceConversion:'none'});
      transfer.add(image);
    }
    self.postMessage({geometries,meshes,image,bounds:result.groundMap?.bounds.toArray()},{transfer:[...transfer]});
  }catch(error){self.postMessage({error:String(error)});}
};
