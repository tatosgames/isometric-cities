# Local Verification · November 21, 2026

## City straight lines and visibility of patrols

The test uses the complete city in Chromium, vertically at 390 × 844 px. Each start resets position, direction, level and initial speed of 90 km/h. You travel both directions of five roads with the steering wheel straight and guaguas disabled. Time is counted at 72 km/h or more in the corridor of the road. A patrol must be operational and visible from the camera for at least 0.3 consecutive s. The result for each route is the longest consecutive interval that meets these driving conditions without a visible patrol.

Star progression remains active after departure. The table shows the worst interval without visible patrol, in seconds, between the outward and return journeys. The comparison uses the same two seeds and the same initial conditions for each before/after pair. The distribution also depends on the loading of the sectors.

| Neighborhood and street | Departure 2 stars, before → after | Departure 4 stars, before → after |
|---|---:|---:|
| Schamann · Calle Doña Perfecta | 29,7 → 8,6 | 22,4 → 8,9 |
| Ciudad del Mar · Avenida Alcalde José Ramírez Bethencourt | 16.7 → 6.6 | 10.7 → 7.4 |
| La Isleta · Calle Juan Rejón | 11.6 → 8.9 | 10.3 → 4.4 |
| Guanarteme · Calle Fernando Guanarteme | 11,3 → 5,7 | 15,2 → 2,5 |
| Santa Catalina–Canteras · Calle General Vives | 19,5 → 11,4 | 6,0 → 6,2 |

With the isometric camera, the overall time at high speed with a legible patrol increases from 16.2% to 41.1% in two-star starts and from 20.7% to 50.4% in four-star starts. With the upper house and four stars the final value is 54.0%, with a maximum of 9.1 s without sightings. All 30 guides in the final version recorded at least one sighting. In General Vives, on the first leg with two stars, the facades limit visibility to 1.3 s out of 18.5 s of fast driving.

In an ordinary game on mobile viewport with active traffic, capture, restart and return to a star were verified. The general suite reported a canceled photo request while browsing the desktop test (`auditorio-alfredo-kraus.webp`, `ERR_ABORTED`).

After the build, run `node scripts/qa-police-straights.mjs` for four stars with isometric camera. Repeat with `--aerial` for the upper chamber and with `--two-stars` for two stars. The `longest` field is expressed in seconds, `seen` is the time with a readable patrol, `fast` the estimated driving time and `forward` the distance traveled along the straight in meters.

## Python Regeneration · November 26, 2026

Comparison with `7c7dfa91` in isolated checkouts, with Python 3.14 and the same cached inputs. The absolute times are affected by the concurrent load. Equality is verified with the SHA-256 of the generated files, comparing two regenerations from the same input or the canonical files in Git.

| Generator | Measurement | Comparison |
|---|---|---|
| Layers of the city | 406 → 93 s elapsed, 280 → 81 s CPU. The candidate reuses OSM and gzip. | The five files match. |
| Pilot Layers | 27 → 14 s elapsed. The reference includes the first recovery of the missing sources. | The three files coincide with the same snapshot. |
| Sectors and areas | 1.201 s for reference, 1.102 s at cold cache and 142 s at hot cache. | All 2,212 artifacts output match byte for byte. |
| PNOA Roofs | 609 s for the full reference, 685 s for the first round that populates the cache. At hot cache, 181 s for the complete generation and 38 s for the colors only. | Atlas PNG, WebP and palette match the reference. The palette also matches in quick mode. |
| Guaguas network | 309 → 158 s elapsed. | The 136 JSONs, including versioned names, match. 10,098 sections in the city and 122 in the pilot. |
| Audits | 578 candidates in both runs. | Identical CSV and GeoJSON. |
| LiDAR and SITCAN | A PNOA card is reread in 0.46–0.95 s versus 1.96–2.05 s for decoding. The SITCAN comparison uses a reproducible GeoTIFF window. | LiDAR reports and CSV, PNG preview and SITCAN reports identical. |

When comparing sectors, both versions reuse published WebP tiles. The reference preserves the original reads and intercepts writes to compute digests. The candidate compares the files on disk before rewriting them. The test integrated with the verified atlas and hot road caches, including the first encoding of the WebP clippings, lasted 239 s and left the canonical geodata identical.

The experimental spatial filter of city roadways reduced candidate obstacles from 106,513 to 9,489. It produced a different WKB mask and index outline than the reference. The delivery version reuses the masks calculated with the existing algorithm. The guaguas network filter passes the comparison of 136 files and is part of the delivery.

The roadway cache takes up approximately 112 MB, of which 45 MB is for masks and 39 MB is for terrain faces. The PNOA cache for the entire extent occupies approximately 680 MB and contains 221 filtered tiles. The projected OSM takes up approximately 54 MB for the main and coast extracts. The sample LiDAR tile takes up approximately 103 MB decoded. Gzip 6 produces 14,477,594 bytes, versus 14,058,069 bytes for canonical gzip. The two unzipped payloads match and the default command restores the canonical file.

Passed 22 Python tests (`python -m unittest discover -s scripts -p 'test_*.py'`), `typecheck`, `build` and `npm test` suite in isolated checkout. The browser suite moved into the second round with an independent Vite cache.

The Python roadway check now selects the exact mask components that reach each sector. It completed checks on all 2,041 sectors and stopped after the border checks. The same file check of `HEAD` finds only one error out of 2,720 joints, between `-4_22` and `-3_22`, for the additional vertex (5416.2214 m, 28.1449 m). Tolerance and assertion are the original ones.

**Clouds above the roofs.** Verified the new elevation in Parque Doramas with a moving view of 390 × 844 px. The sky test passes on desktop and mobile, including opt-out, WebGL fetch, and entry into help.

## Police with Increasing Difficulty · November 25, 2026

Comparison with the `42488497` revision. The stationary target serves to isolate driving errors. The moving target trials separately measure how much the swerve earns.

| Try | Result |
|---|---|
| 40 approaches on pilot roads, same knot pairs | 24 to 35 arrivals. From 5 to 0 destructive incidents. In the new version 4 arrivals out of time and 1 missed route. |
| 20 coppie tenute in riserva | 19 arrivi, 0 incidenti distruttivi. |
| Two inputs with the same initial speed and position | The delay gained by steering is 0.54 s on the straight, 4.13 s in the curve, 2.88 s in the double curve, 8.03 s in the square and 0.39 s in the strait. |
| Same intersection, three chambers vertically and horizontally | In four views the car crosses, enters within 4 m if the player continues and leaves room for dodging. In the other two the director postpones due to insufficient visibility. |
| Stars and touch controls | All five stars fit on the screen, separated by buttons, at 320, 390, and 844 pixels wide. |
| Five patrols with emulated mobile viewport | Chromium, 390 × 844, WebGL software, driver without guaguas, same start with brake pressed. Out of 55 intervals per build, median 16.7 ms and 90th percentile 16.9 ms on both. It is a measure of browser cadence on the test computer. |

**Thirty guides on the Vegueta map.** Ten distinct departures on the OSM network, identical for the three strategies. Each driver runs through all five levels for at least 175 seconds simulated with production physics. The laboratory continues after a contact to be able to observe the subsequent levels. The percentage indicates samples with at least one operational patrol within 25 m, including periods without any nearby patrols in the denominator. Guaguas are disabled in this comparison.

| Player Input | ★ | ★★ | ★★★ | ★★★★ | ★★★★★ | Interceptions ordered |
|---|---:|---:|---:|---:|---:|---:|
| Volante diritto | 9% | 65% | 72% | 74% | 74% | 6 |
| Dodge in response to patrol | 17% | 61% | 68% | 66% | 70% | 4 |
| Follows the coins to the point of interest | 44% | 74% | 92% | 82% | 94% | 14 |

The most marked increase comes with the second patrol. At four stars, proximity pressure drops for two strategies. The frequency of intercept orders is affected by the player's path and turns. This is the step to observe in the phone test. To maintain per-game data, set `POLICE_REPORT` to a JSON path before running the gauntlet.

To play short tests, run `npm.cmd run typecheck`, `npm.cmd run build`, and `npm.cmd test`. Performance comparison is done with `node scripts/benchmark-police.mjs <directory-dist-precedente>`. Long gauntlet starts with `node scripts/qa-police-runs.mjs` after build.

To repeat a guide, open `?lab=guida&area=pilot&seed=7&start=-60,-818&nobuses`. In console `policeRun()` returns build, URL, input changes and telemetry. `replayPolice(policeInputs())` starts again from the same node and reproduces the recorded commands. To compare two changes use the same URL and inputs. `policeAdvance(3,0,false)` advances for three seconds with the steering wheel straight. Real input takes over driving.

**Telephone test to be completed.** Six games, in pairs with the same start for each of the three rooms, alternating the previous and new versions. Let the player choose the path. Record the first moment he decided to deviate, the perceived cause of the capture and whether he saw the escape route. Also try a tight dodge near a building. An unreadable capture plays back with the track before changing distance, angle, or speed.

## Tracks, smoke and jerks while driving · November 25, 2026

Report: no smoke or grass on the screen, and every now and then a burst of speed attributed to the wrong surface. Verified with registered guides frame by frame in the city (Avenida Marítima, La Minilla):

- **The surface map is correct**: along the axis of every driveway it always reads asphalt, and in 3,000 random points the asphalt coincides with 98% coverage of the carriageways. The transition from asphalt ↔ pavement at the edge of the road does not change the driving.
- **The sprint was the bonus of the drift**: upon release it returned all the lost speed in a single 1/120 s step, up to the gear limit; measured +16, +20 and +26 km/h in one frame, on asphalt as well as on grass, and even after a bump while skidding. Now it arrives in 0.2 s (`BONUS_RISE` to `drive-physics.ts`), always up to gear; braking cancels it. New check in `qa-drive-handling.mjs`: no step adds more than 0.2 s.
- **Tracks did not appear east or west**: each piece was only spread along the x-axis of the world, so a track traveled along x had zero width. The defect preceded the surfaces; now the width is taken across the direction of the wheel. Verified in a test scene (tracks in four directions) and in game.
- **Smoke**: Player's drift gave a single 0.22s burst at the start. Now on asphalt and pavement it smokes throughout the slide (one puff every 0.05 s). The particles (seven types) were tested in a test scene.

It remains true that no traces remain on the pavement (sidewalks, squares, pedestrian streets, 70% of the time in a free drive along the seafront), as required.

## Surfaces under the wheels · November 25, 2026

Previously the car drove the same way on asphalt, lawns, squares and the beach, and dust and skids were the same everywhere. Now every car, including patrols, reads the surface beneath it.

- **Surface Map** (`src/drive/drive-surface.ts`): five classes (asphalt, pavement, lawn, earth, sand), painted from the same sources as the ground (`roadCoverage` roadways, pedestrian streets, mapped surfaces) on 128 m tiles at 2 px/m, only when needed. Soft edges between two classes take the class of the next pixel: previously a sand/pavement edge read as grass. Roadways have rings of up to 31,000 points: cut out on the tile and filled once per tile, a tile goes from 150 to about 2 ms (median; worst case 6 ms). The map is built when driving starts in approximately 25–70 ms.
- **Driving**: off the asphalt `speed` reduces speed and acceleration, `grip` reduces the recovery of the slide and lets it open more; above the tip of the surface the car loses `roughDrag × (1 − speed)` m/s² more. Values: grass 72% and traction 0.6, dirt 80% and 0.7, sand 85% and 0.75 (a moderate slowdown, as required). The pavement drives like asphalt and only makes the body shake. The transition takes about 0.2 s, so a curb does not jerk. On the asphalt the 18 trajectories and 40 pursuits remain identical to before.
- **Water**: ponds, fountains and swimming pools are walls like the border of the city; only the one that a street crosses remains open (307 out of 308 in the city).
- **Signals**: tracks always off the road (darker when skidding) and never on the pavement; clods, cloud of dirt or sand spray from rear wheels; instead of white smoke, drifting off the road, a gust of terrain; shaking of the body according to the surface; a hop and a short vibration on your phone when you leave the road or re-enter it.
- **Particles on the GPU**: a single buffer instantiated by 256 particles, moved by the shader from the moment of birth (with the simulation time, which the hit-stop stops); the CPU only writes the new box. The tracks, 1,500 pieces with color and opacity per vertex, load only new pieces. In a first attempt the tracks did not appear because the loaded range counted vertices instead of pieces: corrected before on-screen verification.
- **Lab**: *Surfaces* folder with `roughDrag` and speed, grip and shaking of lawn, earth and sand, plus the shaking of the pavement; telemetry shows the current surface.

Tests: `qa-drive-handling.mjs` (nothing changes on the asphalt; one second on the lawn brings you to 72% of the peak; the sand stops at 85%, no more; wider drift on the lawn; exact return to the asphalt values; patrols slowed down), new `qa-drive-surface.mjs` (classes of Calle Mayor de Triana, Avenida Marítima, Paseo de Las Canteras and beach; time per card; solid water; driving the car leaves the seafront, arrives on the sand and remains under the limit, without errors), `qa-drive-lab.mjs`. While driving, the cadence remains at 16.7 ms per frame, as before. Checked on screen on Las Canteras beach: visible traces and spray of sand. Not verified on the screen: lawn and ground, and the comparison of the smoke on the asphalt with the previous captures, because in the captures the car ended up behind trees and buildings.

## Rendering Deduplication · November 25, 2026

Removed 31 clean lines in four rendering modules. The area silhouettes and distant blocks share the construction of the geometries. The landmarks share the geometry of the pitched roofs, the two terrain canvases share the context preparation and the streamer only exposes the opening state that the viewer uses.

The hashes of vertices, normals, colors and material groups coincide for landmarks and LOD silhouettes. In the pilot and in a sector with roadways, texture pixels, texture coordinates, and shadow samples match both Canvas and OffscreenCanvas. In identical-camera captures near the Miller Building and at the neighborhood scale, the per-pixel average of the maximum difference between the three RGB channels is 0.122 and 0.126 out of 255, respectively.

Checked TypeScript, data-controlled builds, `qa-ground`, `qa-main-lod`, `qa-recovery` and `qa-sectors`. The circuit completed six laps and crossed the border in both directions with active patrol. The full emulated desktop and mobile suite went to an isolated build after a first run with request errors on zones and sectors served by `dist`.

## Viewer launch and pilot changes · November 25, 2026

The viewer loads the initial data into `load-startup-data.ts`. The opening decision uses the outcome of the stream after the frame is drawn. `motion.ts` calculates the release speed and flight interpolation, with the pose applied by the viewer.

The editor separates history, draft, pilot mesh and pointer management. `qa-editor.mjs` also checks that losing focus or capture during a drag discards the preview and that an equivalent or invalid commit still allows redo.

Verified TypeScript, data control build, full suite desktop and mobile emulated, `qa-editor` in development and on build, `qa-boot`, `qa-map-camera`, `qa-main-lod`Z, `qa-drive-lab` and `qa-recovery`. Check out the desktop and Triana opening captures with the tab open on mobile.

## Second reduction of lab values ​​· November 25, 2026

The panel drops from 91 to **79** sliders. Before choosing, each driving value was moved one-half and one-and-a-half times over eight courses (including against a wall), and each body pose value over 18 series.

- No effect possible: the patrols' seven reward values ​​(they never take any), so the patrols folder shows six values. The isometric view, which is that of the map, is also hidden.
- Obtained from another value with the exact ratio as before, therefore without effect on the default values: `bonusMin` from `bonusMax`; `boostFade` set to 1 (with `bonusRecover` describing the same extra stickiness); `poseMinSpeed` from `poseFullSpeed`, `poseLift` from `poseDive`, `poseAttack` and `poseReverse` from `poseRelease`; `sparkLife` from `puffLife`; `stopArrive` and `stopCaught` from `hitStop` (formerly `stopWall`).
- Verification: identical body angles within 2·10⁻¹⁵ degrees over 7,200 steps, 18 identical trajectories and trackings, no values ​​left out of the folders.

Discarded with measure: bring patrols to the player's pose. When cornering, roll would change by up to 18° and yaw by up to 9°, and the entire bodywork, including the wheels, would tilt by up to 28°: not a small effect.

Complete suite passed two out of two times in an isolated copy; `qa-drive-lab.mjs` passed.

## Merged values ​​and slope-following car · November 25, 2026

**Mergers.** The lab panel drops from 133 to 91 sliders. Each fusion was compared with the previous trajectories: 18 series (player at 90 and 30 km/h and patrol, in slalom, repeated touches, tight steering, rapid countersteering, skid braking and cornering start) and the simulated chases.

- Without effect, trajectories identical to the millimeter: `gearLoss` inside `coast` (they were both 0.8); `kickDamp`, `puffSlip`, `puffRearm` and `zoomRate` obtained from `kickStiff`, `skidSpeed` and `paceRate` with ratios that give exactly the same values ​​as before (22; 2.5 and 1.5 m/s; 1.1).
- `hardImpact` single threshold of 11 m/s for stopping the player and destroying patrols (previously 11.5): no difference on chases.
- A single `recover` while steering in place of the ramp from `recover` to `driftRecover` (with `holdRate` and `holdRelease`): 54°/s for the player, 135°/s for patrols. The 18 trajectories remain within **0.45 m**, the nose within 0.1° and the speed within 0.1 km/h. Out of 158 chases: first 99 arrivals, 18 destroyed, 4 blocked, 52 km/h; after 99, 16, 3, 56 km/h.
- Only hidden in the panel: coin and slope folders, player's `rollbackGrip`, `steerDead` (steers −1/0/1 only), the field of view of the other screen type. Patrols show only their own and `steerDead` values; a value that they share with the player is changed in the player's folder and moves both (checked in Chrome on the development server: the player's `accel` brings with it the patrols' one, `recover` does not; «Reset» and restoring from the URL reset both).

Discarded because regressions: removing `turnRelease` changes the steering by **9.5°** with repeated touches on the same side; merging `poseReverse` into `poseAttack` doubles the time of visible countersteering (17 → 33 ms), compared to the 40 ms of reversal documented in `JUICE.md`. Not done: bring the patrols to the player's pose, which would change their appearance when cornering and must be judged by eye.

**Slope.** Previously the car only followed the height of the terrain and always remained level; in physics the slope is worth a maximum of 0.6 m/s² and the gearbox still keeps the speed in gear, so uphill and downhill cruising are not felt. On city streets, one in three sections exceeds 5% and one in five exceeds 10% (90th percentile 8.7th). Now the entire car, including wheels and shadow, takes the slope of the road along the nose, measured under the two axles and damped (the terrain is a 5 m grid), up to 22°; This also applies to patrols. The player's body folds more than 50% (`slopeLean`), nose up when going uphill and down when going downhill, without detaching the wheels. `groundPitch` is tested in `qa-drive-pose.mjs`: 10% uphill, reverse by turning the car, zero sideways, limit on uneven terrain. Comparison on the screen on Calle Crucita Arbelo Cruz (13%) with the car stationary: on level ground, with the road and with the extra bend. The lab accepts `start=x,y` to set off on a chosen route.

Complete suite passed two out of two times in an isolated checkout copy; lab tests passed.

## Guide review and English lab · November 25, 2026

Code review of the single guide and the lab, then corrections.

Lab flaws fixed: the sliders of the values ​​by which the game divides (radii, fields of view, durations) stop one step above zero, and `bonusTime` at zero no longer produces NaN in the model; the URL is written at the end of the modification and not at each dragging step (previously 400 writings in 0.47 s, now **one**); keys pressed in a panel field no longer drive the car; when stationary the telemetry shows the base gear instead of zero.

Reductions: `start` option removed from `makeDrive` (`startAt()` remains); removed `cameraModes.fixed.pitch`, never read; the slip is calculated once per step; `spawnChaser` and `restart` restart from `restBody()`; the parameters used only for comparison with the previous model were removed from the tests. After these changes the player's measurements are identical (4.58 s, 3.2°, 60°, 0.79°); the simulated pursuits go from 23/40 to **25/40** at 47 km/h: the simulation is sensitive to rounding differences, so it is valid as an order of magnitude.

The entire lab is in English: `lab.html`, the catalogue, the road, width, sector and LOD test panels and the driving panel. The identifiers in the URLs (`?test=larghezze`, `?lab=guida`, `modo=visivo`…) and the toponyms remain unchanged. Tests rerun on the build: `qa-drive-lab.mjs`, `qa-road-lab.mjs`, `qa-lod-lab.mjs`, `qa-road-width-lab.mjs` passed. `qa-lod-lab.mjs` and `qa-road-width-lab.mjs` failed on the first execution (one assertion and one timeout) and passed on the next two without modification.

Full Suite (`node scripts/qa.mjs`): **passed two out of two times** in an isolated checkout copy with these changes. In the main checkout it had failed three times (two timeouts on capture, an HTTP error on load) while another agent was working on it: it rebuilt `dist` during the run and the suite serves that folder. The same suite on the already committed code, in isolated copy, passes. It's likely that the two initial failures of the lab tests also came from there; it is not proven.

Measurement aside, 12 starts with the car braking immediately: the patrols catch it 12 times out of 12, in 8–59 s. In another series of 12 with 1.5 s of driving before braking, one start in 12 was not caught within 100 s (patrols remained beyond 67 m); with the previous model (`bed2273`) in the same test 2 out of 12 were missing.

## Single guide and calibration laboratory · 25 November 2026

The drift-racer drive is the only one: `?handling` was removed together with the previous model. `steerCar` in `drive-physics.ts` serves players and patrols with two profiles of the same shape, `TUNE.player` and `TUNE.patrol`; the steering state (steering wheel, gear, drift time, extra grip) is in every car. The section below describes the model; where it mentions `?handling=drift`, `steerDrift`, `TUNE.drift` and `qa-drive-drift.mjs` this applies.

`qa-drive-handling.mjs` (part of `npm.cmd test`) repeats player measurements with the same results as before shuffling: 90 km/h at **4.58 s**, 100 ms touch **3.2°**, drift limit 60°, 60 vs. 120 Hz **0.79°**. Plus: two cars don't affect each other; a patrol on a curve slides to its limit of 20°; a light correction (steering 0.2) turns without downshifting or slowing down; a stationary car that swerves after a collision starts again (over 4 m/s in 1.5 s).

Defect found and corrected, present in the profile published on November 25: after a collision, with a small residual lateral speed and the steering held, the branch "rolls backwards" reset the speed with each step and the car remained stationary until the steering was turned. Now that branch is only valid if the car moves back more than the push of a step recovers. Furthermore, the slip left by a collision is no longer cut off suddenly at the skid limit: it is reabsorbed at the recovery speed, so a car can slide along a wall.

`qa-drive-chase.mjs` simulates 40 chases on the pilot's real streets (`pilot.json`, including walls and trees): the patrol starts 150–300 m away from a stationary player.

| Model | Reached | Destroyed | Blocked | Over 60s | Average on the road | Strong shocks for running |
|---|---|---|---|---|---|---|
| Precedente (commit `bed2273`) | 22/40 | 4 | 1 | 12 | 41 km/h | 8,2 |
| Unique, first of the two corrections | 9/40 | 5 | 21 | 3 | 62 km/h | 1.4 |
| Single, current `TUNE.patrol` profile | **23/40** | 5 | 2 | 9 | **51 km/h** | 4.8 |

The test fails below 20 arrivals or above 4 blocks. It is a simulation with the player stationary: it does not say how the patrols behave against a drifting player, nor how they appear on the screen.

`index.html?lab=guida&area=pilot` Laboratory (`qa-drive-lab.mjs`, Chrome, on the build): from the `lab.html` catalog the game opens in the Vegueta pilot with the panel and its folders; by lowering `baseSpeed` to 30 km/h the car already in motion remains below 45 km/h; the URL becomes `t=player.baseSpeed:30`; by turning off «Police» the patrols disappear and the URL takes on `nopolice`; «Copy values» shows `player: baseSpeed:kmh(30)`; after reloading the panel starts again from those values; outside the lab `t=` is ignored and the panel is not there. No errors in console. Not tested on phone: the panel is designed for the desktop.

