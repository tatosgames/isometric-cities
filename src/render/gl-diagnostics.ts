import type * as T from 'three';

/**
 * Console diagnostics of the WebGL context, under the `[atlas:gl]` prefix: which GPU, when the context is lost and
 * restored (as errors and warnings, with what was resident at that moment), a restore that never comes, and GL
 * errors such as OUT_OF_MEMORY that break drawing without losing the context.
 * `snapshot` adds the application's own state (view, sectors, quality) to every report.
 *
 * On a phone the console is out of reach, so the same reports also go to an on-screen panel (`showGlReport`), which
 * opens by itself when the map stops drawing: a context not restored, no frame after the page comes back or the
 * context is restored, or an uncaught error. `?gl=debug` keeps it open and refreshed.
 */
export function watchGlContext(renderer: T.WebGLRenderer, snapshot: () => Record<string, unknown>, restoreTimeout = 5000) {
  const canvas = renderer.domElement, gl = renderer.getContext();
  const started = performance.now();
  let lostAt = 0, losses = 0, waiting = 0, nextCheck = 0, frames = 0, lastFrameAt = 0, watching = 0;
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
      framesDrawn: frames,
      lastFrameAgoS: lastFrameAt ? +((performance.now() - lastFrameAt) / 1000).toFixed(1) : 'never',
      contextLost: gl.isContextLost(),
      canvas: `${canvas.width}×${canvas.height} px (DPR ${renderer.getPixelRatio().toFixed(2)} of ${devicePixelRatio})`,
      jsHeapMiB: heap ? `${(heap.usedJSHeapSize / 1048576).toFixed(0)} / ${(heap.jsHeapSizeLimit / 1048576).toFixed(0)}` : 'n/a',
      hidden: document.hidden,
      uptimeS: +((performance.now() - started) / 1000).toFixed(1),
      losses
    };
  }
  const panel = makePanel(state);
  /** Writes to the console and keeps the line for the on-screen panel. */
  function report(level: 'info' | 'warn' | 'error', message: string, withState = true) {
    if (withState) console[level](message, state()); else console[level](message);
    panel.note(message);
  }
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  console.info('[atlas:gl] WebGL ready', {
    gpu,
    vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    canvas: `${canvas.width}×${canvas.height}`
  });
  panel.note(`[atlas:gl] WebGL ready · ${gpu}`);
  /** After the page comes back or the context returns, a frame must follow: otherwise the map stays blank. */
  function expectFrame(after: string) {
    clearTimeout(watching);
    const before = frames;
    watching = window.setTimeout(() => {
      if (document.hidden || gl.isContextLost() || frames !== before) return;
      report('error', `[atlas:gl] No frame drawn 3 s after ${after}: the map is blank.`);
      panel.show(`No frame drawn after ${after}`);
    }, 3000);
  }
  canvas.addEventListener('webglcontextlost', event => {
    losses++; lostAt = performance.now();
    clearTimeout(watching);
    const reason = (event as WebGLContextEvent).statusMessage;
    report('error', '[atlas:gl] WebGL context lost' + (reason ? ': ' + reason : '') +
      '. The GPU driver or the browser dropped the context, often for lack of video memory or a GPU reset.');
    clearTimeout(waiting);
    waiting = window.setTimeout(() => {
      report('error', `[atlas:gl] WebGL context not restored after ${restoreTimeout / 1000} s. ` +
        'The browser may have blocked 3D for this page after repeated GPU resets (see chrome://gpu, Log Messages).');
      if (!document.hidden) panel.show('WebGL context not restored');
    }, restoreTimeout);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    clearTimeout(waiting);
    report('warn', `[atlas:gl] WebGL context restored after ${(performance.now() - lostAt).toFixed(0)} ms`);
    if (!document.hidden) expectFrame('the context was restored');
  });
  document.addEventListener('visibilitychange', () => {
    panel.note(`[atlas:gl] page ${document.hidden ? 'hidden' : 'visible'}${gl.isContextLost() ? ' (context lost)' : ''}`);
    if (document.hidden) return;
    if (gl.isContextLost()) { if (performance.now() - lostAt > restoreTimeout) panel.show('WebGL context not restored'); }
    else expectFrame('the page came back');
  });
  // An exception in the frame loop stops drawing for good, with the interface still there.
  window.addEventListener('error', event => {
    report('error', `[atlas:gl] Uncaught error: ${event.message} (${event.filename?.split('/').pop()}:${event.lineno})`);
    panel.show('Uncaught error');
  });
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    report('error', `[atlas:gl] Unhandled rejection: ${reason}`);
    panel.show('Unhandled rejection');
  });
  if (new URLSearchParams(location.search).get('gl') === 'debug') panel.show('Live (?gl=debug)', true);
  return {
    /**
     * Counts the frame, then reads the GL error flag at most once a second. `getError` waits for the GPU process,
     * so it is not called every frame. Errors are reported once per kind and second.
     */
    check(time: number) {
      frames++; lastFrameAt = performance.now();
      if (time < nextCheck || gl.isContextLost()) return;
      nextCheck = time + 1000;
      const seen = new Set<number>();
      for (let error = gl.getError(); error !== gl.NO_ERROR && !seen.has(error); error = gl.getError()) {
        seen.add(error);
        report('error', `[atlas:gl] GL error ${names[error] ?? error}` +
          (error === gl.OUT_OF_MEMORY ? ': the GPU could not allocate a buffer or texture, so some of the map is not drawn.' : ''));
      }
    },
    state
  };
}

