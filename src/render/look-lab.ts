import * as T from 'three';
import { staticShadowStyle } from './static-ground-shadow.ts';
import { wind } from './wind.ts';

/**
 * Looks chosen with `?look=` (`matcap` is the default and `base` uses the original lighting):
 * - `sole`: the same lit materials with tone mapping, a warmer and stronger sun and a weaker sky fill.
 * - `matcap`: the folio/Soso Mart style. Lit materials read a toon matcap instead of the lights;
 *   anything that darkens `diffuseColor` (static ground shadow, cloud shadows, contact darkening) still shows.
 *   The real shadow map does not, so this look keeps the static shadow mask.
 *   Its look is one set of parameters (`MatcapTune`) read from and written to the URL, tuned live in `?lab=qualita`.
 */
export type Look = 'base' | 'sole' | 'matcap';

export function readLook(): Look {
  const value = new URLSearchParams(location.search).get('look');
  return value === 'base' || value === 'sole' ? value : 'matcap';
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

export function readTune(query: URLSearchParams): MatcapTune {
  const tune = {...defaultTune};
  const preset = query.get('matcap'), palette = query.get('palette');
  if (preset && preset in matcapPresets) tune.preset = preset as MatcapPresetId;
  if (palette && palette in palettes) tune.palette = palette as PaletteId;
  for (const key of numbers) {
    const raw = query.get(key);
    if (raw === null) continue;
    // A bare `?tilt` keeps the old meaning: the full edge blur.
    const value = raw === '' ? 1 : Number(raw);
    if (Number.isFinite(value)) tune[key] = Math.max(0, Math.min(3, value));
  }
  return tune;
}

/** Writes only what differs from the defaults, so plain links stay plain. */
export function writeTune(url: URL, tune: MatcapTune) {
  url.searchParams.delete('matcap'); url.searchParams.delete('palette');
  for (const key of numbers) url.searchParams.delete(key);
  if (tune.preset !== defaultTune.preset) url.searchParams.set('matcap', tune.preset);
  if (tune.palette !== defaultTune.palette) url.searchParams.set('palette', tune.palette);
  for (const key of numbers) if (tune[key] !== defaultTune[key]) url.searchParams.set(key, String(+tune[key].toFixed(2)));
  return url;
}

function paintMatcap(texture: T.CanvasTexture<HTMLCanvasElement>, preset: MatcapPreset) {
  const canvas = texture.image, size = canvas.width;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  const light = new T.Vector3(-.35, .55, .76).normalize();
  const {shade, mid, lit, bands: [a0, a1, b0, b1], rim} = preset;
  const step = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let x = (i + .5) / size * 2 - 1, y = 1 - (j + .5) / size * 2, r2 = x * x + y * y;
    if (r2 > .999) { const k = Math.sqrt(.999 / r2); x *= k; y *= k; r2 = .999; }
    const z = Math.sqrt(1 - r2), d = x * light.x + y * light.y + z * light.z;
    const a = step(a0, a1, d), b = step(b0, b1, d), glow = Math.pow(1 - z, 3) * rim, o = (j * size + i) * 4;
    for (let k = 0; k < 3; k++) image.data[o + k] = Math.min(255, (shade[k] + (mid[k] - shade[k]) * a) * (1 - b) + lit[k] * b + glow * 255);
    image.data[o + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  texture.needsUpdate = true;
}

function makeMatcapTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.generateMipmaps = false; texture.minFilter = T.LinearFilter;
  return texture;
}

/** Post-processing settings of a tune, for `makeQualityOutput().setPost`. */
export function tunePost(tune: MatcapTune) {
  const palette: Palette = palettes[tune.palette];
  return {tilt: tune.tilt, glow: tune.glow, grade: tune.palette === 'neutral' ? null : palette};
}

export function makeMatcapLook(initial: MatcapTune) {
  const matcap = {value: makeMatcapTexture()}, gain = {value: 1}, bounce = {value: 0};
  let painted: MatcapPresetId | null = null;
  function set(tune: MatcapTune) {
    if (painted !== tune.preset) { painted = tune.preset; paintMatcap(matcap.value, matcapPresets[tune.preset]); }
    gain.value = tune.gain; bounce.value = tune.bounce;
    staticShadowStyle.strength.value = tune.shade;
    staticShadowStyle.tint.value.fromArray(matcapPresets[tune.preset].shadow);
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
      shader.uniforms.lookMatcap = matcap; shader.uniforms.lookGain = gain; shader.uniforms.lookBounce = bounce;
      shader.fragmentShader = 'uniform sampler2D lookMatcap; uniform float lookGain; uniform float lookBounce;\n'
        + shader.fragmentShader.replace('#include <opaque_fragment>', `
        // Orthographic: one view direction, so the matcap depends on the normal only.
        vec2 lookUv = normal.xy * .495 + .5;
        outgoingLight = diffuseColor.rgb * texture2D(lookMatcap, lookUv).rgb * lookGain + totalEmissiveRadiance;
        // Walls face down the view (negative y): the street throws warm light back on them.
        outgoingLight += diffuseColor.rgb * vec3(1., .82, .64) * lookBounce * .45 * smoothstep(-.1, .6, -normal.y);
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => innerKey + '/look-matcap';
    material.needsUpdate = true;
  };
  return {
    set,
    patch: (scene: T.Object3D) => scene.traverse(object => {
      const material = (object as T.Mesh).material;
      if (!material) return;
      if (Array.isArray(material)) material.forEach(patch); else patch(material);
    })
  };
}
