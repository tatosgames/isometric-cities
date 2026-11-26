import * as T from 'three';

/**
 * Looks chosen with `?look=` (`matcap` is the default and `base` uses the original lighting):
 * - `sole`: the same lit materials with tone mapping, a warmer and stronger sun and a weaker sky fill.
 * - `matcap`: the folio/Soso Mart style. Lit materials read a three-band toon matcap instead of the lights;
 *   anything that darkens `diffuseColor` (static ground shadow, cloud shadows, contact darkening) still shows.
 *   The real shadow map does not, so this look keeps the static shadow mask.
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

// Toon matcap lit from the upper left, as in Soso Mart, with a cool shadow band for a sunny street.
function makeMatcap(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  const light = new T.Vector3(-.35, .55, .76).normalize();
  const shade = [164, 168, 196], mid = [236, 229, 218], lit = [255, 250, 238];
  const step = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let x = (i + .5) / size * 2 - 1, y = 1 - (j + .5) / size * 2, r2 = x * x + y * y;
    if (r2 > .999) { const k = Math.sqrt(.999 / r2); x *= k; y *= k; r2 = .999; }
    const z = Math.sqrt(1 - r2), d = x * light.x + y * light.y + z * light.z;
    const a = step(.18, .26, d), b = step(.62, .68, d), rim = Math.pow(1 - z, 3) * .08, o = (j * size + i) * 4;
    for (let k = 0; k < 3; k++) image.data[o + k] = Math.min(255, (shade[k] + (mid[k] - shade[k]) * a) * (1 - b) + lit[k] * b + rim * 255);
    image.data[o + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.generateMipmaps = false; texture.minFilter = T.LinearFilter;
  return texture;
}

export function makeMatcapPatcher() {
  const matcap = { value: makeMatcap() }, gain = { value: 1.08 };
  const patch = (material: T.Material) => {
    if (material.userData.look) return;
    material.userData.look = true;
    const lit = (material as T.MeshStandardMaterial).isMeshStandardMaterial || (material as T.MeshLambertMaterial).isMeshLambertMaterial
      || (material as T.MeshPhongMaterial).isMeshPhongMaterial;
    if (!lit) return;
    const inner = material.onBeforeCompile, innerKey = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      inner.call(material, shader, renderer);
      shader.uniforms.lookMatcap = matcap; shader.uniforms.lookGain = gain;
      shader.fragmentShader = 'uniform sampler2D lookMatcap; uniform float lookGain;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', `
        // Orthographic: one view direction, so the matcap depends on the normal only.
        vec2 lookUv = normal.xy * .495 + .5;
        outgoingLight = diffuseColor.rgb * texture2D(lookMatcap, lookUv).rgb * lookGain + totalEmissiveRadiance;
        #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => innerKey + '/look-matcap';
    material.needsUpdate = true;
  };
  return (scene: T.Object3D) => scene.traverse(object => {
    const material = (object as T.Mesh).material;
    if (!material) return;
    if (Array.isArray(material)) material.forEach(patch); else patch(material);
  });
}
