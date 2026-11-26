import {cityDetail} from '../dynamic-quality.ts';
import type { Building, CityCore, FarBlock, Layers, Point, Prop, Ring, RoofTones, SectorIndex, Zone, ZoneData } from '../../data/types.ts';
import { ringCenter, sectorOwner, zoneOfSector } from '../../data/sector-index.ts';
import { isLayers, isZone, loadData } from '../../data/load.ts';
import { required } from '../../required.ts';
import {surfaceStencil} from '../building-stencil.ts';
import { sectorBuilder } from './sector-builder.ts';
import { overviewGround, overviewSilhouettes } from '../overview.ts';
import * as T from 'three';
import { makeCity } from '../scene.ts';
import { breezy } from '../wind.ts';
import {makeStaticGroundShadow} from '../static-ground-shadow.ts';
import { makeGroundMap } from '../ground-map.ts';
import { groundSampler } from '../ground-surface.ts';

export interface SectorLod {
  stable:boolean;
  attach?:(low:T.Group, detail:Pick<ReturnType<typeof makeCity>,'group'|'materials'>, overview:ReturnType<typeof makeGroundMap>)=>{step:(show:boolean,now:number,covered?:boolean)=>boolean;dispose:()=>void};
  observe?:(id:string,show:boolean)=>void;
}
interface StreamOptions {
  lod?:SectorLod;
  data: CityCore & SectorIndex;
  /** File prefix of the dataset: `city` reads `city-zones/` and `city-sectors/`. */
  stage?: string;
  neutral: boolean;
  tones: RoofTones | null;
  compact: boolean;
  refresh: () => void;
  host: HTMLElement;
  legacyRoads?:boolean;
  loadLayers?:(s:{id:string;file:string},signal:AbortSignal)=>Promise<Layers>;
  loadZone?:(z:Zone,signal:AbortSignal)=>Promise<ZoneData>;
  /** Footprints of a zone arrive with `data`, and leave with `null`. Collision follows the same residency. */
  onZone?:(id:string,data:ZoneData|null)=>void;
}

type Assets={bytes:number;dispose:()=>void};
interface ResidentZone {
  id: string;
  file: string;
  far: T.Group;
  farGroundAt: ReturnType<typeof groundSampler>;
  bounds: T.Box3;
  prefetch: T.Box3;
  sectors: ResidentSector[];
  assets: Assets | null;
  group: T.Group | null;
  map: ReturnType<typeof makeGroundMap> | null;
  wanted: number;
  used: number;
  failed: number;
  retry: number;
}
interface ResidentSector {
  id: string;
  file: string;
  zone: ResidentZone;
  low: T.Group | null;
  groundAt: ReturnType<typeof groundSampler> | null;
  bounds: T.Box3;
  prefetch: T.Box3;
  detail: T.Group | null;
  assets: Assets | null;
  used: number;
  failed: number;
  retry: number;
  estimate: number;
  wanted: number;
  /** Inside the camera frustum just now or a moment ago, as opposed to only prefetched around it. */
  inView: boolean;
  seen: number;
}

// Backing image plus RGBA texture and its mip chain.
const textureBytes=(texture:{image:{width:number;height:number}})=>Math.ceil(texture.image.width*texture.image.height*4*(1+4/3));

// Count unique typed arrays. The far terrain texture belongs to the base scene.
function resources(group: T.Object3D): Assets {
  const geometries=new Set<T.BufferGeometry>(), materials=new Set<T.Material>(), arrays=new Set<T.TypedArray>();
  group.traverse(mesh=>{
    if(!(mesh instanceof T.Mesh))return;
    geometries.add(mesh.geometry);
    for(const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])materials.add(material);
    for(const a of [...Object.values(mesh.geometry.attributes),mesh.geometry.index,
      ...(mesh instanceof T.InstancedMesh ? [mesh.instanceMatrix,mesh.instanceColor] : [])]){
      if(a)arrays.add(a.array);
    }
  });
  // `dispose` shares this scope: a set of arrays left here would keep every buffer in memory after its upload.
  const bytes=[...arrays].reduce((n,a)=>n+a.byteLength,0);
  arrays.clear();
  return {
    bytes,
    dispose(){
      group.removeFromParent();
      group.traverse(mesh=>{if(mesh instanceof T.InstancedMesh)mesh.dispose();});
      for(const geometry of geometries)geometry.dispose();
      for(const material of materials)material.dispose();
    }
  };
}

