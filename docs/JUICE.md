# Game feel of the guide

What responds to what in the «Conducir» mode, with what values and with what limits. It should be read before adding or tweaking an effect. Modeled after Butter Run's `doc/JUICE.md` and Smash Royale's juice rules, keeping only what is needed for an arcade guide seen from above.

The values ​​are those of `TUNE` in `src/drive/drive-tune.ts` as of November 25, 2026; they are tested live in the `index.html?lab=drive&area=pilot` laboratory. If they change in the code, the code applies and this file must be updated. For the interface see [UI_ANTI_SLOP.md](UI_ANTI_SLOP.md), for the shot [CAMERA_FRAMING.md](CAMERA_FRAMING.md).

## Rules

1. **Effects are presentation.** No effects change collisions, paths, or scores. The only exception is the hit-stop, which stops the game time for everyone equally.
2. **One event, one recognizable response.** Each event has its own combination of signals and does not share it with another. Two signals that say the same thing are noise: one is removed.
3. **Force follows the event.** Crawling along a wall produces almost nothing, a head-on collision produces everything. The capture is the strongest event of the game and nothing else rivals it.
4. **Never twice in a row.** Hit-stop effects have a minimum interval. The continuous ones (dust, marks) have none.
5. **No case in the chamber.** The chamber only moves in a direction that has meaning. The random flickering has been removed.
6. **Same behavior on every device.** Effects do not turn off or dim based on system motion preferences (`AGENTS.md` rule). This is why they must remain small and short for everyone.
7. **Turns itself off.** Game effects return to sleep in less than half a second. The final sequence keeps the scene in black and white until the retry or return to the map.

## Catalogue

| Event | Simulation | Room | Cars and scene | Interface | Vibration |
|---|---|---|---|---|---|
| Collected coin | – | – | The coin is attracted within 6 m | «+1» rising from the point, coin pill pulsing | 8 ms |
| Acceleration | 90 km/h in 4.58 s, then up to 116 km/h in a straight line | Slow zoom with speed | Muzzle rising up to 6° | – | – |
| Steering and drifting | Response from 35% to full in 140 ms | Slow zoom with speed | Shoots up to 28° inwards, puff on trigger, two tracks during the slide | Touch zone on | – |
| Braking | 27 m/s², priority brake grip | – | Nose that lowers up to 8°, skid effects if it skids | Both zones on | – |
| Side swipe against a facade | The speed along the wall loses 12% of the incoming speed | – | Up to three short sparks from player contact | – | – |
| Light impact (over 3 m/s) | – | – | Car hopping | – | – |
| Medium shock (over 6 m/s) | – | Push towards the wall, in proportion | Hop | – | 18 ms |
| Strong impact (over 11 m/s) | Freeze 110 ms | Pushed towards the wall | Hop | – | 18 ms |
| Thrust of a patrol (over 6 m/s) | – | Push towards the patrol, at 70% | – | – | – |
| Crash of a patrol | – | Thrust towards the wreckage within 40 m, weaker from afar | Dark wreck spinning, smoke for 3 s | «+2» with impact icon | – |
| Pedestrian near an oncoming vehicle | – | – | The pedestrian dashes sideways at 6.2 m/s for 0.9 s, hopping; if a wall leaves no room, jump over the car | – | – |
| Arrival at destination | Freeze 100 ms | – | Crown of dust, new beam of light | «+10» large; the drop of the new goal flies from the car to its place in 0.45 s | 40 ms |
| Shot (button, Space or F, every 3 s) | – | Light shake (0.25) | Fat yellow slug, level 1.1 m above the road along the car, 55 m/s up to 120 m, smoke trail every 4 m, puff at the muzzle, small hop | The ring inside the button fills in 3 s, icon dimmed meanwhile | – |
| Shot into a building | Freeze 80 ms (not within the gap of another) | Push towards the impact, strong shake (1.2) | The building breaks into 2.5D pieces from the impact (demolition lab), dust, rubble slab; rebuilt after 20 s out of view, once its pieces have sunk | – | 30 ms |
| Shot into a patrol | – | As a patrol crash, plus shake (0.6) | Wrecked as in a crash, thrown 9 m/s along the shot and 10 m/s up, rolls over, one bounce, stops at walls | «+2» with impact icon | – |
| Shot into a monument | – | Push towards it, at 30%, shake (0.4) | The slug stops in a cloud of dust: a monument is its own model and stays standing | – | – |
| Shot into a guagua | – | Push towards it, at 50%, shake (0.8) | Thrown 5 m/s along the shot and 7 m/s up, rolls, lies 3 s as an obstacle, sinks in 1 s; its run does not come back | – | – |
| Capture | Stopped for 220 ms, then end of game | Full push towards the patrol; after the shutdown, slow approach of 14% | Powder on release | Panel after another 420 ms, record that pulsates if broken | 140 ms |

