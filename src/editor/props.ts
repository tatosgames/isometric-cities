import * as T from 'three';
import type { MapProp } from '../data/pilot-edits.ts';
import type { Altitude } from '../data/types.ts';

export function makeProp(prop: MapProp, altitude: Altitude) {
  const model = new T.Group();
  const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number) => {
    const mesh = new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshLambertMaterial({ color }));
    mesh.position.set(x,y,z);
    mesh.castShadow = true;
    model.add(mesh);
  };
  switch (prop.kind) {
    case 'bench':
      for (const x of [-.62,.62]) box(.09,.45,.45,'#444c48',x,.225,0);
      box(1.65,.09,.5,'#a46d47',0,.46,0);
      box(1.65,.27,.07,'#a46d47',0,.73,-.22);
      for (const x of [-.62,.62]) box(.07,.33,.08,'#444c48',x,.61,-.22);
      break;
    case 'bollard':
      box(.17,.83,.17,'#465750',0,.415,0);
      box(.18,.07,.18,'#e8dfc1',0,.73,0);
      break;
    case 'planter':
      box(1.05,.52,.8,'#b97e63',0,.26,0);
      box(.94,.19,.69,'#698052',0,.54,0);
      break;
  }
  poseProp(model,prop,altitude);
  return model;
}

export function poseProp(model: T.Object3D, prop: MapProp, altitude: Altitude) {
  const [east,north] = prop.position;
  model.position.set(east,altitude(east,north),-north);
  model.rotation.y = prop.yaw;
}

export function disposeMeshes(group: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>();
  group.traverse(object => {
    if (object instanceof T.InstancedMesh) object.dispose();
    if (object instanceof T.Mesh || object instanceof T.Line) {
      geometries.add(object.geometry);
      for (const material of [object.material].flat()) materials.add(material);
    }
  });
  group.removeFromParent();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
