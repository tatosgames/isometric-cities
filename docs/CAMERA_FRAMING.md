# Framing contract

What the camera must guarantee in each viewer state. It's just presentation: the camera never changes geometry, collisions, paths or game outcomes. Modeled after `CAMERA_FRAMING.md` from Smash Royale, adapted to an isometric orthographic chamber.

The values ​​cited are those of the code as of November 24, 2026. If they change in the code, the code applies and this file must be updated.

## Common rules

1. **Map and guide share the orthographic camera.** The orthographic camera is born from `makeMapCamera()` in `src/render/map-camera.ts`, the same as editors and laboratories, with edges in pixels (`fitPixels`), distance from the target `CAMERA_DISTANCE` (1500 m) and angle `mapViewDirection()`. Only `src/main.ts` moves it, with the `view(target, zoom, offset)` function: the guide asks for a shot by calling `view`.
2. **Orientation.** The map rotates jerkily around the vertical while maintaining the isometric inclination. The Isométrica view while driving resumes the orientation at the entrance. The other driving views orient the same orthographic camera along the trajectory.
3. **Zoom is in pixels per meter.** The camera borders are in CSS pixels, so `camera.zoom` says how many pixels a meter occupies. All thresholds are thought like this.
4. **The target remains inside the perimeter.** `draw()` brings the target back into the border box at each frame and the camera 1500 m from it: zooming towards the cursor makes it slide in its own plane, and in orthographic projection the distance does not change the image.
5. **No jumps.** Every change of shot is a flight or a muffled run-up. The dampings are exponential in seconds (`approach` in `src/geometry.ts`), therefore equal to 30, 60 or 120 frames per second. The `+`, `−` and pan buttons animate for 300 ms. A clean break is only permitted when restoring after context loss, where you return to the last saved view.

## Map

- **Opening:** detail on the place indicated by `data.focus`, not the overview.
- **Panorama** (viewfinder or Start button): maintains orientation and frames the entire perimeter with a margin (`fitAt`).
- **Dragging:** the ground remains under the pointer, one by one, with the mouse and with the finger, even vertically (`GroundControls` in `src/render/map-camera.ts`). No dampening during the gesture. Upon release, the map continues at the speed of the last 100 ms of the gesture, measured on the times of the pointer events, and slows down by `coastRate` 6 per second. A finger still for more than 80 ms before lifting and a pinch does not cause slipping. A new tap, button or Play stops the slide.
- **Wheel and pinch:** the zoom goes towards the indicated point, not towards the center.
- **Zoom buttons:** `+`, `−` and pan interpolate target and zoom in 300 ms; new inputs replace the current flight starting from the current view.
- **Rotation buttons:** ±90° around the target, at constant zoom and tilt. A shot lasts 300 ms. Close clicks add up and restart from the visible pose.
- **Interactive zoom limits:** minimum of 0.8 × the smallest of the pan levels, maximum of 12 × the largest with a minimum of 4 px/m and room for aperture zoom.
- **Selected location:** 320 ms flight with zoom such that the short side covers approximately 245 m. The place becomes the target and an offset of the view (`setViewOffset`) brings it to the center of the part that the card leaves free: to the right of the panel on wide screens, above the sheet on the phone in portrait (`frame()` in `src/map/place-card.ts`). With the pill alone the marker goes to the center. With the tab open, zoom and rotation rotate around the place, which remains in the free part.
- **Closing or folding the card:** the target returns to the center of the screen and the offset disappears without the image moving. The saved view and `data-view` always return the point to the center of the screen.
- **Screen rotation and scaling:** target, zoom, orientation and pixel offset remain unchanged.
- **Markers:** projected every frame, hidden when they go off screen.

## Help