## Steering and drifting

- Player and patrols drive the same model (`steerCar`): the nose turns with the steering and the direction of travel follows it, so a drift changes direction almost without costing speed. Thrust is 8.2 m/s² up to half base speed and 4.1 m/s² beyond. The base speed is 90 km/h for the player and 94 for the patrols; on a straight line the tip rises slowly up to 116 and 120 km/h and returns to the base by steering or braking.
- The player slides up to 60° and, after a long slide, regains the lost speed upon release; the patrols slide up to 20° and have no reward. The patrols also brake before the walls, with a check from 4 m up to the stopping distance plus the radius of the car, approximately 13.8 m at 94 km/h.
- For capture, the threshold of 4.5 m/s applies. For coins the recall radius is 6 m and the traction is 25 m/s.
- The slope along the route slows down the uphill recovery and helps it downhill. It is neutral up to 2%, then applies 0.06 m/s² for each additional percentage point up to 0.6 m/s². The same correction helps the braking uphill and reduces it downhill. The forward limits remain 90 and 94 km/h.
- At each change of side the ramp starts again from 35%. Upon release, the weight of the slide drops by 10 per second and the lateral grip coefficient tends to 9.5 s⁻¹. Braking uses its own coefficient of 2.2 s⁻¹.
- The pose updates at 120 Hz. The steering response increases between 2 and 10 m/s. At full steering the additional rotation ranges from 10.5° to 21° and the roll from 14° to 28°, depending on the slip. When amplifying the slip, the additional rotation brings the nose up to 45° from the direction of travel.
- The wheels follow the orientation and height of the car. The body alone tilts. The variation in speed before the impacts determines the longitudinal inclination, which returns to neutral during cruising. Damping covers 90% of the path in 85 ms upon entry, 170 ms upon release, and 40 ms during pose reversal; in the code only one value, `poseRelease`, from which the other two derive. On sloping roads the entire car takes the inclination of the road along the nose, up to 22°, and the player's body leans another 50% (`slopeLean`).
- Three warm white particles appear behind the wheels for 220 ms when lateral slip exceeds 2.5 m/s during a non-contact maneuver. The puff rearms below 1.5 m/s. The two traces start at 4 m/s. Silhouette, arrow, tracks and puffs follow the visual orientation. Camera and collisions use simulation.
- The cars contact shadow is a 4.15 × 2.5 m rectangle with opacity 0.38. Rotates with the car and stays on the ground during rolls and hops.

Slope sampling uses the 6m back and 6m front terrain grid. It follows the running speed and uses the nose below 2 m/s. The filter has a time constant of 180 ms. Within 11 m of OSM alignments marked as a bridge or at another level, the correction returns to zero because the ground elevation may differ from that of the roadway. Patrols use the same correction to calculate how far away to start braking.

## Surfaces

One fact, more consistent indicators: off the asphalt the car slows down and slides more, and you can see it without texts.

