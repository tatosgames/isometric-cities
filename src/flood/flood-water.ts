import * as T from 'three';
import type { FloodView } from './flood-sim.ts';

/**
 * Flood water, shallow to deep: clear turquoise over the street, darker blue in the channel, with a little sediment.
 * Then the four hazard classes of FD2320 (see `flood-impact.ts`) and the foam.
 */
// The sea's own palette (`render/sea.ts`), so flood and sea read as the same water.
const TONES = {
  shallow: '#74c4bd', deep: '#2b7888', silt: '#8c7d55', foam: '#f3f6ef',
  low: '#f2d46b', some: '#f0932b', most: '#d63a35', all: '#6b1430'
};
/** Water shallower than this (m) is not drawn: wet streets, not a flood. */
const THINNEST = .015;
/** The surface floats this far above the ground it covers, clear of the terrain's own triangles. */
const LIFT = .08;

/**
 * The flood surface: one vertex on each node of the flood grid, lifted in the vertex shader to the water height
 * held in a four-channel float texture (surface, shown value, velocity east and north) that the worker fills. Dry
 * vertices sit on the ground, so a wet edge ends inside the triangle where the shown value falls under `THINNEST`.
 *
 * Low poly and opaque, one draw call: a swell in the vertex shader tilts the 5 m triangles, each drawn with its own
 * normal, so facets turn a little lighter or darker against the sun; depth tints the water with the sea's palette,
 * a slow swell of tone runs along the current and soft foam marks its edge, as on the shore.
 */
