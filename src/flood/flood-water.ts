import * as T from 'three';
import type { FloodView } from './flood-sim.ts';

/** Muddy water, shallow to deep; then the four hazard classes of FD2320 (see `flood-impact.ts`). */
const TONES = {shallow: '#c9b98d', deep: '#6f5a37', low: '#f2d46b', some: '#f0932b', most: '#d63a35', all: '#6b1430'};
/** Water shallower than this (m) is not drawn: wet streets, not a flood. */
const THINNEST = .03;
/** The surface floats this far above the ground it covers, clear of the terrain's own triangles. */
const LIFT = .08;

/**
 * The flood surface: one vertex on each node of the flood grid, lifted in the vertex shader to the water height
 * held in a two-channel float texture (surface, shown value) that the worker fills. Dry vertices sit on the ground,
 * so a wet edge ends inside the triangle where the shown value falls under `THINNEST`.
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
  const data = new Float32Array(n * 2);
  const map = new T.DataTexture(data, w, h, T.RGFormat, T.FloatType);
  map.minFilter = map.magFilter = T.NearestFilter;
  map.needsUpdate = true;
  const uniforms = {
    floodMap: {value: map}, floodWidth: {value: w}, floodMode: {value: 0},
    ...Object.fromEntries(Object.entries(TONES).map(([k, v]) => ['flood' + k[0].toUpperCase() + k.slice(1), {value: new T.Color(v)}]))
  };
  const material = new T.MeshBasicMaterial({transparent: true, depthWrite: false, side: T.DoubleSide});
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'uniform sampler2D floodMap; uniform float floodWidth; varying float vFlood;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      int floodColumns = int(floodWidth);
      vec2 floodState = texelFetch(floodMap, ivec2(gl_VertexID % floodColumns, gl_VertexID / floodColumns), 0).rg;
      transformed.y = floodState.r + ${LIFT};
      vFlood = floodState.g;`);
    shader.fragmentShader = `uniform int floodMode; uniform vec3 floodShallow, floodDeep, floodLow, floodSome, floodMost, floodAll;
      varying float vFlood;\n` + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      if (vFlood < ${THINNEST}) discard;
      vec3 floodTone = floodMode == 1
        ? (vFlood < .75 ? floodLow : vFlood < 1.25 ? floodSome : vFlood < 2. ? floodMost : floodAll)
        : mix(floodShallow, floodDeep, smoothstep(0., 2.5, vFlood));
      diffuseColor.rgb = floodTone;
      diffuseColor.a = .62 + .3 * smoothstep(${THINNEST}, .6, vFlood);`);
  };
  const mesh = new T.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return {
    mesh,
    /** Takes a state from the worker (copied: the buffer can go back at once). */
    show(state: Float32Array, view: FloodView) {
      data.set(state);
      map.needsUpdate = true;
      uniforms.floodMode.value = view === 'hazard' ? 1 : 0;
    },
    dispose() { geometry.dispose(); material.dispose(); map.dispose(); }
  };
}
