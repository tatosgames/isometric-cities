import * as T from 'three';
import type { BuildingRange } from '../render/scene.ts';

export function previewBuilding(ranges: BuildingRange[]) {
  const spans = ranges.map(({mesh,start,count}) => {
    const position = mesh.geometry.getAttribute('position') as T.BufferAttribute;
    const first = start*3, length = count*3;
    mesh.frustumCulled = false;
    return {mesh,position,first,length,original:position.array.slice(first,first+length)};
  });

  function write(x: number,y: number,z: number,hidden = false) {
    for (const {position,first,length,original} of spans) {
      const array = position.array;
      if (hidden) array.fill(0,first,first+length);
      else for (let i=0;i<length;i+=3) {
        array[first+i] = original[i]+x;
        array[first+i+1] = original[i+1]+y;
        array[first+i+2] = original[i+2]+z;
      }
      position.addUpdateRange(first,length);
      position.needsUpdate = true;
    }
  }

  return {
    move: (x: number,y: number,z: number) => write(x,y,z),
    hide: () => write(0,0,0,true),
    restore() {
      write(0,0,0);
      for (const {mesh} of spans) mesh.frustumCulled = true;
    }
  };
}