## Drift-racer Guide · November 24, 2026

`?handling=drift` replaces the player's driving with the drift-racer's (Construct 3), rewritten in `steerDrift` by `drive-physics.ts` with the parameters in `TUNE.drift`. The values ​​come from the game's `carconf.json`, at 24.4 px per meter (610 px/s = 90 km/h); the constants that in the original are valid per tick (steering and drift growth) are converted into values ​​per second.

The handbrake of the original is not there. The drift arises from the steering held alone: ​​the direction of travel follows the nose at 70°/s, which drops to 50°/s in 0.45 s of steering, while the nose turns up to 190°/s; drift is limited to 60°. With free steering the gear returns to the nose at 200°/s. Pressing the two sides together remains normal braking.

`qa-drive-drift.mjs` (now part of `npm.cmd test`) measures at 120 Hz: base speed of 90 km/h at **4.58 s**, peak of 116 km/h after a long straight, return to base gear after braking; a 100 ms touch turns the nose by **3.2°**; one second of steering at 90 km/h brings the drift to the limit of 60°, losing less than 1 m/s; 350 ms after release the car is straight, the nose has not moved and the speed has returned to 90 km/h; a short touch gives no reward; between 60 and 120 steps per second the steering changes by 0.79°; after a backward bounce the car starts moving forward again; the patrols give the same result with the two profiles.

In Chrome, with `?handling=drift&nopolice`, the guide starts, collects coins, steers and holds the direction on release, without errors in the console. The feel was not judged: the panel was hidden and the test was instrumented. Not carried over from the original: off-track penalties, turbo, fixed bounce at negative speed (impacts from here remain).

## Driving Physics · November 24, 2026

**Interpolation.** Before each 1/120 s step, the position and direction of each car are saved. The design places them between the last step and the previous one, in proportion to the time left in the accumulator; once the drawing is finished, the simulated poses are put back on. Cars that jump more than 4 m (reappearance, restart) are drawn where they are. `data-drive` reports simulated poses, not drawn ones. During freeze, capture and pause do not interpolate.

**Backward braking.** With 3 m/s of recoil, one braking step brings the speed to −2.775 m/s; before he reset it in a single step.

**Steering at high speed.** `turnFade` 0.3 enters with a smoothstep between 60 km/h and maximum speed: at 13 m/s the steering is identical (correction in the first 100 ms 2.58°, as before); at 90 km/h it is worth 70%. With full steering from 90 km/h, a quarter turn goes from 0.64 to 0.78 s with a wider radius; the exit speed remains approximately the same (58.9 versus 57.9 km/h): it is mainly the lateral grip that loses speed when cornering, not the speed of the steering.

**Patrols braking.** With 4 m/s of lateral slip, a braking step reduces this to 3.93 m/s for the player (grip 2.2) and 3.76 m/s for the patrol (grip 7.5).

The regressions in `qa-drive-pose.mjs` cover all four points. Acceleration, tip and braking from 90 remain unchanged (1.442 s, 5.442 s, 0.933 s / 11.5 m). Typecheck, build and targeted tests (`qa-drive-pose`, `qa-drive-camera`, `qa-drive-route`, `qa-drive-location`, `qa-pedestrians`) and `npm.cmd test` suite passed. In Chrome the guide starts, collects coins and generates a patrol without errors in the console; with the panel hidden it was not possible to judge the fluidity frame by frame.

## Slope and acceleration

At 120 Hz the recovery from 60 to 90 km/h takes **3.39 s** on a constant 8% descent, **4.00 s** on flat and **4.88 s** on an 8% climb. Regression controls braking, limit of correction on steep slopes, reversal, transition between uphill and downhill, neutrality near bridges and roads at different levels, and anticipation of braking of patrols going downhill.

In Chrome with touch emulation, starting at 20 m/s for 150 ms on the same stretch of Calle Párroco Villar Reina, the car reached 20.36 m/s downhill and 20.23 m/s uphill. On the flat stretch of Avenida Marítima it reached 20.29 m/s in both directions.

Typecheck, build e suite `npm.cmd test` superati.

## More Legible Roll and Bounce

The 120 Hz regression measures over 27° of roll in sustained cornering and checks that the body remains above the plane of the wheels even at maximum roll with pitch. In Chrome with emulated touch, a frontal impact at 15 m/s produced a 0.9 m jump. The shadow remained on the ground and the car returned to driving altitude. Typecheck, build and suite `npm.cmd test` passed.

## Side-Scraping in Alleys

With a contact of 4 m/s towards a facade and 18 m/s along the facade, the simulation cancels the velocity towards the wall and preserves 17.52 m/s along the wall. In the 2.6 m wide test corridor, one second of continuous steering towards the frontage keeps the car within the corridor and above 12 m/s in both directions. Regression also controls bounce in head-on collisions, on the edge of the map, and against a tree.

In Chrome desktop and emulated touch, an instrumented test on one side of the map verified three sparks going out within 160 ms of animation, the preservation of velocity along the wall and the absence of bounce in grazing contacts. The frontal impact on the same side still produces bounce, hop and hit-stop.

Typecheck, build e suite `npm.cmd test` superati.

## Speed and Braking · November 23, 2026

The 120 Hz regression measures 60 km/h at **1.442 s** and tips it at **5.442 s**, equal to 90 km/h for the player and 94 km/h for patrols. The player travels **96.5 m** from rest before reaching 90 and stops from that speed in **0.933 s** and **11.5 m**. For the same amount of slip, the patrol loses 50% more due to the drift coefficient. Obstacle control finds obstacles at 4, 8 and 13.8 m. The camera test checks 0 m from standstill, 5 m at 10 km/h and 12 m from 90 km/h.

In desktop Chrome and emulated touch, the instrumented test reached 90 km/h on a graph avenue, tested a sharp curve and stopped the car before an intersection starting from 90. A frontal impact at around 10.6 m/s produced the bounce and one at around 11.6 m/s also triggered the stop.

Typecheck, build and `npm.cmd test` passed. The suite highlighted an already queued capture filter update when the page is hidden. Rendering now applies the filter only to the visible page. The feel test on a physical phone remains open.

## Arcade Steering · November 22, 2026

Regression at 120 Hz measures **1.442 s** up to 16.5 m/s and **0.658 s** to stop from 13 m/s in a straight line. A touch of 100 ms at 13 m/s changes the direction of the trajectory by **2.58°**, compared to **0.96°** of the previous calibration. After 400 ms of steering, upon release the slip drops below 1.5 m/s in **175 ms**. The test also checks roll, countersteering within 50 ms, longitudinal inclination, return to neutral position, height of the body over the wheels and stance limit after a collision.

Typecheck, build, and path and camera regressions passed. An instrumented test in Chrome desktop (1440×900) and emulated touch (390×844) performed starting, cornering and countersteering, braking and frontal impact. At approximately 15 m/s the body reaches 16.4° of roll while the wheels remain level. The white puff appears once during the slide and the tracks leave. The impact produces a hop, leaving the shadow on the ground and without letting out another poof. On a physical phone, the driving sensation remains to be verified.

`npm.cmd test` passed in Chrome desktop and touch emulated. The suite holds down the brake to verify capture after steering and after WebGL reset. The free run can continue after having grazed a wall and had expired the wait on the second attempt on mobile.

Regression uses the same steering function called by the game. A comparison of 2,400 steps per vehicle gave the same physical state before and after simplification, for the player and for a patrol, with braking, reversing and ramp resetting. The body test rotates the vertices of the model to verify the distance from the plane of the wheels.

## Basic verification

Windows, Node 24.13, Chrome desktop and Playwright. Type checking passed with `npm.cmd run typecheck`. Vite Build completed with `npm.cmd run build`. The main bundle measures approximately 604 kB minified (154 kB gzip) and exceeds Vite's default information threshold.

| Try | Outcome |
|---|---|
| `node scripts/qa.mjs pilot` | Neutral and stylized, identical room on Santa Ana. The square remains open in front of the two towers. |
| `npm.cmd test` | Production build tested at 1440x900 and 390x844. All six tabs, floating index, pan, zoom, reset, keyboard movement and activating a marker with Enter. Pinch via Chromium touch events. |
| Page requests | No failed requests, error HTTP responses, external resources, or unhandled JavaScript exceptions in the tested locations. |
| Opening | Until the first view with camera ready: approximately 2.7 s desktop and 2.0 s mobile emulated in the recorded test. |
| Movement | Measurement prior to the restyling. Chrome local desktop, viewport 1887×2044. During 50 alternating keyboard moves, median inter-frame interval 17.3 ms, 95th percentile 18.6 ms after five initial frames. On a physical phone, performance remains to be measured. |
| Data playback | From cache: approximately 1.4 s for Santa Ana and 1.6 s for the full area. Local cache with Python libraries approximately 225 MB. Final scene 716 kB on disk. Zero raster tiles. |

## Visual tests

- [Full-Screen Opening View](screenshots/opening.png) · detail of Triana.
- [Overview to San Telmo](screenshots/overview.png) · continuous perimeter and marker.
- [Neutral Santa Ana](screenshots/santa-ana-neutral.png) and [Stylized Santa Ana](screenshots/santa-ana-styled.png) · same geometries, view and scale.
- [Market and Theater](screenshots/mercado-teatro.png) · mutual position and urban crossing along the ancient Guiniguada.
- [Triana on Mobile](screenshots/triana-mobile.png) · Cabinet name, controls and attribution.

The tests cover overview and detail. The scene is continuous, grouped into spatial cells for drawing. At the edges of the model you can see the cuts of the area. The relief of the facades, the heights and the vegetation have the approximations described in the [data notes](DATA_SOURCES.md).


## Restoring WebGL on mobile

The test selects San Telmo, forces two consecutive cycles of context loss and restoration on the same canvas and checks the projection, tab and variety of pixels in the center of the map. The suite scales to 1440x900 and 390x844 in Chrome with Playwright. The test simulates WebGL termination, without simulating browser process termination by the operating system.

The touch/small screen profile uses maximum DPR 1, multisample anti-aliasing off, direct lighting without shadow maps, and lighter geometry for trees and facades. For the complete scene, the sum of attribute bytes in the final geometries goes from 87,888,600 to 35,822,556; the triangles 732.405 to 426.459. These values ​​measure mesh arrays and not total device memory.

## Camera, Memory, and Gradual Recovery

Comparison with commit 1c8f8c0. Local Chrome in Playwright, 390x844 touch viewport, same Vite build for each revision. The route alternates between Santa Ana and San Telmo, with eight small keyboard pans per stage. In historical measurement the transitions were deactivated. The current benchmark waits for the camera to finish flying before measuring pan. Twenty stages measured after the first two warm-ups.

| Measurement | Previous version | Current version |
|---|---:|---:|
| Floating geometric arrays, including indices, colors, and instance matrices | 35,822,556 bytes | 21,252,343 bytes |
| Node process RSS spike isolated during scene construction | 348,628 KiB | 298,176 KiB |
| Top league in heap and backing storage when opening in Chrome | 104.6 MB | 91.0 MB |
| Opening in the single run of the benchmark | 2.37 s | 2.47 s |
| 95th percentile range during pan | 34.6 ms | 34.0 ms |
| Draw call WebGL for frames, media | 17.75 | 30 |
| Triangles sent per frame, average | 147.010 | 139,674 |
| Draw call in the five second rest | 0 | 0 |

Per-cell instances reduce duplicate data and increase separate drawings. The WebGL buffers and textures counted in the new version remain at 245 and 6 between the end of the warm-up and the twentieth measured stage. Openness and percentile are measures of a session, sensitive to browser, GPU, and computer load. The RSS peak includes the entire isolated process; Chrome sampling does not measure VRAM. Repeating on local build with `node scripts/benchmark.mjs`; an optional argument selects another build folder.

The browser suite covers viewport orientation, zoom and center preserved, three consecutive losses (pan, transition, tab), pixel recovery, reduced profile from the second loss, and recovery via the reload button. On mobile it also experiences pinch after reset and temporary resolution reduction during a prolonged gesture with slow intervals. Checked the visual comparisons of [Santa Ana](screenshots/santa-ana-styled.png), [Mercado](screenshots/mercado-teatro.png) and [San Telmo](screenshots/san-telmo.png).

Monument verification: typecheck, build, neutral/stylized comparison in Santa Ana, and desktop/mobile smoke tests completed. Control shots: [cathedral](screenshots/santa-ana-styled.png) and [Gabinete Literario](screenshots/triana-mobile.png). All graphic assets of the demo are served by the project.

## Catalog and roofs

The browser suite adds a seventh location to the test data, changes the order of the locations, and controls the saved selection and driver filter. A separate regeneration with Alameda de Colón retained the coordinates of the original six locations and the pilot's perimeter. On the city scene, the geometric checks for positioning on the roofs drop from 18,178 to 15,132 with the same aggregate result.

## Roads on the ground

The [mobile view of Teatro Pérez Galdós](screenshots/teatro-mobile.png) covers the avenue along the flowerbed and the intersections on the sides of the theater. The color of roads, paths and OSM surfaces follows the same terrain triangles throughout the area. The streets have rounded junctions and the pedestrian paths are drawn last. The color map is generated once per scene with the largest edge limited to 2048 pixels. Check out the neutral and stylized pilot, emulated desktop and mobile navigation, zooming and repeated WebGL context restoration.

## “Conducir” Mode · November 21, 2026

`npm.cmd test` covers, at 1440×900 and 390×844: entry into the mode, trail of coins present, start at first input (keyboard on desktop, touch on the left side on mobile), counterclockwise steering and automatic advancement, capture with «¡Atrapado!» panel, «Otra vez» with score reset, collection of at least one coin, exit with return to the previous view. No JavaScript exceptions or failed requests.

- Without driving, in three desktop trials the capture came after approximately 10, 16 and 31 s.
- Chrome with 390x844 emulation, 10 s driving: median inter-frame interval 17.5 ms, 95th percentile 18.3 ms. It's the development computer, not a phone.
- [Mobile Screenshot](screenshots/conducir-mobile.png).

Known limitations: No testing on physical phone (real touch, vibration, performance). Swipe does not have an automatic test. Capture in the test depends on the random arrival of patrols, with a maximum wait of 120 s. The cars are circles of 1.15 m radius; only trees more than 4.5 m from a facade are obstacles. Dynamic shadows are spots, the shadow map remains static. Buildings can cover the car in narrow streets: the yellow shape follows the covered pixels and the arrow appears when a building volume covers the center of the passenger compartment.

### Icon-Only Interface and Game Feel

HUD, guide and final panel without visible text: own SVG icons, numbers, animated touch zones (brake lesson after 4 s, only once, remembered in the browser), destination indicator with location number, light beam at the finish line and records in the final panel only. Labels and ads remain for screen readers. Added: coin magnet, numbers popping up when collecting, patrol lights, wrecks spinning, nose dropping when braking, pause before capture panel.

Camera: separate smooth advance, narrow tracking, zoom with time constant of approximately 1 s. Measured in 0.5 s samples while driving: zoom between 0.91 and 0.97 of the base value, maximum variation between two samples 0.012. Glide entry from map zoom in approximately 1.5 s.

- [Driving HUD on Mobile](screenshots/conducir-mobile.png) · [capture panel](screenshots/conducir-fin.png).
- The design detector reports the 10 px footer and the Inter font, pre-existing and not modified.
- Not tested on physical phone. The feeling compared to Pako's video must be judged by playing.

### Hit-stop and camera shot · November 22, 2026

Simulation stop for strong impact (55 ms, over 9 m/s, at most one every 0.6 s), arrival (50 ms) and capture (110 ms); dust, chamber and interface continue. The random shaking of the chamber is replaced by a push towards what it hit, with spring return. Rules and catalog in [JUICE.md](JUICE.md).

- Spring calculated outside the browser with the same steps as the code: full stroke 0.99 m peak and return below 3 cm in 0.28 s at 60 frames per second; 0.93 m at 20.
- `npm.cmd test` verifies that the capture produces at least one stop and that the camera movement returns below 2 cm.
- Not tested: threshold and interval of impacts in a narrow street when playing by hand, and the effect of stops together with vibration on a physical phone.

## Vegueta–Arenales–Ciudad Jardín Corridor

The initial test divided the original 487,313 m² into 17 sectors. On the 390×844 touch viewport the startup built 9 sectors and 16.02 MB of detail array. After San Telmo, Santa Ana and back, 20.73 MB of array remained resident and the viewfinder only showed the simplified level. This first measurement concerned the geometries before the introduction of local textures.

The final area cut out on the coast measures 3,040,938 m² (6.24×); the vertices exported with precision of one decimeter give 3,040,955 m². The check on the generated data compared the multisets of buildings, terrain polygons and trees between source and sectors. Each element has an owner, all road sections are represented and the 160 files recalled from the 80 sectors are present. The original six POIs retained their local coordinates and IDs. [Overview](screenshots/overview.png) · [Parque Doramas](screenshots/ciudad-jardin.png)

| Benchmark in Chrome with emulated mobile viewport | Before, 0.487 km² | After, 3,041 km² |
|---|---:|---:|
| First navigable view | 2.29 s | 2.48 s |
| Peak championship on the main block during the opening | 102.2 MB | 86.1 MB |
| p95 interval during pan | 18.2 ms | 18.4ms |
| Draw call averages per frame | 32.44 | 70.75 |
| Medium triangles per frame | 144,863 | 185.226 |
| Drawings in 5 s at rest | 0 | 0 |

Measurements of a single local run per version. The route alternates between Santa Ana and San Telmo. The sector version waits for the detail before sampling the pan. The first view can already be explored while the worker prepares the detail. The sampled heap excludes the worker and VRAM. The percentile during pan does not measure the peak of a cold load. The expanded version sends more draw calls and triangles. In a first prototype, the synchronous preparation of the detail interfered with the interactions; the end result uses a worker and portable arrays.

The specific test `node scripts/qa-sectors.mjs` blocks the first detail request, forces WebGL loss, and checks for detail return after restore. Visit Santa Ana, Plaza de la Feria, Parque Doramas and Metropole for three tours and check out expulsions, budgets and stabilization. In the observed run, after warming up, the detail at the four stops occupied approximately 45–50 MB within 48 MiB (50.33 MB). These figures estimate data from resident sectors. Then use two real road nodes on Calle Luis Doreste Silva as starting and ending points and drive both ways across the border x = −480 m, with active vehicle and patrol. The game graphics, physics and controls are those of production.

On the 5,067 node road graph the ten points of interest gave the same nearest nodes and distance vectors as the exhaustive calculation. With Local Node, averaged over ten locations, finding the node took 0.0043 ms with index and 0.0638 ms with linear scan. The complete path took 0.67 ms with the priority queue and 0.76 ms with the old scan. With the source unchanged, the field is reused.

ADB was available and the connected devices list was empty. The touch, orientation, memory pressure and retrieval tests are simulated browser tests. Temperature, VRAM and fluidity on the physical phone remain to be measured.

Repeated the entire generation from cache in pilot order, cities, colors and sectors. The 168 files under `public/data` kept the same SHA-256.

In the second and third rounds of testing the WebGL buffer/texture counts at crashes were 922/30 and 922/30 in Santa Ana, 944/32 and 944/32 in Plaza de la Feria, 1,010/36 and 1,010/36 in Doramas, and 1,040/36 and 1,036/36 in Metropole, respectively. These are resource counters, not bytes of VRAM.

Credits are seen with the location menu, location card, final summary, and WebGL recovery popup. They hide while exploring and driving.

## Graphics Robustness · November 21, 2026

- **Loss of driving context.** The game remains suspended instead of closing: score, patrols and position are preserved, no simulation steps without graphics, and the race restarts only at the first input after the reset. Covered by `npm.cmd test` on desktop and mobile emulated (`held` status to `data-drive`). Switching tabs or windows releases ongoing taps, without a pause panel.
- **Continuous adaptive resolution** (historical measurement of the previous controller, now replaced by `src/render/dynamic-quality.ts`). Activate while dragging, flying and driving, on all devices; three levels (1, 0.85, 0.7 of the basic pixel ratio). It drops after two windows of 30 frames with a median over 33 ms, goes up after six windows with 75th percentile under 20 ms, and doubles the wait if the level just risen does not hold. With a steady view it immediately returns to full. Simulation: 40 ms per frame leads to 0.85 after 60 frames and 0.7 after 120; at 16 ms it goes back to 0.85 after 190 frames and to 1 after 370.
- **Shader warm-up.** Upon entering the guide, all the mode materials are compiled, including those that appear later (wreckage, flashing lights, dust colors). Programs counted in 45 s of driving with one capture: 15 at entry and 15 maximum on emulated mobile; 16 and 17 on desktop.

Limits: on the desktop there remains a program compiled during the game in progress, unidentified (probable material from a sector uploaded in streaming). In Chrome with software rendering the guide drops to 0.7 for loading sectors - this is not a measurement of a phone. The first run of the suite after the change reported four failed sector requests while losing context in help; it was not repeated in the six subsequent executions and the cause is not established. No testing on physical phone.

## Solid-Color Roofs

Check the PNOA colors for all 4,698 building parts in the city and 1,108 in the pilot. At Parque Doramas, with emulated mobile Chrome and the same camera, the build capture coincides with the flat variant of the visual comparison. The build loads WebP zero in the pilot and sectors, both with the worker and with synchronous build. Typecheck and build passed.

Passed the Playwright suites of the city on desktop and mobile emulated, of the neutral and stylized pilot and of the sectors. In the mobile circuit the estimated detail bytes remained within 48 MiB, with identical WebGL counters in the last two rounds at each shutdown. Verified recovery after loss of context and crossing while driving in both directions.

## Three driving views

Verified typecheck, build, city browser suite and sector circuit. The repeatable control `node scripts/qa-drive-camera.mjs` tests rotation limit, a reversal, stationary stability, and reentry after an obstacle, with steps at 30 and 120 Hz. Chrome tested the change during keyboard and two-finger steering, WebGL retrieval, return to the previous view, and preference retrieval after reload.

In the pan benchmark in emulated mobile Chrome, one run per build, the p95 went from 18.3 to 18.4 ms and average triangles from 198,485 to 223,617. At Parque Doramas the resident detail went from 14 sectors and 50,037,827 bytes to 13 sectors and 48,340,157 bytes within the 48 MiB budget. The benchmark measures the map in pan. Fluency on a physical phone remains to be measured.

Record six clips of the same startup and steering sequence on Chrome at 390x844 and 1440x900, one per view: starting, turning about 90°, and reversing. Local videos are in `.cache/camera-clips/`, with names like `390-high.webm` and `1440-chase.webm`.

## TypeScript Migration

- The `npm.cmd run typecheck` command controls all `src/` with `strict: true`. The Vite build includes the separate worker. The same assets and save formats remain available.
- The entrance controls accept both scenes, the POI catalog, the roof palette, the index and all 80 distributed sectors. Also tried a saved numeric selection from the first version and rejecting a view with incomplete coordinates.
- Chrome loads and displays sectors from build under `/isometric-cities/`, either using the worker or with `OffscreenCanvas` disabled and building on the main thread. The Node control of the driving camera switches before and after the migration.
- In the emulated mobile benchmark, the p95 during pan went from 18.2 to 18.1 ms. Both builds recorded 90.75 draw calls and 223,617 triangles per frame, with zero draws at rest. This is a software-rendered Chrome build run.

The complete browser suite, neutral and stylized driver, and sector circuit pass on both the reference JavaScript build and the TypeScript build. The circuit maintains the same observed maximum of 49,868,015 bytes of resident detail, within the 48 MiB rolling budget. The guide crosses the same sector boundary in both directions with an active patrol.

Three opens in mobile Chrome emulated with a new process for testing, performed alternating builds, yield a median of 1,675 ms for JavaScript and 1,672 ms for TypeScript. The comparison measures the time until the first navigable view, on this machine.

## Driving Startup, Place Index, and Streaming Recovery

