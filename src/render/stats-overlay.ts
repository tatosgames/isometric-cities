import Stats from 'three/addons/libs/stats.module.js';
import type { WebGLRenderer } from 'three';

/**
 * Debug overlay with `?stats` in the URL: three.js Stats (FPS, frame ms, heap MB where the browser exposes it)
 * plus draw calls and thousands of triangles for the whole frame, post-processing passes included.
 * Click the panel to cycle what it shows. Nothing is created without the parameter.
 */
export function makeStatsOverlay(renderer: WebGLRenderer, query: URLSearchParams) {
  if (!query.has('stats')) return null;
  const stats = new Stats();
  const calls = stats.addPanel(new Stats.Panel('DC', '#ff8', '#221'));
  const triangles = stats.addPanel(new Stats.Panel('kTRI', '#f8f', '#212'));
  stats.showPanel(0);
  // Below the drive HUD pills, clear of the touch steering buttons in the bottom corners.
  Object.assign(stats.dom.style, { left: '8px', top: '60px', zIndex: '9999' });
  document.body.append(stats.dom);
  // The composer renders several passes per frame: count them all, then reset once per frame.
  renderer.info.autoReset = false;
  let maxCalls = 1, maxTriangles = 1, nextGraph = 0;
  return {
    begin() { renderer.info.reset(); stats.begin(); },
    end() {
      stats.end();
      // Like the FPS graph, the counters draw a new column twice a second instead of every frame.
      const now = performance.now();
      if (now < nextGraph) return;
      nextGraph = now + 500;
      const {calls: drawn, triangles: shown} = renderer.info.render;
      maxCalls = Math.max(maxCalls, drawn); maxTriangles = Math.max(maxTriangles, shown / 1000);
      calls.update(drawn, maxCalls);
      triangles.update(shown / 1000, maxTriangles);
    }
  };
}