// Once the GPU holds a buffer, its copy in memory would only serve a restored graphics context. Zones and sectors
// are rebuilt from their files instead (see `forget`), so the copy goes as soon as it is uploaded. Geometry that is
// still read afterwards, such as the ground a sampler walks, is left out by the caller.
function release(this: T.BufferAttribute){(this as unknown as {array: null}).array=null;}
function gpuOnly(root: T.Object3D){
  root.traverse(mesh=>{
    if(!(mesh instanceof T.Mesh))return;
    const geometry=mesh.geometry;
    // Culling needs the bounds, and they are computed from the positions about to go.
    if(!geometry.boundingSphere)geometry.computeBoundingSphere();
    for(const a of [...Object.values(geometry.attributes),geometry.index])if(a instanceof T.BufferAttribute)a.onUpload(release);
    // A buffer is uploaded at its first draw, and a mesh outside the view is never drawn: its copy would stay
    // for as long as the zone. Draw it once wherever it is; culling returns with the upload.
    const position=geometry.getAttribute('position');
    if(!mesh.frustumCulled || !(position instanceof T.BufferAttribute))return;
    mesh.frustumCulled=false;
    position.onUpload(function(this: T.BufferAttribute){release.call(this);mesh.frustumCulled=true;});
  });
}

// The far blocks of a zone in typed arrays: enough to draw its silhouettes again after a lost graphics context,
// at a sixth of the memory the silhouettes themselves would keep.
type PackedBlocks={points: Float64Array;ends: Uint32Array;heights: Float64Array;tones: string[]};
function packBlocks(blocks: FarBlock[]): PackedBlocks {
  const points=new Float64Array(blocks.reduce((n,b)=>n+b.ring.length*2,0)),ends=new Uint32Array(blocks.length);
  let i=0;
  blocks.forEach((b,k)=>{for(const [x,y] of b.ring){points[i++]=x;points[i++]=y;}ends[k]=i;});
  return {points,ends,heights:Float64Array.from(blocks,b=>b.height),tones:blocks.map(b=>b.tone)};
}
function unpackBlocks({points,ends,heights,tones}: PackedBlocks): FarBlock[] {
  let start=0;
  return Array.from(ends,(end,k)=>{
    const ring: Ring=[];
    for(let i=start;i<end;i+=2)ring.push([points[i]??0,points[i+1]??0]);
    start=end;
    return {ring,height:heights[k]??0,tone:tones[k]??''};
  });
}