- `npm.cmd run build` first checks the scenes, the catalogue, the palette and the 80 distributed sectors. An index with a missing building-sector association is also rejected when opened in the browser, before creating the renderer.
- `node scripts/qa-recovery.mjs` verifies that the map remains navigable without roads or places. Also checks the switch to local construction when the worker does not respond for 10 s, both with the sector still requested and after cancellation.
- `node scripts/qa-drive-route.mjs` checks the route choice, coin spacing, magnet, scoring events, one-time bonus and destination change. `node scripts/qa-drive-camera.mjs` also passes after refactoring.
- Also passed the emulated desktop and mobile browser suite, the pilot and the sector circuit. In the circuit the observed peak of resident detail was 49,868,015 bytes on a compact budget of 48 MiB. The guide crossed the sector boundary in both directions with an active patrol.

## Wind and cloud shadows · November 22, 2026

- `npm.cmd run typecheck`, `npm.cmd run build` and `npm.cmd test` pass to desktop and mobile emulated. The suite now checks that, with the map stopped and sectors loaded, two images of the canvas 800 ms apart are different and that `data-view` remains identical.
- Idle cadence measured by counting WebGL `clear` calls in software-rendered Chrome: 28.3 draws per second on desktop and 27.5 on emulated mobile, with `requestAnimationFrame` at 55–57 per second. Replaces the "zero drawings at rest" entry in the TypeScript migration section.
- Drawings at rest only update the wind clock and redraw the scene: camera, sectors, markers and adaptive resolution remain those of the last complete frame.
- Visual control on the regenerated screenshots: foliage and palm trees remain attached to the trunks, the cloud shadow appears as a darker band in the overview and at medium zoom.
- Not verified: consumption and temperature on physical phone, and the readability of the oscillation at the driving scale on real screen. The shadows of the trees in the shadow map remain still while the crowns move about half a meter.
- Screenshots in `docs/screenshots` are no longer identical between two runs, because cloud shadows depend on the moment of the shot.

## Sea and contact shadow · November 22, 2026

- `python scripts/data.py city` regenerates from local cache: `city.json`, `poi.geojson` and `city-aoi.geojson` remain identical byte for byte and `sea.json` (8 KB) is added. 5,309 m of the 10,679 m of the perimeter coincide with the mapped coast.
- `npm.cmd run typecheck`, `npm.cmd run build` (which now also applies `sea.json`), `npm.cmd test` and `node scripts/qa-sectors.mjs` pass. The peak detail resident in the circuit remains 49,868,015 bytes.
- The sea is a single mesh with a distance from the coast texture painted once on canvas. The panoramic view frames land and sea; movement remains limited to land. The sea does not appear in the pilot or neutral mode.
- Contact Shadow: Building footprints are filled onto a mask at approximately 4m per pixel and multiplied onto the ground texture. The first version, with wide outlines drawn on canvas, increased the startup from around 2.1 to 6.4 s in Chrome with software rendering and was discarded. With the mask, the construction of the texture of the entire city goes from 72 to 390 ms in the same test.
- startup measured by the suite after changes: 2,828 ms on desktop and 1,781 ms on mobile emulated (before sea and shadow: 2,091 and 1,451 ms in the same session). It is only one run per configuration.
- Known limitations: in detailed sectors the shadow only considers buildings in the sector itself, so it may be missing along the edges; the port piers outside the perimeter appear as voids surrounded by foam; sea ​​level is set at −0.9 m because the terrain model reaches 0 m on the banks.
- Not verified: appearance and cost on physical phone; the movement of the waves was checked only on still images and with the test comparing two frames.

## Pedestrians · November 22, 2026

- `node scripts/qa-pedestrians.mjs` (included in `npm.cmd test`) drives a car at 16.5 m/s along a pedestrian street for 600 frames: on open ground pedestrians run away and no one on the ground comes within 2.3 m of the center of the car (minimum observed 5.14 m); in a 2 m wide corridor they jump over the car; no one ends up in an obstacle; a stationary car only moves those who touch it.
- The browser suite checks that there are pedestrians at the entrance and that no one is within 2.2 m of the car. The two values ​​are the thirteenth and fourteenth fields of `data-drive`: pedestrians present and minimum distance from the player.
- In a 4 s run on emulated desktop: 40 pedestrians present, minimum distance sampled 7.5 m.
- Cost: two draw calls (colored body and head) and no new data.
- Not verified: test by hand in narrow streets, readability on physical phone (figures are about 3 m tall in scale, like oversized cars), behavior with many patrols together.

The `lab.html` catalog loads each proof via a dedicated input in `src/lab/main.ts`. To add a test, record the form's ID, title, description, and dynamic import. The `node scripts/qa-road-lab.mjs` suite checks the connection to the road test, the three materials, the A/B wipe on the same frame and the replay in emulated desktop and mobile Chrome. For the results of the withdrawn visual tests, see [history](STORICO_PROVE_VISIVE.md).

## Map rotation

`npm.cmd test` exercises the four 90° shots and checks that center and zoom remain unchanged. Also try double-clicking, keyboard activation, panning with all markers visible, changing screen orientation, exiting Play, and restoring WebGL with and without page reload. `rotation-desktop.png`, `rotation-mobile.png` and `rotation-landscape.png` captures are saved in the directory chosen with `QA_SCREENSHOT_DIR`.

`node scripts/qa-drive-camera.mjs` checks that the Isométrica view in driving starts from the orientation chosen on the map.

Typecheck, build and Chrome suite completed. Check the captures at 1440x900, 390x844 and 844x390. The touch test was performed in Chrome emulation.

## Geometric roadways on sector boundaries

First test on Calle San Nicolás, sectors `-2_-2` and `-1_-2`. The generator produces 962 triangles and the resident detail grows by 30,909 bytes. Over five passes per configuration the median p95 remains at 18.2 ms on the mobile profile and goes from 18.2 to 18.3 ms on desktop. The capture at the same position shows the edge of the asphalt curving next to the car. [Texture and Geometry Comparison](screenshots/carreggiate-san-nicolas.png)

Extending to 80 sectors produces 37,487 triangles. The data check verifies 124 boundaries crossed by the asphalt, with a tolerance of 1 cm in plan and elevation, and the exclusion of corridors around 10 way OSM with bridge or explicit level. The entire city's detail JSON grows from 4,291,052 to 5,661,927 bytes before HTTP compression. Each sector downloads only its own file.

The game test crosses the border both ways in Conducir with active patrol. The laboratory also reproduces the delayed arrival of the eastern sector. Times measured with Chrome on computer and mobile viewport cover streaming and route drawing. The perceived stability during a turn and the thermal behavior still require testing on a physical phone.

Repeat with the complete index and five steps per configuration. The memory indicates the resident data counted by the streamer at the comparison point.

| Chrome Profile | p95 textures | p95 geometry | Texture memory | Geometry memory |
|---|---:|---:|---:|---:|
| Mobile emulated, 390 × 844 | 18.3 ms | 18.3 ms | 46.81 MiB | 46.97 MiB |
| Desktop, 1024×720 | 18.2 ms | 18.3 ms | 59.81 MiB | 59.98 MiB |

Both profiles respect the +10% threshold on hot p95. During the single cold boot, the maximum interval observed with a request pending was 1,614 ms / 960 ms on mobile and 1,516 ms / 1,295 ms on desktop (texture / geometry). These values ​​include initial loading and depend on the test machine. Also verified construction on the main thread with OffscreenCanvas disabled, WebGL context recovery and three laps of the street circuit with sector expulsion from the 48 MiB mobile budget.

## 5- and 9-Meter Roadways

The verification on the distributed files counts 45,088 triangles in 80 sectors, 124 road boundaries consistent within 1 cm and 10 exceptions for bridges and levels. The added band control uses 1 mm tolerance for rounding. The three central sections of the laboratory measure 5 m in Calle Rafael Mesa y López, 9 m in Avenida Marítima and 4.75 m in Calle Párroco Villar Reina. In the latter the edges are respectively 2.50 and 2.25 m away from the axis. [Comparison at the Same Position](screenshots/larghezza-carreggiata.png)

| Profile | p95 previous | p95 new | Previous / new resident detail |
|---|---:|---:|---:|
| Mobile emulated | 18.3 ms | 18.2 ms | 46.97 / 46.99 MiB |
| Desktop | 18.2 ms | 18.3 ms | 59.98 / 60.01 MiB |

Medians of five hot passes on the route of Calle San Nicolás, comparison with the geometry of `85b05aa`. The mobile detail budget is 48 MiB. The outline used for panning adds 469 kB to the JSON index (about 173 kB with local gzip). Chrome emulation tests the two profiles on the same machine.

The Conducir test crosses the border both ways with active patrol. The first round of QA on sectors reported growth in WebGL counters in Santa Ana. Repeating the entire circuit surpassed the same threshold, with 48,584,527 bytes residing in Santa Ana in both of the final two loops. The laboratory test covers the three-section selector, the width change and the position of the car stored.

## LOD transitions in the main game

City Map and Conducir share the lab's 250ms fade. The map goes into detail at 520 m and maintains it up to 580 m. Streamer diagnostics expose `near` and `fading` (sectors in transition). The renderer requires additional frames until completion and preserves the environmental redraw of the stopped map.

The `node scripts/qa-main-lod.mjs` test delays a sector, forces the loss of context at the first fade with the camera stopped and verifies the recovery. With unit zoom orthographic camera checks the two directions around 550 m, the completion of the fades, the budget and the neutral mode. The benchmark on the Santa Ana–San Telmo route in emulated mobile Chrome measures a p95 of 18.3 ms on the reference build `5d75c91` and 18.4 ms on the new build (+0.55%). The results are for the test computer.

## LOD transitions in the lab

Open `lab.html?test=lod`. The three variants compare the current behavior, the hysteresis (entry at 520 m and exit above 580 m) with a temporary driving preference for recent visible sectors, and the same policy with visual transition. The initial duration is 250 ms. The roadway samples the panoramic texture in world coordinates while transitioning to the local material. Building and tree silhouettes use complementary masks on a 4 × 4 pixel matrix. The expulsions necessary to respect the budget take place immediately.

`node scripts/qa-lod-lab.mjs` after the build repeats three scenarios on two sectors of Calle San Nicolás. The first artificially delays the east sector by 1.8 s with the camera stopped. The second oscillates around 550 m after going into detail. The third travels the curve in both directions with the test chamber. The browser checks errors, budget and image variations by enabling the two effects separately and holding the transition at 50%. [Crosshatch at Mid-Transition and Full Detail](screenshots/lod-laboratorio.png)

| Chrome Profile | Changes during zoom, current / stable / visual | p95 en route, current / stable / visual |
|---|---|---|
| Mobile emulated (390×844) | 14 / 0 / 0 | 18.2 / 18.2 / 18.3 ms |
| Desktop (1024×720) | 14 / 0 / 0 | 18.2 / 18.3 / 18.3 ms |

A change counts the request to show or hide the detail of a single sector. Times measure requestAnimationFrame intervals on the test computer. On the mobile profile the final captures of the current variant and the completed transition coincide. The screen is distinguishable on the windows and along the edges of the foliage in 50% capture. The physical phone is used to judge its visibility in motion.

With `node scripts/qa-lod-lab.mjs --citta` the same path uses the full index on the emulated floating profile. The p95 was 18.3 ms for the current variant, 18.2 ms with stable thresholds, and 18.2 ms with visual effects. All three recorded 11 substitutions during the course and 2 cumulative expulsions. The experimental priority did not reduce the changes in this test. The detail memory at the end was 49,412,515 bytes out of 48 MiB available (47.12 MiB resident). The final pose required 28 draw calls, which rose to 34 by forcing the transition to 50% of the details present. This simultaneous superposition is a load test. The first load intervals are sensitive to browser warming and do not demonstrate an advantage between variants.

## Municipal heights against LiDAR (November 22, 2026)

Tile PNOA-LiDAR 459-3109 (2023, 6.7 points/m²): 577 buildings, 554 measured, 8 without sufficient points. LiDAR p95 difference less municipal: median +0.8 m, mean absolute error 1.82 m, 74 % within 2 m, 93 % within 5 m. Buildings ≥ 20 m (73): average difference −0.26 m. Control locations, municipal / LiDAR p95: Teatro 30.6 / 30.7, Mercado 13.5 / 12.4, Gabinete 25.3 / 24.7, Casa de Colón 13.4 / 12.9. Cathedral (41.5 m municipal): 38.4 m at p95 and 47.5 m at p99 on the main body, the other four parts from 10 to 20 m. Building 41667, without municipal data: 9 m estimated against 16.2 m measured. There remain unverified gaps of 10 m and more on individual buildings (e.g. 40750 and 41183). Only checked the tile mentioned: Arenales and Ciudad Jardín are missing. The published mesh was not regenerated.

## Roof colors: 20 cm orthophoto 2024 against PNOA (22 November 2026)

Window of `roof-tones.json` read remotely from the SITCAN orthophoto (CC BY 3.0), reduced to 1 m and treated with the same algorithm as `roof-colours.py`. Out of 4,820 buildings: median ΔE 2.9, 75th percentile 4.3, 95th percentile 7.0; 82.7% under 5 and 99.5% under 10; median brightness −0.4. Nave 41119: `#e5e3e0` vs. `#e6e4e1`. The worst cases (ΔE 12-14, e.g. 38573 and 40126) were not inspected. The comparison is at 1 m: the advantage of 20 cm is not measured. No published data has been changed. Playback: `python -I scripts/roof-compare-20cm.py`.

## Baseline before coastal expansion (November 22, 2026)

Branch `espansione-costa`, perimeter unchanged (3.04 km², 80 sectors, 4,698 building parts). `data.py city`, `roof-colours.py` and `sectors.py` regenerated: compared to the previous data, only one building changes (41667, from 9 m estimate to 16.2 m from the LiDAR) and only one sector file (`0_-2`). Roads, surfaces, trees, terrain and borders are identical.

- `typecheck` and `build`: green. `npm.cmd test`: Green in 3 min 2 s (startup 2,617 ms desktop, 2,076 ms mobile emulated).
- `node scripts/benchmark.mjs`: opening 3,162 ms, peak sampled heap 80.9 MB, p95 18.4 ms, 115 draw calls and 263,657 triangles per frame, 701 buffers and 18 textures at the base, 736 and 18 at the end, 17,290 draws at rest.
- `node scripts/qa-sectors.mjs`: 4 out of 5 green runs. One failed with «WebGL resources grew on the repeated circuit» (buffer 1004 → 1052, texture 24 → 25 in Santa Ana, estimated bytes unchanged). An execution passed on the data committed to `main`. The failure is intermittent and has not been diagnosed: it must be clarified before enlarging the area, because the threshold is used to detect resource losses.

## Sector test: measurement with meters stopped (22 November 2026)

The intermittent failure of `qa-sectors.mjs` was not a waste of resources. On eight laps of the circuit the WebGL buffers stop from the fourth lap (1054, 1160 and 1257 at Plaza de la Feria, Parque Doramas and Metropole) and the ejections increase regularly. It only wobbled Santa Ana, by about 40 buffers and 1 texture: a resident sector loads its buffers at the first drawn frame, and the test read the counters before that frame or during the LOD fade. The test now waits for `pending` and `fading` at zero and two equal meter readings at 150 ms. After correction: maximum gap of 14 buffers between runs (threshold 24) and six out of six green executions. The viewer has not been changed.

## Three-level viewer and 6× scale test (November 22, 2026)

Branch `espansione-costa`. The viewer loads one core (0.67 MB plus 0.62 MB of binary terrain) in place of `city.json` (4.6 MB), 10 on-demand zones, and the 80 sectors. Chrome with 390×844 mobile emulation, same procedure as the base.

| Measurement | Basic (Phase 0) | City, three levels | Replica 6× |
|---|---|---|---|
| Opening | 3.162 ms | 3,649 ms | 4,669 ms |
| Peak heap sampled at opening | 80.9 MB | 21.5 MB | 77.6 MB |
| p95 frame, close-up view | 18.4ms | 18.7 ms | 18.3 ms |
| Draw calls and triangles per frame | 115 / 263,657 | 116 / 266.280 | 107 / 265,653 |
| p95 frame, distant view | not measured | 18.2 ms | 18.3 ms |
| Draw calls and triangles, far view | not measured | 120 / 25,963 | 267 / 155.132 |
| Heap after harvest, distant view | not measured | 21.9 MB | 49.1 MB |

`npm.cmd test` green (opening 2,649 ms desktop, 1,255 ms mobile emulated, against 2,617 and 2,076 for the base). `qa-sectors.mjs` green 8 out of 8 times with the new control and 3 out of 3 after the last zone visibility change; now includes far view (no zones required, max two in memory) and return. `qa-recovery.mjs` and `qa-drive-route.mjs` green. `qa-main-lod.mjs` green 4 times out of 5: a performance did not fade within the time limit; undiagnosed.

Limits of the measurements: the p95 of about 18 ms coincides in all cases, so it is the limit of the test bench and does not distinguish the loads. The 6× replica has non-rounded coordinates and larger-than-real files (36 MB zones versus 3.3 × 6), and has no coast. In driving, the replica was not driven: the border crossing is tested only on the real city. No testing on physical phone. On desktop the overview of the current city remains building by building; in the compact profile the entire view passes to the fused blocks.

The sector test now compares the maximum of the WebGL buffers of the last two rounds with that of the previous two, after two rounds of adjustment (six rounds in total): on nine rounds the counters remain stationary, with oscillations of approximately 20 buffers linked to the panorama drawn.

## Vegueta, Vega de San José and San Cristóbal (November 22, 2026)

First neighborhood of the expansion, branch `espansione-costa`. The three new zones use the barrio boundaries in OpenStreetMap (relations 16905756, 16905755 and 16905754). Mainland from 3.04 to 4.53 km²; building parts from 4,698 to 6,073 (12,361 municipal records in the acquisition rectangle); road sections from 1,433 to 2,350; trees 10,376 to 15,367; 16 zones and 126 sectors. The coordinates of the previous ten locations do not change. New locations: Iglesia de Santo Domingo (way 38062759) and Parroquia de San Cristóbal (way 842431973).

OSM extracts now use a fixed 0.01° grating in the window [-15.44, 28.07, -15.40, 28.14]. With the window enlarged and the data redownloaded, the previous city was identical except for the order of the elements.

- `typecheck`, `build`, `npm.cmd test`: green (open 2,996 ms desktop, 1,225 ms mobile emulated). `qa-sectors.mjs`: 2 out of 2 green executions.
- Benchmark, Chrome with mobile emulation, four runs: p95 of frame in close-up view 52.8, 70.5, 70.9 and 35.8 ms, versus 18.7 ms before neighborhood; 142 draw calls and around 371,000 triangles per frame versus 116 and 266,000. In Santa Ana, 13 sectors are now visible instead of 11 and 58.9 MB of detail instead of 43.0: the view is full where previously there was emptiness to the south. Far view: p95 18.2 ms in three out of four runs, 201 draw calls, 35,634 triangles. Peak heap upon opening 36-40 MB. The desk uses the integrated Intel UHD GPU of this machine (not software rendering, as written in an early draft): the degradation was real and the cause is described in the following section.
- Heights with LiDAR (tiles 458-3108, 459-3106, 459-3107, 459-3108, 459-3109): in the new area 679 parts measured, median deviation +0.44 m, mean absolute error 3.88 m, 66% within 2 m, 87% within 5 m. Santo Domingo 15.6 m municipal versus 13.4 m; Parroquia de San Cristóbal 16.2 versus 12.5 m. 70 parts of 13 OBJECTIDs exceed 10 m of difference, all with the highest municipality and all in complexes with multiple parts: the «altura máxima» of the complex is also applied to the low bodies (for example 40994: 51.7 m municipality, 3.3 m measured on two parts; 39616: 30 parts). List in `.cache/lidar-control/scarti-vegueta-sur-san-cristobal.csv`. Incorrect: Luca's decision. No new height exported: building 39623, without municipal height, has no points classified as a building in the LiDAR (81 m², remains at 9 m and must be checked on the orthophoto); 36746 falls out of the downloaded tiles. Tiles 458-3106 and 458-3107 (50 parts) were not downloaded.

Limits: the Torreón de San Pedro Mártir is on the rocks outside the mainland of the model and is not among the places. The Vegueta border includes a narrow spit along the Guiniguada. On desktop the entire city exceeds 6km and the full view switches to merged blocks. The drag and zoom test in `qa.mjs` has been made scale independent. No testing on physical phone; Driving in the new neighborhood was not tested by hand.

## Stable streaming and lighter geometry (November 22, 2026)

The deterioration measured after the first neighborhood did not depend on the design load. With the full budget, a sector at the edge of the screen was downloaded and built, then discarded because the camera had moved one step in the meantime, and immediately requested again: 160 frames out of 160 with a loading in progress, p95 over 100 ms. Three fixes in `sector-stream.ts`:

- a zone or sector request remains valid 600 ms after leaving the view, and the same applies to the "in view" state;
- a sector in view can only make room by ejecting unwanted or preloaded sectors around the view; sectors of the same type do not expel each other;
- a sector whose size is known is downloaded only if there is space.

In `scene.ts` buildings no longer build the bottom and top of the extrusion (one is underground, the other is under the roof) and, in the compact profile, the parapets have three faces instead of a closed box.

Chrome with 390x844 mobile emulation on Intel UHD GPU, `node scripts/frame-profile.mjs <luogo>` (160 frames of small alternating shifts):

| Location | Previously: p95, triangles | After: median / p90 / p95, triangles |
|---|---|---|
| Santa Ana | 107-123 ms, 359.000 | 16,7 / 33,3 / 33,4 ms, 264.000 |
| Santo Domingo | 89-124 ms, 384.000 | 16,9 / 33,4 / 33,5 ms, 277.000 |
| San Telmo | 18,3 ms, 304.000 | 16,7 / 16,8 / 16,9 ms, 229.000 |

`benchmark.mjs`: p95 close up 16.8 ms (was 36-71), 93 draw calls and 190,000 triangles per frame, startup 1.9 s. Main thread 4.5ms per frame in Santa Ana.

Limits: in Santa Ana and Santo Domingo about one frame in ten still lasts twice as long. Removing other triangles (test without sills, −11%) does not change it and the main thread is unloaded: the residual cost is on the GPU side and is not diagnosed. The far view measurement in `benchmark.mjs` now starts while the previous requests are still valid (429 draw calls, 483,000 triangles): it should be read with this reservation. `qa-sectors.mjs` waits 800 ms before reading the counters and tolerates 64 buffers (one sector is worth approximately 45): 5 green executions out of 5. `qa-main-lod.mjs` records the appearance of the recovery warning on the page, which now lasts less than the sampling interval: 6 green out of 6. `npm.cmd test` green. No testing on physical phone.

## Low bodies of the complexes corrected with LiDAR (22 November 2026)

The municipal data assigns the maximum height of the complex to each part of a complex. `scripts/lidar-check.py --export` now also writes to `content/lidar-heights.json` the individual parts (`parts`) where the municipal height exceeds the measured p95 by more than 10 m, only for OBJECTIDs with multiple polygons, a footprint of at least 30 m² and at least 50 roof points. `data.py` applies them with `source: lidar-pnoa`. In the five downloaded tiles: 72 parts of 15 OBJECTIDs, heights from 2.1 to 23.8 m (for example 40994 from 51.7 to 3.3 m, 40032 from 50.6 to 2.7 m). Roads, surfaces, trees, terrain and borders are the same as before. One of the parts belongs to the cathedral (41119), which retains the height of the catalogue.

`typecheck`, `build`, `npm.cmd test` and `qa-sectors.mjs` green. Limitations: the corrected parts were not compared one by one with the orthophoto; a demolished or overgrown body would give an incorrect low value. The rule only applies where a tile exists: Arenales, Ciudad Jardín and the western edges are not covered. The gaps where the LiDAR is higher than the municipal are not affected.

## Wider view limited to one neighborhood (November 22, 2026)

