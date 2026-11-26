import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { defaultTune, matcapPresets, palettes, type Look, type MatcapTune } from '../render/look-lab.ts';

const choices = (table: Record<string, {label: string}>) =>
  Object.fromEntries(Object.entries(table).map(([id, {label}]) => [label, id]));

/**
 * `?lab=qualita` look panel: the look is one dropdown (changing it reloads, since lights and materials differ);
 * Matcap then exposes its parameters, applied live and kept in the URL by `change`.
 */
export function lookControls({look, tune, navigate, change}: {
  look: Look; tune: MatcapTune; navigate: (look: Look) => void; change: () => void;
}) {
  const root = document.createElement('div');
  root.className = 'look-lab';
  const gui = new GUI({container: root, title: 'Look'});
  const label = <C extends {domElement: HTMLElement}>(controller: C) => {
    const name = controller.domElement.querySelector('.name')?.textContent ?? '';
    for (const input of controller.domElement.querySelectorAll('input,select')) input.setAttribute('aria-label', name);
    return controller;
  };
  label(gui.add({look}, 'look', {Matcap: 'matcap', Base: 'base', Sole: 'sole'}).name('Rendering look')
    .onChange((next: Look) => navigate(next)));
  if (look === 'base') return root;
  // lil-gui types options by the property's value type: the ids are plain strings to it.
  const choice = tune as unknown as Record<'preset' | 'palette', string>;
  const slider = (folder: GUI, key: 'gain' | 'bounce' | 'shade' | 'clouds' | 'glow' | 'tilt', name: string, max: number, min = 0) =>
    label(folder.add(tune, key, min, max, .01).name(name).onChange(change));
  if (look === 'matcap') {
    const materials = gui.addFolder('Materials');
    label(materials.add(choice, 'preset', choices(matcapPresets)).name('Matcap').onChange(change));
    slider(materials, 'gain', 'Brightness', 1.4, .7);
    slider(materials, 'bounce', 'Street bounce', 1);
    const shadows = gui.addFolder('Shadows');
    slider(shadows, 'shade', 'Building shadow', 2);
    slider(shadows, 'clouds', 'Cloud shadow', 2);
    const atmosphere = gui.addFolder('Atmosphere');
    label(atmosphere.add(choice, 'palette', choices(palettes)).name('Palette').onChange(change));
  }
  const post = gui.addFolder('Post-processing');
  slider(post, 'tilt', 'Edge blur', 2);
  if (look === 'matcap') {
    slider(post, 'glow', 'Pink edge glow', 1);
    gui.add({reset() {
      Object.assign(tune, defaultTune);
      for (const controller of gui.controllersRecursive()) if (controller.property !== 'look') controller.updateDisplay();
      change();
    }}, 'reset').name('Reset Matcap');
  }
  return root;
}
