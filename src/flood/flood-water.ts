import * as T from 'three';
import type { FloodView } from './flood-sim.ts';

/**
 * Flood water, shallow to deep: clear turquoise over the street, darker blue in the channel, with a little sediment.
 * Then the four hazard classes of FD2320 (see `flood-impact.ts`) and the foam.
 */
const TONES = {
  shallow: '#5cb8c6', deep: '#1d5c8e', light: '#a9e6e6', silt: '#8c7d55', foam: '#f4f8f5',
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
 * normal, so facets turn pale or dark against the sun; depth tints the water, a white rim marks its edge and
 * crisp whitecaps drift down fast currents.
 */
export function makeFloodWater({w, h, dx, dy, west, north}: {w: number; h: number; dx: number; dy: number; west: number; north: number}) {
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
  const data = new Float32Array(n * 4);
  const map = new T.DataTexture(data, w, h, T.RGBAFormat, T.FloatType);
  map.minFilter = map.magFilter = T.NearestFilter;
  map.needsUpdate = true;
  const uniforms = {
    floodMap: {value: map}, floodWidth: {value: w}, floodMode: {value: 0}, floodTime: {value: 0},
    ...Object.fromEntries(Object.entries(TONES).map(([k, v]) => ['flood' + k[0].toUpperCase() + k.slice(1), {value: new T.Color(v)}]))
  };
  // Opaque: no blending, no sorting, and the depth test hides what is under the water.
  const material = new T.MeshBasicMaterial({side: T.DoubleSide});
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `uniform sampler2D floodMap; uniform float floodWidth, floodTime;
      varying float vFlood; varying vec2 vFlow; varying vec3 vFloodAt;\n` +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      int floodColumns = int(floodWidth);
      vec4 floodState = texelFetch(floodMap, ivec2(gl_VertexID % floodColumns, gl_VertexID / floodColumns), 0);
      vec2 floodAt = vec2(transformed.x, -transformed.z), flow = floodState.ba;
      float floodSpeed = length(flow);
      vec2 along = floodSpeed > .05 ? flow / floodSpeed : vec2(.8, .6);
      // Low-poly swell: a few long waves, taller and faster where the current runs, none at the edge.
      float swell = sin(floodAt.x * .33 + floodTime * 1.3) * cos(floodAt.y * .27 - floodTime * 1.1)
        + .7 * sin(dot(floodAt, along) * .55 - floodTime * (1.8 + floodSpeed * .8))
        + .4 * sin(dot(floodAt, vec2(-along.y, along.x)) * .9 + floodTime * 2.3);
      float floodWave = smoothstep(.05, .6, floodState.g) * (.05 + .045 * min(floodSpeed, 5.)) * swell;
      transformed.y = floodState.r + ${LIFT} + floodWave;
      vFlood = floodState.g;
      vFlow = flow;
      vFloodAt = (modelMatrix * vec4(transformed, 1.)).xyz;`);
    shader.fragmentShader = `uniform int floodMode; uniform float floodTime;
      uniform vec3 floodShallow, floodDeep, floodLight, floodSilt, floodFoam, floodLow, floodSome, floodMost, floodAll;
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
      vec3 sun = normalize(vec3(.35, .85, .4)), view = normalize(cameraPosition - vFloodAt);
      float facing = dot(normal, sun), mirror = dot(reflect(-sun, normal), view);
      vec2 at = vec2(vFloodAt.x, -vFloodAt.z);
      float speed = length(vFlow);
      vec3 floodTone;
      if (floodMode == 1) {
        floodTone = vFlood < .75 ? floodLow : vFlood < 1.25 ? floodSome : vFlood < 2. ? floodMost : floodAll;
      } else {
        floodTone = mix(floodShallow, floodDeep, smoothstep(0., 3., vFlood));
        floodTone = mix(floodTone, floodSilt, .1 + .15 * smoothstep(1.5, 6., speed));
      }
      // Facets tilted to the sun turn pale, those turned away darken; the ones that mirror it shine.
      floodTone *= .9 + 1.6 * (facing - .9);
      floodTone = mix(floodTone, floodLight, smoothstep(.55, .9, mirror) * (floodMode == 1 ? .3 : .75));
      // Whitecaps where the current runs, crisp, in bands drifting downstream.
      vec2 along = speed > .05 ? vFlow / speed : vec2(1, 0);
      vec2 drift = vec2(dot(at, along) - floodTime * (1.5 + speed * 2.), dot(at, vec2(-along.y, along.x)));
      float caps = step(.6, floodNoise(drift * vec2(.08, .35)) * .7 + .3 * floodNoise(drift * .4)) * smoothstep(1.5, 4., speed);
      // A white rim where the water meets the ground.
      float rim = 1. - step(.1, vFlood);
      floodTone = mix(floodTone, floodFoam, max(caps * .85, rim) * (floodMode == 1 ? .5 : 1.));
      diffuseColor.rgb = floodTone;`);
  };
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    /** Takes a state from the worker (copied: the buffer can go back at once). */
    show(state: Float32Array, view: FloodView) {
      data.set(state);
      map.needsUpdate = true;
      uniforms.floodMode.value = view === 'hazard' ? 1 : 0;
    },
    /** Moves foam, streaks and ripples: real seconds, so the water keeps flowing when the flood is paused. */
    tick(seconds: number) { uniforms.floodTime.value = seconds % 3600; },
    dispose() { geometry.dispose(); material.dispose(); map.dispose(); }
  };
}