/** The on-screen report: closed until something goes wrong, then the reason, the state and the last lines. */
function makePanel(state: () => Record<string, unknown>) {
  const lines: string[] = [], started = performance.now();
  let root: HTMLElement | null = null, body: HTMLPreElement | null = null, title = '', timer = 0;
  // The panel can open before the map has finished building the state it reports.
  const read = () => {
    try { return Object.entries(state()).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join('\n'); }
    catch (error) { return `state not available yet: ${error}`; }
  };
  // What happened first, then the state now: the events say which failure it is.
  const text = () => `${title}\n\n${lines.join('\n')}\n\n${read()}\n${navigator.userAgent}`;
  function render() { if (body) body.textContent = text(); }
  return {
    note(line: string) {
      lines.push(`${((performance.now() - started) / 1000).toFixed(1)} s  ${line}`);
      if (lines.length > 30) lines.shift();
      render();
    },
    show(reason: string, live = false) {
      title = reason;
      if (!root) {
        root = document.createElement('div');
        root.id = 'gl-report';
        root.setAttribute('role', 'alert');
        root.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;max-height:55dvh;z-index:50;display:flex;'
          + 'flex-direction:column;gap:6px;padding:8px;border-radius:8px;background:#1d2622ee;color:#f3f0e2;'
          + 'font:11px/1.35 ui-monospace,Menlo,Consolas,monospace;box-shadow:0 4px 16px #0006';
        const bar = document.createElement('div');
        bar.style.cssText = 'display:flex;gap:6px';
        const button = (label: string, action: () => void) => {
          const b = document.createElement('button');
          b.textContent = label; b.onclick = action;
          b.style.cssText = 'font:12px system-ui;padding:6px 10px;border-radius:5px;border:0;background:#f3f0e2;color:#1d2622';
          bar.append(b);
        };
        button('Recargar', () => location.reload());
        button('Copiar', () => { void navigator.clipboard?.writeText(text()); });
        button('Cerrar', () => { root?.remove(); root = body = null; clearInterval(timer); });
        body = document.createElement('pre');
        body.style.cssText = 'margin:0;overflow:auto;white-space:pre-wrap;word-break:break-word;user-select:text';
        root.append(bar, body);
        document.body.append(root);
      }
      clearInterval(timer);
      timer = window.setInterval(render, live ? 1000 : 2000);
      render();
    }
  };
}
