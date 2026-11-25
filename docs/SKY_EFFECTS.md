# Sky effects trial

Open `/?focus=parque-doramas&sky=1` to see three gulls circling the park and wisps drifting over the city. Switch to `sky=0` for the same camera without the trial. Omitting `sky` also leaves the trial off. The other flock is at `focus=parque-santa-catalina`. For a drive near Doramas use `/?lab=guida&sky=1&start=-1340,1762`.

**Quality control.** The renderer calls `sky.setEnabled(skyRequested && allowed)`. A quality policy can change `allowed` after the map opens:

```js
window.dispatchEvent(new CustomEvent('atlas:sky-quality', {detail: false}));
window.dispatchEvent(new CustomEvent('atlas:sky-quality', {detail: true}));
```

The second call restores the effects on an opted-in page. The current adaptive resolution policy only changes pixel ratio. Wire its quality decision to `setSkyQualityAllowed` in `src/main.ts` to control the trial automatically.

**Rendering.** Each flock shares a gull mesh and uses one instanced draw when visible. The transparent cloud plane samples the wind texture and clock used by the ground shadows. Its opacity fades at street zoom. Switching the trial off detaches the objects and skips animation updates. Switching it back on reuses the resources. Existing wind, sea and shadows run in both modes.

After building, run `node scripts/qa-sky.mjs` to compare desktop and mobile, verify draw calls stop when disabled, and exercise context recovery and driving. [In-game capture](screenshots/sky-doramas.png)
