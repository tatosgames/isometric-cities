import * as T from 'three';
import type { BuildingState } from './flood-impact.ts';

/** One colour per building state: grey while dry, then the hazard tones up to the collapse. */
export const STATE_TONES: Record<BuildingState, string> = {
  dry: '#9aa3a6', wet: '#f2d46b', flooded: '#f0932b', damaged: '#d63a35', collapsed: '#3b0f1e'
};

/**
 * Markers over the watched buildings (hospitals, schools…): a small octahedron above each roof, coloured by state.
 * One instanced draw call; colours change only when a state does.
 */
export function makeFloodMarkers(places: readonly {x: number; y: number; top: number}[]) {
  const mesh = new T.InstancedMesh(new T.OctahedronGeometry(2.6, 0), new T.MeshBasicMaterial(), Math.max(1, places.length));
  mesh.count = places.length;
  const matrix = new T.Matrix4(), colour = new T.Color(), shown: (BuildingState | null)[] = places.map(() => null);
  places.forEach((p, i) => {
    mesh.setMatrixAt(i, matrix.makeScale(1, 1.6, 1).setPosition(p.x, p.top + 9, -p.y));
    mesh.setColorAt(i, colour.set(STATE_TONES.dry));
  });
  mesh.frustumCulled = false;
  return {
    mesh,
    show(states: readonly BuildingState[]) {
      let changed = false;
      states.forEach((s, i) => {
        if (shown[i] === s) return;
        shown[i] = s; changed = true;
        mesh.setColorAt(i, colour.set(STATE_TONES[s]));
      });
      if (changed && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    dispose() { mesh.geometry.dispose(); (mesh.material as T.Material).dispose(); }
  };
}
