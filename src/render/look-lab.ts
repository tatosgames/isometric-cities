import * as T from 'three';
import { staticShadowStyle } from './static-ground-shadow.ts';
import { wind } from './wind.ts';
import { pairs, query, search, setPairs } from '../url-state.ts';

/**
 * Looks chosen with `?look=` (`matcap` is the default and `base` uses the original lighting), followed by the
 * Matcap values: `?look=sole`, `?look=preset:clay,tilt:1`.
 * - `sole`: the same lit materials with tone mapping, a warmer and stronger sun and a weaker sky fill.
 * - `matcap`: the folio/Soso Mart style. Lit materials read a toon matcap instead of the lights;
 *   anything that darkens `diffuseColor` (static ground shadow, cloud shadows, contact darkening) still shows.
 *   The real shadow map does not, so this look keeps the static shadow mask.
 *   Its look is one set of parameters (`MatcapTune`) read from and written to the URL, tuned live in `?lab=quality`.
 */
export type Look = 'base' | 'sole' | 'matcap';

const LOOKS = ['base', 'sole', 'matcap'] as const;
/** The look named in `?look=` (its first bare item), if any. */
const namedLook = (q: URLSearchParams) => LOOKS.find(name => pairs(q, 'look').has(name));

export function readLook(): Look {
  return namedLook(query()) ?? 'matcap';
}

/**
 * The matcap look failed on this device (a shader that does not compile, or a probe that comes back black):
 * reloads the page with `?look=base`. A look named in the URL is kept, to debug the look and to never loop.
 */
let fellBack = false;
export function fallbackToBase(reason: 'probe' | 'shader') {
  if (fellBack) return;
  fellBack = true;
  const q = query(), forced = namedLook(q) !== undefined;
  console.error(`[atlas:gl] matcap look failed (${reason}), ${forced ? 'kept: look forced in the URL' : 'fallback to base look'}`);
  if (forced) return;
  setPairs(q, 'look', [['base', ''], ...pairs(q, 'look')]);
  location.replace('?' + search(q) + location.hash);
}

export function lightLook(look: Look, renderer: T.WebGLRenderer, fill: T.HemisphereLight, sun: T.DirectionalLight) {
  if (look !== 'sole') return;
  renderer.toneMapping = T.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  fill.color.set('#dce6ff'); fill.groundColor.set('#a88f78'); fill.intensity = .88;
  sun.color.set('#ffe2b8'); sun.intensity = 3.35;
}

type RGB = readonly [number, number, number];
interface MatcapPreset {
  label: string;
  shade: RGB; mid: RGB; lit: RGB;
  /** Smoothstep edges of the shade→mid and mid→lit bands, on the cosine to the light. */
  bands: readonly [number, number, number, number];
  rim: number;
  /** Colour the static ground shadow tends to: black darkens, a cool tone tints. */
  shadow: RGB;
}

// Toon matcaps lit from the upper left, as in Soso Mart. `toy` is the original one.
export const matcapPresets = {
  toy: {label: 'Toy day', shade: [164, 168, 196], mid: [236, 229, 218], lit: [255, 250, 238], bands: [.18, .26, .62, .68], rim: .08, shadow: [0, 0, 0]},
  matte: {label: 'Matte toy', shade: [176, 174, 198], mid: [232, 226, 216], lit: [250, 246, 236], bands: [-.1, .45, .5, .98], rim: .04, shadow: [.28, .3, .48]},
  clay: {label: 'Warm clay', shade: [168, 138, 132], mid: [228, 204, 184], lit: [252, 238, 220], bands: [.04, .4, .58, .9], rim: .1, shadow: [.42, .26, .3]},
  cel: {label: 'Hard cel', shade: [118, 126, 172], mid: [228, 222, 214], lit: [255, 252, 242], bands: [.2, .215, .65, .665], rim: 0, shadow: [.16, .18, .4]},
  pastel: {label: 'Pastel', shade: [196, 188, 224], mid: [244, 236, 232], lit: [255, 252, 246], bands: [.12, .32, .6, .76], rim: .12, shadow: [.45, .4, .62]}
} satisfies Record<string, MatcapPreset>;
export type MatcapPresetId = keyof typeof matcapPresets;