At Luca's request the map no longer moves away until it shows the whole city. The long side of the widest view covers 3,000 m on desktop and 2,400 m in the compact profile (`farthest` in `src/main.ts`); the reset button and rotations use the same limit. The limit lies within the zone thresholds (6,000 and 3,200 m), so each view shows one building per footprint and the melted blocks only appear as a zone loads. `npm.cmd test`, `qa-sectors.mjs` (2 of 2) and `qa-main-lod.mjs` green. The tests no longer expect all placeholders to be visible in the larger view, and `qa-sectors.mjs` checks that that view preserves the areas without detail. The restoration view remains centered on the geometric center of the city, which now partially frames land outside the perimeter.

## Triana, Arenales, Ciudad Jardín and Alcaravaneras (November 22, 2026)

Seven new areas from barrio boundaries in OpenStreetMap: Triana (16904602), Canalejas (16904534), Fincas Unidas (16904535), Lugo (16904536), Ciudad del Mar (16904537), Ciudad Jardín (16904538) and Alcaravaneras (16904432). The first six add only 125 parts of the building, because the previous corridor covered them almost entirely; Alcaravaneras adds 680. Mainland from 4.53 to 5.05 km²; building parts from 6,073 to 6,878; road sections 2,576; trees 16,506; 19 zones and 142 sectors. The twelve places do not move. No new places.

- `typecheck`, `build`, `npm.cmd test` green (opening 1,991 ms desktop, 917 ms mobile emulated). `qa-sectors.mjs` 2 out of 2.
- Benchmark: p95 close up 18.2 ms, 86 draw calls and 178,000 triangles per frame, startup 1.9 s, peak heap 43 MB. Frame profile (median / p95): Santa Ana 17.5 / 35.8 ms, Plaza de la Feria 17.5 / 18.2 ms, Metropole 17.7 / 18.3 ms, with 270-282,000 triangles.
- LiDAR: thirteen tiles (added 457-3110, 457-3111, 457-3112, 458-3109, 458-3110, 458-3111, 458-3112, 459-3110). Out of 6,194 measured parts the median LiDAR minus municipal deviation is +0.55 m, the average absolute error 1.98 m, 72% within 2 m and 91% within 5 m. Exported 16 heights for buildings without municipal data and 114 low bodies of complexes: in total 137 parts with `source: lidar-pnoa`. There remain 31 parts at 9 m estimate: 29 without sufficient points and some where the LiDAR does not find a ceiling (for example 30904, measured at 0 m). `lidar-check.py` now discards heights below 2.5 m for buildings without data and below 2 m for low bodies, and has gone from 12 minutes to about a minute with thirteen tiles (points ordered by band, spatial index of neighbors) with identical results on the five previous tiles.

Limits: Tile 457-3113 (112 parts, none without height) did not exit the Centro de Descargas filter and was not downloaded. The corrections were not compared one by one with the orthophoto. No testing on physical phone; Driving in new neighborhoods was not hand-tested.

## Local driver editor

