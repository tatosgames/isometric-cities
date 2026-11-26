import * as T from 'three';
import type { Building, RoofTones } from '../data/types.ts';
import { roofTone } from '../render/roof-tone.ts';
import { wallTone } from '../render/scene.ts';
import { makeDebris, type Blast } from './debris.ts';
import { fractureBuilding, rubbleSlab } from './fracture.ts';

const RUBBLE = '#a39886';

/** A footprint as the city draws it, and the ground under its first corner, where its walls stand. */
export interface Part { building: Building; base: number }

/**
 * Brings buildings down, in the demolition lab and in the drive. What comes down is what the city draws under one
 * id: every volume of a building split in parts, or a block of neighbours fused on small screens. `hide` takes it
 * out of the city meshes; each part breaks into the pieces of `fracture.ts` at the blast, which fly as `debris.ts`
 * and leave a rubble slab. `update` moves the pieces and says when the shadow map has to follow.
 */
export function makeDemolisher({material, altitude, tones, hide}: {
  material: T.Material;
  altitude: (east: number, north: number) => number;
  tones: RoofTones | null;
  hide: (id: number) => void;
}) {
  const debris = makeDebris(material, altitude);
  const done = new Set<number>();
  /** False if it is already down. */
  function demolish(id: number, parts: readonly Part[], blast: Blast) {
    if (done.has(id) || !parts.length) return false;
    done.add(id);
    hide(id);
    const impact: [number, number] = [blast.point.x, -blast.point.z];
    for (const {building: b, base} of parts)
      debris.burst(fractureBuilding({building: b, base, wall: wallTone(b), roof: roofTone(b, tones), impact}), blast);
    debris.slab(id, parts.flatMap(({building, base}) => rubbleSlab(building, base, .9, RUBBLE)));
    return true;
  }
  /** It stands again (the caller has put it back in the city): its rubble goes. */
  function restore(id: number) {
    done.delete(id);
    debris.clearSlab(id);
  }
  return {root: debris.root, demolish, restore, update: debris.update, demolished: done,
    get pieces() { return debris.pieces; }, get dust() { return debris.dust; }};
}
