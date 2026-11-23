import * as T from 'three';
import type { Altitude, CityData } from '../data/types.ts';

const upAxis=new T.Vector3(0,1,0);
export const normalizeTurn=(turn: number)=>T.MathUtils.euclideanModulo(turn,4);

interface FramingOptions {
  host: HTMLElement;
  compact: boolean;
  data: CityData;
  altitude: Altitude;
  /** Unit vector from the target towards the camera at turn 0. */
  direction: T.Vector3;
}

/** How the map camera is oriented and how far it may zoom out: pure geometry of the city outline and the screen. */
export function makeMapFraming({host,compact,data,altitude,direction}: FramingOptions){
  const mapInclination=Math.acos(direction.y);
  const mapOffset=new T.Vector3();
  function mapDirection(turn: number){return mapOffset.copy(direction).applyAxisAngle(upAxis,normalizeTurn(turn)*Math.PI/2);}
  const border=data.boundary.map(([x,y])=>new T.Vector3(x,altitude(x,y),-y));
  const bounds=new T.Box3().setFromPoints(border);
  const center=bounds.getCenter(new T.Vector3());
  function fitAt(turn: number){
    const offset=mapDirection(turn);
    const right=new T.Vector3().crossVectors(upAxis,offset).normalize();
    const up=new T.Vector3().crossVectors(offset,right);
    const point=new T.Vector3();
    let halfWidth=0,halfHeight=0;
    // Measure from the actual orbit center so an asymmetric coastline still fits.
    for(const vertex of border){
      point.copy(vertex).sub(center);
      halfWidth=Math.max(halfWidth,Math.abs(point.dot(right)));
      halfHeight=Math.max(halfHeight,Math.abs(point.dot(up)));
    }
    return Math.max(farthest(),Math.min(host.clientWidth/(2*halfWidth+60),host.clientHeight/(2*halfHeight+65))*.92);
  }
  // The widest view shows a district, never the whole city: its longer side covers this many metres.
  // It stays inside the span where every building is drawn, so the merged far level only fills in while zones load.
  function farthest(){return Math.max(host.clientWidth,host.clientHeight)/(compact?2400:3000);}
  function openingZoom(){return Math.max(host.clientWidth/340,host.clientHeight/225);}
  return {mapInclination,mapDirection,bounds,center,fitAt,farthest,openingZoom};
}