- **Tracks**: on the asphalt only when skidding, black; on the lawn, on the earth and on the sand always in movement (opacity 0.3–0.35, 0.5–0.55 in drift), wider and of the color of the ground; none on the flooring.
- **Debris**: from the rear wheels, over 4 m/s, one piece for every 0.6 m traveled (half for patrols): green and brown clods on the lawn, a low cloud on the ground, clear spray on the sand, sideways in a skid. Drifting off-road launches a barrage of terrain instead of white smoke.
- **Tremoration**: altitude, roll and pitch of the body, from a noise that depends on the meters traveled (stationary with the car, the same on each device), full from 10 m/s; width per surface (`rumble`: pavement 0.25, lawn 1, earth 0.8, sand 0.6).
- **Drift smoke**: on asphalt and pavement, in addition to the initial burst, a puff every 0.05 s from one rear wheel and then from the other until the car slides.
- **Slide bonus**: The returned speed comes in 0.2 s, not in one step: previously a release could give +20–26 km/h in one frame, and it felt like a jerk.
- **Curb**: leaving or returning to the road over 5 m/s, a 2 cm bounce per m/s (maximum 35 cm) and a 12 ms vibration on the phone.

## Crawled against a facade
- When the component towards the wall is worth at most half of the component along the wall, the contact cancels the first and reduces the second by 12% of what was cancelled. The nose realigns towards the tangent and the vehicle can continue along the face.
- From 5 m/s along the wall, player contact can produce three 160 ms sparks, with at least 75 ms between separate emissions. The swipe excludes skip, vibration, camera shot and hit-stop. For more direct impacts, the edge of the map, trees and other cars, the usual crash response is used.

## Hit-stop

For some frames the simulation does not advance: cars, patrols, coins and stopwatch remain stationary. Dust, hopping, camera and interface continue, so the screen doesn't seem frozen.

The player's hop reaches up to 0.9 m and returns in approximately 0.41 s to maximum height. A second, weaker impact ends the current hop. The shadow remains on the ground.

