import { MathUtils, type Spherical, type Vector2, type Vector3 } from 'three';
import { normalizeTurn } from './framing.ts';

export interface Flight {
  start: number; duration: number;
  from: Vector3; to: Vector3;
  z0: number; z1: number;
  turn0: number; turn1: number;
  /** Screen-space offsets that place the target beside the place card. */
  s0: Vector2; s1: Vector2;
  driveOrbit: Spherical | undefined;
}

export interface DragSample {t: number; x: number; z: number; zoom: number}
export const coastWindow=100;

export function measureCoast(trail: readonly DragSample[],now: number,out: Vector3){
  const last=trail.at(-1);
  let first=trail.find(p=>now-p.t<=coastWindow && p.zoom===last?.zoom);
  const previous=trail.at(-2);
  // A long frame can leave only one sample in the window.
  if(first===last && previous && previous.zoom===last?.zoom && last.t-previous.t<=3*coastWindow)first=previous;
  if(!last || !first || last===first || now-last.t>80)return false;
  out.set(last.x-first.x,0,last.z-first.z).divideScalar((last.t-first.t)/1000);
  return true;
}

export function sampleFlight(flight: Flight,time: number){
  const t=MathUtils.clamp((time-flight.start)/flight.duration,0,1),ease=t*t*(3-2*t);
  const turn=t>=1?normalizeTurn(flight.turn1):MathUtils.lerp(flight.turn0,flight.turn1,ease);
  const zoom=flight.z0===flight.z1?flight.z0:Math.exp(MathUtils.lerp(Math.log(flight.z0),Math.log(flight.z1),ease));
  return {t,ease,turn,zoom};
}
