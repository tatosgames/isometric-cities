import * as T from 'three';
import type { MapProp } from '../data/pilot-edits.ts';
import type { CityData, Building, Ring, RoofTones } from '../data/types.ts';
import { makeCity, type BuildingRange } from '../render/scene.ts';
import { required } from '../required.ts';
import { previewBuilding } from './building-drag.ts';
import { disposeMeshes, makeProp, poseProp } from './props.ts';

function extrude(rings: Ring[], height: number, altitude: number) {
  const paths = rings.map(ring => ring.map(([x,y]) => new T.Vector2(x,y)));
  const shape = new T.Shape(paths[0]);
  shape.holes = paths.slice(1).map(ring => new T.Path(ring));
  return new T.ExtrudeGeometry(shape,{ depth: height, bevelEnabled: false }).translate(0,0,altitude).rotateX(-Math.PI/2);
}

export function makeCityView(scene: T.Scene, tones: RoofTones) {
  const props = new T.Group(), pickables = new T.Group();
  const propModels = new Map<string,T.Object3D>();
  const buildingRanges = new Map<Ring[],BuildingRange[]>();
  let city: ReturnType<typeof makeCity>;
  let previous: CityData | undefined;
  let moving: ReturnType<typeof previewBuilding> | undefined;
  let reshaped: T.Mesh | undefined;

  function rebuild(data: CityData, edits: MapProp[]) {
    if (!previous || previous.buildings.some((building,part) => building.rings !== data.buildings[part].rings)) {
      if (previous) {
        disposeMeshes(city.group);
        city.groundMap?.texture.dispose();
        disposeMeshes(pickables);
        pickables.clear();
      }
      buildingRanges.clear();
      city = makeCity(data,false,tones,false,null,buildingRanges,true);
      scene.add(city.group);
      const material = new T.MeshBasicMaterial({ side: T.DoubleSide });
      data.buildings.forEach((building,part) => {
        const z = city.altitude(...building.rings[0][0]);
        const geometry = extrude(building.rings,building.heightOverride ?? building.height,z);
        const mesh = new T.Mesh(geometry,material);
        mesh.userData.part = part;
        pickables.add(mesh);
      });
    }
    previous = data;
    disposeMeshes(props);
    props.clear();
    propModels.clear();
    for (const prop of edits) {
      const model = makeProp(prop,city.groundAt);
      model.userData.prop = prop.id;
      propModels.set(prop.id,model);
      props.add(model);
    }
    scene.add(props);
  }

  function previewFootprint(building: Building, rings: Ring[], translate: boolean) {
    const origin = building.rings[0][0], target = rings[0][0];
    const bottom = city.altitude(...target), height = building.heightOverride ?? building.height;
    moving ??= previewBuilding(buildingRanges.get(building.rings) ?? []);
    if (translate) {
      moving.move(target[0]-origin[0],bottom-city.altitude(...origin),origin[1]-target[1]);
    } else if (reshaped) {
      reshaped.geometry.dispose();
      reshaped.geometry = extrude(rings,height,bottom);
    } else {
      moving.hide();
      reshaped = new T.Mesh(extrude(rings,height,bottom),new T.MeshLambertMaterial({color:0xbc7958}));
      scene.add(reshaped);
    }
    return bottom + height + .18;
  }

  return {
    get city(){ return city; },
    rebuild,
    propModel: (id: string) => propModels.get(id),
    buildingMesh: (part: number) => pickables.children[part],
    pick: (ray: T.Raycaster) => ray.intersectObjects([...props.children,...pickables.children],true)[0],
    poseProp: (prop: MapProp) => poseProp(required(propModels.get(prop.id),'prop'),prop,city.groundAt),
    previewFootprint,
    clearPreview(){
      moving?.restore();
      moving = undefined;
      if (reshaped) disposeMeshes(reshaped);
      reshaped = undefined;
    }
  };
}
