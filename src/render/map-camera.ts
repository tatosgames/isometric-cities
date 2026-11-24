import * as T from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';

/**
 * The orthographic camera shared by the map, the drive, the editor and the labs. Its frustum is in CSS pixels,
 * so `zoom` reads as pixels per metre. Depth in an orthographic projection is linear: 1 to 5000 m keeps
 * millimetre precision, and the nearest visible ground stays some 400 m in front of the camera.
 */
export const CAMERA_DISTANCE=1500;
const NEAR=1,FAR=5000;

/** From the target towards the camera at the map's first quarter turn: the isometric angle of the whole atlas. */
export const mapViewDirection=()=>new T.Vector3(-.82,1.15,.68).normalize();

export function makeMapCamera(){return new T.OrthographicCamera(-1,1,1,-1,NEAR,FAR);}

/**
 * Size the frustum to the host in pixels. `shift` moves the image so the orbit target sits that many pixels right
 * of and below the centre: a view offset changes only the projection, so panning, zoom to the cursor, picking and
 * projected markers keep working around the target.
 */
export function fitPixels(camera: T.OrthographicCamera,width: number,height: number,shift?: {x: number;y: number}){
  camera.left=-width/2;camera.right=width/2;camera.top=height/2;camera.bottom=-height/2;
  if(shift && (shift.x || shift.y))camera.setViewOffset(width,height,-shift.x,-shift.y,width,height);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

/**
 * The point at the height of `point` that the camera shows `dx` pixels right of and `dy` pixels below it.
 * `toCamera` is the unit vector from the target towards the camera; its height is the sine of the elevation.
 */
export function screenOffsetOnGround(out: T.Vector3,point: T.Vector3,dx: number,dy: number,zoom: number,toCamera: T.Vector3){
  const flat=Math.hypot(toCamera.x,toCamera.z) || 1;
  const across=dx/(zoom*flat),toward=dy/(zoom*toCamera.y*flat);
  return out.set(point.x+toCamera.z*across+toCamera.x*toward,point.y,point.z-toCamera.x*across+toCamera.z*toward);
}

const basePan=(MapControls.prototype as unknown as {_pan(deltaX: number,deltaY: number): void})._pan;
const toEye=new T.Vector3();

/**
 * Map controls whose ground stays under the finger too. MapControls already grabs the ground under the mouse;
 * a touch pan goes through `_pan`, which moves the target by as many metres as the finger moved pixels, and seen
 * at an angle a ground step towards the camera looks shorter by the sine of the elevation. The vertical part is
 * stretched back by that sine. `_pan` is internal to three.js: if it disappears, touch pans as three.js does.
 */
export class GroundControls extends MapControls {
  _pan(deltaX: number,deltaY: number){
    const sine=this.screenSpacePanning?1:toEye.subVectors(this.object.position,this.target).normalize().y;
    basePan.call(this,deltaX,deltaY/Math.max(.2,sine));
  }
}