interface Palette { label: string; lift: RGB; gain: RGB; saturation: number; contrast: number }
// Colour grades applied after the output pass, in display space.
export const palettes = {
  neutral: {label: 'Neutral', lift: [0, 0, 0], gain: [1, 1, 1], saturation: 1, contrast: 1},
  cream: {label: 'Cream day', lift: [.025, .018, 0], gain: [1.02, 1, .93], saturation: .9, contrast: .95},
  warm: {label: 'Warm afternoon', lift: [.012, 0, 0], gain: [1.06, .99, .9], saturation: 1.06, contrast: 1.04},
  cool: {label: 'Cool morning', lift: [0, .01, .03], gain: [.95, .99, 1.06], saturation: .94, contrast: 1},
  rose: {label: 'Rose dusk', lift: [.03, 0, .025], gain: [1.05, .93, .97], saturation: 1, contrast: 1.03}
} satisfies Record<string, Palette>;
export type PaletteId = keyof typeof palettes;

export interface MatcapTune {
  preset: MatcapPresetId;
  /** Brightness of the matcap. */
  gain: number;
  /** Warm light bounced from the street onto walls. */
  bounce: number;
  /** Strength of the static building shadow on the ground (0 hides it). */
  shade: number;
  /** Strength of the moving cloud shadows. */
  clouds: number;
  palette: PaletteId;
  /** Pink glow at the frame edges. */
  glow: number;
  /** Folio edge blur, top and bottom of the frame. */
  tilt: number;
}

export const defaultTune: MatcapTune = {preset: 'toy', gain: 1.08, bounce: 0, shade: 1, clouds: 1, palette: 'neutral', glow: 0, tilt: 0};
const numbers = ['gain', 'bounce', 'shade', 'clouds', 'glow', 'tilt'] as const;

export function readTune(q: URLSearchParams): MatcapTune {
  const tune = {...defaultTune};
  const look = pairs(q, 'look'), preset = look.get('preset'), palette = look.get('palette');
  if (preset && preset in matcapPresets) tune.preset = preset as MatcapPresetId;
  if (palette && palette in palettes) tune.palette = palette as PaletteId;
  for (const key of numbers) {
    const raw = look.get(key);
    if (raw === undefined) continue;
    // A bare `tilt` in `?look=` keeps the old meaning: the full edge blur.
    const value = raw === '' ? 1 : Number(raw);
    if (Number.isFinite(value)) tune[key] = Math.max(0, Math.min(3, value));
  }
  return tune;
}

/** Writes `?look=` with only what differs from the defaults, so plain links stay plain. */
export function writeLook(url: URL, look: Look, tune: MatcapTune) {
  const entries: [string, string][] = look === 'matcap' ? [] : [[look, '']];
  if (tune.preset !== defaultTune.preset) entries.push(['preset', tune.preset]);
  if (tune.palette !== defaultTune.palette) entries.push(['palette', tune.palette]);
  for (const key of numbers) if (tune[key] !== defaultTune[key]) entries.push([key, String(+tune[key].toFixed(2))]);
  const q = new URLSearchParams(url.search);
  setPairs(q, 'look', entries);
  url.search = search(q);
  return url;
}

/**
 * The toon matcap computed from the normal in the shader, instead of read from a painted texture.
 * Some Android drivers (Adreno 630 on the Pixel 3) sampled the sRGB matcap texture painted on a canvas as black,
 * which turned every lit surface black. The formula is the one the texture was painted with: three bands on the
 * cosine to a light from the upper left, plus a rim, in sRGB and then decoded to linear like the texture was.
 */
const matcapShader = `
  vec2 lookN = normal.xy * .99;
  float lookR2 = dot(lookN, lookN);
  if (lookR2 > .999) { lookN *= sqrt(.999 / lookR2); lookR2 = .999; }
  float lookZ = sqrt(1. - lookR2);
  float lookD = dot(vec3(lookN, lookZ), vec3(-.3495, .5493, .7590));
  float lookA = smoothstep(lookBands.x, lookBands.y, lookD), lookB = smoothstep(lookBands.z, lookBands.w, lookD);
  float lookRimT = 1. - lookZ, lookRimGlow = lookRimT * lookRimT * lookRimT * lookRim;
  vec3 lookSrgb = min(vec3(1.), mix(lookShade, lookMid, lookA) * (1. - lookB) + lookLit * lookB + lookRimGlow);
  vec3 lookMatcap = sRGBTransferEOTF(vec4(lookSrgb, 1.)).rgb;`;

