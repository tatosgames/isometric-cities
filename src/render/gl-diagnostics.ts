import type * as T from 'three';

/**
 * Console diagnostics of the WebGL context, under the `[atlas:gl]` prefix: which GPU, when the context is lost and
 * restored (as errors and warnings, with what was resident at that moment), a restore that never comes, and GL
 * errors such as OUT_OF_MEMORY that break drawing without losing the context.
 * `snapshot` adds the application's own state (view, sectors, quality) to every report.
 */
export function watchGlContext(renderer: T.WebGLRenderer, snapshot: () => Record<string, unknown>, restoreTimeout = 5000) {
  const canvas = renderer.domElement, gl = renderer.getContext();
  const started = performance.now();
  let lostAt = 0, losses = 0, waiting = 0, nextCheck = 0;
  const names: Record<number, string> = {
    [gl.INVALID_ENUM]: 'INVALID_ENUM', [gl.INVALID_VALUE]: 'INVALID_VALUE', [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
    [gl.INVALID_FRAMEBUFFER_OPERATION]: 'INVALID_FRAMEBUFFER_OPERATION', [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
    [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST_WEBGL'
  };
  function state() {
    const {memory, render, programs} = renderer.info;
    const heap = (performance as Performance & {memory?: {usedJSHeapSize: number; jsHeapSizeLimit: number}}).memory;
    return {
      ...snapshot(),
      gpuObjects: {geometries: memory.geometries, textures: memory.textures, programs: programs?.length ?? 0},
      lastFrame: {calls: render.calls, triangles: render.triangles},
      canvas: `${canvas.width}×${canvas.height} px (DPR ${renderer.getPixelRatio().toFixed(2)} of ${devicePixelRatio})`,
      jsHeapMiB: heap ? `${(heap.usedJSHeapSize / 1048576).toFixed(0)} / ${(heap.jsHeapSizeLimit / 1048576).toFixed(0)}` : 'n/a',
      hidden: document.hidden,
      uptimeS: +((performance.now() - started) / 1000).toFixed(1),
      losses
    };
  }
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  console.info('[atlas:gl] WebGL ready', {
    gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    canvas: `${canvas.width}×${canvas.height}`
  });
  canvas.addEventListener('webglcontextlost', event => {
    losses++; lostAt = performance.now();
    const reason = (event as WebGLContextEvent).statusMessage;
    console.error('[atlas:gl] WebGL context lost' + (reason ? ': ' + reason : '') +
      '. The GPU driver or the browser dropped the context, often for lack of video memory or a GPU reset.', state());
    clearTimeout(waiting);
    waiting = window.setTimeout(() => {
      console.error(`[atlas:gl] WebGL context not restored after ${restoreTimeout / 1000} s. ` +
        'The browser may have blocked 3D for this page after repeated GPU resets (see chrome://gpu, Log Messages).', state());
    }, restoreTimeout);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    clearTimeout(waiting);
    console.warn(`[atlas:gl] WebGL context restored after ${(performance.now() - lostAt).toFixed(0)} ms`, state());
  });
  return {
    /**
     * Reads the GL error flag at most once a second, after a frame. `getError` waits for the GPU process,
     * so it is not called every frame. Errors are reported once per kind and second.
     */
    check(time: number) {
      if (time < nextCheck || gl.isContextLost()) return;
      nextCheck = time + 1000;
      const seen = new Set<number>();
      for (let error = gl.getError(); error !== gl.NO_ERROR && !seen.has(error); error = gl.getError()) {
        seen.add(error);
        console.error(`[atlas:gl] GL error ${names[error] ?? error}` +
          (error === gl.OUT_OF_MEMORY ? ': the GPU could not allocate a buffer or texture, so some of the map is not drawn.' : ''), state());
      }
    },
    state
  };
}