export function makeFloodWater({w, h, dx, dy, west, north, z}: {w: number; h: number; dx: number; dy: number; west: number; north: number; z: Float32Array},
  /** Called with each state once it is on the GPU, or skipped for a newer one: the worker can reuse its buffer. */
  release: (state: Uint16Array<ArrayBuffer>) => void) {
  const n = w * h, position = new Float32Array(n * 3);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const i = (r * w + c) * 3;
    position[i] = west + c * dx; position[i + 2] = -(north - r * dy);
  }
  const index = new Uint32Array((w - 1) * (h - 1) * 6);
  let k = 0;
  for (let r = 0; r < h - 1; r++) for (let c = 0; c < w - 1; c++) {
    const a = r * w + c, b = a + 1, d = a + w, e = d + 1;
    index.set([a, d, b, b, d, e], k); k += 6;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(position, 3));
  geometry.setIndex(new T.BufferAttribute(index, 1));
  // The state, in half floats with the surface above the ground; the ground itself, uploaded once.
  const map = new T.DataTexture(new Uint16Array(n * 4), w, h, T.RGBAFormat, T.HalfFloatType);
  map.minFilter = map.magFilter = T.NearestFilter;
  map.needsUpdate = true;
  /**
   * The worker's state waiting to go up, and the rows of it that hold water. Only those rows are uploaded, from a
   * texture that is never bound (`copyTextureToTexture` then reads its data straight into the map): early in a
   * flood a tenth of the grid instead of all of it.
   */
  const staging = new T.DataTexture(null, w, h, T.RGBAFormat, T.HalfFloatType);
  const region = new T.Box2(), corner = new T.Vector2();
  let pending: Uint16Array<ArrayBuffer> | null = null;
  const ground = new T.DataTexture(z.slice(), w, h, T.RedFormat, T.FloatType);
  ground.minFilter = ground.magFilter = T.NearestFilter;
  ground.needsUpdate = true;
  const quads = (w - 1) * 6;
  const uniforms = {
    floodMap: {value: map}, floodGround: {value: ground}, floodWidth: {value: w}, floodMode: {value: 0}, floodTime: {value: 0},
    ...Object.fromEntries(Object.entries(TONES).map(([k, v]) => ['flood' + k[0].toUpperCase() + k.slice(1), {value: new T.Color(v)}]))
  };
  // Opaque: no blending, no sorting, and the depth test hides what is under the water.
  const material = new T.MeshBasicMaterial({side: T.DoubleSide});
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `uniform sampler2D floodMap, floodGround; uniform float floodWidth, floodTime;
      varying float vFlood; varying vec2 vFlow; varying vec3 vFloodAt;\n` +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      int floodColumns = int(floodWidth);
      ivec2 floodCell = ivec2(gl_VertexID % floodColumns, gl_VertexID / floodColumns);
      vec4 floodState = texelFetch(floodMap, floodCell, 0);
      floodState.r += texelFetch(floodGround, floodCell, 0).r;
      vec2 floodAt = vec2(transformed.x, -transformed.z), flow = floodState.ba;
      float floodSpeed = length(flow);
      vec2 along = floodSpeed > .05 ? flow / floodSpeed : vec2(.8, .6);
      // Low-poly swell: a few long waves, taller and faster where the current runs, none at the edge.
      float swell = sin(floodAt.x * .33 + floodTime * 1.3) * cos(floodAt.y * .27 - floodTime * 1.1)
        + .7 * sin(dot(floodAt, along) * .55 - floodTime * (1.8 + floodSpeed * .8))
        + .4 * sin(dot(floodAt, vec2(-along.y, along.x)) * .9 + floodTime * 2.3);
      float floodWave = smoothstep(.05, .6, floodState.g) * (.03 + .025 * min(floodSpeed, 5.)) * swell;
      transformed.y = floodState.r + ${LIFT} + floodWave;
      vFlood = floodState.g;
      vFlow = flow;
      vFloodAt = (modelMatrix * vec4(transformed, 1.)).xyz;`);
    shader.fragmentShader = `uniform int floodMode; uniform float floodTime;
      uniform vec3 floodShallow, floodDeep, floodSilt, floodFoam, floodLow, floodSome, floodMost, floodAll;
      varying float vFlood; varying vec2 vFlow; varying vec3 vFloodAt;
      float floodHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float floodNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(floodHash(i), floodHash(i + vec2(1, 0)), f.x), mix(floodHash(i + vec2(0, 1)), floodHash(i + 1.), f.x), f.y);
      }\n` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (vFlood < ${THINNEST}) discard;
      // One normal per triangle: the facets of the low-poly look.
      vec3 normal = normalize(cross(dFdx(vFloodAt), dFdy(vFloodAt)));
      if (normal.y < 0.) normal = -normal;
      vec3 sun = normalize(vec3(.35, .85, .4));
      float facing = dot(normal, sun);
      vec2 at = vec2(vFloodAt.x, -vFloodAt.z);
      float speed = length(vFlow);
      vec3 floodTone;
      if (floodMode == 1) {
        floodTone = vFlood < .75 ? floodLow : vFlood < 1.25 ? floodSome : vFlood < 2. ? floodMost : floodAll;
      } else {
        floodTone = mix(floodShallow, floodDeep, smoothstep(0., 3., vFlood));
        floodTone = mix(floodTone, floodSilt, .06 + .1 * smoothstep(1.5, 6., speed));
      }
      // Facets: a gentle light and shade against the sun, no mirror glints (they speckle from afar).
      floodTone *= 1. + .45 * clamp(facing - .95, -.25, .1);
      // A slow swell of tone along the current, as on the sea.
      vec2 along = speed > .05 ? vFlow / speed : vec2(1, 0);
      floodTone *= 1. + .05 * sin(dot(at, along) * .12 - floodTime * (1. + speed * .6) + floodNoise(at * .02) * 5.);
      // Soft foam only where the water meets the ground, as on the shore.
      float rim = 1. - smoothstep(${THINNEST}, .15, vFlood);
      floodTone = mix(floodTone, floodFoam, rim * (floodMode == 1 ? .4 : .8));
      diffuseColor.rgb = floodTone;`);
  };
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  let rows: readonly [number, number] = [0, -1];
  mesh.onBeforeRender = renderer => {
    if (!pending) return;
    const [r0, r1] = rows;
    if (r0 <= r1) {
      staging.image.data = pending;
      region.min.set(0, r0); region.max.set(w, r1 + 1); corner.set(0, r0);
      renderer.copyTextureToTexture(staging, map, region, corner);
    }
    const done = pending;
    pending = null;
    release(done);
  };
  return {
    mesh,
    /**
     * Takes a state from the worker, valid on the rows `rows` (the water's span), to upload before the next draw, and
     * draws only those rows of quads. A state not yet uploaded gives way to the newer one: its rows are among its own.
     */
    show(state: Uint16Array<ArrayBuffer>, view: FloodView, next: readonly [number, number]) {
      if (pending) release(pending);
      pending = state; rows = next;
      uniforms.floodMode.value = view === 'hazard' ? 1 : 0;
      const first = Math.max(0, next[0] - 1), last = Math.min(h - 1, next[1] + 1);
      geometry.setDrawRange(first * quads, Math.max(0, last - first) * quads);
    },
    /** Dry again, for a new run: the whole map goes up once more. */
    reset() {
      if (pending) release(pending);
      pending = null;
      (map.image.data as Uint16Array).fill(0);
      map.needsUpdate = true;
      geometry.setDrawRange(0, 0);
    },
    /** Moves foam, streaks and ripples: real seconds, so the water keeps flowing when the flood is paused. */
    tick(seconds: number) { uniforms.floodTime.value = seconds % 3600; },
    dispose() { geometry.dispose(); material.dispose(); map.dispose(); ground.dispose(); staging.dispose(); }
  };
}