Open `editor.html` on GitHub Pages. Locally, start `npm.cmd run dev -- --host 127.0.0.1 --port 5197` and open `http://127.0.0.1:5197/editor.html`. Select a building in the scene to move it or correct a boundary or courtyard vertex. The catalog includes bench, stake and planter. `Download JSON` exports the corrections. `Open edits` reopens them in the editor and `Test Drive` opens the pilot file chooser. [Pilot Editor on GitHub Pages](https://tatosgames.github.io/isometric-cities/editor.html)

`node scripts/qa-editor.mjs` launches Vine and Chrome. The test covers selection, dragging on the gizmo, editing a courtyard vertex, placing and rotating props, removing, undo/redo and download with reopening in a new session. Check atomic rejection of invalid JSON, different map version and invalid footprint. Verify launching Conducir with the reloaded file and query the same guide collision grid to compare the old and new wall positions.

Passed `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd test` and `node scripts/qa-editor.mjs`. In mobile Chrome emulated at 390 × 844, verify the pose of a bench with tap and download of the JSON.

In **Move**, directly drag a building or prop or use the arrows. During the gesture you can see the 3D model moving. **Vertices** allows you to drag the points of the footprints and courtyards. **Frame** frames the selection and **Overview** restores the initial view. The test also checks dragging without the gizmo, undoing with Esc, and panning.

The editor test also passed on the production build served under `/isometric-cities/`, the path used by GitHub Pages. Opens **Test Drive** from the editor link and checks the JSON loading on the opened page.

The editor and loading of corrections are available for the pilot only. Reading the JSON happens in the browser. The file is linked to the bytes of `pilot.json` by its SHA-256 fingerprint. Santa Ana and Gabinete Literario are read-only. The catalog contains decorative furniture without collisions.

## Support of vehicles on the ground

Cars, patrols and wrecks follow the height of the triangle below their center. Shadows, skids and dust use the same surface. The index in 15 m cells is built upon the first use of each sector's terrain and is released when the zone exits. It uses existing buffers and does not add draw calls.

`ShapeGeometry` and the shared function produce the same faces in the same order for all 23,378 detail ground cells. The zones and 142 sectors contain the same rings. The triangulation remains compatible with the roadways already generated.

`scripts/qa-ground.mjs`, included in `npm.cmd test`, compares the elevation to a vertical raycast on the actual mesh. At `(-1270, 1055)` the visible terrain is 6.89 m above the grid elevation in the current geodata. The measurement remains within 1cm of the raycast before and after the delayed arrival of the detail. The test also covers panning, sector edge, diagonal of a pilot cell and fallback out of terrain.

In Chrome desktop and mobile emulation (390 × 844), ride both ways on a stretch with 3.06 m of elevation gain over 35.27 m. The car was visible on the straight and turning, with an active patrol.

`npm.cmd run typecheck`, `npm.cmd run build` and `npm.cmd test` completed. `node scripts/qa-sectors.mjs` passed in isolated execution, with crossing in both directions and an active patrol. The previous attempt had exceeded the circuit tolerance by one buffer.

On sharper bumps a single wheel can still penetrate, because the support is calculated at the centre. The precise point of the original screenshots remains to be reproduced.

## Santa Catalina–Canteras and Guanarteme (November 22, 2026)

Third neighborhood of the expansion. Two new areas from the barrio boundaries in OpenStreetMap (relations 16904433 and 16904431). Mainland from 5.05 to 8.06 km²; building parts from 6,878 to 10,137; road sections from 2,576 to 3,574; trees 16,506 to 18,983; zones 19 to 27; sectors 142 to 218. The previous buildings are unchanged, except one on the old edge. New locations: Parque Santa Catalina (way 265760472) and Auditorio Alfredo Kraus (way 585709389), 14 in total. Published data: core 1.6 MB, zones 8.3 MB, sectors 16.5 MB.

The OSM window changes to [-15.47, 28.07, -15.40, 28.16] (63 cells, 35 new). Municipal record 16913 has no geometry: `data.py` reports it and skips it. The Santa Catalina-Canteras border includes piers mapped in OSM; that of Guanarteme includes the bare slope towards El Rincón.

The reset button now returns to the Plaza de Santa Ana at the maximum distance, because the city no longer fits into the widest view and its geometric center falls away from everywhere.

- `typecheck`, `build`, `npm.cmd test`: green (opening 3,289 ms desktop, 3,107 ms mobile emulated). `qa-sectors.mjs`: 2 out of 2 green executions.
- Benchmark, Chrome with mobile emulation on Intel UHD integrated GPU: 2,304 ms opening, 60.5 MB peak heap. Close-up view: p95 18.3 ms, 85 draw calls and 176,654 triangles per frame. Wider view over Vegueta: p95 35.9 ms, 219 draw calls and 383,282 triangles. Previously the restoration included partly empty land; now it frames the historic center, which is the densest point.
- Frame profile (`frame-profile.mjs`): Parque Santa Catalina median 17.8 and p95 18.5 ms; Alfredo Kraus Auditorium 17.8 and 18.4 ms; Santa Ana 17.5 and 35.8 ms, as before.
- LiDAR: twenty tiles (added 455-3112, 456-3111, 456-3112, 456-3113, 457-3113, 457-3114, 458-3113). Out of 9,471 parts measured, the median LiDAR least municipal deviation is +0.6 m, average absolute error 2.02 m, 72% within 2 m, 90% within 5 m. In the new area: 3,108 deliveries, median +0.75 m, mean absolute error 2.23 m, 70% within 2 m, 89% within 5 m. Exported measured heights: from 16 to 43 buildings without municipal data and from 114 to 131 low buildings. 189 parts now use `lidar-pnoa`; 40 remain at 9 m estimate.
- Eye control screens of the two new locations, up close and at maximum distance: consistent buildings, piers, beach and slope; no errors in console.

Limits. In the new area, 97 buildings have a roof measured over 10 m higher than the municipal figure (for example 25810: 41.7 m municipal, 78.2 m measured; 22817: 3.6 against 29.1 m) and 16 have it lower. Incorrect: Luca's decision. List in `.cache/lidar-control/scarti-santa-catalina-guanarteme.csv`. Tiles 454-3112, 455-3111, 458-3106 and 458-3107 are missing (61 parts in total). The wider view of the historic center beats the 60 Hz frame on the integrated GPU. No testing on physical phone; Driving in new neighborhoods was not hand-tested. The two new locations do not have a dedicated model. La Isleta and the port are not yet included.

## Lighter Dense Isolates (November 22, 2026)

Optimization passage after Triana–Alcaravaneras and Santa Catalina–Guanarteme. Counting a dense sector (-8_14, 217 buildings) showed that parapets (36 % of triangles) and walls weigh, not windows: municipal footprints have on average 16 sides per building, with a vertex wherever a neighbor touches the wall. Two interventions, both without changing the shape:

- `sectors.py` removes vertices within 0.1 m from a straight wall from the sector and zone footprints (`lighter()`); `city.json` remains intact. In the city, the footprint levels dropped from 237,142 to 185,654 (−22%); sectors from 16.5 to 15.6 MB, zones from 8.3 to 7.5 MB.
- `scene.ts` does not build windows, frames and parapets buried in a taller adjacent building (`buriedTo()`). In the pilot editor everything remains, because the buildings move there.

`frame-profile.mjs` now accepts a coordinate view (`x,y,zoom`). Phone emulated 390x844 on Intel UHD GPU, triangles per frame:

| View | Before | After |
|---|---|---|
| Santa Catalina (-1800, 3480), close view | 320,468 | 268,625 |
| Santa Catalina (-2040, 3480), close view | 372,062 | 297,209 |
| Alcaravaneras (-1560, 2760), close view | 324,423 | 297,319 |
| Arenales (-840, 1080), close view | 342,061 | 296,681 |
| Santa Ana, close view | 270,743 | 220,331 |
| Santa Catalina, wider view | 335,264 | 264,493 |
| Santa Ana, wider view | 169,321 | 138,222 |

Up close, the drop per screen is smaller than that per sector, because the memory budget is filled with more sectors (from 14 to 15, from 16 to 17). `benchmark.mjs`: opening 2,087 ms (was 2,304), peak heap 51.6 MB (was 60.5), close view p95 18.2 ms with 159,124 triangles (was 176,654), wider view 323,183 triangles (was 383,282).

`typecheck`, `build`, `npm.cmd test` and two runs of `qa-sectors.mjs`: green on a clean copy of the commit. Comparison with an identical camera on Parque Santa Catalina and eye inspection of a dense block at zoom 3.2: no difference in shape; a stepped building now has a technical volume on the roof, because the triangulation of the roof has changed.

Limits. The wider views are stable at 18 ms in `frame-profile.mjs`, but `benchmark.mjs` still measures 35.4 ms of p95 in the far view: its measurement starts with the previous requests still valid. Up close, in three of the five dense blocks measured one frame out of ten still lasts 35 ms, as in Santa Ana before: the cost is on the GPU side and does not depend on the number of triangles alone. The time measurements were taken with another process active on the machine and must be repeated with the machine free. No testing on physical phone. The catalog of applied tricks is in [PERFORMANCE.md](PERFORMANCE.md).

## Buildings taller than municipal data corrected with LiDAR (22 November 2026)

In 157 parts of the building the measured roof (p95) exceeds the municipal height by more than 10 m. `scripts/lidar-check.py --export` corrects 54: only those in which the median of the roof points also rises (over 5 m above the municipal and at least 75% of the p95). In the other 103 the median remains close to the municipal data: the p95 reads a tree, a neighbor's overhang or a tall body on a small part of the footprint, and the height does not change. Of the 54 correct, 34 are between Santa Catalina and Guanarteme and 20 in the previous neighborhoods.

Examples: 25810 (tower next to Parque Santa Catalina) from 41.7 to 78.2 m; 22817 from 3.6 to 29.1 m; 16466 from 7.8 to 32.6 m. The footprints don't change. In the city, 243 parties now use `lidar-pnoa`, 9,854 the municipal data and 40 the 9 m estimate.

`typecheck`, `build`, `npm.cmd test` and `qa-sectors.mjs`: green on a clean copy of the commit. Eye control of tower 25810 on the map.

Limits. The 54 corrections were not compared one by one with the orthophoto; only tower 25810 was looked at on the map. A tall body covering less than half the footprint remains in the municipal data. The value applied is p95, which on roofs with technical volumes can exceed the eaves by a few metres.

## La Isleta and Puerto de la Luz (23 November 2026)

Fourth neighborhood of the expansion: the entire barrio of La Isleta from the border in OpenStreetMap (relation 16904434), with built-up area, industrial area, port piers, volcanic slope and El Confital. Mainland from 8.06 to 19.30 km²; building parts from 10,137 to 14,973; road sections from 3,574 to 4,703; trees 18,983 to 21,981; zones 27 to 50; sectors 218 to 487. The previous buildings are unchanged. New locations: Castillo de la Luz (way 126808548) and Mercado del Puerto (way 119110526), ​​16 in total. Published data: core 2.3 MB, terrain 5.8 MB, zones 13 MB, sectors 28 MB.

The OSM window changes to [-15.47, 28.07, -15.39, 28.19] (96 cells). Three corrections emerged from the scale:

- The elevation service responds -32768 beyond its coverage without declaring it as missing data (four lines north of the peninsula, at sea): `data.py` reads it as sea level.
- The sea was drawn only within 260 m of the land and left a hole in the port basin: now the basins closed by land and piers are full.
- The world of driving asked each road junction if it is within the border by scrolling all its sides: 2.7 s at the opening with the new coast. The border is now indexed by bands (`ringIndex()` to `drive-world.ts`) and the control no longer appears in the profile.

Checks on a clean copy of the commit:

- `typecheck` and `build`: green. `qa-sectors.mjs`: 2 green executions out of 2. In `npm.cmd test` the installation, pedestrian and ground support tests pass; `qa.mjs` stops at line 75 (footer visible on the map). The same crash happens on the previous commit `1a37dba`, without these changes: it doesn't depend on La Isleta, and the rest of `qa.mjs` was not executed.
- `benchmark.mjs`, Chrome with mobile emulation on Intel UHD GPU, compared to `1a37dba` in the same machine conditions: startup 5.3-5.9 s (was 6.3), close-up view p95 18.2 ms with 156,139 triangles (was 18.1 ms, 158,928), peak heap 112.6 MB (was 88.7).
- `frame-profile.mjs`: Santa Ana close up 17.4 / 18.4 ms (median / p95), wider view of Santa Ana 17.4 / 18.2 ms, wider view of Santa Catalina 17.5 / 18.3 ms.
- LiDAR: thirty tiles (added 457-3115, 457-3116, 458-3114, 458-3115, 459-3113, 459-3114, 459-3115, 459-3116, 460-3115, 460-3116). Out of 14,160 parts measured, the median LiDAR least municipal deviation is +0.66 m, average absolute error 1.90 m, 72% within 2 m, 91% within 5 m. In the new area: 4,647 deliveries, median +0.86 m, mean absolute error 1.96 m, 72% within 2 m, 92% within 5 m. Exported 40 heights for buildings without municipal data, 40 low buildings and 32 roofs higher than the municipal data. In the city, 361 parties use `lidar-pnoa`, 14,563 the municipal data, 49 the estimate of 9 m. Castillo de la Luz 9.0 m municipal versus 12.0 m measured; Mercado del Puerto 13.0 against 9.5 m; Alfredo Kraus Auditorio 29.0 against 29.0 m, with the p99 at 40.9 m for the tower.
- Screenshots seen by eye: town of La Isleta, industrial area, piers and port basin, peninsula with the volcanic relief and port tanks, already present as municipal buildings.

Limits. The heap peak grows with the surface (112.6 MB): the always resident level must be lightened before adding Ciudad Alta. Immediately after restoring the view `benchmark.mjs` measures one or two frames of approximately 170 ms (p95 on 40 frames; 35 ms on the previous commit), while with the view stopped the cadence is regular: undiagnosed cause. In the widest view of Santa Catalina, resident areas estimate 93 MB. Tiles 454-3112, 455-3111, 458-3106 and 458-3107 are still missing. The northern peninsula has no municipal buildings: it is land with paths. No testing on physical phone; untested hand drive in new area. Cranes, silos and dedicated models are not in this step.

## Port items and three dedicated models (November 23, 2026)

**Port objects.** OpenStreetMap inventory inside the area: 21 cranes (`man_made=crane`: 18 gantry, 1 travel lift, 2 typeless), 2 smokestacks, 97 tanks (68 mapped as point, 29 with footprint), and 22 silos. Cranes and chimneys travel in a new list, `props` (type, position, orientation, size), written by `data.py` and distributed by `sectors.py` in sectors and zones. `src/render/port-props.ts` draws them: the crane is a procedural portal with the arm raised, in close detail (13 parallelepipeds) and as a silhouette in the intermediate view (6). Colors from the 2024 SITCAN orthophoto: light blue structure, white engine room. Tanks and silos are already municipal buildings: the 34 that contain a tank or a mapped silo lose windows and technical volumes and take on a clear shell. No containers and no ships: OSM does not map them.

**Dedicated models** in `src/render/landmarks.ts`, with volumes from municipal footprints, heights from LiDAR, plan from 20 cm orthophoto and facades from reference photographs (Wikimedia Commons and two photos of the Mercado provided by Luca, used only as a visual reference):

- **Castillo de la Luz** (OBJECTID 32072): stone walls at 10 m, battlements along the wall walk, turret with conical roof at 13 m. The round bastions and the courtyard are already in the footprint.
- **Mercado del Puerto** (26966): ivory walls at 7.4 m with dark openings, band of slats, hipped roof up to 9.2 m, canopy on green iron columns, gable portals and octagonal skylight up to 14 m.
- **Alfredo Kraus Auditorium** (14627, only the body of the hall): ocher stone at 29 m, glazed lantern with clear spire up to 48 m, octagonal tower and glass on the side of the footprint facing the ocean.

The Auditorium municipal record has six separate bodies: the catalog can now style a single body with the `OBJECTID:floor(x minimo):floor(y minimo)` key, the same as LiDAR corrections.

Checks on a clean copy of the commit: `typecheck` and `build` green; `qa-sectors.mjs` 2 out of 2 green; green installation, pedestrian and ground support tests. `qa.mjs` remains stuck at line 75 as on the `1a37dba` commit. Screenshots of the three models from two orientations and of the cranes from near and far, seen by eye.

`frame-profile.mjs`, phone emulated on Intel UHD GPU (median / p95, triangles): Castillo de la Luz 18.0 / 18.3 ms, 172,065; Mercado del Puerto 17.9 / 36.0 ms, 212,236; Alfredo Kraus Auditorium 17.9 / 18.1 ms, 49,842; terminal crane close-up 17.4 ms, 5,876; wider view on La Isleta 17.9 / 18.2 ms, 330,338. `benchmark.mjs`: opening 5.7 s, p95 close-up view 18.2 ms, heap peak 110.7 MB.

**Optimization step, outcome.** The inhabited center of La Isleta is the heaviest point of the city: at (-1200, 5000) up close 325,393 triangles with median 35.9 ms and p95 53.8 ms, i.e. half constant cadence on the emulated phone. Sector -5_22 has 385 buildings; after the optimizations already active, the parapets remain the largest item (27,768 triangles before discarding the buried ones), then walls 12,712, windows and sills 12,120, technical volumes 7,752, roofs 5,512. Incorrect in this step.

Limits. The positions of the cranes in OSM are approximate (note `FIXME`): in the orthophoto a real crane is about 50 m from the mapped point. The orientation is towards the nearest edge of the platform. Cranes are not obstacles in driving. The 68 reservoirs mapped only as a point and without a municipal building are not drawn: OSM does not give their size. The models are simplified interpretations in the model style; the position of the Castillo tower and the Auditorio lantern is measured on the orthophoto. The roof of the Auditorium has the dark color of the PNOA, darker than life. From above the Mercado shows above all the roof. No testing on physical phone; guide not tested by hand.

## Dense Neighborhoods, Resident Memory, and the Post-Recovery Surge (November 23, 2026)

Fixes for issues left open after La Isleta.

- **Geometry in the compact profile** (`scene.ts`): the parapet is the upper face plus the external one (4 triangles instead of 6); the roof cabs lose their lids and the tank next to them; of the windowsills only the balconies remain. On desktop nothing changes.
- **Road coverage by zone**: each zone carries its own (`coverage` in the zone file). Previously, each ground texture redesigned the coverage of the entire city, kept in the index: it was the origin of the shot after restoration. The index keeps a simplified copy at 1.5 m for the distant map and drops from 1.74 to 0.48 MB; the zones increase from 13 to 15 MB.
- **Ground in Int16**: Grid remains in 16-bit decimeters on main thread and worker (`Terrain.scale`), 6 MB instead of 12 per copy.
- **Cranes and chimneys in the guide**: the four legs of each crane and the shaft of the chimneys enter among specific obstacles in the area, such as logs (`propObstacles()`).

Phone emulated 390x844 on Intel UHD GPU, `frame-profile.mjs` (median/p90, triangles):

| Close up view | Before | After |
|---|---|---|
| La Isleta Core (-1200, 5000) | 35.9 / 52.6 ms, 325,393 | 18.2 / 36.3 ms, 257,828 |
| Santa Catalina (-2040, 3480) | 17,5 / 18,8 ms, 297.209 | 18,1 / 18,3 ms, 232.517 |
| Santa Ana | 17,5 / 35,6 ms, 220.331 | 17,3 / 18,3 ms, 178.001 |
| Mercado del Puerto | 17,9 / 18,9 ms, 212.236 | 18,1 / 18,2 ms, 171.914 |

`benchmark.mjs`: Worst frame after recovery from 175.7 to 36.2 ms (p95 out of 40 frames); peak heap 110.7 to 101.5 MB; at sight stops heap plus buffer from 98.4 to 86.3 MB. Close-up view p95 18.2 ms.

`typecheck`, `build`, `npm.cmd test` in full and two runs of `qa-sectors.mjs`: green on a clean copy of the commit. Comparison with an identical camera on the nucleus of La Isleta in the telephone profile at 4 and 1.59 zoom: unchanged shapes and colors; the light edge of the roofs on the far side is thinner and the roof cabins no longer have light lids.

Limits. In the La Isleta core, one frame in ten still lasts 36 ms. Collision with cranes occurs only when calculating leg positions, not driving into them. The peak heap remains above 100 MB: 13 MB comes from resident JSON and 7 MB from the help wall index. Times measured with another process active on the machine. No testing on physical phone.

## Glide back to the map

Check Chrome from Follow, Aerial and Isometric views at 1100×700, 390×844 and 844×390. Exiting with the button or Esc sends the camera through intermediate poses and returns it to the center, zoom and angle saved before Play. The driving suite verifies flight initiation and recovery when exiting a match and after capture.

## Neighborhood 5: Ciudad Alta and San Francisco–San Nicolás (November 23, 2026)

The entire district 4 (16 barrios) plus the San Francisco - San Nicolás district, which closes the gap between Triana and Schamann. OpenStreetMap does not map these barrios as borders: the perimeters come from the Municipality's «Barrios» service (`ENTS_CO_ID` 24, field `NUCL_CO_ID`), new zone of type `municipal` in `content/las-palmas.json`. Ten meters of margin close the junction with the OSM borders; the holes under 2,000 m² between the two sources are filled.

Barrios added: Schamann, Las Rehoyas, Rehoyas Altas, San Antonio, Altavista, Don Zoilo, Escaleritas, Las Chumberas, La Minilla, La Feria, Cuevas Torres, San Lázaro, Las Torres, Las Torres Industriales, El Cardón, Díaz Casanova and San Francisco - San Nicolás.

| | Before | After |
|---|---|---|
| Area | 19,30 km² | 27,83 km² |
| Building parts | 14,973 | 21,326 |
| Roads | 4,703 | 7,201 |
| Alberi | 21.981 | 42.782 |
| Zones / sectors | 50 / 487 | 61 / 639 |

Of the 14,973 previous buildings, 14,881 are identical; the 92 changed were on the old border and were cut off.

**LiDAR.** Eleven new tiles downloaded from the CNIG (40 in cache). 20,174 buildings out of 21,326 were measured: median deviation +0.58 m, 70.9% within 2 m, 90.6% within 5 m. The export added 32 heights where the municipal data is missing, 144 low parts and 7 high parts. In the city now 551 parts have height from LiDAR and 68 remain estimated at 9 m.

**Checks** on a clean copy: `typecheck`, `build`, `npm.cmd test` in full, `qa-sectors.mjs` (2 out of 2 green before LiDAR corrections, 1 out of 1 after), `check-data.mjs`. Screenshots of Schamann, Las Torres, San Lázaro and the overall view check it out.

Phone emulated 390x844 on Intel UHD GPU, `frame-profile.mjs` (median / p90, triangles): Schamann (-2250, 300) close 16.7 / 16.7 ms, 323,314; Schamann (-1800, 600) at close range 17.4 / 18.2 ms, 313.902 and at maximum distance 17.3 / 18.2 ms, 379.234; Las Torres (-3300, 1300) 17.3 / 18.2 ms, 97,523; San Lázaro (-3800, -500) 17.3 / 18.2 ms, 205,755; La Isleta core 16.7 / 16.8 ms, 208,273; Santa Ana 16.7 / 16.8 ms, 159,018. `benchmark.mjs`: startup 5.1s, close-up view p95 16.8ms, worst frame after reset 33.2ms.

**Optimization pass, outcome.** Schamann is now the point with the most triangles in the city (323,000 up close on the phone, versus 208,000 in the core of La Isleta), but keeps the cadence full. Three new sectors exceed 240 buildings and have the list merged (-10_1, -9_1, -8_2), plus -2_-2 with San Nicolás. No changes to the return code in this step.

Limits. Memory went up: heap after collection 128.7 MB in the benchmark (was 95.7), with 65.6 MB of resident zones in the center wide view (was 48.7). It's above the threshold we set for phones and that's not correct. LiDAR card 454-3109 arrived truncated and was discarded (20 buildings); 454-3112 and 458-3106 are also missing (2 buildings each). The southern edge of San Lázaro has a thin tip that comes from the municipal perimeter. No new locations on the menu and no template dedicated to Ciudad Alta. A first execution of `npm.cmd test` stopped on the timed control of the end of driving screen with the car occupied; repeated with a free machine is green. No testing on physical phone; driving in new neighborhoods not tested by hand.

## Resident memory after Ciudad Alta (November 23, 2026)

With Ciudad Alta the heap after harvesting had risen to 128 MB. A snapshot of the heap on the emulated phone, at the widest view above Schamann (14 zones loaded), gave 144.8 MB: 66 MB of geometry buffer and 61 MB of JavaScript arrays and numbers. Three fixes in `sector-stream.ts` and `overview.ts`:

- **Zones without tiles and coverage.** Each loaded zone kept its 15m ground tiles (636,706 coordinate pairs citywide) and street coverage alive, because the function that dropped it shared the scope with the downloaded data. Now only footprints, trees and objects remain, which serve for guidance.
- **No per-vertex normals in the middle and far view of the compact profile.** The materials are flat-shaded and the compact profile has no shadow map: the per-vertex normal was not read. It was 12 out of 27 bytes per vertex.
- **Far layer contours released** after doing geometry.

| Measurement (emulated phone) | Before | After |
|---|---|---|
| Heap, broader view on Schamann (-2250, 300) | 144.8 MB | 103.5 MB |
| Heap, close up view in Vegueta (-80, -560) | 88.5 MB | 74.2 MB |
| `benchmark.mjs`, heap after collection | 128.0 MB | 101.4 MB |
| `benchmark.mjs`, zone residenti | 65,6 MB | 52,1 MB |

Same-camera comparison at wider view: maximum difference 2 in 255 per channel, average 0.03. `typecheck`, `build`, `npm.cmd test` in full and two runs of `qa-sectors.mjs`: green on a clean copy.

Limits. The sampled peak at the opening remains at 105-107 MB: I haven't analyzed it. The footprints of the uploaded areas (for driving) and streets, surfaces and coverage of the entire city remain resident. The geometry buffers (41 MB at widest view) still have a copy on CPU: freeing it after loading on the GPU requires rebuilding the zones when the WebGL context is restored, and I didn't do that. Worst frame after reset in the benchmark 33-50 ms on three measurements with machine busy (17-34 before). `qa-main-lod.mjs`, which is not part of `npm.cmd test`, fails on line 45 in the same way on the previous commit. No testing on physical phone.

## GPU-only geometries (November 23, 2026)

Zone and sector geometries kept a copy in memory after loading to the GPU. Now the copy is freed upon upload (`gpuOnly()` in `sector-stream.ts`); only the distant level and the ground surfaces remain in memory, which the elevation sampler still reads. Upon loss of WebGL context, zones and sectors are released (`forget()`) and reloaded from their files upon recovery; the guide keeps the footprints in the meantime. A sector's byte counter kept all of its arrays alive: correct.

| Measurement (emulated phone) | Before | After |
|---|---|---|
| Heap, broader view on Schamann (-2250, 300) | 103.5 MB | 88.5 MB |
| Heap, close up view in Vegueta (-80, -560) | 74.2 MB | 65.6 MB |
| Heap, close up view on Schamann | not measured | 76.9 MB |
| `benchmark.mjs`, heap after collection | 101.4 MB | 79.4 MB |

Test of loss and restoration of context (`WEBGL_lose_context`) at close-up view with 19 sectors: all released and reloaded, no errors in the console, image after restoration the same as before except for 0.66% of the pixels (crowns moved by the wind). `qa-boot.mjs` (three context loss scenarios), `qa-sectors.mjs`, `typecheck` and `build` green. `npm.cmd test`: one execution stopped on the time control of the end of guide screen, then two greens in a row.

Limits. The peak sampled upon opening remains at 108 MB. After a loss of context the city first returns as a distant level and then reloads: a second or two without detail, not measured on the phone. Loss of context during an untested driving game. No testing on physical phone.

## Central Void Filled: Cliffs and Ravines (November 23, 2026)

The covered city was oblong, with a large inlet between Ciudad Alta, Triana-Vegueta and San Cristóbal: south of La Isleta it filled 51% of its convex envelope. Added the 12 municipal barrios within that cove: Miller, Miller Industrial, Lomo Apolinario, San Roque, El Batán, San Juan - San José, Zárate, El Lasso, La Paterna, Los Tarahales, Casablanca III and the «Diseminado Las Palmas de GC» (ravine, 1.4 km² almost without houses, covered but not labeled). Now the portion south of La Isleta fills about 67 percent of the envelope.

| | Before | After |
|---|---|---|
| Area | 27,83 km² | 33,86 km² |
| Building parts | 21,326 | 27,086 |
| Roads | 7,201 | 8,391 |
| Alberi | 42.782 | 45.420 |
| Zones / sectors | 61 / 639 | 66 / 747 |

Of the 21,326 previous buildings, 21,266 are identical; the 60 changed were on the old border. Cranes and chimneys unchanged.

**LiDAR.** Four new tiles (44 in cache, including 454-3109 re-downloaded and read to completion). 25,545 buildings out of 27,086 were measured: median deviation +0.54 m, 66.7% within 2 m, 90.4% within 5 m. Exported 151 heights where the municipal data is missing, 37 low parts and 5 high ones. In the city 820 parts have height from LiDAR and 132 remain estimated at 9 m.

**Fix.** After committing the sea job `data.py` no longer ran: crane orientation used a removed variable (`coast`). Now use the coastline inside the window; the 23 positions and directions are identical to before.

**Checks** on a clean copy: `typecheck`, `build`, `check-data.mjs`, `npm.cmd test` in full and two runs of `qa-sectors.mjs`, all green. The overview, San Juan - San José and the wider mobile view were visually inspected.

Emulated phone, `frame-profile.mjs` (median / p90, triangles): San Juan - San José (-650, -1300) close 17.4 / 18.1 ms, 110,603; center (-1500, -900) at maximum distance 17.5 / 18.1 ms, 320,814; San Roque (-1250, -850) close 17.4 / 18.1 ms, 85,166. `benchmark.mjs`: startup 5.6 s, close-up view p95 18.2 ms, worst frame after reset 36.1 ms.

Limits. **Memory went back up**: heap after collection 102.6 MB in benchmark (79.4 before this step), 106.7 MB at widest view on Schamann (88.5), 98.2 MB at widest view on center, 78.5 MB near San Juan. The gain from the previous step is almost all spent: the expansive views of the center now load full areas where they were previously empty. El Secadero and Lomo Verdejo (0.21 km²) remain outside because they do not touch the covered area. The southern edge follows the municipal perimeters and is jagged, with some thin peaks. LiDAR tiles 454-3112, 455-3107 and 457-3106 are missing (24 buildings in total). No place on the menu and no dedicated model in the new barrios. No testing on physical phone; driving in new barrios not tested by hand.

## Southern Ring and El Secadero (November 23, 2026)

Added Casablanca I, Pedro Hidalgo, Tres Palmas and Hoya de La Plata south of Zárate and San Cristóbal, plus El Secadero, which now touches the covered area. El Secadero belongs to another municipal service entity (Tafira, `ENTS_CO_ID` 50): a zone `municipal` can indicate `entity`. Lomo Verdejo (0.03 km²) remains outside because it is 80 m from the covered area. The acquisition window drops to 28.02° N to have the coastline beyond the new southern edge; the sea stops where the acquired coast ends.

| | Before | After |
|---|---|---|
| Area | 33,86 km² | 36,22 km² |
| Building parts | 27,086 | 28,748 |
| Roads | 8,391 | 8,702 |
| Alberi | 45.420 | 45.511 |
| Zones / sectors | 66 / 747 | 75 / 805 |
| Terrain Grid | 1,259 × 2,478 | 1,259 × 2,868 |

Of the 27,086 previous buildings, 27,078 are identical. Cranes and chimneys unchanged.

**LiDAR.** Five new tiles (49 in cache, all read to completion). 27,118 buildings out of 28,748 were measured: median deviation +0.53 m, 65.7% within 2 m, 90.2% within 5 m. Exported 37 heights where the municipal data is missing, 5 low parts and 3 high ones. In the city 887 parts have height from LiDAR and 143 remain estimated at 9 m.

**Shape.** The southern ring doesn't make the city more square: it lengthens it. South of La Isleta the area fills approximately 63% of its convex envelope (67% after the central void alone, 51% before). Between El Secadero and Pedro Hidalgo a cove remains: there is the «Diseminado de Tafira» (6.6 km², countryside).

**Checks** on a clean copy: `typecheck`, `build`, `check-data.mjs` and `npm.cmd test` in full green. `qa-sectors.mjs`: four out of five green executions; the failed one occurred when the machine was very busy and I didn't keep a record of it, the next three are green.

Emulated phone (median / p90, triangles): Pedro Hidalgo (-1250, -4150) at close range 18.0 / 18.1 ms, 56,019 and at maximum distance 18.0 / 18.1 ms, 89,598. Heap: 62.5 MB from close to Pedro Hidalgo, 110.4 MB at the widest view on Schamann (106.7 before). `benchmark.mjs` with machine busy, alternating with the previous commit: heap after collection 106.5 MB versus 102.5; opening 8.7-10.3 s versus 11.0-12.4; worst frame after reset 107 ms vs 106-125. The times do not distinguish the two commits and are not valid as an absolute measurement.

Limits. Memory continues to rise with the area: 106.5 MB after collection in the benchmark. The times for this step were taken with the machine very busy (the build also took three times as long): they need to be remeasured. LiDAR tiles 454-3112, 455-3107 and 459-3104 (11 buildings) are missing. Jagged southern edge, with the Hoya de La Plata coastal strip jutting out. Nowhere on the menu in the new barrios. No testing on physical phone; driving in new barrios not tested by hand.

## Opening failed on phone: time limit and screen phase (November 23, 2026)

Luca's report: on the phone the published page loads slowly, doesn't respond and then shows «No se pudo abrir el mapa». Cause found: The page stopped opening after a total of 25 seconds. With the city at 36 km², an emulated phone with a six times slower CPU takes 15 to 25 seconds, depending on the load of the measuring machine: a real phone can exceed the limit without anything being broken.

- **Limit on stall, not total** (`index.html`): Opening fails only after 45 seconds without any progress. Each step resets the limit (`atlas:boot-progress`).
- **Screen phase** (`main.ts`): a note appears before the still-visible attributions, identifying the current step and elapsed seconds: files being downloaded («Descargando: ciudad y terra, city-index…»), «Preparando la ciudad», «Preparando la vista», «Cargando el barrio», «Cargando los buildings». If an error occurs, the note remains visible as «Error en: <fase> · <messaggio>» or «Sin avance en: <fase>». It disappears when the map is ready.

Phase times with 6× slower CPU (emulated phone, local network): data 2.4 s; city ​​preparation 3.3 s; vision preparation 5.4 s; barrio 1.4 s; buildings 1.8 s; total 14.3 s. The published page serves the initial compressed data: 2.8 MB in all (land 1.0 MB, city 1.2 MB, index 0.4 MB).

`typecheck`, `build`, `npm.cmd test` and `qa-boot.mjs` (three runs) green on a clean copy. `qa-boot.mjs` updated in two points: the expected limit is 45 s and, with the tab visible, there are at least one armed timers.

Limits. I didn't reproduce the error on a real phone: the cause is inferred from the 25 s limit and slow CPU times. If «Error en: …» appears on the phone, the cause is different and the note says at what stage. The opening is not faster than before: during «Preparando la ciudad» and «Preparando la vista» the page remains busy and does not respond. The work to be moved out of startup is listed in PERFORMANCE.md.

## Faster Startup (November 23, 2026)

Two changes in `main.ts`, measured on emulated phone with 6× slower CPU, three openings per version alternating:

- **Driving and pedestrians after opening.** The driving world and pedestrians are no longer built before the first image but in the first free moment after opening (`requestIdleCallback`, at the latest after 4 s). If you press Play first, Play builds them.
- **The map opens with the neighborhood ready.** First he was also waiting for the detail of the first sector; now that detail fades immediately afterwards, as in the rest of the city.

| | Before | After |
|---|---|---|
| Map open and usable | 13.2 - 13.9 s | 9.8 - 11.2 s |
| Full detail on screen | 22.5–22.8 s | 21.7–23.3 s |

`typecheck`, `build`, `npm.cmd test`, `qa-sectors.mjs` and `qa-boot.mjs` (three runs) green on a clean copy. `qa-boot.mjs` updated: Map can open while first sector detail is still coming.

Limits. The time until full detail does not change. The construction of driving and pedestrians after opening occupies the page for about a second with 6× slower CPU: a gesture at that moment can trigger. All that remains before opening is the ground texture of the entire city (1.3 s), waiting for the GPU (about 2 s) and reading the JSON. Slow CPU times on desktop, not from a real phone.

## Place Names in Conducir

The name of the starting neighborhood appears at the start of each game, if the starting point is covered by the data. Use the same fade as neighborhood changes.

The HUD audit verified high margin occupancy by statistics and controls and hidden OSM attribution during the match. The way uses the center on desktop and a row below the controls on narrow screens. The barrio name appears in a state region for 5 s, including fades. The attribution remains visible in the guide.

The control rotates every 140 ms. The street name requires 400 ms of confirmation, the neighborhood 700 ms. At intersections, distance and alignment with the gear count. The tests check for a named and unnamed street intersection, an ambiguous match, the real POIs of Vegueta and Triana, and a border crossing canceled before confirmation. The local dataset covers the 12 OSM boundaries present in the catalog.

Replay with real street coordinates in Chrome at 1440x900, 390x844 and 844x390. From Calle Mayor de Triana to Calle Pelota «Vegueta» appears only once. The title ends, the street empties out of cover and the HUD disappears returning to the map. The two names use ivory text with a dark green outline and remain distinct from commands in all three formats.

`typecheck`, Playwright desktop/mobile builds and suites passed. The full suite was iterated on an isolated build after a sector service failure in the shared build.

## Capture in Conducir

`npm.cmd test` covers capturing during a real game, locking coins, time and records, focusing on the retry button, and WebGL recovery after the sequence has started. A sample of the scene at the end of capture verifies that the RGB channels match and that the color returns when restarted. The mobile test rotates the screen with the outcome open, checks the space above the attributions and uses the map button after a second capture. Set `QA_SCREENSHOT_DIR` to save desktop, mobile portrait, and landscape screens outside of checkout.

`typecheck`, `build` and `npm.cmd test` passed. Screenshots checked in Chrome at 1440x900, 390x844 and 844x390. Title, statistics and buttons leave the central area around the car free. In one capture sampled on the waterfront, the car settled approximately 18 inches after contact and the score remained fixed for all 117 frames observed. Mobile verification is in emulation.

### CSS Desaturation and Title

On the pilot in Chrome with mobile emulation at 390x844, three first captures after fresh uploads recorded 17.8, 18.1 and 18.2 ms at the first filtered frame. The previous value was approximately 897 ms. During the transition the medians were between 17.6 and 18.0 ms. Desaturation created zero WebGL programs in all three runs, compared to 14 in the previous pass. In one test, the title and buttons appeared together approximately 844 ms after capture, after a delay following the start of the filter. In the other two they appeared separately, in the first useful frames after the respective thresholds.

`typecheck`, `build` and `npm.cmd test` passed. The suite controls pausing of desaturation when tab hidden and with broken WebGL, title outline removal, and filter reset on retry and exit. Controlled screens on desktop and in mobile emulation, in portrait and landscape. Desktop emulation does not reproduce the Android system font. Device verification remains open.

## Map preloader

The city downloads core, index and terrain in parallel. Until the opening, the streamer gives priority to the central area and, at close zoom, to the visible sector closest to the target. The fade lasts 260 ms and starts after the frame with the settled detail. The reserve level can enter after four seconds from the first base frame. In that case Play waits for collisions in the zone. Retrying for a critical error reloads the same URL.

`node scripts/qa-boot.mjs` checks the order of requests, the screen still visible when the zone or sector is suspended, the assignments and keyboard focus, the reserve opening with Play pending, the retry after a module error, missing essential data, unavailable WebGL and context restoration. Also passed are `typecheck`, `build`, `npm.cmd test`, `qa-sectors.mjs`, `qa-recovery.mjs` and `qa-editor.mjs`.

In the local cold cache test that pauses and releases requests, the map is interactive after 6.46 s at 1440x900 and 3.64 s at emulated 390x844. The first frame after Play arrives in 547 ms and 461 ms respectively. The milestones `atlas:startup-*` and the measurement `atlas:play-first-frame` are readable in the browser's User Timing API. The cold cache comparison in Vite dev, with two tests per variant and per viewport, does not show a repeatable gain for the scene warm-up with `compileAsync()`. The coast and overview pre-bake remains a separate test.

### Smoothness and Recovery

The test holds the input module and verifies that the core and ground begin to discharge while waiting and that each file is only requested once. The suite also moved from the build served under `/atlas/`. With the core still waiting, index completion moved the ring from 30 to 36 percent, with an intermediate visual value sampled after 80 ms. The initial detail is drawn directly to the final layer until the preloader covers the scene. Visible stream transitions use the existing fade.

An isolated HTTP 503 is recovered on a second attempt after 200 ms. Two failures lead to `Reintentar`. The test also checks that the startup limit is suspended with the card in the background. If the WebGL context is lost during the fade, the preloader immediately becomes opaque again and the ring becomes indeterminate until recovered. Comparison of times between individual runs in headless Chrome varies from profile to profile. The physical phone trial remains open.

### Preloader Cleanup Review

Only one ring. Pivot while progress is unknown and interpolate real milestones as they begin to arrive. Attributions remain visible during loading and on the first view. The test verifies that the first command moves the credits to «Licencias dedatos» and that the bar remains absent while driving and when returning to the map.

With touch emulated in Chrome, the test verifies that the selection and context menu events are cancelled, that a driving gesture leaves the page scroll stopped and that the places menu continues to scroll. Dragging and pinching move the map with the page stopped at the initial scale.

## Open sea

`python scripts/data.py sea` regenerates `sea.json` from OpenStreetMap extracts. Two generations produced the same file. The open sea surface covers 128.12 km². The geometric comparison with the previous file finds the 11 basins and the entire surface already drawn within 0.04 m² of rounding. Generation verifies that the ocean does not invade the land classified in the acquisition window.

With Chrome at 1440×900 and in mobile emulation at 390×844 and 844×390, comparison with the same exposure in La Isleta, Las Canteras and San Cristóbal at minimum zoom. The offshore cut disappears in all four rotations tested for each shot. In the four samples off La Isleta and Las Canteras, the beige bottom pixels drop to zero. Foam and seabed remain visible along the mapped coast. The mobile test is in emulation.

In the 1000x1000 square window with the target at the western edge and minimum zoom, the 2,800 m margin also eliminates the residual triangle in the lower left corner. The sample of that corner goes from 146 beige pixels with the margin of 2,350 m to zero, even after rotation.

`npm.cmd run typecheck`, `npm.cmd run build` and `npm.cmd test` passed onto the final version. The first lap of the suite had stopped after 120 seconds waiting for the second capture in the mobile guide. The next two laps passed.

## Refactor without Visual Changes (November 23, 2026)

Three commits (`bb68754`, `1345f97`, `52e544b`) reorganize the code without touching behavior, data or calibration.

- **`drive.ts` from 735 to 602 lines.** Excerpts `drive-tune.ts` (`TUNE`, `CAPTURE`, pool constants), `drive-types.ts`, `drive-effects.ts` (tyres, dust, smoke, puffs, sparks) and `drive-crowd.ts` (pedestrian drawing). `drive.ts` re-exports `TUNE`.
- **`main.ts` from 498 to 427 lines.** Excerpts `boot.ts` (phase, progress, error and startup note) and `map/framing.ts` (orientation, contour fitting, minimum and startup zoom).
- **Shared functions.** `src/geometry.ts` replaces four copies of the calculation of the angle in ±π and two of the point inside a polygon. `pilot-edits`'s version did not close the loop; the editor rings are already verified closed, so the outcome does not change. `scripts/geo.py` brings the map source and EPSG:32628/4083 converters of the five Python scripts. `scripts/qa-browser.mjs` collects browser startup and build server of the 12 browser scripts; `CHROME_PATH` allows you to use a Chromium other than Chrome.
- **`src/editor/main.ts` untouched.** Select, drag, and cancel share state in a single function: extracting input first requires a state object.

**Checks (Linux, Chromium by Playwright, WebGL software).**

- Typecheck e build superati.
- `qa-drive-pose`, `qa-drive-camera`, `qa-drive-route`, `qa-pedestrians`: identical values ​​to before (60 km/h at 1.442 s, 90 at 5.442 s / 96.5 m, braking 0.933 s / 11.5 m, nearest pedestrian 5.14 m). `qa-drive-location` does not print anything, as before.
- Origin calculated with `geo.py` identical to the previous one in EPSG:32628 and 4083. Python scripts compile but were not re-run on the data: `.cache` and geographic dependencies are missing here.
- Manual test in the browser, before and after: rotation (0° → 90°), zoom (3.11 → 4.00) and reset (0.33) give the same values; Conducir starts with 40 pawns and no errors in the console.
- With `CHROME_PATH`: `qa-boot` and `qa-recovery` passed.
- `qa-main-lod` fails here with both the new and old script, at different points from one run to the next: depends on the timing of the WebGL software, not the refactor. To be repeated with Chrome on Windows.
- Full `npm test` suite not run.

## Conducir without police (November 23, 2026)

`?nopolice` in the querystring starts Conducir without patrols: no captures, the race continues until you exit. Coins, destinations and pedestrians remain active. In Chromium (WebGL software), after 4 s of driving: 1 patrol without parameter, 0 with `?nopolice`, no errors on the page. Typecheck and build passed.

## Coin rotation (November 23, 2026)

Reported by Luca on phone: the coins seemed to rotate badly. Each coin was a vertical disk that revolved around the vertical axis of the world; seen from above they never showed the entire face (about two thirds of the height in an isometric view, less than half in an aerial view) and with every half turn they became a dash. Now they rotate around the vertical axis of the screen and at the beginning of the rotation they look at the camera: the face arrives whole in all three views. Phase staggered between coins and hop unchanged. Captures in Chromium (390 × 700, touch) before and after in the three views; typecheck and build passed.

## Doubled Hit-Stop (November 23, 2026)

At Luca's request, who didn't notice them on the phone, all stops last twice as long: strong impact 110 ms (`stopWall`), arrival at destination 100 ms (`stopArrive`), capture 220 ms (`stopCaught`). Single coins remain without retainer, as per `docs/JUICE.md`. Minimum interval between two crash stops unchanged at 0.6 s. In Chromium with constant braking the capture arrives after 19 s and records the stop, without errors on the page. Typecheck, build, `qa-drive-pose` and `qa-drive-camera` passed.

## Destination drop with distance (November 23, 2026)

Reported by Luca on the telephone: the yellow card «01» with the arrow was not clear. Now it's a turquoise drop (`#3cc9b8`, shared only with the light beam) whose tip points to the location, downwards when framed. Inside is the distance as the crow flies: «4.3km», below 995 m «850m» in steps of 10 m. At each new destination during the race the drop flies from the car to its place in 0.45 s; when entering the guide no, because the camera is still gliding from the map and the flight started from off screen. Widened margins: the larger drop touched the right touch area and the tip touched the exit button.

In Chromium (390 × 780, touch, `?nopolice`): distance decreasing regularly (90 → 70 → 50 → 30 m) and passing to km above 995 m; flight recorded frame by frame (scale 0.5 → 1) and absent at entry; no overlap with statistics, exit and touch zones; no errors on the page. A distance along the roads was tried and discarded: it jumped from 1.1 to 2.7 km in a second and a half. The arrival flight was not captured on the screen: driving randomly does not reach a destination. Typecheck and build passed.

## Places in the new neighborhoods (23 November 2026)

Ciudad Alta, riscos and barrancos, southern ring and Alcaravaneras had no places: Conducir's trail never took us. A scan of the named OSM polygons (parks, churches, markets, facilities, squares, monuments) on the discovered barrios gave the candidates; recognizable places chosen, schools excluded. Each way was reread in full by the OSM API: valid polygon, OSM name identical to that of the catalog, internal point in the expected barrio and inside `city-aoi.geojson`.

| # | Luogo | OSM | Barrio |
|---|---|---|---|
| 17 | Parque de La Ballena | way/583818223 | Escaleritas |
| 18 | Parque de Las Rehoyas | way/787583937 | Las Rehoyas |
| 19 | Mercado de Altavista | way/204791336 | Altavista |
| 20 | Castillo de San Francisco | way/251520472 | San Francisco - San Nicolás |
| 21 | Cementerio Inglés | way/251568732 | San Juan - San José |
| 22 | Parque Gloria Fuertes | way/582922523 | Casablanca III |
| 23 | Iglesia San Francisco Javier | way/845103711 | Pedro Hidalgo |
| 24 | Parque Antiguo Estadio Insular | way/583766587 | Alcaravaneras |
| 25 | Real Club Náutico | way/265775327 | Alcaravaneras |

Discarded after capture: Estadio de Gran Canaria (San Lázaro) and Castillo de Mata, because the map only shows terrain there; a dedicated model would be needed. Tres Palmas, Hoya de La Plata and El Secadero do not have named polygons useful in OSM.

`poi.geojson` has been updated here by reproducing the calculation of `data.py` (internal point of polygon, same origin and projection) on the current OSM data, because the session has no pipeline cache: the first 16 places are identical byte for byte. At the next `python scripts/data.py city` the points will come from the cached extract and may move slightly. In Chromium: menu and placeholder have 25 entries, the map flies to each new place and the tab shows the name, no errors on the page. `check:data`, typecheck, build and `qa-drive-route` passed.

## Dedicated models: Estadio de Gran Canaria and Castillo de Mata (23 November 2026)

Neither of them is in the Municipality's buildings layer: that's why the map showed empty land there. New catalog entry `osmBuildings` (footprint from OpenStreetMap, declared height) read from `scripts/osm_buildings.py` in `data.py`; negative ids to avoid meeting municipal OBJECTIDs. `scene.ts` and `overview.ts` choose colors and details from the absolute value of the id: with a negative id the palette index did not exist and walls and roofs came out white.

- **Estadio de Gran Canaria** (way/838329801, `building=stadium`, 38,084 m², the pitch is already outside the footprint): extruded base at 4 m, bleachers rising from the edge of the pitch to 20 m on the external wall, green pitch in the center. The base starts from the height of the first vertex like the extrusion: with the height of the centre, the stadium, on a slope, covered the stands. The partial roofs of the stands are not drawn: their extension is not mapped.
- **Castillo de Mata** (way/182801321, enclosure `historic=castle`, 7 m, battlements like the Castillo de la Luz with the same function) and the internal body (way/251520474, 10 m).

Estimated heights, to be measured with `lidar-check.py`. Preview in Chromium on a local copy: `city.json` with the three buildings added by the same function as `data.py`, `sectors.py` with a neutral roof atlas instead of the orthophoto (2 min 10 s, 28,751 parts), captures from two distances and two orientations, no errors. Copy and atlas discarded: published data is not regenerated. The two places remain in the catalog but outside of `poi.geojson` until it regenerates, so as not to aim for empty land. Typecheck, build, `check:data`, `qa-drive-route`, `qa-drive-pose` and `qa-pedestrians` passed.

## Place cards (November 24, 2026)

Card with photo, neighborhood, name, text and links for places with a `card` block in the catalog; proposal approved by Luca with these choices: panel on the left, texts of 400–600 characters, link to the official site when it exists and otherwise to Wikipedia in Spanish, first four complete places. Animations with `element.animate`, without GSAP or other dependencies.

- **Contents.** Plaza de Santa Ana (498 characters), Casa de Colón (556), Teatro Pérez Galdós (531), Mercado de Vegueta (478). Facts reread on the Wikipedia entries in Spanish: the draft proposal said that the dogs in the plaza were originally described as bronze; they are cast iron painted green, placed in 1895. For the market the only date of inauguration remains (1858): the year of construction differs between the sources. Photo from Wikimedia Commons, 57 to 111 KB, credits in `DATA_SOURCES.md`.
- **Build.** `check:data` rejects texts outside 400–600 characters and missing photos.
- **Layout**, in Chromium with WebGL software. 1280 × 800: 376 px panel on the left, marker at x = 835, i.e. in the center of the free part. 390 × 844: sheet up to 70% of the height, text that scrolls with the link always in view, marker above the sheet. 844 × 390: Photo next to text. In all three the neighborhood («Vegueta», «Triana») comes from `barrios.json`.
- **Movement.** Animations stopped at 120, 380 and 700 ms: the photo is revealed from above, the name rises word by word, text and link follow.
- **Behavior.** Moving the map on the phone folds the paper into the pill; a touch reopens it. Closing with × and Esc. A place without `card` (Parque de San Telmo) shows the pill from before. `article h3` still contains the full name. No errors on the page.

Typecheck, build, `qa-drive-pose`, `qa-drive-route` and `qa-pedestrians` passed. Not tested on physical phone; dragging photo down not tested with real finger.

`npm test` with `CHROME_PATH` does not reach the cards here: after the driving, pedestrian and soil tests (passed) it stops at line 49 of `qa.mjs`, waiting for the initial sectors to finish loading within 30 s, before touching a place. Two laps, same point. It is loading under WebGL software; it was not compared to the previous commit. To be repeated with Chrome on Windows.

## Shared map camera, zoom to cursor, scroll and tab offset (November 24, 2026)

`MapControls` instead of manually configured `OrbitControls`; orthographic camera, pixel edges, distance and angle common to map, guide, editor and laboratories (`src/render/map-camera.ts`); the location card moves the image with `setViewOffset` instead of moving the target; Exponential driving chamber dampings per second. Contract updated in [CAMERA_FRAMING.md](CAMERA_FRAMING.md).

- **`qa-map-camera.mjs` (new, included in `npm test`).** Offset geometry: the target falls exactly at the requested displacement and the recalculated point at the center of the screen falls on the center (error < 1e-6 px). Identical damping after 1 s at 30, 60 and 144 fps. In the browser, 1440 × 900: the wheel holds the point under the pointer (gap < 3 px), the map slides after release and then stops, Plaza de Santa Ana ends up in the center of the part left free by the panel (< 3 px) and remains there after a rotation and after `+`, closing the tab does not move the image (< 1.5 px) and `data-view` remains the same. Passed.
- **`qa-drive-camera`, `qa-editor`, `qa-drive-pose`, `qa-drive-location`, `qa-pedestrians`, `qa-ground`:** passed.
- **`qa.mjs`, desktop**, in Chromium with WebGL software and extended waits: the entire map part passed (wind with stationary map, four shots with center and zoom unchanged, pan, drag, wheel, San Telmo card with rotation and orientation change without changing `data-view`, three context losses, reload with Santa Ana). The guide stops at two expectations related to real time: capture within 120 s and the `#over` summary not yet visible immediately after the loss of context. Capture time measured twice per build: 224 and 71 s on the previous commit, 53 and 183 s on this one; the limit is exceeded on both.
- **`qa.mjs`, phone 390 × 844**: Passed all the way (map, card, pinch, lose context, reload, drive, capture, return) after two interventions. The first is in the code: `#status` is above the card (`z-index: 5`), because the sheet covered «Recargar». The second only in the local copy of the test: close the restored tab before Play, which the sheet covers. The second point remains open, see `PROGRESS.md`.
- **Screenshots**: Teatro Pérez Galdós marker centered above the sheet on the phone; driving view unchanged.

Not tested on physical phone: slide after dragging and pinching towards the indicated point.

**Fix: Map was chasing the finger.** Three.js dampening (`enableDamping`) only applies `dampingFactor` of each move per update, about 10% with the value used: while dragging the map lagged and caught up afterwards. Now the damping is turned off and the slide starts on release from the measured speed (`coast` in `src/main.ts`). Furthermore, with the finger the pan of three.js moved the ground by 73% vertically (sine of the inclination); `GroundControls` makes up for it. `qa-map-camera` now checks that the marker moves as much as the mouse (60, 80 px) and as much as the finger delivered by the browser, with 96 px vertically, and the slide after a finger swipe at 60 Hz with explicit timing. Three out of three laps passed; `qa-editor` and `qa-drive-camera` passed. The control traces show the eight steps of the finger applied all the same: the deviations seen initially came from the test, which read the marker before the next frame.

**Continued: Pedestrians.** Rotating towards the direction of travel or escape (`pedestrians.ts`), appearing and jumping into view (`drive-crowd.ts`) use `approach` instead of `min(1, dt·k)`: they were the only dampings linked to the `dt` of the frame. Steering, pitch when braking and grip of cars and patrol cars remain as they are, because `drive-physics.ts` already runs at a fixed pitch of 1/120 s. `qa-pedestrians` (closest to the ground 5.14 m, margin 2.3 m), `qa-drive-pose` (same measurements: 60 km/h at 1.442 s, braking 0.933 s / 11.5 m), `qa-drive-camera`, `qa-drive-location`, typecheck and build passed.

## Beaches and Paseo de Las Canteras (November 24, 2026)

Reported by Luca with two photographs: in Las Canteras it was not clear that there is a beach or a seafront. The map colored the ground only for parks, squares and streets; the sand was the beige of the ground and the paseo was a 2.2 m pedestrian line almost the same color.

- **Data.** Four OSM `natural=beach` areas: Playa de Las Canteras (way/30598416, 172,087 m² on land), Playa de Las Alcaravaneras (way/30663319, 34,707 m²) and two smaller ones at El Rincón (way/585702774 and 585702820). `data.py` now writes them as `beach` surfaces. Here, without pipeline cache, they were added to `city.json` with the same rule as of today's OSM, and `sectors.py` was rerun with published roof tiles: `city-core.json`, `city-index.json` and 56 out of 805 sectors change, no roofs or zones files.
- **Yield.** Sand `#e4cf9d` with ripples; Paseo Las Canteras (2 km in OSM, already in the data with its name) 9 m wide in terracotta `#b9755c` with light band, from the reference photographs. La Barra was already designed by the sea.
- **Place.** «Playa de Las Canteras» in the catalog and in `poi.geojson` (26 places), without listing for now: the photographs sent do not have a known license.
- **Captures** in Chromium: wide view at 1280 × 800, detail at 390 × 844 on the paseo, Alcaravaneras. No errors on the page. `check:data`, typecheck, build, `qa-drive-route`, `qa-pedestrians` and `qa-drive-pose` passed.

Limits: umbrellas, palm trees on the paseo and street lamps in the photographs are not there, because OSM does not map them as objects; atmospheric pedestrians can walk on the sand, as in squares. Not tested on physical phone.

## Las Arenas, hospitals and wooden balconies (24 November 2026)

Requested by Luca after the beach. The three complexes are in the municipal data, each as a single block with the maximum height over the entire footprint and the windows and balconies of a building: Las Arenas 38,925 m² at 25.9 m (OBJECTID 15839 and 15840), Hospital Doctor Negrín 37,328 m² at 28.7 m (16440), Hospital Insular 13,778 m² at 45.9 m (39612).

- **Places.** Centro Comercial Las Arenas (way/33127705), Hospital Universitario de Gran Canaria Doctor Negrín (way/237094321), Hospital Universitario Insular de Gran Canaria (relation/11551897): 29 places in the menu, without tab for now.
- **Appearance.** Windowless Las Arenas; hospitals with white walls and windows without balconies (new `balconies: false`). The styles are in the catalog and, as `data.py` would do, in `city.json`; `sectors.py` rerun without roof atlas.
- **Wooden balconies.** Houses up to 15 m in Vegueta and Triana: closed brown balcony with roof on one in two houses, instead of the light balcony on one in four. It is an illustrative detail, not a relief of the actual facades.
- **Captures** in Chromium before and after on the three complexes, on Vegueta and Triana, and a close-up detail of the balconies. No errors on the page. `check:data`, typecheck, build, `qa-drive-route`, `qa-pedestrians` and `qa-ground` passed.

Limits: the volumes remain those of the municipal data. Low bodies and towers can only be distinguished with `lidar-check.py` and orthophoto, which require caching. Triangles and cadence on telephone in the Vegueta sectors not remeasured after the new balconies.

## Cards of all places (November 24, 2026)

Added 26 cards: 30 places out of 31 in the catalog now have text and links, 21 also have photos. Search divided between three agents, with one rule: each fact of the text accompanied by the literal sentence of the source and its address, author and license of each photo read from the file page on Wikimedia Commons. Texts between 487 and 578 characters.

- **Corrected upon re-reading.** Mercado del Puerto: attribution to the technicians of the Eiffel company removed, supported only by Wikipedia without citation. Castillo de San Francisco: removed «hoy está en stado de abandono», without date. Parque de Las Rehoyas: surface removed, automatically obtained from a PDF. Conflicting dates between sources left out (opening of the Parque del Estadio Insular, reconstruction of the Castillo de Mata, start of work on the Castillo de San Francisco).
- **Photos discarded on sight.** Real Club Náutico (taken from a car, shows a billboard) and Parque de La Ballena (shows the viaduct and a football field, not the park).
- **Without suitable free photo:** El Obelisco, Club de Natación Metropole, Parroquia de San Cristóbal, Parque de La Ballena, Parque de Las Rehoyas, Mercado de Altavista, Parque Gloria Fuertes, Real Club Náutico, Centro Comercial Las Arenas. The tab opens without a pane.
- **Without card:** Iglesia San Francisco Javier. Only data from diocesan lists, and all sources place the parish in Hoya de la Plata, not in Pedro Hidalgo: check which building the marker points to.
- **Single source, to be reread:** El Obelisco (Mapping Canarias), Parroquia de San Cristóbal (an article by La Provincia; the temple is dedicated to Nuestra Señora del Buen Viaje), Parque de La Ballena (project sheet at the Colegio de Arquitectos, status as of 2019). The numbers of beds and places in hospitals and markets are from undated sources.

`check:data` and build passed. In Chromium, at 1280 × 800, all 29 menu items opened one by one: 28 tabs with text, photo where applicable and domain of the correct link, one pill (Iglesia San Francisco Javier), no errors on the page or failed requests. At 390 × 844 check one card without photos and one with photos. No testing on physical phone. The texts have not been proofread by a local person.

## Building Archetypes and Catalog Exceptions (November 25, 2026)

Requested by Luca with five screenshots of the site: Ciudad de la Justicia, Hospital Insular and Materno Infantil, the supermarket next to San Francisco Javier, San Cristóbal. Question: are different archetypes needed or are exceptions enough?

**Diagnosis.** Each municipal building was treated as a dwelling: pastel color, bay windows, balconies, cabin on the roof. Three cases do not hold:

1. warehouses, markets and shopping centers (deep layout, no windows);
2. hospitals, schools and offices (ribbon windows, no balconies);
3. municipal records that are an entire lot extruded to the maximum height (courtyards, yards and even a sports field become a full block).

**Choice: two archetypes from the data plus exceptions in the catalog.** OpenStreetMap covers only a part (out of 617 buildings over 1,500 m², 219 have no OSM buildings and 213 have only `building=yes`), so a large system of archetypes from tags alone is not reliable. The `kind` field is born in `data.py` like this:

- **`hall`**: OSM tag `building` industrial, warehouse, retail, supermarket, commercial, hangar, garage, parking, sports_centre, sports_hall, service, or `shop` mall, supermarket, department_store; or, without tag, plan with inscribed circle with a radius of at least 15 m, at least 1,200 m² and a height of up to 16 m. Yield: neutral walls without windows, a wide door every 16 m, light band under the roof, skylights on 12 m grid (stylization, like the cabin of the houses).
- **`block`**: OSM tag hospital, school, university, college, office, public, civic, government, fire_station, or `amenity` hospital, school, university, college, courthouse, police, townhall, library. Yield: light walls, a continuous band of glass per floor, no balconies.
- The archetype is assigned only to buildings without a catalog entry; the catalog can impose it (`kind`) or deny it (`kind: "housing"`).

Result in the city: 655 `hall`, 247 `block`, 27,918 homes (28,820 shares).

**Eccezioni a catalogo.**

- **`footprint: "osm"`** for lots extruded in full: only what OSM maps as a building within the record, at the municipal height, remains. Applied after verification on the orthophoto to 40993 (seven cross blocks and police station next to the Justicia), 17363 (it was a sports field rendered as a 12.7 m building), 15495, 20053, 2034 (Cementerio de San Lázaro, rows of niches). Not automatic: where OSM is incomplete it would erase real buildings.
- **Ciudad de la Justicia (40994).** Model `ciudad-de-la-justicia`: base lowered to 10 m (estimate), four slats of 67 x 21 m measured on the orthophoto, at municipal height (51.7 m), with glazed galleries on the long sides.
- **Maternal Infantil (39610)** `block`; **ramped parking (39613)** `hall` without skylights; **Negrín and Insular** `block`.

**Limits stated.** Pieces in a batch with `footprint: "osm"` all have the maximum height of the record. The geometric rule does not see warehouses higher than 16 m without OSM tags. The other fully extruded lots (about 25 candidates over 1,500 m² with less than 60% covered by OSM buildings) must be verified one by one on the orthophoto. San Cristóbal and San Francisco Javier were not affected.

**Measurements and tests.**

```
typecheck, build: ok
`npm test` stops at `scripts/qa.mjs:181` while waiting for the pinch gesture, as it did on `main`.
frame-profile 35,-1160,1.59 (Justicia): median 16.7 ms, p95 16.8, 120 draws
frame-profile 167,5372,1.59 (industrial zone): 16.7 / 16.8, 85 draws
frame-profile 167,5372,0.352: 16.7 / 16.9, 270 draws
frame-profile -270,-2600,1.59 (hospitals): 16.7 / 16.8, 94 draws
```

## San Telmo as a whole, Pérez Galdós Theater and soil types (November 25, 2026)

Requested by Luca after the first passage: the park only had the two kiosks and the hermitage, the composition of the area was missing; the theater looked nothing like the original. Sources: SITCAN 20 cm orthophoto, OpenStreetMap from cached extracts, terrain model. The photos from Google Maps, Street View and Tripadvisor indicated by Luca served only as a visual reference: none are in the project.

**Parque de San Telmo.**

- **Estación de Guaguas (way 584044810).** It was completely missing: the covering plaza was a void. Now it's a `osmBuilding`. The terrain model already contains the rise of the square (7-8 m compared to 4 m on Avenida Rafael Cabrera): the extruded body is only the edge (1.6 m, estimate). Above, from the `estacion-san-telmo` model: the six glazed skylights of the stairs (way 519309916-21, 14.8 x 7 m), the blue pyramid with the white cross (way 584054251), the ice rink (way 519309910, 6 m), the round light well (way 584051421) and the shelter entrance window, measured on the orthophoto. Heights of skylights, pyramid and canopy: estimates.
- **Balusters.** The four white walls of the descent from the park to the station (way 761736871, 76, 77, 78), 1 m high (estimated).
- **Barco Pirata (way 209186908).** The blue floor of the play area and the ship where the orthophoto shows it: hull, two castles, two masts, bowsprit. Proportions from the plan, estimated heights.
- **Quiosco de la Música.** Stone base at 1.4 m, columns, bell-shaped roof with spike; peaked at 8 m (estimate, it was 6.5).
- **Two pavilions** (ways 434815204 and 434815206, `building=public`), estimated at 3 m.
- **Flowerbeds.** The park is a paved area (`pavedParks`) and covered its own flowerbeds: the surfaces are now painted from largest to smallest, so the gardens mapped inside the park become green again. This applies to the whole city.
- **Not modeled:** monuments and sculptures mapped as a point (Cruceiro, Don Cristóbal del Castillo, Espiral del Viento), the round hut under the trees (way 521049353), the bathrooms, the fields on the roof of the station.

**Teatro Pérez Galdós (41435).** The first passage had reversed the bodies. The orthophoto shows the hipped roof on the historic hall, towards the sea, and dark flat roofs on the modern stage body, towards the north-west; the shadow confirms that the tall body is the modern one. Now: gray stage body at municipal height (30.6 m), without windows; separate historic hall with `split.polygon`, lowered to 17 m at the cornice (estimate), hipped roof up to 21.5 m with the color of the orthophoto, facades with three orders of arched openings between stone bands, five bays on the entrance front and eight on the sides (number of bays and heights of the bands: estimate from general knowledge and reference photos). The low body between the hall and the tower remains at the height of the tower.

**Soil Types.** A surface can declare its material (`ground`): `grass`, `asphalt`, `earth`, `rubber`, `pitch`, with colors in `src/data/road-style.json`. `data.py` gets it from the OSM `surface` tag, from the feature type (`leisure=playground` means rubber, `leisure=pitch` means sports field, at street level only), or from the catalog's `grounds` entry. Areas tagged `place=square` are also included as surfaces. Plaza de Stagno, in front of the theatre, is catalogued as dark asphalt, matching the orthophoto.

**Measurements and tests.**

```
Frame profile at San Telmo (`node scripts/frame-profile.mjs -110,420,1.59`, emulated phone): median 18.0 ms, p95 18.1 ms, 102 draw calls, 126,651 triangles.
Models: `estacion-san-telmo` 607 triangles, `barco-pirata` 115, `quiosco-de-la-musica` 173, `teatro-perez-galdos` 882; all 26 models total 8,966.
Data: 805 sectors, 28,767 building parts; surfaces by ground type: 380 sports fields, 134 playgrounds, 15 grass, 12 dirt, 7 asphalt.
`npm.cmd run typecheck` and `npm.cmd run build` pass. `npm.cmd test` stops at `scripts/qa.mjs:181` while waiting for the pinch gesture, as it did on `main` before these changes.
Before/after screenshots with the same camera (`node scripts/shot.mjs`) for San Telmo and the theater; visual checks of Doramas, Estadio Insular, Metropole and Real Club Náutico for the new ground types.
```

## Passage over places without a model (November 25, 2026)

Requested by Luca: Check all the locations in the catalog that didn't have a model and give each a more faithful low-poly silhouette. Sources: SITCAN 20 cm orthophoto viewed through the window (one crop per location, with municipal footprints superimposed), OpenStreetMap tags and geometries from cached extracts, municipal heights. No LiDAR tiles on this car: any height that doesn't come from the City or OSM is a stated estimate. No photographs reproduced.

**New templates** (`src/render/landmarks.ts`, with shared helpers `roof`, `block`, `bounds`Z, `eaves`, `pitched`):

- **Teatro Pérez Galdós (41435).** `split.polygon` separates the stage tower (27 m, hip roof up to 30.6 m municipal, as in the orthophoto) from the hall, lowered to 19 m (estimate). Entrance front on the side opposite the scene: three arched doors and two frames (estimated from general knowledge, not from photos).
- **Mercado de Vegueta (41434).** Ring of stalls at 8 m (estimate) and three raised naves where the orthophoto shows them: two with white pitched roofs up to 13.5 m at the municipal level, a lower gray one.
- **Casa de Colón (41117).** Bands of tiles along all the walls, including patios. The stone portal is not drawn: its position is not verified.
- **Iglesia de Santo Domingo (40140), Parroquia de San Cristóbal (40525), Iglesia San Francisco Javier (body 37217:-340:-3736), Ermita de San Telmo (40444).** Nave under the orthophoto pitched roof (tiles, gray sheet metal in San Cristóbal); lowered walls (estimates: 12, 12.5, 8.5 and 8 m), filled to municipal height. Bell towers and facades not drawn: not verifiable from above.
- **Parque de San Telmo.** Music kiosk (way 259777939, `building=roof`: columns and green octagonal roof) and modernist kiosk (way 259777937, `building=kiosk`, 1923: red body and dome) as `osmBuildings`. Estimated heights (6.5 and 6.4 m).
- **El Obelisco.** Way 582805814 (`man_made=obelisk`): extruded base and tapered shaft up to 25 m of the `height` tag, color from the `colour` tag.
- **Parque Antiguo Estadio Insular.** The two white tents (way 511090031 and 511090032, `amenity=shelter`) with the same membrane model as Santa Catalina station; peaks at 9 m (estimate).
- **Las Arenas (15839).** The five square glass pyramids above the atriums, on the OSM footprints (way 1307312257-60 and 62; side 16.2 m), 6 m high and the largest 9 m (estimate). Body height: municipal.
- **Hospital Insular (body 39612:-315:-2492).** Helipad on the roof where they put OSM (way 808027654) and the orthophoto. The municipal record extrudes the entire body at 45.9 m: the heliport is therefore higher than life.
- **Club Metropole (30075).** `split.polygon` lowers the uncovered tennis and padel courts to 0.4 m, which the municipal record extruded to 8.5 m together with the pavilions. Light pavilions without windows.
- **Castillo de San Francisco (33451).** Appearance only: stone, without windows or roofing furnishings.

**Water.** `data.py` writes as surface `water` every OSM area `leisure=swimming_pool` or `natural=water` between 4 and 20,000 m² (308 in the city); `ground-map.ts` paints it with `color.water` by `road-style.json`, after parks and squares. They serve Metropole, Real Club Náutico, the ponds and pools of Parque Doramas. Driving pedestrians do not walk on it.

**Places left without model, and why.** Plaza de la Feria (the Galdós sculpture is an OSM node: no dimensions mapped), Cementerio Inglés (an enclosure, no buildings to model), Hospital Doctor Negrín and Mercado de Altavista (bodies of different heights distinguishable only with LiDAR), parks of La Ballena, Las Rehoyas and Gloria Fuertes and Playa de Las Canteras (no structures mapped). Parque Doramas receives only water; Pueblo Canario and Hotel Santa Catalina remain municipal extrusions.

**Limitations.** Casa de Colón's tile bands also follow walls shared with neighbors and make a point in sharp corners. The roof of the Ermita de San Telmo covers the rectangle containing the L-shaped footprint. Estimates to be measured with LiDAR: all the heights of the lowered walls, the peaks of the tents, the pyramids, the kiosks.

**Measurements** (`node scripts/frame-profile.mjs`, emulated phone, before → after):

```
Theater (97,-159) zoom 1.59: draws 91.1 -> 90.5; median 18.0 -> 17.4 ms; p90 18.1 -> 18.0 ms
Theater zoom 0.352: draws 155.5 -> 156.5; median 18.0 -> 17.7 ms; p90 18.1 -> 18.3 ms
Las Arenas (-3286,2600) 1.59: draws 79.5 -> 80.5; median 18.0 -> 17.4 ms; p90 18.1 -> 18.2 ms
San Telmo (-200,385) 1.59: draws 117.2 -> 117.2; median 18.0 -> 17.3 ms; p90 18.1 -> 18.2 ms
```

**Tests.** `npm.cmd run typecheck` and `npm.cmd run build` pass. `npm.cmd test` stops at `qa.mjs` line 181 (waiting for pinch, 30 s): it is the same error already recorded on main before this job (then line 180); the suite's previous checks pass. Identical camera before and after screens for 15 locations (`node scripts/shot.mjs`), check them one by one.

## Santa Catalina Port (November 24, 2026)

Requested by Luca from a capture on the phone: El Muelle as a single block at 38 m with building windows, Elder and Miller as condominiums, radial asphalt bars on the station square, streets that ended in a round cap. References: PNOA 1 m and SITCAN 20 cm orthophotos (read remotely) superimposed on footprints and roads of the model; Wikimedia Commons photos («Buildings of Elder ^ Miller - panorama», «Museo Elder de la Ciencia y la Tecnología», «ELDER - panorama») used for reference only, not reproduced.

- **Roads underground.** The 20 lanes of the Estación de Guaguas Santa Catalina have in OSM `level=-1` but not `tunnel`: `data.py`Z now discards every `highway` with all the negative `level`s (21 ways in the city, 20 lanes and a sidewalk). The surface streets that continue in an underground section have `portal: true` (177 in the city) and end with a clear cut in `carriageways.py` and in the raster ground: Avenida Marítima at the entrance under the square, bus ramps. The trench ramp inside the roundabout island is real (way 1263512785, `cutting=yes`) and remains.
- **El Muelle (29223).** `split.polygon` (new: ring in local meters) separates the semicircular atrium and the forecourt from the strip. Batten at municipal height (38.1 m), light walls without windows. Atrium and forecourt extruded at 6 m; `landmarks.ts` draws the glass vault on the half-ring (radii 29 and 48.5 m, from 22 to 30 m), the glass façade on the straight side and the white lattice pergola at 13 m. The cylindrical tower remains a separate body at the municipal level.
- **Elder Building (26981).** Dark glass cube north at municipal height (19.7 m); historic water green building with windows and without balconies at 11 m.
- **Miller Building (26979).** White walls at 30 feet with no windows; two parallel red slopes up to the municipal peak (13.5 m), from the orthophoto plan.
- **Station tent.** `osmBuildings` with the way 1261817818 (`building=roof`): white membrane with high spikes on the corners, trees at the tips.

Stated estimates, to be measured with the LiDAR (on this machine `.cache/lidar` is empty): atrium and forecourt plan, vault and pergola of El Muelle, historical body of the Elder, walls of the Miller, peaks of the tent (13 m).

**Checks.** `typecheck`, `build` with green `check:data`. Comparison of `city.json` before and after: only the 21 underground ways, the 177 with `portal` and the three buildings change; `roof-tones.json` changes only for 29223, 29223-atrio, 26981, 26981-vidrio and the tent. Identical camera captures (1440 × 900 at zoom 0.9 and 3.2, phone at 1.59) before and after, seen by eye. `frame-profile.mjs` at (-1250, 4000) on emulated phone, starting commit against this:

| View | Draw calls | Triangles | Median / p90 |
|---|---|---|---|
| Close view (1.59) | 88 → 94.5 | 83,848 → 81,219 | 16.7 / 16.8 ms, unchanged |
| Wider (0.352) | 306.5 → 308.4 | 277,592 → 279,536 | 16.7 / 16.8 ms, unchanged |

`npm.cmd test`: guidance, pedestrians, ground and map camera exceeded; `qa.mjs` stops at line 180 (pinch on phone, `data-view` unchanged within 30 s). `qa-sectors.mjs`: the sector circuit passes, then the click on Play is intercepted by the Santa Ana card link. Both crashes happen identically on a clean copy of the starting commit `4de5a3e`: they do not depend on this step.

## Place Card and Sector Reset · November 25, 2026

On Chrome at 390×844, reloading the map with Santa Ana selected restores the compact name. The suite checks two paths with the touch: touching the name reopens the tab, touching Play after a new reset enters the guide. The side panel reopens on the desktop. Saved center, zoom and orientation pass checks on restore.

On an isolated production build there were three consecutive launches of `qa-main-lod.mjs`. The test compares the coordinates observed during fading and after WebGL retrieval with those set initially. Also passed are TypeScript, build with data verification, full desktop and mobile suite and `qa-sectors.mjs` (six laps and two-way border crossing with active patrol). The suite's screenshots are locally cached.

## Performance in Chrome at 390 × 844 · November 25, 2026

Windows, Chrome headless 155, WebGL on NVIDIA RTX 4060 via ANGLE/D3D11. Three new browser processes, HTTP cache disabled, CPU slowed 6×, isolated production local build. The first two times start from the start of navigation. The last column measures the time from the first touch sent by the test to the change in vision.

| Opening | Interactive map | First drag visible | Touch → view |
|---|---:|---:|---:|
| 1 | 14,205 s | 15,668 s | 126 ms |
| 2 | 12,972 s | 14,437 s | 101 ms |
| 3 | 12,567 s | 14,091 s | 119 ms |
| Mediana | 12,972 s | 14,437 s | 119 ms |

A fourth boot with CPU sampling attributes 2.77 s out of 14.12 s to ground drawing on the main thread, including called functions. For cadence we used `frame-profile.mjs` at normal CPU speed, 1.59 zoom and initial orientation, alternating between the two locations. Each test measures 160 frames with small camera movements.

| Location | Medians of the three trials (ms) | 90th percentile of the three tests (ms) |
|---|---|---|
| Plaza de Santa Ana | 18,1 · 17,7 · 18,1 | 18,2 · 18,2 · 18,2 |
| Iglesia de Santo Domingo | 18,1 · 18,1 · 17,3 | 18,2 · 18,2 · 18,2 |

**Five minute drive on the reference build.** Depart at (−642.9, −820.9), destination Parque Antiguo Estadio Insular. In `?nopolice` mode the automatic route covered 3,873 m and 10 sectors in 300.06 s. Over 16,871 frames the median is 17.9 ms and the p90 is 18.2 ms. Four frames exceed 50 ms, the worst reaches 128 ms. The trace recorded between seconds 120 and 130 falls outside the peaks observed at seconds 20, 49 and 64. From this run the frequency of the shots is obtained, but their cause remains open.

**Ground experiment on startup.** Two isolated copies of the same build, A with drawing on the main thread and B with image transfer from a worker. In A/B/B/A/A/B order, each with a new browser and 6× CPU, the map becomes interactive in 15,312 / 11,145 / 11,354 / 12,822 / 14,220 / 15,106 s. Medians A and B: 14.220 and 11.354 s. The first visible entrainment goes from 15.852 to 12.754 s of median. The median improvement of 2.866 s at opening exceeds the change of 2.490 s between baseline trials. The slowest B sample is 15.106 s. In Santa Ana with identical center and zoom, the texture boundaries match and all 895 × 2,048 pixels have identical RGBA values.

**Verification of the integrated code and decision.** In the alternating A/B/B/A/A/B comparison the map is interactive in 16,159 · 16,055 · 14,839 s with the reference and 14,678 · 15,173 · 14,444 s with the worker compiled from source. Medians 16.055 and 14.678 s. For the first visible entrainment the samples are 17.748 · 17.550 · 16.360 s and 16.314 · 16.551 · 16.047 s, with medians 17.550 and 16.314 s. Image transfer observed in all three candidate apertures. The 6× slowdown is applied to the emulated page, without separate configuration for the worker.

The median gain at startup (1.377 s) is lower than the initial variability (1.638 s). The gain at first tracking (1.236 s) is less than the variability of the alternating reference (1.388 s). The candidate was withdrawn. The P1 measures are for the isolated build based on bed2273, which predates the new place templates. Consumption, heat and fluidity on a physical phone remain to be measured.

After the arrival of the new location models (f9b9da9), boot and recovery, three repetitions of the level test, both road crossings and the desktop/mobile suite also moved to the second isolated build. The first run of the suite had broken in the physics test during concurrent changes to the guidance. The same test and suite were repeated.

## Guagua in Conducir · November 25, 2026

Line 13 towards Tres Palmas runs 230.8 m in Vegueta. The importer checked the vehicle rectangle (7.2 × 2.2 m) along each segment, including nose and tail, against roadways, buildings, trees, and driver and city limits. Two extractions of the same ZIP produce identical files. An invalid archive leaves the last valid extract intact.

The 120 Hz test uses both real stops. Check braking, stop for three seconds, restart and wait at the end until both ends go out of sight. At La Portadilla the test repeats the chase with the driver's obstacles, the physics of the car and the steering of the patrols. The player who follows the guagua remains behind. By moving the approach path 2.45 m to the left, the player passes the bus as the patrol makes contact and slows down. The control also covers side impacts and separation of overlapping bodies.

To repeat the checks from the project root use these commands.

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
node scripts/qa-guagua-browser.mjs
```

The dedicated browser test starts near the first stop, with external requests blocked, on desktop and emulated phone. Check the moving pass beyond both stops and return the game to the start. The first pass captures are in `.cache/qa-guaguas/`. For a manual test open `index.html?lab=guida&area=pilot&start=-60,-818` and choose the aerial view with the camera button.

[Bus and Car at the First Stop, Aerial Pilot View](screenshots/guagua-vegueta.png).

**Compact model of the 13 line.** The collision length increases from 9 to 7.2 m. The geometric check covers 230.8m of the course and the chase test verifies that the player can still overtake the bus at La Portadilla. [Model View from the Door Side](screenshots/guagua-modello.png).

## Who occupies the memory · November 25, 2026

Measure without changing the viewer using the new `node scripts/heap-profile.mjs <x,y,zoom> <build> "" <depth>` command: capture the Chrome heap snapshot with phone emulation (390 × 844), after garbage collection, attributed to the first named variable on the shortest path from the root. Use a non-minified build (`npx vite build --minify false --outDir .cache/dist-profile`), with the map stopped and without entering Conducir.

| Entry (MB) | Up close in Vegueta (-80, -560, 1.59) | Wider view on Schamann (-2250, 300, 0.352) |
|---|---|---|
| Totale dell'istantanea | 88,3 | 113,4 |
| Driving world (`drive.world`), driving off | 22.0 | 38.9 |
| of which wall segments of the loaded zones (`segs`) | not separated | 21.1 |
| of which nodes and connections of the road network | 8.5 | 7.6 |
| Pedoni (`people`) | 4,9 | 4,9 |
| Streaming layer geometries still in JavaScript | 27.4 | 26.9 |
| Loaded zone footprints (`residentZones.buildings`) | 4.2 | 10.5 |
| Core land (plus 7.6 MB of copy in the worker) | 6.9 | 6.9 |
| Core surfaces and streets | 6.3 | 5.8 |
| Estimation of meters: detail / zones | 58.0 / 26.5 (5 zones, 18 sectors) | 0 / 85.0 (16 zones) |

Reading. The always resident part of the nucleus (land, roads, surfaces) is worth around 13 MB plus 7.6 in the worker: it is not the largest item. The driving world, built and maintained even when you are not driving (22-39 MB, grows with the loaded zones), and the streaming geometries which remain in JavaScript (27 MB) weigh more. Limits: only one execution per view; attribution follows the shortest path, so a data shared between two owners is counted by only one; GPU memory is not measured; no evidence on physical phone.

## Memory: guide to the first Play and released geometries · 25 November 2026

Two corrections after the measurement above, without affecting data or yield.

- **Geometries.** `gpuOnly()` frees the copy in memory upon upload, but the upload occurs at the first drawing and a sector out of sight is never drawn: the copy remained for the entire life of the area. Now each zone and sector mesh is drawn once as it arrives, even out of sight, then goes back to normal cutting. The copy passes to the GPU: the heap decreases, the graphics memory increases by the same amount for the sectors loaded and never framed (300 more buffers in the benchmark, 1,660 against 1,360).
- **Guide.** Road network, walls and pedestrians are no longer built after the opening: the first Play builds them, step by step with a frame in the middle and the wait button, and they remain for the following games. A hidden page with no game in progress frees them.

| Measure (Chrome, emulated phone) | Before | After |
|---|---|---|
| Heap snapshot, close view in Vegueta | 88.3 MB | 45.7 MB |
| Heap snapshot, broader view on Schamann | 113.4 MB | 56.2 MB |
| `benchmark.mjs`, heap after collection | 107.3 MB | 55.2 MB |
| Primo Play, dal tocco al primo fotogramma | 287 ms | 590 ms |
| First Play with 6× slower CPU | 1,302 ms | 4,958 ms |
| Play seguenti (CPU normale / 6×) | 58 / 455-541 ms | 50-61 / 421-555 ms |

With geometry correction alone the snapshots were 72.8 and 100.0 MB. The cost of the first Play at 6× CPU is divided into road network 1.7-2.3 s, walls of 6-8 zones 1.4-1.7 s and pedestrians 0.8-1.1 s; before the same job would block the main thread at any time after opening.

Checks: `typecheck`, `build`, `node scripts/qa.mjs`, `qa-boot`, `qa-recovery`, `qa-sectors`, repeated after realignment on `9d307b4`, with `qa-guagua-motion` (benchmark on `4d6eff2`: 54.6 MB). Identical camera captures with `shot.mjs` in three views: the differences between the previous and new version (13,000-91,000 pixels, maximum deviation 2-79 out of 255) are within those between two captures of the same version (20,000-67,000 pixels, maximum deviation 1-127), due to wind and clouds.

Limits. `qa-drive-lab.mjs` fails on values ​​URL (`t=player.baseSpeed:30`) also on previous build - it is not dependent on this step and is undiagnosed. Whoever plays returns to the previous values ​​as long as the page remains visible. The imprints of the loaded zones (4-10 MB) remain in memory for the following Play. One measurement per view; GPU memory not measured; the first slower Play has not been tested on a physical phone.

**Sky at Parque Doramas.** The test in `scripts/qa-sky.mjs` compares the same view with the default sky and with `sky=0`, counts the WebGL draws for the two effects and verifies reactivation, context recovery and entry into the guide. The observation lasts 20 seconds per format. [Desktop Capture](screenshots/sky-doramas.png) · [URL Controls and Code](SKY_EFFECTS.md).

## Local guaguas in Conducir · city network

### Continuity of the guaguas in Guanarteme

#### Adaptive Corridor Widening

The city candidate expands 1,018 bands covering 127.38 km of axis, of which 4.73 km in Guanarteme. It adds 130,909.60 m² of asphalt with a margin of 0.50 m from the facades. The triangulated check verified 2,041 sectors, 511 with new stripes and 2,720 roadsides. The only exception on board was already present. In Conducir, 11 of the 12 pixels entirely inside the new strips change from pavement to asphalt and the already asphalted pixel remains as such.

The network goes from 906.26 to 923.66 verified GTFS km, adding the variants separately. The continuous sections of at least 1 km go from 169 to 230. The L2 in Guanarteme retains the 2.07 km section. Successful browser test on desktop and emulated phone, with reference pilot preserved.

Five alternating pairs on the emulated phone in Guanarteme use the same recorded guide and reach the same point. The median p90 remains at 18.1 ms. Sector and zone memory goes from 74.272 to 74.296 MB and JavaScript heap from 112.82 to 117.53 MB. The surface index preserves the detail around the new bands and measures 3.71 MB, compared to 7.80 MB for the first candidate for full detail.

With the same feed, the comparison between the old catalog and the regenerated one counts 27 → 81 city sections of at least 1 km and 238 → 428 of at least 500 m. In the cells that intersect the Guanarteme rectangle, the median rises from 25 to 124 m and the sections of at least 500 m go from 56 to 97. The GTFS voids with midpoint in the barrio fall from 7.48 to 4.77 km, summed over the variants.

At departure `-2800,2400`, lines L2, 45 and 65 have sections of approximately 1.27 km. Observing line 45 for 167 simulated seconds, the same bus advances 981 m along its stretch, from 273 to 1,254 m. The 500 m threshold concerns city traffic. Pilot line 13 preserves the test route.

With the new directional junctions and the space available when cornering, the sections of at least 1 km go from 81 to 169 in the city and from 6 to 42 in the cells around Guanarteme. The longest continuous stretch in the city reaches 7.11 km. The GTFS gaps with midpoint in Guanarteme drop from 4.77 to 2.74 km summed over the variants. At the start `-3400,2700` the L2 has 2.07 continuous km. In 205 simulated seconds the same bus advances 1.23 km along the stretch.

The `qa-guagua-local.mjs` test verifies that the same guagua continues to move after multiple reversals in sight, passes stops and restarts after a head-on encounter. The `qa-guagua-browser.mjs` test follows line 13 past both stops on the desktop and the emulated phone.

A 90 s simulation with published data at Hoya de La Plata, fixed view on `-296,-3975` and radius of 90 m, recorded a maximum wait of 2.02 s per right of way. In the 18,059 samples with displacement, the nose followed the direction of travel.

The November 25 feed produces 117 service variations on 111 tracks. The city covers 666.6 of the 822.1 internal GTFS km, counting each variant; serves 534 distinct stops on 46 lines. In the pilot there are 9.7 km out of 13.4, with 12 lines and 12 stops. The check uses the track width of the layout and the entire size of the vehicle in curves. The 8,299 city sections also end where the verification interrupts a journey. Source two networks from the same ZIP and the same OSM extracts gave identical files. [Report by Line, Direction, and Neighborhood Gaps](../public/data/guaguas/city/coverage.json).

The build control compares the time windows of each cell calculated in Python with the TypeScript clock and checks for continuous distance coverage. The simulation tests verify three-second stops, queues between different lines, priority at an intersection, limit of six buses, reappearance out of range, cancellation of uploads and zero updates of a released bus. An invalid archive and an interruption during the manifest exchange leaves the previous network usable.

Playwright trials use Chrome desktop and phone emulated with external requests blocked. They verify the reproducible departure in Vegueta, the local activation in Pedro Hidalgo, the absence of vehicles in Calle Coronel Rocha and driving with a missing package. Opening the map alone generates zero requests for guagua data. [Test Links and Commands](GUAGUAS.md).

In Triana, on an emulated phone with repeated start and input, four runs alternating with and without fleet give a p90 of 16.8 ms per frame in both configurations. WebGL drawings per frame at p90 go from 62 to 69. With six buses active the p90 of fleet instrumented CPU work is 0.1 ms. These measures affect Chrome on this machine; the physical phone remains to be measured.

## Terrain in boxes · November 25, 2026

The terrain was a single grid on the city's size rectangle (1,259 × 2,868 5 m cells), 60% sea or countryside outside the border, held twice: on the page and in the sector worker. Now `sectors.py` publishes only the boxes of 64 cells that touch the 100 m widened border (526 out of 900) and the worker receives with each sector the window of dimensions under his objects, with 60 m of margin. All readings go from `heightAt()` to `src/geometry.ts`.

| Measure (Chrome, emulated phone) | Before | After |
|---|---|---|
| `city-terrain.bin` | 7.22 MB | 4.31 MB |
| Land on page (`data.terrain`) | 6.9MB | 4.1 MB |
| Worker buffer | 7.6 MB | 0.7 MB |
| Heap snapshot, close view in Vegueta | 46.5 MB | 43.8 MB |
| Heap snapshot, broader view on Schamann | 57.0 MB | 54.2 MB |
| `benchmark.mjs`, heap after collection | 54.8 MB | 52.0 MB |

Verification.

- Odds: old and new reading compared on a 10 m mesh, 362,131 points inside the boundary: maximum difference 0. Outside the 100 m margin the odds are 0 by choice.
- Worker window: 200 random windows along the border, 400 points each: maximum difference 8.5 × 10⁻¹¹ m. Out of ten views of the emulated phone, no sector read odds outside their window; in the worst case (a dedicated model) 33 m of the 60 margin remain.
- `sectors.py` regenerated from scratch only changes `city-core.json` and `city-terrain.bin`: zones and sectors have the same content names.
- Identical camera captures in four views (Vegueta, La Isleta on the coast, wider view on Schamann, Pedro Hidalgo at the southern edge): the differences between the previous and new versions lie within those between two captures of the same version.
- `typecheck`, `build`, `node scripts/qa.mjs`, `qa-ground`, `qa-boot`, `qa-recovery`, `qa-sectors`, `qa-drive-pose`: green.

Limits. A view pushed beyond 100 m from the border reads elevation 0 instead of relief: not tested by hand by dragging the map to the edge of the hills. A dedicated model reading elevations more than 60 m from its building would take the elevation of the window edge without warning. One measurement per view; no evidence on physical phone.

## South Block · November 25, 2026

Four entities of the «Barrios» municipal service enter in full: La Montañeta (49), Marzagán (19), Tafira (50) and Los Hoyos (14), 26 named barrios plus the four «Diseminado» that connect them, covered and without labels. The barrios of lower Tafira alone did not touch the covered area and would have left holes: the area remains a single ring just by taking the entire entities. The window switches to −15.48 / 28.00 / −15.38 / 28.19: to the south and east for the acquired coast to close the sea under Jinámar, to the west for La Calzada.

| | Before | After |
|---|---:|---:|
| Area | 36.22 km² | 62.67 km² |
| Building parts | 28,748 | 36,321 |
| Zones / sectors | 75 / 805 | 110 / 1,290 |
| Barrios with name | 46 | 72 |
| `city-core.json` + `city-terrain.bin` | 4.3 + 4.3 MB | 6.8 + 6.7 MB |
| Heap after collection (`benchmark.mjs`, emulated phone) | 52.0 MB | 62.5 MB |

- Terrain: 819 squares out of 1,430 of the rectangle (1,619 × 3,490 cells). As a single grid it would be 11.3 MB per copy.
- LiDAR: 27 tiles on the south block, 5,928 buildings measured; 998 buildings without municipal height take the measured one, 70 low parts and 3 high ones correct. Minus municipal LiDAR median deviation −0.43 m, 85 % within 5 m.
- Guaguas network regenerated on new roads: 9,200 sections in 498 cells, 117 patterns.
- `typecheck`, `build` (with `check-data`), `node scripts/qa.mjs`, `test_guagua_index.py`: green. `benchmark.mjs`: p95 16.8 ms near and 17 ms far.
- Six desktop captures (Jinámar, Marzagán, Tafira Alta, Campus, Los Hoyos, Salto del Negro): continuous soil, roads and buildings on junctions with the previous area, no holes.

Limits. Three marginal LiDAR tiles are missing (455-3103, 456-3105, 459-3104) and those west of x = 455 km for Tafira Alta and Los Hoyos: citywide 975 buildings without municipal data or measurement remain at an estimated 9 m. The southern edge follows the municipal border, with the finger of Montequemado and the recess towards Telde. Rural areas have soil and roads but little vegetation. No locations or cards in new neighborhoods. `heap-profile.mjs` and `PERFORMANCE.md` passage on the heavier sectors were not redone; no evidence on physical phone.

`qa-sectors.mjs`: tour between locations passes (detail memory within budget, 58–60 MiB); the check on the starting point of the guide also fails in the same way on the pre-expansion state, so it comes from the changes to the guide already present on `main` and remains to be fixed.

## North-West Block · the whole municipality · 25 November 2026

Almatriche (1), Los Giles (12), San Lorenzo (30), Tamaraceite (36) and Tenoya (37) enter in full: 40 named barrios plus the five connecting «Diseminado». With the southern block the model now covers the entire municipality; 0.16 km² of waste remains outside the municipal perimeters. The area remains a single ring without holes. The window changes to −15.53 / 28.00 / −15.38 / 28.19. Beyond Los Giles the north-west edge is the border with Arucas, that is, the mainland: the sea is not there by choice. The additional coast extract (`seaCoastBounds`) goes up to −15.58 because the sea window, 2.8 km wide beyond the city, is closed by the coast of Arucas.

| | South Block | The whole municipality |
|---|---:|---:|
| Area | 62.67 km² | 103.88 km² |
| Building parts | 36,321 | 48,308 |
| Zones / sectors | 110 / 1,290 | 164 / 2,041 |
| Barrios with name | 72 | 112 |
| `city-core.json` + `city-terrain.bin` | 6.8 + 6.7 MB | 9.4 + 10.4 MB |
| Heap after collection (`benchmark.mjs`, emulated phone) | 62.5 MB | 77.1 MB |

- Terrain: 1,268 squares out of 2,255 of the rectangle (2,611 × 3,490 cells). As a single grid it would be 18.2 MB per copy.
- LiDAR: 20 tiles on the north-west, 5,775 buildings measured, median LiDAR minus municipal deviation +0.12 m, 90% within 5 m; 209 buildings without municipal height take the measured one, 77 parts of complexes correct.
- The roof atlas now exceeds 178 million pixels which PIL treats as a suspicious image: `sectors.py` raises the limit, because the atlas is our mosaic.
- Guaguas network: 10,098 sections in 579 cells, 117 patterns.
- `typecheck`, `build` (with `check-data`), `node scripts/qa.mjs`: green. `benchmark.mjs`: p95 16.9 ms near and 17.4 ms far.
- Five desktop captures (Tamaraceite, San Lorenzo, Tenoya, Los Giles, Almatriche): continuous connections with the previous area, no holes.

Limits. `public/data/city.json` weighed 94.5 MB, close to GitHub's 100 MB limit: it now publishes as `city.json.gz` (14.1 MB, see below). Throughout the municipality, 3,176 buildings without municipal data or measurements remain at an estimated 9 m: LiDAR tiles are missing west of x = 451 km. Rural areas have soil and roads but little vegetation. No locations or cards in new neighborhoods; `qa-sectors.mjs` remains to be fixed (see above); `heap-profile.mjs` and the passage of `PERFORMANCE.md` not redone; no evidence on physical phone.

## Optimization passage on the entire municipality · 25 November 2026

Heaviest sectors: those of La Isleta remain (up to 316 KB). The new neighborhoods are lighter: median sector 8 KB compared to 19 in the historic city, the heaviest (Tamaraceite center) 216 KB.

`frame-profile.mjs`, emulated phone:

| View | Triangles | Draw calls | Median / p95 |
|---|---:|---:|---:|
| Tamaraceite close view (1.59) | 106,867 | 106 | 16.7 / 16.9 ms |
| Tamaraceite at widest view (0.352) | 204,732 | 195 | 16.7 / 16.8 ms |
| La Isleta up close | 170,706 | 133 | 16.7 / 16.8 ms |
| La Isleta at the widest view | 296,832 | 213 | 16.7 / 16.8 ms |

Drawing is not the limit: no view goes outside 60 fps. Rest memory has grown (from 52.0 to 77.1 MB with expansion). `heap-profile.mjs` shows 14.4 MB of geometry buffers held in JavaScript from the far layer, which did not pass by `gpuOnly()`: the silhouettes of 164 zones (positions and colors, about 10 MB) and the far ground (positions and texture coordinates).

Change: Distant silhouettes leave copy after upload; block outlines remain in typed arrays (1.6 MB), and `forget()` redraws silhouettes upon loss of WebGL context. The distant ground remains: the elevation sampler reads the triangles.

- `benchmark.mjs`: heap after collection from 77.1 to 67.5 MB, p95 16.8 ms near and 17 ms far.
- `heap-profile.mjs` on Schamann: Buffers held from 29.1 to 21.5 MB at close range and from 32.6 to 24.1 MB at widest view.
- Identical camera captures, two per version: differences between before and after of 0–0.13% of pixels, as between two captures of the same version.
- Loss and restoration of context to desktop view with only the far layer on screen: silhouettes redrawn, no errors in console, same difference before/after loss as in the previous version (1.5%, wind and clouds).
- `typecheck`, `build`, `node scripts/qa.mjs`, `qa-recovery`, `qa-boot`: green.

Remaining in memory, in order: terrain 9.9 MB, roads and surfaces of the nucleus approximately 8 MB, footprints of the loaded areas approximately 4 MB, distant soil approximately 4 MB. The land is useful at every altitude; roads and surfaces are among `PERFORMANCE.md`'s unproven ideas.

## City layers in gzip · November 25, 2026

`public/data/city.json` (94.5 MB: ground 41, terrain grid as text 29, buildings 19) becomes `city.json.gz` (14.1 MB). `scripts/city_layers.py` is the only point that decides the format: `write_layers()` to `data.py`, `read_layers()` to `sectors.py`, `lidar-check.py`, `roof-colours.py`, `roof-compare-20cm.py`, `guaguas.py`, `guagua_network.py`, `lab-carriageway.py`, `qa-carriageway-data.py` and `audit-city.py`. The pilot remains `pilot.json` in the clear. The streets lab reads gzip with `DecompressionStream`; if the server has already decoded it (`Content-Encoding: gzip`, like Vite's development server does) it recognizes it from the first two bytes.

- The decompressed gzip is identical byte for byte to the JSON above; gzip without date, so two writes of the same data give the same file.
- `sectors.py` and the guaguas network regenerated by gzip: no published file changes.
- `qa-road-lab.mjs` green on build and development server; `typecheck` and `build` green.
- The two local commits were rewritten before the push, so the 94.5 MB version does not enter the repository history.

### Faster square soil

`data.py` cuts the land into one million 15m squares. First, each square was cut out against the entire contour of the municipality (11,366 vertices): about 20 minutes. Now a prepared test (`shapely.contains`/`intersects`, columnar) discards the outside squares and returns all the inside ones as they are, with the vertices in the order that GEOS would give; only the ones on the edge are cut out. `data.py city` integer goes from 6–20 minutes to 184 s, with `city.json.gz` identical byte for byte (inner squares remain written as decimals, `-1500.0`).

## Daylight, cover edges and contact

A/B comparison in Chrome. The first five tables isolate each intervention. The last one compares the initial build with the three active interventions. Orthographic camera, viewport, resolution and wind time (7 s) coincide between the pairs. The originals also include the test with hemispheric intensity 1.25. [Capture Parameters](screenshots/look-136/catture.json) · [Original PNGs](screenshots/look-136/originals).

| Tavola | Cosa osservare |
|---|---|
| [Santa Ana](screenshots/look-136/torri-prima-dopo.png) | The hemispherical light goes from 1.38 to 1.15. The sun remains at 2.12. The arches can still be seen in the shadowed façade. |
| [La Isleta](screenshots/look-136/tetti-prima-dopo.png) | The parapet uses 75% of the roof color and 25% cream in linear space. The roof retains the available sample; sector and zone share the fallback color. |
| [Vegueta Rooftops](screenshots/look-136/cabina-prima-dopo.png) | The vertices at the base of the cabins are 10% darker in linear space. |
| [Vegueta Balconies](screenshots/look-136/balcone-prima-dopo.png) | In the mobile view, the cutout shows the slight gradation between the attachment and the edge of the wooden balcony. |
| [San Juan – San José](screenshots/look-136/pendio-prima-dopo.png) | The base of the wall receives a slight warm tint by sampling the local terrain elevation. The effect is interpolated onto existing faces. |
| [Driving and Overview](screenshots/look-136/guida-panorama-prima-dopo.png) | Combined effect on the Carretera del Centro and in the wide view. The guide uses the same seed, simulation pace, position and orientation of the car. |

Measurements on Chrome, NVIDIA GeForce RTX 4060 GPU (ANGLE D3D11), emulated mobile viewport 390 × 844. Three paired comparisons, in the order before/after, after/before, before/after. Each sample measures 45 animation intervals to compare the same resolution. On the map, small movements alternate and in driving you advance along the road with the same seed.

| Scenario | Canvas | p90 before, ms | p90 after, ms | Median p90 before → after |
|---|---|---|---|---|
| Santa Ana map | 390 × 844 | 16.7 / 16.9 / 16.8 | 16.8 / 16.8 / 16.8 | 16.8 → 16.8 ms |
| Driving in the pilot | 331 × 717 | 16.8 / 16.9 / 16.9 | 16.8 / 16.8 / 16.7 | 16.9 → 16.8 ms |

In a separate control with fixed camera and content, the 30 frames drawn in La Isleta all have 161 draw calls and 241,207 triangles, in both builds. Driving on the Carretera del Centro, at the same position, orientation and tick, the 30 frames all have 37 draw calls and 82,844 triangles in both builds. The changes use existing lights and color attributes. They remain to be measured on a physical phone.

Checks passed: typecheck, build with data validation, complete browser suite and circuit of six laps of the sectors with driving crossing in both directions. The full suite and final circuit use Playwright's Chromium via `CHROME_PATH`. The sector test now also reproduces water and port obstacles when reconstructing the available starting nodes: the previous discrepancy caused the same assertion to fail even on the initial build.

## Checks after merging the two sessions · November 26, 2026

On commit `7c7dfa91`, which merges the whole municipality with police, light and guaguas of the other session, Chrome desktop on this machine.

- `typecheck`, `build` with data validation and green `npm.cmd test`.
- `qa-sectors.mjs` green: six laps between Santa Ana, Plaza de la Feria, Parque Doramas and Metropole with stable detail memory between 58 and 60 MiB, and crossing while driving in both directions with active patrol. The failure reported in the south and north-west blocks closes.
- `qa-drive-lab.mjs` green (panel, live cursor, police, copy, URL).

`heap-profile.mjs`, also redone in the new areas (JavaScript heap of the page + external memory; worker aside):

| View | Heap | External memory | Detail | Zones | Workers |
|---|---|---|---|---|---|
| Santa Ana, place view | 33.3 MB | 20.6 MB | 57.8 MB, 18 sectors | 26.5 MB, 5 zones | 2.8MB |
| Tamaraceite Center (heaviest sector of the new neighborhoods, 216 KB) | 32.2 MB | 22.3 MB | 57.4 MB, 21 sectors | 31.3 MB, 7 zones | 2.7 MB |
| Tamaraceite, wider view | 32.9 MB | 26.2 MB | none | 68.4 MB, 16 zones | 1.6 MB |
| Marzagán | 29.4 MB | 21.1 MB | 56.0 MB, 23 sectors | 25.8 MB, 7 zones | 2.6 MB |

`benchmark.mjs`: open in 9.7 s, p95 18.1 ms, heap after collection 67.7 MB (67.5 after optimization pass), peak sampled 148 MB. No new neighborhood exceeds the La Isleta sectors (up to 317 KB), already covered in the passage of `PERFORMANCE.md`: nothing to lighten. They remain to be measured on a physical phone.
## Global Dynamic Quality · November 26, 2026

The first moving frame uses the direct path at maximum DPR 1 with contact shadows. The calibration tests a projection of the official footprints in the direction of the sun. Subsequent moving promotions enable FXAA and DPR up to 1.25. In the guide and on the map the thresholds are identical. The comparisons use the previous build and levels set in the lab to also show effects that the test device would have automatically excluded.

| Emulated mobile profile, 390 px wide canvas | Pan, Average FPS | Pan, p95 ms | Guide, Average FPS | Guide, p95 ms |
|---|---:|---:|---:|---:|
| Build precedente | 56,5 | 18,3 | 49,0 | 18,3 |
| Basic startup in new build | 55.7 | 18.1 | 43.2 | 18.1 |
| Static shadows | 55.5 | 18.1 | 44.9 | 18.3 |
| Static shadows with FXAA | 55.8 | 18.1 | 46.1 | 18.4 |

Measurements collect 120 RAF intervals per sequence in Chrome on PC with a 390×844 touch viewport. Average driving FPS suffers from spikes during launch and streaming. A single run per profile does not allow differences in mean to be attributed to the effect. All levels in the table have DPR 1. The automatic tests of the three shots started on base and maintained it. A separate test with a stable synthetic cadence at 60 Hz in the real rendering cycle enabled and maintained still-map shadows.

On the desktop the comparison at 1440 × 900 between direct native AA and zero sample target render with final copy gave p95 of 18.1 ms in both cases, in panning and driving. The desktop therefore retains native AA. Consumption, heat and sustained performance on the physical phone remain to be measured.

Comparisons with the same camera and scale: [square and cathedral](screenshots/qualita-dinamica/plaza.webp), [narrow street](screenshots/qualita-dinamica/calle.webp), [sector boundary](screenshots/qualita-dinamica/sectores.webp). Each image pairs previous builds, static silhouettes, and silhouettes with FXAA. The projection follows the volumes obtained from the available footprints and heights and affects the terrain and roadways.

To repeat the measurements use `node scripts/qa-quality-views.mjs dist static`, replacing the profile with `base`, `fxaa` or `auto`. For the previous build pass its directory and `before`. The controlled cadence promotion test is `node scripts/qa-quality-idle.mjs dist`.
Passed typecheck, build, controller tests, browser calibration, level comparisons and camera tests. The general suite crashed when opening a Chromium page, with less than 1 GiB of free physical RAM. Its overall outcome remains to be verified.

### Verification of centralization

In Chromium the GPU texture counter goes from 0 to 2 by activating FXAA and returns to 0 by deactivating it, for two consecutive cycles. The simulated 60 Hz test checks the first moving frame with DPR 1, then the static shadows with antialiasing still off. The three views emulate a 390×844 screen and control the memory ceiling of shadow textures (12 MiB in the compact profile, 24 MiB in the standard profile). The cap affects mask textures and does not measure total browser memory. The controller simulation also covers rollback after six seconds if a mask remains in preparation.
The build, typecheck, and general suite (`npm test`) moved to Chromium, including emulated desktop and mobile sessions and WebGL context fetching in help.

### Idle Cadence at 30 and 60 FPS

`node scripts/qa-quality-idle.mjs dist 30` and the same test with `60` verify in Chromium the first frame at DPR 1 and the static shadows after the initial calibration. The watches are synthetic. Normal environmental animation with a still view is excluded from the measurement.

`node scripts/qa-dynamic-quality.mjs` checks for a smooth 30 FPS, alternating intervals from around 17 and 50 ms, dropping from 60 to 30 during movement, returning to 60 FPS after easing, and canceling an overpriced promotion. The observed regularity allows you to choose an operational objective. The physical cause of the limitation and power consumption require on-device measurements.

### Extracting the Reusable Controller

The city test compares the exact indices of the frames where the controller changes levels with a trace collected before extraction. The sequence includes calibration, rest, loading, smooth movement, and slowing down. Ten transitions coincide on the compact profile and four on the desktop. The copied folder alone in a temporary directory passes three tests with Node 24, using a particle profile and no dependencies installed. To repeat the test run `node --test adaptive-quality.test.mjs` from the copy.

## Piper

In three synthetic scenarios, the simulation reproduced 9.28 s of stopping in front of a 14 m out-of-cover swath, an elevation change from 582 to 460 m over a cliff, and a 110 m high façade between the Piper and the chamber. The regressions test for movement along the boundary, constant altitude in level flight, and line of sight to the tail. A fourth test measures the rise of the chamber during the dive and the return to the vertical cruising distance when the control is released.

Test in Chrome starting from the same road, identical bow and 0.4 m difference in altitude. Swooping in, the new view includes the roundabout and rooftops along the way. [Before](screenshots/piper-dive-before.png) · [After](screenshots/piper-dive-after.png).


Trail simulation tests at 30 and 120 FPS for level flight, turn length at 32 m/s, pause, power off and restart without connection to the previous trajectory. [Touch Turn at 390×844](screenshots/piper-turn.png).

`node scripts/qa-flight-simulation.mjs` tests at 60 Hz the take-off and return over buildings, a single-wing strike, the descent onto land and sea, the turn along an irregular border and the release of the keyboard and touch.

`node scripts/qa-flight.mjs` uses Chrome on the build. On the pilot check takeoff from standstill, turn, WebGL loss and recovery, return, new takeoff, accident and new game. On the sectored city, check the turn with a finger at 390x844, the horizontal passage and the return to the road. [Pilot View](screenshots/piper-pilot.png) · [Vertical City View](screenshots/piper-city.png).

In the coastal test the Piper went from (186.5; −1011) to (346.8; −1011), crossing the edge of a 240 m sector. The return command started at 40.1 m above sea level, above a `sea.json` sea range. The car resumed on Avenida Marítima 0.92 m from a network node. The stopwatch advanced from 0:06 to 0:10 while conserving the coins.
Passed simulated 30 and 60 Hz Chromium typecheck, build and calibrations. The full suite ran on an isolated build with 120 second navigation timeout. Two previous runs had stopped during HTTP navigation and on checking the scene color at the end of the guide, respectively.

### Controller decisions and WebGL buffers

The portable test checks event order, target and p95 slowdown, input interruption, loading and expiration during preparation. The city test tests the transition between screens at DPR 1 and 2, in both directions. The lab's browser test compares the panel with `drawingBufferWidth` and `drawingBufferHeight` of the WebGL context and changes the DPR while leaving the CSS viewport the same.

The controller review covers four regressions with deterministic tests: a single callback to reset during a test, calibration consistent with the maximum allowed, distinct reason for the neutral FPS band, and discarding timestamps out of order. The city comparison continues to check the frames of the 14 reference transitions.

## Piper flight at 1080p

Chromium on an RTX 4060, 60 Hz, full city, same starting road, heading and scripted inputs. Each production build flew twice in the same WebGL session. The table compares the second pass against commit `28a99def`. Both used a 1920 x 1080 drawing buffer with native antialiasing. The flight profile was at its base level on this pass.

| Segment | Draw calls per frame, before / after | Triangles per frame, before / after | p95 frame time, before / after |
|---|---:|---:|---:|
| Cruise | 404 / 128 | 1,709,580 / 638,249 | 16.8 / 16.9 ms |
| Turn | 710 / 152 | 2,584,314 / 771,369 | 16.8 / 16.9 ms |
| Dive | 680 / 166 | 2,249,632 / 792,192 | 16.8 / 16.9 ms |

On the baseline, disabling solar shadows alone gave 330 calls and 1.30 million triangles in cruise. Halving each buffer dimension kept the baseline geometry cost around 1.69 million triangles. Median frame time was 16.7 ms in each case. First takeoff still had an isolated 783 ms frame (983 ms before). The integrated GPU target of 30 FPS requires a measurement on that device.

Reproduce with `node scripts/benchmark-flight.mjs dist`. Use `--half-resolution` for the resolution comparison and `--shots=directory` to save the view after each dive.

With the real browser render loop fed synthetic 18 FPS timestamps, flight reached level -2 and the canvas measured 1344 x 756. Landing restored the previous ground level and the 1920 x 1080 canvas.