1. **The car is the subject.** The camera follows the car closely (`followRate` 9): the car remains almost stationary on the screen, the world passes by.
2. **You can see where you are going.** The target advances along the direction of travel from 0 m from rest to 5 m at 10 km/h, then grows to 12 m at 90 km/h and stays within that limit. The advance is damped separately (`leadRate` 2.4). The chamber shot follows its own spring (point 6).
3. **Basic field of view:** The short side of the screen covers 62m on phone and 95m on desktop (`viewSpanCompact`, `viewSpanWide`). At 390px wide it's about 6.3px/m, with the car around 25px.
4. **Slow and small dynamic zoom.** Widens up to 10% at 90 km/h and up to 8% with a patrol within 45 m, and narrows by 14% on capture. The two inputs are filtered (`paceRate` 0.7) and the zoom follows them with `zoomRate` 1.1. `followRate`, `leadRate`, `paceRate`, and `zoomRate` are exponential rates per second.
5. **Entry and exit when gliding.** When entering drive the camera reaches the car in about a second and a half. Upon exit, the same camera returns in 1.5 s to the point, zoom and orientation of the map before Play. From moving views, return to the isometric angle along the shortest arc.
6. **Directional push, never flicker.** For impacts over 6 m/s, patrol pushes, wreckage within 40 m and capture, the target dashes towards what it hit and returns with a dampened spring (`kick` 36, `kickStiff` 220, `kickDamp` 22). A full shot moves the view about 1 m and retracts in 0.28 s; the limit is `kickMax` 1.2 m. There is no random shift. Never while standing still waiting for the first touch. Details in [JUICE.md](JUICE.md).
7. **No map zoom limit.** When driving `controls.maxZoom` is infinite; upon exit, the limits of the map and the previous shot return.

The camera button and C key alternate between Isométrica, Aérea (65°) and Continuamiento (48°, 1.22× scale). The game remembers your choice on your device. The transition lasts half a second. The moving views rotate along the shortest angular path, up to 100°/s. In the alleys they check the view towards the cabin, climb up to 85° and wait half a second of clear view before returning to normal altitude.

## What must remain visible in the guide

- The hidden part of the car can be read as a silhouette on the facade or roof. The arrow follows the nose when the center of the cabin is covered.
- The next coins in the trail along the direction of travel.
- A patrol approaching, before it reaches contact: this is the reason for the enlargement of point 4.
- The destination: on the scene with the light beam, or on the edge of the screen with the turquoise distance drop when out of view.
- Attribution below.

The interface stays outside these zones: statistics at the top left, exit at the top right, touch zones in the bottom corners. The destination card does not enter the statistics band or the tactile zones band.

## Don't do it

- When drifting, use the damped direction of travel to orient the moving views. Below 2 m/s maintain direction.
- Reset a random camera shift.
- Link zoom to instantaneous events (bump, coin, appearance of a patrol). Always pass through the two filtered inputs.
- Solve a single area readability problem by changing the global field of view values. We intervene on the scene or on the shape of the car.
- Activate two cameras in the same frame. The renderer selects the camera in `src/main.ts`.

## Verify

- `node scripts/qa-map-camera.mjs` (included in `npm.cmd test`) controls zoom to cursor, slide after dragging, place next to tab after rotate and zoom, close without jumping, and offset geometry.
- `npm.cmd test` also controls four-shot looping, four-corner panning, and pose recovery after resizing, exiting guidance, and losing context.
- After a change to the guidance camera, sample the zoom every half second for about ten seconds (ninth field of `data-drive` on `#scene`) and compare it with the values of point 4.
- Look at at least one screenshot at 390×844 and one at 1440×900 with the car in a narrow street.
- On a physical phone the sensation of movement has not yet been tested.

## Flight

The Piper uses a 54° perspective camera, behind the tail and slightly above the wings. Vertically the distance increases to keep both wingtips visible. The horizon remains level while the wings follow the turn command. Takeoff and return connect the street view to the flight altitude. The shadows and streaming follow the Piper's position. Upon impact the chamber holds the point of the explosion.
The flight camera checks the segment between the tail and the tracked position with samples a maximum of 1.5 m apart. When a facade crosses the view, the camera moves closer and rises. When the segment becomes free it resumes the distance with the damping of the run-up. When diving, the camera rises above the tail and points towards the downward trajectory.
