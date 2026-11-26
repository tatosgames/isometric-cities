# Flag-Based Adaptive Graphics Quality

Copy this folder into your project. With Node 24, run `node --test adaptive-quality.test.mjs` from the copied folder.

## Configure quality levels

Declare one complete entry per level, ordered from lowest to highest quality. Each field can be a flag, number, or mode. Connect each field to its effect in a single callback. In this example, the middle level enables shadows and the top level adds FXAA. To enable FXAA at the middle level, change the second `fxaa` value to `true`.

```ts
import {createAdaptiveQuality} from './adaptive-quality.ts';

const quality = createAdaptiveQuality({
  levels: [
    {shadows: false, fxaa: false},
    {shadows: true,  fxaa: false},
    {shadows: true,  fxaa: true}
  ],
  initialIndex: 0,
  baseIndex: 0,
  detect30Fps: true,
  applyLevel({shadows, fxaa}) {
    groundShadows.setEnabled(shadows);
    fxaaPass.enabled = fxaa;
  }
});

// In the existing render loop, once per rendered frame:
quality.sample(time, {mode: moving ? 'moving' : 'resting', ready: !loading});
```

The callback runs immediately when the controller is created, on every level change (including rollback after a failed trial), and on reset. Create effects before the controller. If you omit the callback, apply returned levels manually.

Indices are zero-based. `initialIndex` selects the initial quality level. `baseIndex` defines the baseline for calibration and 30 FPS detection. You can add lower-quality levels before the baseline, for example with reduced resolution. To add an effect, set its value in every entry and connect it once in `applyLevel`.

## Connect the render loop

Use `moving` while the game is active and `resting` for ambient updates. Set `ready: false` while loading and `preparing: true` while a trial effect prepares its resources. Loading frames still count towards a downgrade, because streaming hitches are what the player feels, but never towards a promotion or a 30 FPS cadence; a trial pauses until loading ends. The cooldown timer pauses while resting.

For ambient loops capped at 30 FPS, set `adaptWhileResting: true` to drop one level after three consecutive seconds below 24 FPS. Resting uses its own measurement window and only supports downgrades. The city enables this option for its ground profile.

For initial calibration, set `calibrate: true` and start the game at the baseline level. Once the scene is ready and idle, call `beginCalibration(time)` when `calibrationPending` is true. While `calibrating` is true, render without an idle frame cap and pass `mode: 'calibration'`. An input event or a hidden page can interrupt calibration with `interrupt()`. Use `reset()` to start over. Reset applies the initial profile in one step, within the device's quality ceiling, even during a trial. If you apply levels manually, apply a returned level when it is not `null`.

With `detect30Fps`, the controller can detect a stable 30 FPS cadence at the baseline or a lower level. While moving, an upgrade requires 8 seconds of smooth performance followed by a 2-second trial. A failed trial starts a 30-second active cooldown. For diagnostics, `state` exposes the index, level, FPS target, most recent FPS and p95 in milliseconds, trial status, and remaining cooldown.

## How the level is chosen

| Target | Conditions to try the next level | Conditions to drop one level |
|---|---|---|
| 60 FPS | At least 57 FPS and p95 ≤ 22 ms | Below 54 FPS or p95 > 25 ms |
| 30 FPS | At least 29 FPS and p95 ≤ 38 ms | Below 27 FPS or p95 > 42 ms |

p95 is the frame time within which 95% of measured frames complete. While moving, the game must remain below the downgrade threshold for two consecutive seconds to drop a level. Quality stays unchanged inside the neutral band.

## Decision diagnostics

Pass `onDecision(event)` to `createAdaptiveQuality` to receive calibration, trial, confirmation, downgrade, cancellation, and reset events. Each event includes `action`, `reason`, the `from` and `to` profiles, `targetFps`, `fps`, and `p95Ms`. Measurements refer to the latest completed sample window and can be `null` at startup. For example, `cancel / input` indicates an explicit interruption using `interrupt('input')`. `cancel / preparing` means the effect was still preparing when the trial timed out.

A trial cancelled with `insufficient-headroom` did not meet the requirements for promotion. If the latest window exceeds the slowdown threshold, the reason is `slow`.

The adapter can call `setMaxIndex(index)` to update the highest available level when the output device changes. Lowering the ceiling below the current level immediately applies the allowed level and emits `reduce / capability`. Raising it allows trials again under the normal thresholds.

In Isometric Cities, open **Rendering quality** from `lab.html` or visit `?lab=qualita`. The panel shows the frame rate and p95 of every painted frame in the last second (`Now`, with `loading` while sectors stream and the 30 FPS cap at rest), the last controller window, the four latest decisions and the WebGL drawing-buffer dimensions in pixels. To keep the panel visible with a fixed preview, add `&diagnostics`.

## References

The priority-ordered levels follow the approach in [Babylon SceneOptimizer](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Misc/sceneOptimizer.ts). Discrete steps with a fresh measurement after each change follow [model-viewer](https://github.com/google/model-viewer/blob/5cc277a497f6e13fc75ff4821da73164a12570c9/packages/model-viewer/src/three-components/Renderer.ts). The neutral band and separation of measurement from application follow [Drei PerformanceMonitor](https://github.com/pmndrs/drei/blob/master/src/core/PerformanceMonitor.tsx).
