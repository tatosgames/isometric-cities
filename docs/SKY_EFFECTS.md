# Sky effects

The cloud layer sits 400 m above the camera target. Its opacity fades as the view narrows and reaches zero when the vertical span is 160 m or less.

Open `/?at=parque-doramas` to see three gulls circling the park and wisps drifting over the city. Add `off=sky` for the same camera with sky effects disabled; without it the effects are on. The other flock is at `at=parque-santa-catalina`. For a drive near Doramas use `/?lab=drive&at=-1340,1762`.

**Quality control.** The renderer calls `sky.setEnabled(skyRequested && allowed)`. A quality policy can change `allowed` after the map opens:

```js
window.dispatchEvent(new CustomEvent('atlas:sky-quality', {detail: false}));
window.dispatchEvent(new CustomEvent('atlas:sky-quality', {detail: true}));
```

The second call restores the effects unless the URL specifies `sky=0`. The current adaptive resolution policy only changes pixel ratio. Wire its quality decision to `setSkyQualityAllowed` in `src/main.ts` to control the trial automatically.

**Rendering.** Each flock shares a gull mesh and uses one instanced draw when visible. The transparent cloud plane samples the wind texture and clock used by the ground shadows. Its opacity fades at street zoom. Switching the trial off detaches the objects and skips animation updates. Switching it back on reuses the resources. Existing wind, sea and shadows run in both modes.

After building, run `node scripts/qa-sky.mjs` to compare desktop and mobile, verify draw calls stop when disabled, and exercise context recovery and driving. [In-game capture](screenshots/sky-doramas.png)