// Three levels. Far: merged blocks of every zone, always resident. Zone: one silhouette per building, on demand.
// Sector: full detail inside a loaded zone, within the byte budget. Zones are bounded by the view and counted apart.
export function streamCity({data,stage='city',neutral,tones,compact,refresh,host,legacyRoads=false,loadLayers,loadZone,onZone,lod}: StreamOptions){
  const detailProfile=cityDetail(compact);
  const build=sectorBuilder(data.terrain,compact,neutral,tones);
  const streetPriority=!!data.carriageways&&!legacyRoads,coverage=legacyRoads?undefined:data.roadCoverage;
  // The far ground is painted once from the whole city; merged blocks leave its contact shadows.
  const footprints: Building[]=Object.values(data.far).flatMap(z=>z.blocks.map(b=>({id:0,rings:[b.ring],height:b.height})));
  const base=makeCity({...data,ground:[],buildings:[],trees:[]},neutral,tones,compact,
    neutral?null:makeGroundMap({...data,buildings:footprints},undefined,streetPriority,data.roadFallback,coverage));
  const owner=(x: number,y: number)=>sectorOwner(x,y,data.sectorSize);
  const solid=new T.MeshStandardMaterial({...surfaceStencil(true),vertexColors:true,flatShading:true,side:T.DoubleSide});
  const overviewMaterials=[solid,Object.assign(solid.clone(),surfaceStencil())].map(m=>breezy(m));
  const ground=(map: T.Texture | null)=>breezy(new T.MeshStandardMaterial({...surfaceStencil(),map,
    color:neutral?'#e4dfd3':'white',flatShading:true,side:T.DoubleSide}));
  const farGround=ground(base.groundMap?.texture??null);
  const box=(bounds: Zone['bounds'],vertical: Zone['vertical'])=>new T.Box3(
    new T.Vector3(bounds[0],vertical[0],-bounds[3]),new T.Vector3(bounds[2],vertical[1],-bounds[1]));
  const packed=new Map<string,PackedBlocks>();
  let staticEnabled=false;
  type ShadowMask=ReturnType<typeof makeStaticGroundShadow>;
  const masks=new Map<string,ShadowMask>();
  const casters=new Map<string,Building[]>();
  function* blockCasters(id:string){
    for(const block of unpackBlocks(required(packed.get(id),'packed zone '+id))){
      yield {rings:[block.ring],height:block.height};
    }
  }
  function* farCasters(){for(const id of packed.keys())yield* blockCasters(id);}
  const farMask=base.groundMap && makeStaticGroundShadow(base.groundMap.bounds,farCasters,refresh);
  farMask?.attach(farGround);
  // Silhouettes keep no copy once uploaded; the ground stays, because the ground sampler walks its triangles.
  function farSilhouettes(blocks: FarBlock[]){
    const mesh=overviewSilhouettes({blocks},base.altitude,null,neutral,overviewMaterials,detailProfile.overviewNormals);
    mesh.userData.silhouettes=true;
    gpuOnly(mesh);
    return mesh;
  }
  const zones: ResidentZone[]=data.zones.map(z=>{
    const far=new T.Group(),level=required(data.far[z.id],'far level of zone '+z.id);
    const surface=overviewGround(level.ground,base.altitude,base.groundMap,farGround,detailProfile.overviewNormals);
    packed.set(z.id,packBlocks(level.blocks));
    far.add(farSilhouettes(level.blocks),surface);
    base.group.add(far);
    const bounds=box(z.bounds,z.vertical);
    return {id:z.id,file:z.file,far,farGroundAt:groundSampler(()=>[surface.geometry]),bounds,prefetch:bounds.clone().expandByScalar(data.sectorSize*.5),
      sectors:[],assets:null,group:null,map:null,wanted:-Infinity,used:0,failed:0,retry:0};
  });
  // The far level is geometry now: its outlines would otherwise stay resident for the whole session.
  for(const level of Object.values(data.far)){level.ground=[];level.blocks=[];}
  const zoneById=new Map(zones.map(z=>[z.id,z]));
  const sectors: ResidentSector[]=data.sectors.map(s=>{
    const zone=required(zoneById.get(zoneOfSector(s.id,data)),'zone of sector '+s.id);
    const bounds=box(s.bounds,s.vertical);
    const sector={id:s.id,file:s.file,zone,low:null,groundAt:null,bounds,prefetch:bounds.clone().expandByScalar(data.sectorSize*.55),
      detail:null,assets:null,used:0,failed:0,retry:0,estimate:0,wanted:-Infinity,inView:false,seen:-Infinity};
    zone.sectors.push(sector);
    return sector;
  });
  const sectorById=new Map(sectors.map(s=>[s.id,s]));
  function sampleGround(x: number,y: number,east=x,north=y){
    const zone=zoneAt(east,north);
    if(!zone)return undefined;
    if(zone.far.visible)return zone.farGroundAt(x,y);
    // Zone and detail use the same ground triangles throughout the fade.
    return sectorById.get(owner(east,north))?.groundAt?.(x,y);
  }
  function groundAt(x: number,y: number): number {
    const height=sampleGround(x,y);
    if(height!==undefined)return height;
    // A shared edge can have ground only in the sector to its west or south.
    const west=x%data.sectorSize===0,south=y%data.sectorSize===0;
    return (west?sampleGround(x,y,x-1,y):undefined)??(south?sampleGround(x,y,x,y-1):undefined)??
      (west&&south?sampleGround(x,y,x-1,y-1):undefined)??base.altitude(x,y);
  }
  const budget=detailProfile.sectorMiB*1024*1024;
  // What leaves the view stays requested this long, in milliseconds. A camera hovering on a boundary would
  // otherwise start and cancel the same download at every step.
  const linger=600;
  let lingerTimer=0;
  // Zones that left the view stay for a quick return, up to this many.
  const idleZones=2;
  // Longest side of the view, in metres, that still shows one silhouette per building. Beyond it, merged blocks.
  const zoneSpan=detailProfile.zoneSpan;
  const frustum=new T.Frustum(),matrix=new T.Matrix4(),projected=new T.Vector3();
  const lastTarget=new T.Vector3(),ahead=new T.Vector3(),aheadPoint=new T.Vector3();
  let requested: ResidentSector[]=[],requestedZones: ResidentZone[]=[];
  const shadowBudget=detailProfile.shadowMiB*1024*1024;
  let shadowBytes=0;
  function syncShadowMasks(){
    shadowBytes=staticEnabled && farMask?farMask.textureBytes:0;
    farMask?.setEnabled(staticEnabled);
    const selected=new Set<string>();
    if(staticEnabled)for(const z of requestedZones){
      const mask=masks.get(z.id);
      if(mask && shadowBytes+mask.textureBytes<=shadowBudget){
        selected.add(z.id);
        shadowBytes+=mask.textureBytes;
      }
    }
    for(const [id,mask] of masks)if(!selected.has(id))mask.setEnabled(false);
    for(const id of selected)masks.get(id)?.setEnabled(true);
  }
  let demanded: ResidentZone | undefined;
  let near=false,mid=false,activeFades=0;
  const transitions=new Map<string,ReturnType<NonNullable<SectorLod['attach']>>>();
  const displayed=new Set<string>(), lastVisible=new Map<string,number>();
  let pending: {s: ResidentSector;controller: AbortController} | null=null;
  let pendingZone: {z: ResidentZone;controller: AbortController} | null=null;
  let bytes=0,zoneBytes=0,tick=0,evictions=0;

  function release(s: ResidentSector){
    if(!s.assets)return;
    transitions.get(s.id)?.dispose();transitions.delete(s.id);
    if(displayed.delete(s.id))lod?.observe?.(s.id,false);
    evictions++;s.assets.dispose();bytes-=s.assets.bytes;s.assets=null;s.detail=null;
    if(s.low)s.low.visible=true;
  }
  // Only an adjoining zone can project an urban building across this zone's edge.
  function neighbours(z:ResidentZone){
    return zones.filter(other=>other!==z && other.bounds.min.x<=z.bounds.max.x+190 &&
      other.bounds.max.x>=z.bounds.min.x-190 && other.bounds.min.z<=z.bounds.max.z+190 &&
      other.bounds.max.z>=z.bounds.min.z-190);
  }
  function updateNeighbours(z:ResidentZone){
    for(const other of neighbours(z))masks.get(other.id)?.invalidate();
  }
  function releaseZone(z: ResidentZone,keepFootprints=false){
    if(!z.assets)return;
    for(const s of z.sectors){release(s);s.low=null;s.groundAt=null;}
    masks.get(z.id)?.dispose();masks.delete(z.id);casters.delete(z.id);
    updateNeighbours(z);
    z.assets.dispose();zoneBytes-=z.assets.bytes;z.assets=null;z.group=null;z.map=null;z.far.visible=true;
    if(!keepFootprints)onZone?.(z.id,null);
  }
  async function loadZoneLevel(z: ResidentZone){
    const controller=new AbortController();
    pendingZone={z,controller};
    try{
      const source=required(data.zones.find(zone=>zone.id===z.id),'zone '+z.id);
      let content: ZoneData | null=await (loadZone?loadZone(source,controller.signal):loadData(stage+'-zones/'+z.file,isZone,controller.signal));
      if(controller.signal.aborted || !requestedZones.includes(z))return;
      const [west,south,east,north]=source.bounds;
      // The zone paints its own ground, so its sharpness does not depend on the size of the city.
      const map=neutral?null:makeGroundMap({...data,buildings:content.buildings,textureBounds:[west-5,south-5,east+5,north+5]},
        .6,streetPriority,data.roadFallback,coverage&&(content.coverage??coverage));
      const material=ground(map?.texture??null),group=new T.Group();
      if(map){
        casters.set(z.id,content.buildings);
        const mask=makeStaticGroundShadow(map.bounds,function*(){
          yield* casters.get(z.id)??[];
          for(const other of neighbours(z)){
            const exact=casters.get(other.id);
            if(exact)yield* exact;
            else yield* blockCasters(other.id);
          }
        },refresh);
        masks.set(z.id,mask);mask.attach(material);syncShadowMasks();
        updateNeighbours(z);
      }
      const batches=new Map(z.sectors.map(s=>[s.id,{buildings:[] as Building[],trees:[] as Point[],props:[] as Prop[],ground:[] as Ring[]}]));
      const batch=(id: string)=>required(batches.get(id),'sector '+id+' of zone '+z.id);
      const owners=content.owners;
      content.buildings.forEach((b,i)=>batch(owners[i]).buildings.push(b));
      for(const tree of content.trees)batch(owner(...tree)).trees.push(tree);
      for(const prop of content.props??[])batch(owner(prop[1],prop[2])).props.push(prop);
      for(const ring of content.ground)batch(owner(...ringCenter(ring))).ground.push(ring);
      for(const s of z.sectors){
        const b=batch(s.id);
        const surface=overviewGround(b.ground,base.altitude,map,material,detailProfile.overviewNormals);
        s.low=new T.Group();
        s.groundAt=groundSampler(()=>[surface.geometry]);
        const silhouettes=overviewSilhouettes(b,base.altitude,tones,neutral,overviewMaterials,detailProfile.overviewNormals);
        s.low.add(silhouettes,surface);
        group.add(s.low);
      }
      // The building materials belong to every zone and to the far level: release only what the zone owns.
      const zoneBytesNow=resources(group).bytes;
      for(const s of z.sectors)if(s.low)gpuOnly(s.low.children[0]);
      const assets: Assets={bytes:zoneBytesNow+(map?textureBytes(map.texture):0),dispose(){
        group.removeFromParent();
        group.traverse(mesh=>{if(mesh instanceof T.Mesh)mesh.geometry.dispose();});
        material.dispose();map?.texture.dispose();
      }};
      z.assets=assets;z.group=group;z.map=map;z.failed=0;zoneBytes+=assets.bytes;base.group.add(group);z.far.visible=false;
      // The ground tiles and the street coverage are drawn by now: only footprints, trees and objects stay, for the
      // drive. `dispose` above shares this scope, so what is left here would live as long as the zone.
      const kept: ZoneData={...content,ground:[]};
      delete kept.coverage;
      content=null;batches.clear();
      onZone?.(z.id,kept);
    }catch(error){
      if(!controller.signal.aborted){
        z.failed++;z.retry=performance.now()+Math.min(30000,1000*2**Math.min(z.failed,5));
        console.warn('Zone',z.id,error);
        setTimeout(()=>{if(requestedZones.includes(z))refresh();},z.retry-performance.now()+10);
      }
    }finally{
      pendingZone=null;refresh();
    }
  }

  // Detail that may make room for `s`: anything no longer requested and, for a sector on screen, the prefetched
  // ring around the view. Sectors of the same kind never displace each other: their order changes with every
  // camera step, so when the budget is full the first to arrive stay and the rest keep their overview.
  function evictableFor(s: ResidentSector){
    return sectors.filter(other=>other.detail && other!==s &&
      (!requested.includes(other) || (s.inView && !other.inView)));
  }
  async function load(s: ResidentSector){
    const controller=new AbortController();
    pending={s,controller};
    try{
      const layers=await (loadLayers?loadLayers(s,controller.signal):loadData(stage+'-sectors/'+s.file,isLayers,controller.signal));
      if(legacyRoads||neutral)delete layers.carriageway;
      if(detailProfile.simplifiedBuildings && layers.fused)layers.buildings=layers.fused;
      delete layers.fused;
      if(controller.signal.aborted || !requested.includes(s))return;
      const local=await build(layers,controller.signal);
      if(!local || !s.low)return;
      const mask=masks.get(s.zone.id);
      mask?.attach(local.materials.mat,true);mask?.attach(local.materials.road);
      const detail=local.group;
      const assets=resources(detail);
      gpuOnly(detail);
      const texture=local.groundMap?.texture;
      if(texture){
        assets.bytes+=textureBytes(texture);
        const releaseGeometry=assets.dispose;
        assets.dispose=()=>{releaseGeometry();texture.dispose();if ("close" in texture.image)texture.image.close();};
      }
      s.estimate=assets.bytes;
      const victims=evictableFor(s).sort((a,b)=>a.used-b.used);
      for(const other of victims){
        if(bytes+assets.bytes<=budget)break;
        release(other);
      }
      if(bytes+assets.bytes>budget){assets.dispose();return;}
      s.detail=detail;s.assets=assets;bytes+=assets.bytes;base.group.add(detail);
      if(lod?.attach && s.zone.map)transitions.set(s.id,lod.attach(s.low,local,s.zone.map));
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
    requested=[];requestedZones=[];demanded=undefined;for(const z of zones)z.wanted=-Infinity;for(const s of sectors)s.wanted=-Infinity;pending?.controller.abort();pendingZone?.controller.abort();
  }
  // The graphics context was lost: buffers without a copy in memory cannot be sent again. Zones and sectors are
  // dropped and the next update loads them anew, over the far level. The drive keeps its footprints meanwhile.
  function forget(){
    suspend();
    for(const z of zones)releaseZone(z,true);
    // The far silhouettes have no copy to send again either: they are drawn anew from the packed blocks.
    for(const z of zones){
      const old=z.far.children.find(c=>c.userData.silhouettes);
      if(!(old instanceof T.Mesh))continue;
      z.far.remove(old);old.geometry.dispose();
      z.far.add(farSilhouettes(unpackBlocks(required(packed.get(z.id),'packed blocks of zone '+z.id))));
    }
  }
  function zoneAt(x: number,y: number){return zoneById.get(sectorOwner(x,y,data.zoneSize));}
  /** Ask for the zone under a point whatever the camera shows. True once its footprints are resident. */
  function demand(x: number,y: number){
    const z=zoneAt(x,y);
    if(z!==demanded){
      demanded=z;
      if(z && !z.assets)refresh();
    }
    return !z || !!z.assets;
  }
  function update(camera: T.OrthographicCamera,target: T.Vector3,driving=false,opening?:'covered'|'revealing'){
    tick++;
    const width=(camera.right-camera.left)/camera.zoom,height=(camera.top-camera.bottom)/camera.zoom;
    const span=Math.min(width,height),long=Math.max(width,height);
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    if(driving && target.distanceToSquared(lastTarget)>.0025)ahead.subVectors(target,lastTarget).setY(0).normalize();
    lastTarget.copy(target);aheadPoint.copy(target).addScaledVector(ahead,driving?data.sectorSize*.5:0);
    const now=performance.now();
    near=driving || (lod?.stable?(near?span<=580:span<=520):span<=550);
    mid=driving || long<=(mid?zoneSpan*1.09:zoneSpan);
    const openingZone=opening && mid?zoneAt(target.x,-target.z):undefined;
    let openingSector: ResidentSector | undefined,closest=Infinity;
    if(opening && near && mid)for(const s of sectors){
      if(!frustum.intersectsBox(s.bounds))continue;
      const distance=s.bounds.getCenter(projected).distanceToSquared(target);
      if(distance<closest){openingSector=s;closest=distance;}
    }
    for(const z of zones)if(z===openingZone || z===openingSector?.zone || z===demanded || (mid && (frustum.intersectsBox(z.prefetch) ||
      (driving && Math.min(z.bounds.distanceToPoint(aheadPoint),z.bounds.distanceToPoint(target))<data.sectorSize))))z.wanted=now;
    requestedZones=opening
      ? zones.filter(z=>z===openingZone || z===openingSector?.zone)
      : zones.filter(z=>now-z.wanted<linger);
    const zoneRank=(z: ResidentZone)=>z===demanded?-3:z===openingZone?-2:z===openingSector?.zone?-1:
      (frustum.intersectsBox(z.bounds)?0:1e10)+z.bounds.getCenter(projected).distanceToSquared(aheadPoint);
    requestedZones.sort((a,b)=>zoneRank(a)-zoneRank(b));
    if(staticEnabled)syncShadowMasks();
    for(const z of requestedZones)if(z.assets)z.used=tick;
    // A zone kept for a quick return shows the far level, so one view never mixes the two.
    for(const z of zones)if(z.group){z.group.visible=requestedZones.includes(z);z.far.visible=!z.group.visible;}
    const idle=zones.filter(z=>z.assets&&!requestedZones.includes(z)).sort((a,b)=>b.used-a.used);
    for(const z of idle.slice(idleZones))releaseZone(z);
    if(near)for(const s of sectors)if(frustum.intersectsBox(s.prefetch)||(driving&&s.bounds.distanceToPoint(aheadPoint)<data.sectorSize))s.wanted=now;
    requested=opening
      ? openingSector?.low?[openingSector]:[]
      : sectors.filter(s=>s.low && requestedZones.includes(s.zone) && now-s.wanted<linger);
    // Come back once the lingering requests have expired, even if the camera stays still.
    if(!lingerTimer && (requestedZones.some(z=>z.wanted!==now) || requested.some(s=>s.wanted!==now))){
      lingerTimer=window.setTimeout(()=>{lingerTimer=0;refresh();},linger+20);
    }
    function rank(s: ResidentSector){
      s.bounds.getCenter(projected);
      const visible=frustum.intersectsBox(s.bounds);
      const retained=lod?.stable && driving && now-(lastVisible.get(s.id)??-Infinity)<350;
      return (visible?0:1e10)+projected.distanceToSquared(aheadPoint)-(retained?3600:0);
    }
    // The same grace as the requests: a sector on the edge of the screen keeps one answer while its download runs.
    for(const s of sectors){if(frustum.intersectsBox(s.bounds))s.seen=now;s.inView=now-s.seen<linger;}
    requested.sort((a,b)=>rank(a)-rank(b));
    let fading=0;
    for(const s of sectors){
      if(!s.low)continue;
      const show=requested.includes(s)&&!!s.detail;
      if(lod){
        if(show!==displayed.has(s.id)){
          if(show)displayed.add(s.id);else displayed.delete(s.id);
          lod.observe?.(s.id,show);
        }
        if(show && frustum.intersectsBox(s.bounds))lastVisible.set(s.id,now);
      }
      s.low.visible=!show;
      if(s.detail){s.detail.visible=show;if(show)s.used=tick;}
      if(transitions.get(s.id)?.step(show,now,opening==='covered' && s===openingSector))fading++;
    }
    if(fading || activeFades)refresh();
    activeFades=fading;
    if(pendingZone && !requestedZones.includes(pendingZone.z))pendingZone.controller.abort();
    if(!pendingZone){
      const next=requestedZones.find(z=>!z.assets && z.retry<=performance.now());
      if(next)void loadZoneLevel(next);
    }
    if(pending && !requested.includes(pending.s))pending.controller.abort();
    if(!pending){
      for(const s of requested){
        if(s.detail || s.retry>performance.now())continue;
        // Once its size is known, a sector is fetched only if what cannot be evicted for it leaves room.
        const free=evictableFor(s).reduce((n,other)=>n+required(other.assets,"sector assets").bytes,0);
        if(s.estimate && bytes-free+s.estimate>budget)continue;
        void load(s);break;
      }
    }
    host.dataset.sectors=JSON.stringify({near,mid,fading,loaded:sectors.filter(s=>s.detail).length,
      visible:sectors.filter(s=>s.detail?.visible).length,zones:zones.filter(z=>z.assets).map(z=>z.id),
      zoneBytes,bytes,budget,shadowBytes,shadowBudget,evictions,
      pending:pending?.s.id??pendingZone?.z.id??null});
    return {zoneReady:!openingZone || !!openingZone.assets,busy:!!pending || !!pendingZone || fading>0};
  }
  return {...base,groundAt,update,suspend,forget,demand,
    setStaticShadows(enabled:boolean){
      if(enabled===staticEnabled)return;
      staticEnabled=enabled;
      syncShadowMasks();
    },
    get shadowsPending(){return staticEnabled && (requestedZones.length?requestedZones.some(z=>masks.get(z.id)?.pending):!!farMask?.pending);},
    disposeShadows(){farMask?.dispose();for(const mask of masks.values())mask.dispose();},
    undemand(){demanded=undefined;}};
}
