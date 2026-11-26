import * as T from 'three';
import type { Building, RoofTones } from '../data/types.ts';
import { roofTone } from '../render/roof-tone.ts';
import { wallTone } from '../render/scene.ts';
import { makeDebris, type Blast } from './debris.ts';
import { fractureBuilding, rubbleSlab } from './fracture.ts';

const RUBBLE = '#a39886';

/**
 * Brings buildings down, in the demolition lab and in the drive: `hide` takes the building out of the city meshes,
 * then it breaks into the pieces of `fracture.ts` at the blast, which fly as `debris.ts` and leave a rubble slab.
 * `update` moves the pieces and says when the shadow map has to follow.
 */
export function makeDemolisher({material, altitude, tones, hide}: {
  material: T.Material;
  altitude: (east: number, north: number) => number;
  tones: RoofTones | null;
  hide: (id: number) => void;
}) {
  const debris = makeDebris(material, altitude);
  const done = new Set<number>();
  /** `base` is the ground under the footprint's first corner, where the walls stand. False if already down. */
  function demolish(b: Building, base: number, blast: Blast) {
    if (done.has(b.id)) return false;
    done.add(b.id);
    hide(b.id);
    debris.burst(fractureBuilding({building: b, base, wall: wallTone(b), roof: roofTone(b, tones),
      impact: [blast.point.x, -blast.point.z]}), blast);
    debris.slab(b.id, rubbleSlab(b, base, .9, RUBBLE));
    return true;
  }
  /** The building stands again (the caller has put it back in the city): its rubble goes. */
  function restore(id: number) {
    done.delete(id);
    debris.clearSlab(id);
  }
  return {root: debris.root, demolish, restore, update: debris.update, demolished: done,
    get pieces() { return debris.pieces; }, get dust() { return debris.dust; }};
}
