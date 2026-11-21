import { sectorBuilder } from './sector-builder.js';
import { overviewBuildings, overviewGround } from './overview.js';
import * as T from 'three';
import { makeCity } from './scene.js';

// Count unique typed arrays. The overview terrain texture belongs to the base scene.
function resources(group) {
  const geometries=new Set(), materials=new Set(), arrays=new Set();
  group.traverse(mesh=>{
    if(!mesh.isMesh)return;
    geometries.add(mesh.geometry);
    materials.add(mesh.material);
    for(const a of [...Object.values(mesh.geometry.attributes),mesh.geometry.index,mesh.instanceMatrix,mesh.instanceColor]){
      if(a)arrays.add(a.array);
    }
  });
  return {
    bytes:[...arrays].reduce((n,a)=>n+a.byteLength,0),
    dispose(){
      group.removeFromParent();
      group.traverse(mesh=>{if(mesh.isInstancedMesh)mesh.dispose();});
      for(const geometry of geometries)geometry.dispose();
      for(const material of materials)material.dispose();
    }
  };
}

export function streamCity({data,neutral,tones,compact,refresh,host}){
  const build=sectorBuilder(data.terrain,compact,neutral,tones);
  const base=makeCity({...data,ground:[],buildings:[],trees:[]},neutral,tones,compact);
  const byId=new Map(data.sectors.map(s=>[s.id,{buildings:[],trees:[],ground:[]}]));
  const owner=(x,y)=>Math.floor(x/data.sectorSize)+'_'+Math.floor(y/data.sectorSize);
  data.buildings.forEach((b,i)=>byId.get(data.buildingOwners[i]).buildings.push(b));
  for(const tree of data.trees)byId.get(owner(...tree)).trees.push(tree);
  for(const ring of data.ground){
    const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
    byId.get(owner((Math.min(...xs)+Math.max(...xs))/2,(Math.min(...ys)+Math.max(...ys))/2)).ground.push(ring);
  }
  const solid=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,side:T.DoubleSide});
  const groundMaterial=new T.MeshStandardMaterial({map:base.groundMap?.texture??null,
    color:neutral?'#e4dfd3':'white',flatShading:true,side:T.DoubleSide});
  const sectors=data.sectors.map(s=>{
    const batch=byId.get(s.id),low=new T.Group();
    low.add(overviewBuildings(batch.buildings,batch.trees,base.altitude,tones,neutral,solid),
      overviewGround(batch.ground,base.altitude,base.groundMap,groundMaterial));
    base.group.add(low);
    const [west,south,east,north]=s.bounds;
    const bounds=new T.Box3(new T.Vector3(west,s.vertical[0],-north),new T.Vector3(east,s.vertical[1],-south));
    return {...s,low,bounds,prefetch:bounds.clone().expandByScalar(data.sectorSize*.55),
      detail:null,assets:null,used:0,failed:0,retry:0,estimate:0};
  });
  const budget=(compact?48:96)*1024*1024;
  const frustum=new T.Frustum(),matrix=new T.Matrix4(),projected=new T.Vector3();
  const lastTarget=new T.Vector3(),ahead=new T.Vector3(),aheadPoint=new T.Vector3();
  let requested=[],pending=null,bytes=0,tick=0,evictions=0;

  function release(s){
    evictions++;s.assets.dispose();bytes-=s.assets.bytes;s.assets=null;s.detail=null;s.low.visible=true;
  }

  async function load(s){
    const controller=new AbortController();
    pending={s,controller};
    try{
      const r=await fetch('./data/city-sectors/'+s.file,{signal:controller.signal});
      if(!r.ok)throw Error('sector '+s.id+' HTTP '+r.status);
      const layers=await r.json();
      if(controller.signal.aborted || !requested.includes(s))return;
      const local=await build(layers,controller.signal);
      if(!local)return;
      const detail=local.group;
      const assets=resources(detail);
      const texture=local.groundMap?.texture;
      if(texture){
        // Backing image plus RGBA texture and its mip chain, in addition to the geometry arrays.
        assets.bytes+=Math.ceil(texture.image.width*texture.image.height*4*(1+4/3));
        const releaseGeometry=assets.dispose;
        assets.dispose=()=>{releaseGeometry();texture.dispose();texture.image.close?.();};
      }
      s.estimate=assets.bytes;
      const priority=requested.indexOf(s);
      const victims=sectors.filter(other=>other.detail &&
        (!requested.includes(other)||requested.indexOf(other)>priority)).sort((a,b)=>a.used-b.used);
      for(const other of victims){
        if(bytes+assets.bytes<=budget)break;
        release(other);
      }
      if(bytes+assets.bytes>budget){assets.dispose();return;}
      s.detail=detail;s.assets=assets;bytes+=assets.bytes;base.group.add(detail);
      s.low.visible=false;s.failed=0;
    }catch(error){
      if(!controller.signal.aborted){
        s.failed++;s.retry=performance.now()+Math.min(30000,1000*2**Math.min(s.failed,5));
        console.warn('Sector',s.id,error);
        setTimeout(()=>{if(requested.includes(s))refresh();},s.retry-performance.now()+10);
      }
    }finally{
      pending=null;refresh();
    }
  }
  function suspend(){
    requested=[];pending?.controller.abort();
  }
  function update(camera,target,driving){
    tick++;
    const span=Math.min(camera.right-camera.left,camera.top-camera.bottom)/camera.zoom;
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    if(driving && target.distanceToSquared(lastTarget)>.0025)ahead.subVectors(target,lastTarget).setY(0).normalize();
    lastTarget.copy(target);aheadPoint.copy(target).addScaledVector(ahead,driving?data.sectorSize*.5:0);
    requested=span>550&&!driving?[]:sectors.filter(s=>frustum.intersectsBox(s.prefetch)||(driving&&s.bounds.distanceToPoint(aheadPoint)<data.sectorSize));
    function rank(s){
      s.bounds.getCenter(projected);
      return (frustum.intersectsBox(s.bounds)?0:1e10)+projected.distanceToSquared(aheadPoint);
    }
    requested.sort((a,b)=>rank(a)-rank(b));
    for(const s of sectors){
      const show=requested.includes(s)&&!!s.detail;
      s.low.visible=!show;
      if(s.detail){s.detail.visible=show;if(show)s.used=tick;}
    }
    if(pending && !requested.includes(pending.s))pending.controller.abort();
    if(!pending){
      let reserved=0;
      for(const s of requested){
        if(s.detail){reserved+=s.assets.bytes;continue;}
        if(s.retry>performance.now() || reserved+s.estimate>budget)continue;
        void load(s);break;
      }
    }
    host.dataset.sectors=JSON.stringify({loaded:sectors.filter(s=>s.detail).length,
      visible:sectors.filter(s=>s.detail?.visible).length,bytes,budget,evictions,pending:pending?.s.id??null});
  }
  return {...base,update,suspend};
}