/** Post-processing settings of a tune, for `makeQualityOutput().setPost`. */
export function tunePost(tune: MatcapTune) {
  const palette: Palette = palettes[tune.palette];
  return {tilt: tune.tilt, glow: tune.glow, grade: tune.palette === 'neutral' ? null : palette};
}

export function makeMatcapLook(initial: MatcapTune) {
  const rgb = (c: RGB) => new T.Vector3(c[0] / 255, c[1] / 255, c[2] / 255);
  const shade = {value: new T.Vector3()}, mid = {value: new T.Vector3()}, light = {value: new T.Vector3()};
  const bands = {value: new T.Vector4()}, rim = {value: 0}, gain = {value: 1}, bounce = {value: 0};
  function set(tune: MatcapTune) {
    const preset: MatcapPreset = matcapPresets[tune.preset];
    shade.value.copy(rgb(preset.shade)); mid.value.copy(rgb(preset.mid)); light.value.copy(rgb(preset.lit));
    bands.value.fromArray(preset.bands); rim.value = preset.rim;
    gain.value = tune.gain; bounce.value = tune.bounce;
    staticShadowStyle.strength.value = tune.shade;
    staticShadowStyle.tint.value.fromArray(preset.shadow);
    wind.shade.value = tune.clouds;
  }
  set(initial);
  const patch = (material: T.Material) => {
    if (material.userData.look) return;
    material.userData.look = true;
    const lit = (material as T.MeshStandardMaterial).isMeshStandardMaterial || (material as T.MeshLambertMaterial).isMeshLambertMaterial
      || (material as T.MeshPhongMaterial).isMeshPhongMaterial;
    if (!lit) return;
    const inner = material.onBeforeCompile, innerKey = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      inner.call(material, shader, renderer);
      Object.assign(shader.uniforms, {lookShade: shade, lookMid: mid, lookLit: light, lookBands: bands, lookRim: rim,
        lookGain: gain, lookBounce: bounce});
      shader.fragmentShader = 'uniform vec3 lookShade, lookMid, lookLit; uniform vec4 lookBands;'
        + ' uniform float lookRim, lookGain, lookBounce;\n'
        + shader.fragmentShader.replace('#include <opaque_fragment>', `
        // Orthographic: one view direction, so the matcap depends on the normal only.
        ${matcapShader}
        outgoingLight = diffuseColor.rgb * lookMatcap * lookGain + totalEmissiveRadiance;
        // Walls face down the view (negative y): the street throws warm light back on them.
        outgoingLight += diffuseColor.rgb * vec3(1., .82, .64) * lookBounce * .45 * smoothstep(-.1, .6, -normal.y);
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => innerKey + '/look-matcap-A';
    material.needsUpdate = true;
  };
  const patchScene = (scene: T.Object3D) => scene.traverse(object => {
    const material = (object as T.Mesh).material;
    if (!material) return;
    if (Array.isArray(material)) material.forEach(patch); else patch(material);
  });
  /**
   * Draws a white lit square facing the camera with the look, once, into a 4 × 4 target and reads it back.
   * A driver that turns the matcap black (or NaN) raises no error: only the pixels tell. False means the look is unusable.
   */
  function probe(renderer: T.WebGLRenderer) {
    const target = new T.WebGLRenderTarget(4, 4);
    const scene = new T.Scene(), camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 2);
    const mesh = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshLambertMaterial({color: '#ffffff'}));
    mesh.position.z = -1; scene.add(mesh); patchScene(scene);
    const tuned = gain.value, previous = renderer.getRenderTarget(), pixels = new Uint8Array(4 * 4 * 4);
    gain.value = 1;
    try {
      renderer.setRenderTarget(target); renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, 4, 4, pixels);
    } finally {
      renderer.setRenderTarget(previous); gain.value = tuned;
      target.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
    }
    let sum = 0;
    for (let i = 0; i < pixels.length; i += 4) sum += pixels[i] + pixels[i + 1] + pixels[i + 2];
    // A face toward the camera takes the light band of every preset, well above black.
    return sum / (16 * 3) > 40;
  }
  return {set, patch: patchScene, probe};
}
