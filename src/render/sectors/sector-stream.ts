import type { Building, CityCore, Layers, Point, Ring, RoofTones, SectorIndex, Zone, ZoneData } from '../../data/types.ts';
import { ringCenter, sectorOwner, zoneOfSector } from '../../data/sector-index.ts';
import { isLayers, isZone, loadData } from '../../data/load.ts';
import { required } from '../../required.ts';
import {surfaceStencil} from '../building-stencil.ts';
import { sectorBuilder } from './sector-builder.ts';
import { overviewBlocks, overviewBuildings, overviewGround } from '../overview.ts';
import * as T from 'three';
import { makeCity } from '../scene.ts';
import { breezy } from '../wind.ts';
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
  return {
    bytes:[...arrays].reduce((n,a)=>n+a.byteLength,0),
    dispose(){
      group.removeFromParent();
      group.traverse(mesh=>{if(mesh instanceof T.InstancedMesh)mesh.dispose();});
      for(const geometry of geometries)geometry.dispose();
      for(const material of materials)material.dispose();
    }
  };
}

// Three levels. Far: merged blocks of every zone, always resident. Zone: one silhouette per building, on demand.
// Sector: full detail inside a loaded zone, within the byte budget. Zones are bounded by the view and counted apart.
export function streamCity({data,stage='city',neutral,tones,compact,refresh,host,legacyRoads=false,loadLayers,loadZone,onZone,lod}: StreamOptions){
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
  const zones: ResidentZone[]=data.zones.map(z=>{
    const far=new T.Group(),level=required(data.far[z.id],'far level of zone '+z.id);
    const surface=overviewGround(level.ground,base.altitude,base.groundMap,farGround);
    far.add(overviewBlocks(level.blocks,base.altitude,neutral,overviewMaterials),surface);
    base.group.add(far);
    const bounds=box(z.bounds,z.vertical);
    return {id:z.id,file:z.file,far,farGroundAt:groundSampler(()=>[surface.geometry]),bounds,prefetch:bounds.clone().expandByScalar(data.sectorSize*.5),
      sectors:[],assets:null,group:null,map:null,wanted:-Infinity,used:0,failed:0,retry:0};
  });
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
  const budget=(compact?58:115)*1024*1024;
  // What leaves the view stays requested this long, in milliseconds. A camera hovering on a boundary would
  // otherwise start and cancel the same download at every step.
  const linger=600;
  let lingerTimer=0;
  // Zones that left the view stay for a quick return, up to this many.
  const idleZones=2;
  // Longest side of the view, in metres, that still shows one silhouette per building. Beyond it, merged blocks.
  const zoneSpan=compact?3200:6000;
  const frustum=new T.Frustum(),matrix=new T.Matrix4(),projected=new T.Vector3();
  const lastTarget=new T.Vector3(),ahead=new T.Vector3(),aheadPoint=new T.Vector3();
  let requested: ResidentSector[]=[],requestedZones: ResidentZone[]=[];
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
  function releaseZone(z: ResidentZone){
    if(!z.assets)return;
    for(const s of z.sectors){release(s);s.low=null;s.groundAt=null;}
    z.assets.dispose();zoneBytes-=z.assets.bytes;z.assets=null;z.group=null;z.map=null;z.far.visible=true;
    onZone?.(z.id,null);
  }
  async function loadZoneLevel(z: ResidentZone){
    const controller=new AbortController();
    pendingZone={z,controller};
    try{
      const source=required(data.zones.find(zone=>zone.id===z.id),'zone '+z.id);
      const content=await (loadZone?loadZone(source,controller.signal):loadData(stage+'-zones/'+z.file,isZone,controller.signal));
      if(controller.signal.aborted || !requestedZones.includes(z))return;
      const [west,south,east,north]=source.bounds;
      // The zone paints its own ground, so its sharpness does not depend on the size of the city.
      const map=neutral?null:makeGroundMap({...data,buildings:content.buildings,textureBounds:[west-5,south-5,east+5,north+5]},
        .6,streetPriority,data.roadFallback,coverage);
      const material=ground(map?.texture??null),group=new T.Group();
      const batches=new Map(z.sectors.map(s=>[s.id,{buildings:[] as Building[],trees:[] as Point[],ground:[] as Ring[]}]));
      const batch=(id: string)=>required(batches.get(id),'sector '+id+' of zone '+z.id);
      content.buildings.forEach((b,i)=>batch(content.owners[i]).buildings.push(b));
      for(const tree of content.trees)batch(owner(...tree)).trees.push(tree);
      for(const ring of content.ground)batch(owner(...ringCenter(ring))).ground.push(ring);
      for(const s of z.sectors){
        const b=batch(s.id);
        const surface=overviewGround(b.ground,base.altitude,map,material);
        s.low=new T.Group();
        s.groundAt=groundSampler(()=>[surface.geometry]);
        s.low.add(overviewBuildings(b.buildings,b.trees,base.altitude,tones,neutral,overviewMaterials),surface);
        group.add(s.low);
      }
      // The building materials belong to every zone and to the far level: release only what the zone owns.
      const assets: Assets={bytes:resources(group).bytes+(map?textureBytes(map.texture):0),dispose(){
        group.removeFromParent();
        group.traverse(mesh=>{if(mesh instanceof T.Mesh)mesh.geometry.dispose();});
        material.dispose();map?.texture.dispose();
      }};
      z.assets=assets;z.group=group;z.map=map;z.failed=0;zoneBytes+=assets.bytes;base.group.add(group);z.far.visible=false;
      onZone?.(z.id,content);
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
      if(controller.signal.aborted || !requested.includes(s))return;
      const local=await build(layers,controller.signal);
      if(!local || !s.low)return;
      const detail=local.group;
      const assets=resources(detail);
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
    let fading=0,openingFading=false;
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
      if(transitions.get(s.id)?.step(show,now,opening==='covered' && s===openingSector)){
        fading++;
        if(s===openingSector)openingFading=true;
      }
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
      zoneBytes,bytes,budget,evictions,
      pending:pending?.s.id??pendingZone?.z.id??null});
    return {
      zoneReady:!openingZone || !!openingZone.assets,
      detailReady:!openingSector || (!!openingSector.detail?.visible && !openingFading)
    };
  }
  return {...base,groundAt,update,suspend,demand,undemand(){demanded=undefined;}};
}