- **Events:** strong impact against a wall or a tree, arrival at destination, capture. The crash of a patrol does not use it (Luca's choice, November 22, 2026).
- **Durations:** `hitStop` 0.11 s for the impact; the arrival uses 0.1 s and the capture 0.22 s, derived from the same value. At 60 frames per second it is approximately 7, 6 and 13 frames. Doubled at Luca's request on November 23, 2026: at half they were not noticeable on the phone.
- **Crash threshold:** `hardImpact` 11 m/s speed in the direction of the obstacle; the same threshold destroys a patrol. The crawls in the narrow streets remain below.
- **Minimum interval:** `stopGap` 0.6 s between two impact stops. Arrival and capture have no interval because they cannot be repeated.
- **Overlapping stops:** the longest counts, they do not add.
- **Upon capture** contact freezes score and clock. After 110 ms, camera, dust, pedestrians and wind slow to 30%. Cars and patrol settle for a second with residual inertia, limited by obstacles and available surface.
- Saturation drops to zero in 850ms with a CSS filter on the scene and its background. «ATRAPADO» and the three values ​​appear after 300 ms of slow motion. The icon buttons appear after 600 ms. The outcome time advances while the tab is visible and WebGL context is available. Inertia and chamber use limited delta to avoid jumps.
- Stopped time does not count in the stopwatch. After the stop, the simulation restarts from where it was, without recovering the skipped steps.

## Camera shot
## Camera kick
The camera shoots **towards what it hit** and returns to rest with a dampened spring. A bumped wall pulls her towards the wall, a pushing patrol pulls her towards the patrol. It says which way the shot came, which the previous tremor didn't do.

- **Force:** proportional to the impact speed, full at 14 m/s. `kick` 36 is the launch speed of a full shot.
- **Spring:** `kickStiff` 220; the damping results with a ratio of 0.74 (22 at this stiffness). It barely exceeds zero on the way back, only once.
- **Measurements:** a full shot moves the view a maximum of 0.99 m and returns below 3 cm in 0.28 s; a half-force shot reaches 0.49 m. On phone (6.3 px per meter) it's about 6 and 3 pixels. At 20 frames per second the peak is 0.93 m.
- **Limit:** `kickMax` 1.2 m, even with multiple shots at the same time.
- The direction of hitting walls comes from physics (`hitX`, `hitY` in `src/drive/drive-physics.ts`), not from the speed of the car.
- The spring only moves the chamber target. It does not affect the zoom or the advance along the gear.

## Pedestrians

Simple figures without legs, a colored body and a head, which move in hops: they stretch when climbing and are crushed when landing. I am atmosphere: no points, no penalties, no signals in the interface (Luca's choice, November 22, 2026). They only appear in the guide.

- **Where:** at the edges of driveways, on the pedestrian streets of OSM and along internal ropes in squares and parks. They don't cross. There are 40 on desktop and 26 on phone, recycled between 42 and 82 m from the car, preferably in front of the direction of travel.
- **Escape:** an approaching vehicle alerts them within 6 m plus 0.6 m for every m/s of speed (approximately 16 m at maximum speed). They run away to the side of the trajectory, from the player as well as from the patrols.
- **Never hit:** in each frame a pedestrian within 2.3 m of the center of a vehicle is moved out; if a wall prevents it, it remains in the air until the vehicle has passed. `node scripts/qa-pedestrians.mjs` verifies it.
- During a hit-stop they remain still like the rest of the simulation. They walk before departure and continue in slow motion after capture.
- Values ​​are in `PEDESTRIANS` in `src/drive/pedestrians.ts`.
- I valori sono in `PEDESTRIANS` in `src/drive/pedestrians.ts`.

## Don't do it

- Reset the random tremor, even a small one, or add it to the thrust. Exception, asked by Luca on 26 November 2026: the gun shakes the screen as the demolition lab does (shot, building, patrol, guagua; catalogue above), only for its own events.
- Use hit-stop for coins or every contact - it becomes a continuous stutter and feels like a performance hit.
- Stretch a stop beyond 0.12 s. Beyond that threshold the game is read as blocked.
- Slow motion, full-screen flashes, colored edges, aberrations or blurring. The first two would change the character of the model, the others require a post-processing step that the project does not have.
- Linking the zoom to an instant event: the room contract prohibits it.
- Add an effect without a line in the catalog above.

## Not decided

- **Audio.** The guide is silent by choice (Luca, 21 and 22 November 2026). If it reopens, the proposal is effects synthesized with Web Audio, without files, started only after the first touch and with an icon command to silence.
- **Hit-stop to patrol crash.** Ruled out for now. With many patrols he could sprint often; if it is attempted, it should be limited to crashes close together and with the same minimum interval as the impacts.
- **Sensation on physical phone.** Durations and amplitudes are calibrated on desktop Chrome and on the emulated mobile profile. Vibration and stops must be tested in your hand.

## Check

- `npm.cmd test` checks that the capture produces at least one stop and that the chamber thrust returns to zero. The two values ​​are the eleventh and twelfth fields of `data-drive` on `#scene`: number of stops since entry into the guide and current movement of the camera in meters.
- After changing the spring, recalculate peak and retraction time and update the measurements in this file.
- Try a narrow street by hand: crawling along the walls must never trigger a stop.
## Transformation and plane crash

During assisted take-off the opening of the wings accompanies the climb. On the way back they close again in the last metres. Upon impact the plane disappears in an orange flash with rising smoke and falling fragments. Summary uses the same times as street capture.

### Piper attitude and trails

- At takeoff the propeller goes from 18% to cruising speed in half a second. The nose raises up to 11° and realigns in 1.45 s. During assisted descent the nose pulls back up to 7.4° and the propeller loses revolutions as the wings close.
- Above 23° of inclination two thin trails appear that follow the positions crossed by the wingtips. They reach maximum intensity at 40°. Eight samples at 30 Hz preserve about a quarter of a second of trajectory. In level flight the opacity returns to zero in less than half a second.
- Upon impact the metal fragments have an initial forward component of 16 m/s, which ends within 4 m along the route. Smoke continues to rise from the point of impact.
- On impact, metal fragments receive an initial forward velocity of 16 m/s, which dissipates within 4 m along the route. Smoke continues to rise from the impact point.
