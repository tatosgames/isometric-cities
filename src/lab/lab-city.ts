import * as T from 'three';
import { isCity, isLayers, isRoofPalette, isSectorIndex, loadData } from '../data/load.ts';
import { zonesFromCity } from '../data/sector-index.ts';
import { sunOffset } from '../render/city-light.ts';
import { compactScreen } from '../render/dynamic-quality.ts';
import { makeGameRenderer } from '../render/game-renderer.ts';
import { makeMapCamera } from '../render/map-camera.ts';
import { streamCity } from '../render/sectors/sector-stream.ts';

type StreamOptions = Parameters<typeof streamCity>[0];

/**
 * The city of the labs, drawn as the game draws it: the published sectors streamed by `streamCity`, with the game's
 * renderer, look, lights, shadows and wind. A lab chooses which sectors exist and moves the camera.
 * Quality stays at its starting level, so that renderings and measurements compare like with like.
 */
export async function labCity(host: HTMLElement, query = new URLSearchParams(location.search)) {
  const [city, index, palette] = await Promise.all([
    loadData('city.json.gz', isCity), loadData('city-index.json', isSectorIndex), loadData('roof-tones.json', isRoofPalette)
  ]);
  const compact = compactScreen(), game = makeGameRenderer({query, compact});
  const {renderer, sun} = game;
  renderer.setClearColor(0xe7e5d5);
  host.prepend(renderer.domElement);
  const scene = new T.Scene(), camera = makeMapCamera();
  scene.add(game.fill, sun, sun.target);
  /** `keep` picks the sectors; `widenedRoads: false` paints the carriageways as before their widening. */
  function stream({keep, widenedRoads = true, ...options}: {keep?: ((sector: string) => boolean) | undefined; widenedRoads?: boolean}
    & Omit<StreamOptions, 'data' | 'neutral' | 'tones' | 'compact' | 'host'>) {
    const split = zonesFromCity(city, index, keep), data = {...split.core, ...split.index};
    if (!widenedRoads) delete data.roadCoverage;
    const streamed = streamCity({
      data, neutral: false, tones: palette.tones, compact, host,
      async loadZone(z) {
        const zone = split.zones.get(z.id);
        if (!zone) throw Error('Missing zone ' + z.id);
        return zone;
      },
      loadLayers: (s, signal) => loadData('city-sectors/' + s.file, isLayers, signal),
      ...options
    });
    scene.add(streamed.group);
    game.onStaticShadows(streamed.setStaticShadows);
    game.apply(game.quality.config);
    return {...streamed, split};
  }
  /** Keeps the sun's shadow box on the subject, in 240 m steps as on the map, then draws. */
  function render(time: number, subject: T.Vector3) {
    if (renderer.shadowMap.enabled) {
      const sx = Math.round(subject.x / 240) * 240, sz = Math.round(subject.z / 240) * 240;
      if (sun.target.position.x !== sx || sun.target.position.z !== sz) {
        sun.target.position.set(sx, 0, sz); sun.position.copy(sun.target.position).add(sunOffset);
        renderer.shadowMap.needsUpdate = true;
      }
    }
    game.render(scene, camera, time);
  }
  /** Wind and cloud shadows move on a resting view as on the map: `draw` is repeated at 30 frames a second at most. */
  function ambient(draw: (time: number) => void) {
    let next = 0;
    const tick = (time: number) => {
      requestAnimationFrame(tick);
      if (document.hidden || time < next) return;
      next = time + 1000 / 30;
      draw(time);
    };
    requestAnimationFrame(tick);
  }
  return {city, index, compact, game, renderer, scene, camera, stream, render, ambient};
}
