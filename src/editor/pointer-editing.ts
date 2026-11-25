import * as T from 'three';
import type { TransformControls } from 'three/addons/controls/TransformControls.js';
import type { GroundControls } from '../render/map-camera.ts';

export type Selection = { part: number } | { prop: string };
interface Pick {
  selection: Selection | null;
  vertex: number | null;
  point: T.Vector3;
}

interface PointerEditing {
  host: HTMLElement;
  canvas: HTMLCanvasElement;
  scene: T.Scene;
  camera: T.Camera;
  controls: GroundControls;
  gizmo: TransformControls;
  anchor: T.Object3D;
  isPlacing: () => boolean;
  idleCursor: () => string;
  pick: (ray: T.Raycaster) => Pick | null;
  select: (selection: Selection, vertex: number | null) => boolean;
  click: (ray: T.Raycaster) => void;
  preview: () => void;
  commit: () => void;
  restore: () => void;
}

export function bindPointerEditing({
  host,canvas,scene,camera,controls,gizmo,anchor,isPlacing,idleCursor,pick,select,click,preview,commit,restore
}: PointerEditing) {
  const pointer = new T.Vector2(), ray = new T.Raycaster();
  const plane = new T.Plane(new T.Vector3(0,1,0)), planeHit = new T.Vector3();
  let direct: { id: number; x: number; y: number; offset: T.Vector3; moved: boolean } | null = null;
  let clickStart: { id: number; x: number; y: number; gizmo: boolean } | null = null;

  function pointRay(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(2*(event.clientX-rect.left)/rect.width-1,1-2*(event.clientY-rect.top)/rect.height);
    scene.updateMatrixWorld();
    camera.updateMatrixWorld();
    ray.setFromCamera(pointer,camera);
  }

  function stopDirect() {
    if (!direct) return false;
    const {id,moved} = direct;
    direct = null;
    delete host.dataset.dragging;
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    canvas.style.cursor = idleCursor();
    return moved;
  }

  function cancel() {
    if (!direct && !gizmo.dragging) return;
    stopDirect();
    gizmo.dragging = false;
    gizmo.axis = null;
    restore();
  }

  const primaryPress = (event: PointerEvent) =>
    event.isPrimary && event.button === 0 && !event.shiftKey && !event.ctrlKey && !event.metaKey;
  gizmo.addEventListener('dragging-changed',event => { controls.enabled = !event.value; });
  gizmo.addEventListener('objectChange',preview);
  gizmo.addEventListener('mouseUp',commit);

  // A direct drag claims the event before OrbitControls or the normal click handlers see it.
  canvas.addEventListener('pointerdown',event => {
    if (!primaryPress(event) || isPlacing()) return;
    pointRay(event);
    if (gizmo.enabled) {
      gizmo.pointerHover({x:pointer.x,y:pointer.y,button:event.button} as PointerEvent);
      if (gizmo.axis) return;
    }
    const picked = pick(ray);
    if (!picked?.selection || !select(picked.selection,picked.vertex)) return;
    plane.constant = -picked.point.y;
    if (!ray.ray.intersectPlane(plane,planeHit)) return;
    direct = {id:event.pointerId,x:event.clientX,y:event.clientY,offset:anchor.position.clone().sub(planeHit),moved:false};
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
    event.stopImmediatePropagation();
  },{capture:true});

  canvas.addEventListener('pointermove',event => {
    if (direct?.id !== event.pointerId) return;
    if (!direct.moved && Math.hypot(event.clientX-direct.x,event.clientY-direct.y) < 4) return;
    pointRay(event);
    if (!ray.ray.intersectPlane(plane,planeHit)) return;
    direct.moved = true;
    host.dataset.dragging = 'true';
    anchor.position.copy(planeHit.add(direct.offset));
    preview();
  });

  canvas.addEventListener('pointerup',event => {
    if (direct?.id !== event.pointerId) return;
    if (stopDirect()) commit();
    event.stopImmediatePropagation();
  },{capture:true});

  canvas.addEventListener('pointerdown',event => {
    if (!primaryPress(event)) return;
    clickStart = {x:event.clientX,y:event.clientY,id:event.pointerId,gizmo:gizmo.dragging};
  });
  canvas.addEventListener('pointercancel',() => { clickStart = null; cancel(); });
  canvas.addEventListener('lostpointercapture',event => { if (direct?.id === event.pointerId) cancel(); });
  window.addEventListener('blur',cancel);

  canvas.addEventListener('pointerup',event => {
    const start = clickStart;
    clickStart = null;
    if (!start || start.id !== event.pointerId || start.gizmo
      || Math.hypot(event.clientX-start.x,event.clientY-start.y) > 5) return;
    pointRay(event);
    click(ray);
  });

  return { get active(){ return !!direct || gizmo.dragging; },cancel };
}
