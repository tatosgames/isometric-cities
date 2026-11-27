# Local Verification · November 21, 2026

## Matcap without a texture · November 27, 2026

Reported by Luca: on a Google Pixel 3 (Adreno 630) the map is black, while `?look=base` and an older phone show it fine. On phones `base` and `matcap` differ only in the matcap patch, which multiplied every lit surface by a 128 px sRGB `CanvasTexture`. Black (not the page beige under the transparent canvas) means the shader ran and computed black: some Android drivers sample a canvas uploaded as an sRGB texture as black. The matcap is now computed once per pixel in the shader from the preset uniforms (same bands, rim and sRGB decode as the painted texture): no canvas, no sRGB upload, no sampler, about the cost of one texture read. The texture's bilinear filter no longer softens the band edges, so a thin line along them changes slightly. Two safety nets, since black raises no error: at start the look draws a white square once into a 4 × 4 target and reads it back (`probe`, under 1 ms); if it is black, or if any shader fails to compile (`renderer.debug.onShaderError`, full log in the console), the page reloads with `?look=base` and logs `[atlas:gl] matcap look failed`. An explicit `?look=` in the URL is never overridden, so `?look=matcap` forces the look for debugging and no reload can loop. Not reproduced here (no Adreno): to be confirmed on the Pixel 3.

Map at the same camera (`shot.mjs 0,0,1.6`), old build twice and new build once, on the pixels where the two old shots agree (93% of the frame; the rest is sea, wind and cloud shadows): desktop 1440 × 900 at 2× largest difference 3/255, 0.018% over 2/255, none over 5/255; mobile 390 × 844 at 2× 1.06% over 2/255 and 0.145% over 5/255, on the band edges. Fallbacks, with throwaway builds: a matcap forced to black reloads once to `?look=base` with the probe message; a fragment shader with a syntax error does the same with the shader log; with `?look=matcap` both log and stay. Typecheck, build and the full `npm test` (exit 0) passed.

## Flood lab: critical buildings take the view to them · November 27, 2026

Requested by Luca: a building in the report's list is a button. The view glides to it and zooms in to at least 3, and its marker grows 2.2×. `qa-flood.mjs` clicks the first entry and checks that the view moved more than 20 m and zoomed in (frame `flood-critical-building.png`: the Rectorado of the ULPGC with water at its façade, its marker red).

**How a facility finds its building.** OSM gives a point and tags (`amenity=school`, `hospital`…, with a name). The flood grid knows which building covers each 5 m cell. The point takes the building under it, or the nearest one within 12 m when the point sits at an entrance or in a courtyard. A point with no building within 12 m is left out: 65 of the 383 facilities match in the Guiniguada grid.

## Flood lab: lighter upload, simpler report · November 27, 2026

**Lighter.**
- The water state goes to the GPU in half floats, with the surface above a ground texture uploaded once: 2.1 MB a frame instead of 4.3 MB.
- The worker's buffer becomes the texture's data without a copy on the main thread.
- The water mesh draws only the rows the water spans. In a narrow synthetic valley that is rows 209–243 of 452.
- Packing in the worker stays about 1 ms (0.8 ms before, plus the half-float conversion).

**Fewer ties outside the module.** `qa-demolition.mjs` and `qa-drive-lab.mjs` no longer count the labs, and `src/lab/main.ts` finds the labs by id instead of by position.

**Simpler report.**
- Four figures instead of six; a one-line subtitle.
- Shorter legends; the gauge hint left the panel.
- A seven-row method with the sources in one line each.
- Shorter control names; a two-line solver readout in place of five lines that repeated the report.

`qa-flood-solver.mjs`, `qa-flood.mjs` and `qa-drive-lab.mjs` passed, and so did typecheck and build. Frame at 1440 × 900 checked by eye.

## Flood lab: return periods, gauges, critical buildings · November 27, 2026

Luca asked for return periods, more data, a hydrograph, critical buildings that get damaged or collapse, a more professional look that stays light, and a module easy to take out.

**Return periods.** The Guiniguada has no official discharge: it is not an ARPSI (EPRI, 3rd cycle, 2025). The lab now takes the design floods from Norma 5.2-IC with the sources of Gran Canaria (see [FLOOD.md](FLOOD.md#return-periods)): T10 156, T100 281 and T500 367 m³/s, peaking 4.1 h in. The observed 1954 rain gives 273 m³/s. `qa-flood-solver.mjs` checks the method by hand values (tc 6.09 h, Kt 1.406, KA 0.879) and the Clausen & Clark states.

**Critical buildings.** 383 facilities came from OSM via Overpass (`scripts/flood_facilities.py`); 65 match a building in the Guiniguada grid.

**Browser runs, 1440 × 900, software WebGL:**
- **T500 at its peak (3 h 11 min):** 45.3 ha under water, 57 buildings collapsed and 44 damaged, 6 critical buildings reached, 7.4% of the built value lost.
- **T100:** 32 collapsed and 42 damaged.
- **Close-up of the channel's east bank at T100:** the ruins and dust of the collapsed buildings, and the red marker of a damaged school.
- **Solver:** ×61 real time at the widest; balance under 10⁻⁸.

`qa-flood.mjs` now also checks:
- the T100 peak, the panel title and the history for the charts;
- the first gauge (wet at the barranco);
- more than 20 critical buildings matched and at least one reached.

The cloudburst runs at T500 (61 mm/h). Typecheck and build passed.

## Flood lab: water look · November 27, 2026

Luca could not see the water on the published lab. Muddy brown over the sandy ground, it read as earth. It is now turquoise to blue, with:
- foam at the edge and along fast currents;
- streaks that move with the flow;
- ripples and a sun glint.

The defaults are more dramatic: a 500 m³/s peak at 15 min, ×90 speed, and the view on the lower course. Cell speeds are held to the faces' Froude number: the fastest cell read 34 m/s beside a DEM step, and now reads 7 m/s. Checked on frames of the lower course and of the mouth at zoom 3, where the streets of Triana fill and the water parts around the blocks. `qa-flood-solver.mjs` and `qa-flood.mjs` passed again.

Second pass, after Luca asked for opaque, low-poly water (to save work) with acceptable physics and the technical parameters in view. The water is now opaque, with no blending. A vertex swell tilts the 5 m triangles, drawn one normal per triangle; there is a white rim and crisp whitecaps on fast currents. The panel gains the scheme's θ, Courant number and Froude limit, and the readout gains Δt, the highest Froude number and the cells computed. Checked at zoom 3 on the mouth.

Third pass (Luca): from afar the white glints and whitecaps made the water look dotted. Both are removed. The water now takes the sea's palette, gentle facets, a slow swell of tone and soft foam at the edge only. Checked at zoom 1.4 over Triana.

## Flood lab · November 27, 2026

`scripts/qa-flood-solver.mjs` (Node, now first in `npm test`):
- **Lake at rest** over a bed of 1 m steps with a building in it: no face moves (|q| < 10⁻⁹ m²/s after 2,000 steps) and the volume holds.
- **Dam break in a closed basin:** the volume holds to 10⁻⁹ and the surface settles within 2 cm of the mean.
- **Valley ending in the sea**, with hydrograph, rain and a building: more than half the water reaches the sea, the balance closes to 10⁻⁶, and the volume that entered matches the hydrograph's integral within 2%.
- **Published curves:** JRC 1 m → 40%, 2.5 m → 67.5%; FD2320 classes; scan-line fill of a footprint with a hole.

`scripts/qa-flood.mjs` (browser, 1280 × 800, software WebGL), Guiniguada scenario after 93 simulated minutes at the default 250 m³/s:
- 42.9 ha reached, 32.4 ha under more than 5 cm of water, deepest 6.8 m.
- 273k of 658k m³ reached the sea; balance −6·10⁻¹⁴.
- 478 of 9,178 buildings had more than 10 cm of water at their walls; 6.8% of the built value lost on the JRC curve.

The hazard view draws, and the cloudburst over Triana (80 mm/h for 1 h) wets more than 1 ha with the balance closed. Screenshots: `flood-guiniguada-depth.png`, `flood-guiniguada-hazard.png`, `flood-rain.png`, kept out of Git. No page or console errors.

The water follows the covered barranco under the GC-110, spreads at the mouth between the Teatro Pérez Galdós and the Mercado de Vegueta, then runs along the seafront and into Triana's streets towards San Telmo.

Before the Froude limiter, the fastest cell read 245 m/s on the DEM's 1 m steps; after it, under 12 m/s. Typecheck and build passed. `qa-drive-lab.mjs` passed; its catalog now lists five labs, as does `qa-demolition.mjs`'s. `qa-demolition.mjs` times out in this container (software WebGL): the debris are still there after 20 s. It times out at the same step on the code before this change. [Model, sources and limits](FLOOD.md).

## Gun in the demolition lab · November 26, 2026

`lab.html?lab=demolizione&strumento=sparo` (key 3): the drive's slug and blast, from `drive-weapon.ts` and `TUNE.weapon`, now including the blast values that were written into `drive.ts` (`blast` 22 m/s, `blastReach` 12 m, `push` 18 m/s, shared through `shotBlast`). Without a car, the slug leaves the road 25 m before the point clicked on the viewer's side (`Fired from`, `distanza=` in the URL), stepping further out while that point is inside a footprint, and flies level 1.1 m above the ground to the first wall in reach. The panel's Gun folder edits cooldown, slug speed, range and the three blast values. `scripts/qa-demolition.mjs` now also fires once at the building nearest the centre: a second click during the cooldown fires nothing, and a building comes down (frame `demolition-gun.png`, kept out of Git). Typecheck, build, `qa-demolition.mjs`, `qa-drive-fire.mjs` and the full `npm test` (exit 0) passed.

## Gun in the drive · November 26, 2026

**Fix: neighbours vanishing on a hit.** Reported by Luca: a hit sometimes made similar blocks disappear while only the struck one broke. Two causes. A municipal building split in volumes keeps one id for all of them (48 ids in the pilot area, up to 5 volumes): hiding the id took every volume away while only the struck one was fractured. On small screens, dense sectors draw up to 4 similar neighbours fused into one block under the first one's id: a hit took the whole block away, or nothing when the struck building was not the first. Now what comes down is what the city draws as one: every volume of the id, or the fused block (`partsOf` in the sector stream and in `main.ts`); every part breaks, and the drive world takes out the real buildings under it (`removeUnder`). The demolition lab registered only the first volume of each id and now holds all of them. `qa-drive-fire.mjs` checks both cases in Node (a 3-volume building comes down whole and no neighbour loses its walls; a fused box takes down the buildings inside it) and, in the browser, that a shot brings down as many volumes as the building has; a 2-volume building at 48 m was checked by eye.

**Fix: slugs passing through buildings.** The target is found once, when the gun fires, along the ray of the shot. That ray read the grid every 10 m and could skip a 20 m cell crossed at a corner; it also kept the height of the start, so on a street climbing towards a building the walls stood above it and were missed; and monuments, drawn by their own models, were "demolished" without anything leaving the screen. Now a level ray meets any wall it crosses in plan, the cells are read every 2 m, and a monument stops the slug in a cloud of dust. `qa-drive-fire.mjs` fires level rays from 40 m below the base of the pilot's tall buildings: every one stops on a wall within 30 m. Space fires as F does (Luca's request) and no longer brakes; the down arrow and both sides still brake.

`scripts/qa-drive-fire.mjs` (now part of `npm test`). In Node, on the pilot world: the ray from the map camera meets 38 of 40 tall roofs aimed at (the other two are behind a taller neighbour); a removed building no longer stops the ray and comes back with `restoreBuilding`; slug-against-car and slug-against-turned-bus geometry; a thrown body lands flat in 1.67 s. In the browser, driving lab on the pilot area, 1280 × 800: F before the run starts does nothing; F fires straight ahead (here into the building in front of the start); after a shot the cooldown reads 2.89 s, the button carries `cooling` and `aria-disabled`; a second F 0.6 s later does not restart it; the ring stands at 28% and empties of the class within 3 s; a shot towards the nearest tall building (35 m) brings it down into pieces. No console errors. At 390 × 844 the button sits at the bottom centre on the same line as the two steering zones (centres at the same height), clear of the top buttons and of the car.

By hand, in the same lab (frames in the session's scratch folder, not kept): a patrol 27 m away is wrecked (+2), thrown and turned over; one 66 m away had moved by the time the slug arrived (a miss, as intended). A guagua of line 13 at 17 m is thrown, rolls and lies on the road. A demolished building is rebuilt once out of view and its pieces have sunk, in the pilot area (positions written back) and in the streamed city (Triana: the sector is rebuilt from its file, the building stands again on the way back).

Typecheck, build, full `npm test` (exit 0), `qa-demolition.mjs`, `qa-drive-lab.mjs` and `qa-drive-chase.mjs` passed. Memory: [measures](PERFORMANCE.md#demolition-lab). A cleanup pass (four reviewers: reuse, simplification, efficiency, depth) gave the drive world a single set of fallen buildings, a shared shake, a CSS-driven ring and shorter gun code; `qa-drive-fire.mjs`, the streamed rebuild, a patrol at 18 m and a guagua at 17 m were checked again. After Luca's review: the slug flies level along the car (it used to aim down at the screen centre and hit the ground), slower and bigger, with a smoke trail and the lab's screen shake. Not measured: frame time of the drive with tracking on (`frame-profile.mjs`).

## Demolition lab · November 26, 2026

`lab.html?lab=demolizione`, desktop test viewport 1280 × 800, software WebGL. `scripts/qa-demolition.mjs`: the catalog lists four labs; dynamite clicked on the building nearest the centre brings it down within the fuse (≥ 5 pieces). Picking at the same point then finds another building, so the building has left the sector meshes. The pieces settle, sink and their meshes are gone within 20 s, and the rubble slab stays. A fast mouse sweep of the wrecking ball across the next building breaks it (5 buildings along one sweep at ball height 6 m). No page or console errors. Close-up frames at 60, 250, 500, 900 and 2,200 ms show shards flying out of the side that was hit, dust, then a pile on the footprint. One burst is one draw call; a mid-rise block breaks into 40–110 pieces.

Optimisation pass (same day): `qa-demolition.mjs` passed again and close-up frames show the same blast. Worst frames and per-frame cost: [measures](PERFORMANCE.md#demolition-lab). Hidden buildings now have one owner, the stream: zones and sectors loaded later leave them out of their data, so the lab no longer filters zones itself.

Building tracking is asked for only by this lab (`trackBuildings`): the map and the drive build their sectors as before and keep releasing positions after upload. Typecheck, build, full `npm test` (exit 0) and `qa-drive-lab.mjs` passed. A first `npm test` run failed in `qa-map-camera.mjs` with `ERR_HTTP_RESPONSE_CODE_FAILURE` because `dist` was rebuilt while the suite was serving it; the rerun on an untouched build passed.

## Labs on the game renderer · November 26, 2026

Cause of the carriageways that sank into the ground in the Mercado lab: its reference mesh was baked on an older ground. Against today's ground triangles its vertices ranged from −1.01 m to +1.26 m, and 52% sat more than 1 cm below the ground. Twelve published sectors, checked with the same triangulation and bilinear terrain reading, were all coplanar within 0.1 mm, so the map was not affected.

The road labs now use the game renderer and stream the published sectors. Mercado compares *Game · geometric carriageway* with *Painted roads (legacy)*. Measure, on the desktop test viewport: 16.9 ms p95 · 34 draws · 57,290 triangles against 16.7 ms · 31 draws · 53,638 triangles. Typecheck, build, `qa-road-lab.mjs`, `qa-road-width-lab.mjs` and `qa-lod-lab.mjs` passed. Full `npm test` stopped at `qa-guagua-local.mjs` ("Both routes should clear the intersection"), in guagua code being changed in parallel and unrelated to rendering; the map tests that follow were run alone. `qa-quality-views`, `qa-quality-idle`, `qa-recovery` and `qa-map-camera` passed. `qa-boot` passed on the third run: the first two timed out at different steps while the checkout was being rebuilt by another process.

## Consolidated labs

Lab catalog: Rendering, effects & quality; Driving & flight; Map, LOD & roads. Legacy `?test=` URLs still route; look switches keep the map view; flight exposes cruise speed, bank/pitch limits and FOV. Typecheck, build, `npm test` and dedicated lab checks passed. Open: `qa-carriageways.mjs` historical comparison times out (reference index predates the zone schema).

## City straight lines and visibility of patrols

Full city, 390 × 844, five roads both ways, straight steering, guaguas off, start at 90 km/h. Metric: longest interval at ≥72 km/h with no patrol visible for ≥0.3 s (worst direction, seconds, same seeds).

| Neighborhood and street | 2 stars, before → after | 4 stars, before → after |
|---|---:|---:|
| Schamann · Calle Doña Perfecta | 29.7 → 8.6 | 22.4 → 8.9 |
| Ciudad del Mar · Av. Alcalde José Ramírez Bethencourt | 16.7 → 6.6 | 10.7 → 7.4 |
| La Isleta · Calle Juan Rejón | 11.6 → 8.9 | 10.3 → 4.4 |
| Guanarteme · Calle Fernando Guanarteme | 11.3 → 5.7 | 15.2 → 2.5 |
| Santa Catalina–Canteras · Calle General Vives | 19.5 → 11.4 | 6.0 → 6.2 |

Time with a legible patrol: 16.2% → 41.1% (two stars), 20.7% → 50.4% (four); aerial camera 54.0%, max gap 9.1 s. In General Vives facades limit visibility to 1.3 of 18.5 s. Run `node scripts/qa-police-straights.mjs` (`--aerial`, `--two-stars`) after build.

## Drive look prototypes · November 26, 2026

Shipped look vs `?look=sole`, `?look=matcap`, `?look=matcap&tilt` from the same Vegueta start (1440 × 900, no errors). Matcap ignores lights; Sole shadows were too dark under trees. `&tilt&stats`: 60 FPS, 40 draw calls.

### Pilot rendering benchmark

Intel UHD (ANGLE D3D11), 1440 × 900, DPR 1, 3 × 180 frames per look on Carretera del Centro, seed 7, quality held at L3.

| Look | Published FPS | Published GPU p50 / p95 (ms) | Local FPS | Local GPU p50 / p95 (ms) |
|---|---:|---:|---:|---:|
| Base | 59.9 | 12.14 / 14.41 | 57.4 | 12.77 / 18.66 |
| Sole | 59.9 | 13.17 / 15.31 | 59.9 | 13.08 / 19.35 |
| Matcap | 59.9 | 6.47 / 8.50 | 59.9 | 6.80 / 13.14 |
| Matcap + tilt | 59.9 | 7.09 / 9.59 | 59.9 | 7.24 / 13.64 |

Matcap cuts median GPU ~47%; tilt adds three fullscreen draws (+0.44–0.62 ms); CPU 2.9–3.8 ms for all. Reproduce: `node scripts/benchmark-drive-looks.mjs dist .cache/drive-look-comparison/local 3`.

Matcap is now the default for map, drive and flight. `?lab=qualita` has a look dropdown and a lil-gui Matcap panel (preset, brightness, bounce, shadow strength, palette grade, edge blur, edge glow); only non-default values enter the URL. `look=base` = original lighting; `preview=base` = fixed preview without shadows. `qa-quality-idle.mjs idle-drop` covers dropdown, URL and Reset. Full suite and 30/60 Hz calibration passed.

### Driving lab panel · November 26, 2026

Drive lab panel regrouped with no default changed. `qa-drive-lab.mjs` checks the new folders, the absence of the six removed shaping values, and View distance 2 in the URL (pilot flight horizon 2200 m at ×1, 4400 m at ×2). `qa-flight.mjs` asserts a take-off horizon of at least 1000 m. Drive lab and flight tests passed.

## Python Regeneration · November 26, 2026

Compared with `7c7dfa91` in isolated checkouts; equality by SHA-256.

| Generator | Time | Result |
|---|---|---|
| City layers | 406 → 93 s | 5 files match |
| Sectors and zones | 1,201 s → 142 s (hot cache) | 2,212 artifacts identical |
| PNOA roofs | 609 s → 181 s (38 s colors only) | atlas and palette match |
| Guaguas network | 309 → 158 s | 136 JSONs match |
| LiDAR tile reread | 1.96–2.05 → 0.46–0.95 s | reports identical |

Pilot layers, audits and SITCAN outputs also identical. The experimental roadway spatial filter changed the mask, so existing masks are reused. Caches: roadways ~112 MB, PNOA ~680 MB, OSM ~54 MB. 22 Python tests (`python -m unittest discover -s scripts -p 'test_*.py'`), typecheck, build and `npm test` passed. The roadway check covers all 2,041 sectors; `HEAD` had one joint error of 2,720 (`-4_22`/`-3_22`). Clouds above roofs verified at Parque Doramas.

## Police with Increasing Difficulty · November 25, 2026

Compared with `42488497`: 40 pilot approaches 24 → 35 arrivals, destructive incidents 5 → 0; 20 held-out pairs 19 arrivals, 0 incidents; five stars fit at 320–844 px; five patrols on 390 × 844 software WebGL p90 16.9 ms on both builds.

Thirty Vegueta runs (≥175 s simulated each), share of samples with a patrol within 25 m:

| Player Input | ★ | ★★ | ★★★ | ★★★★ | ★★★★★ |
|---|---:|---:|---:|---:|---:|
| Straight wheel | 9% | 65% | 72% | 74% | 74% |
| Dodge patrols | 17% | 61% | 68% | 66% | 70% |
| Follow coins | 44% | 74% | 92% | 82% | 94% |

Tools: `benchmark-police.mjs <previous-dist>`, `qa-police-runs.mjs` (`POLICE_REPORT`); replay via `?lab=guida&area=pilot&seed=7&start=-60,-818&nobuses` and `policeRun()` / `replayPolice(policeInputs())`. Open: phone play test.

## Tracks, smoke and jerks while driving · November 25, 2026

- Surface map correct (98% agreement with carriageways on 3,000 points).
- The "sprint" was the drift bonus returned in one 1/120 s step (+16–26 km/h); it now ramps over 0.2 s (`BONUS_RISE`), checked in `qa-drive-handling.mjs`.
- East/west tracks had zero width; width now follows the wheel direction.
- Drift smoke now puffs every 0.05 s for the whole slide.

## Surfaces under the wheels · November 25, 2026

`src/drive/drive-surface.ts` paints asphalt, pavement, lawn, earth and sand on 128 m tiles at 2 px/m on demand (150 → ~2 ms per tile; ready in 25–70 ms). Off asphalt cars lose speed and grip (grass 72% / 0.6, earth 80% / 0.7, sand 85% / 0.75); pavement only shakes; asphalt trajectories unchanged. Water is solid except where a street crosses (307 of 308). Signals: off-road tracks, spray, terrain gusts, body shake, phone vibration. Particles and 1,500 track pieces are GPU-driven. Passed `qa-drive-handling.mjs`, new `qa-drive-surface.mjs`, `qa-drive-lab.mjs`; 16.7 ms/frame. Not verified on screen: lawn and earth.

## Rendering Deduplication · November 25, 2026

31 lines removed across four modules; geometry hashes and texture pixels identical, captures within 0.13/255. `qa-ground`, `qa-main-lod`, `qa-recovery`, `qa-sectors` and full suite passed.

## Viewer launch and pilot changes · November 25, 2026

Startup data in `load-startup-data.ts`; flight interpolation in `motion.ts`; editor split into history, draft, mesh and pointer. `qa-editor.mjs` also checks focus loss mid-drag and redo after no-op commits. Full suite and targeted tests passed.

## Second reduction of lab values · November 25, 2026

Panel 91 → **79** sliders (each value scaled ×0.5/×1.5 over eight courses). Removed unused patrol reward values; several values now derived with their previous exact ratios. Body angles identical within 2·10⁻¹⁵°, 18 trajectories identical. Rejected: player pose on patrols (up to 28° body tilt). Suite 2/2.

## Merged values and slope-following car · November 25, 2026

Panel 133 → 91 sliders. Single `recover` (54°/s player, 135°/s patrols) keeps trajectories within **0.45 m**; 158 chases: destroyed 18 → 16, blocked 4 → 3. Rejected: removing `turnRelease` (9.5°), merging `poseReverse` (countersteer 17 → 33 ms).

**Slope**: one street section in five exceeds 10%. Cars (and patrols) now pitch with the road under both axles, up to 22°, plus `slopeLean` on the player body; `groundPitch` tested in `qa-drive-pose.mjs`; checked on Calle Crucita Arbelo Cruz (13%). Lab accepts `start=x,y`. Suite 2/2.

## Guide review and English lab · November 25, 2026

Lab fixes: no zero divisors, no NaN at `bonusTime` = 0, URL written once per drag (was 400 writes), panel keys don't drive. Player metrics unchanged; simulated chases 23/40 → **25/40**. The lab UI is in English; URL identifiers and place names unchanged. Lab tests passed (two flaked once); suite 2/2 in an isolated copy (main-checkout failures came from a concurrent `dist` rebuild).

## Single guide and calibration laboratory · 25 November 2026

The drift-racer model is the only one (`?handling` removed): `steerCar` in `drive-physics.ts` with `TUNE.player`/`TUNE.patrol`. `qa-drive-handling.mjs`: 90 km/h at **4.58 s**, 100 ms touch **3.2°**, drift limit 60°, 60 vs 120 Hz **0.79°**. Fixed a post-collision freeze with held steering; collision slip now reabsorbed gradually.

| `qa-drive-chase.mjs`, 40 chases | Reached | Destroyed | Blocked | Avg speed |
|---|---|---|---|---|
| Previous (`bed2273`) | 22/40 | 4 | 1 | 41 km/h |
| Current `TUNE.patrol` | **23/40** | 5 | 2 | **51 km/h** |

Fails below 20 arrivals or above 4 blocks. Lab `index.html?lab=guida&area=pilot` (`qa-drive-lab.mjs`): live values, `t=` URL, «Police» toggle, «Copy values»; `t=` ignored outside the lab.

## Drift-racer Guide · November 24, 2026

Port of the Construct 3 drift-racer (`carconf.json`, 24.4 px/m): drift from held steering only, travel follows the nose at 70 → 50°/s, nose up to 190°/s, drift capped at 60°. `qa-drive-drift.mjs` at 120 Hz: 90 km/h at **4.58 s**, 100 ms touch **3.2°**, straight 350 ms after release. Not ported: off-track penalties, turbo.

## Driving Physics · November 24, 2026

Render interpolation between 1/120 s steps (jumps >4 m drawn directly); backward braking no longer zeroes speed in one step; `turnFade` 0.3 above 60 km/h (quarter turn at 90 km/h 0.64 → 0.78 s); patrols lose lateral slip faster (grip 7.5 vs 2.2). Covered by `qa-drive-pose.mjs`; acceleration and braking unchanged. Suite passed.

## Slope and acceleration

60 → 90 km/h: **3.39 s** on 8% descent, **4.00 s** flat, **4.88 s** on 8% climb; regressions cover braking, reversal, bridges and patrols braking downhill. Suite passed.

## More Legible Roll and Bounce

Over 27° roll in sustained turns with the body above the wheel plane; a 15 m/s impact gives a 0.9 m hop. Suite passed.

## Side-Scraping in Alleys

4 m/s into a wall + 18 m/s along it keeps 17.52 m/s; in a 2.6 m corridor the car stays inside above 12 m/s. Sparks within 160 ms, no bounce on grazing; frontal impacts still bounce. Suite passed.

## Speed and Braking · November 23, 2026

At 120 Hz: 60 km/h at **1.442 s**, top speed at **5.442 s** (90 km/h player, 94 patrols); stop from 90 in **0.933 s / 11.5 m**. Impacts ~10.6 m/s bounce, ~11.6 m/s also stop. Suite passed. Open: feel on a phone.

## Arcade Steering · November 22, 2026

100 ms touch at 13 m/s turns **2.58°** (was 0.96°); slip under 1.5 m/s **175 ms** after release; 16.4° roll at ~15 m/s with level wheels. 2,400-step comparison identical after simplification. Open: feel on a phone.

## Basic verification

Windows, Node 24.13, Chrome, Playwright; bundle ~604 kB (154 kB gzip). `npm.cmd test` at 1440x900 and 390x844 covers tabs, index, pan, zoom, reset, keyboard, pinch; no failed or external requests. Opening ~2.7 s desktop, ~2.0 s mobile; cache ~225 MB; scene 716 kB; zero raster tiles.

## Visual tests

- [Full-Screen Opening View](screenshots/opening.png) · detail of Triana.
- [Overview to San Telmo](screenshots/overview.png) · continuous perimeter and marker.
- [Neutral Santa Ana](screenshots/santa-ana-neutral.png) and [Stylized Santa Ana](screenshots/santa-ana-styled.png).
- [Market and Theater](screenshots/mercado-teatro.png) · along the ancient Guiniguada.
- [Triana on Mobile](screenshots/triana-mobile.png) · controls and attribution.

Approximations are described in the [data notes](DATA_SOURCES.md).

## Restoring WebGL on mobile

The suite forces two context loss/restore cycles on San Telmo. Touch profile: DPR 1, no MSAA, no shadow maps, lighter trees and facades; attribute bytes 87.9 → 35.8 MB, triangles 732,405 → 426,459.

## Camera, Memory, and Gradual Recovery

Compared with `1c8f8c0`, 390x844 touch, Santa Ana ↔ San Telmo:

| Measurement | Previous | Current |
|---|---:|---:|
| Geometry arrays | 35.8 MB | 21.3 MB |
| Chrome heap peak at opening | 104.6 MB | 91.0 MB |
| Pan p95 | 34.6 ms | 34.0 ms |
| Draw calls per frame | 17.75 | 30 |

Per-cell instancing trades memory for draws; buffers/textures stable. `node scripts/benchmark.mjs`. Suite covers three consecutive context losses and the reload button. Checks: [Santa Ana](screenshots/santa-ana-styled.png), [Mercado](screenshots/mercado-teatro.png), [San Telmo](screenshots/san-telmo.png), [Gabinete Literario](screenshots/triana-mobile.png).

## Catalog and roofs

Suite adds a seventh location and checks saved selection; existing coordinates unchanged. Roof positioning checks 18,178 → 15,132.

## Roads on the ground

[Mobile view of Teatro Pérez Galdós](screenshots/teatro-mobile.png). Roads and OSM surfaces share the terrain triangles; color map generated once (max 2048 px).

## “Conducir” Mode · November 21, 2026

`npm.cmd test` at 1440×900 and 390×844: entry, coins, first-input start, steering, capture («¡Atrapado!»), «Otra vez», exit; no exceptions. Idle capture after 10–31 s; 390x844 driving median 17.5 ms, p95 18.3 ms.

[Mobile Screenshot](screenshots/conducir-mobile.png). Limits: no physical-phone test; swipe untested; cars are 1.15 m circles; only trees >4.5 m from facades are obstacles; an arrow and silhouette show the car when buildings cover it.

### Icon-Only Interface and Game Feel

Text-free HUD (SVG icons, numbers, one-time brake lesson, numbered destination), coin magnet, pop-ups, patrol lights, nose dive on braking. Driving zoom stays 0.91–0.97 of base; glide in from the map ~1.5 s. [Driving HUD on Mobile](screenshots/conducir-mobile.png) · [capture panel](screenshots/conducir-fin.png).

### Hit-stop and camera shot · November 22, 2026

Pauses on strong impacts (55 ms, >9 m/s, ≤1 per 0.6 s), arrival (50 ms) and capture (110 ms); shake replaced by a spring push (0.99 m peak, settled in 0.28 s). `npm.cmd test` checks capture stop and camera return. Rules in [JUICE.md](JUICE.md).

## Vegueta–Arenales–Ciudad Jardín Corridor

Area 0.487 → 3.041 km² (80 sectors); source vs sector multisets match; original POIs unchanged. [Overview](screenshots/overview.png) · [Parque Doramas](screenshots/ciudad-jardin.png)

| Chrome, emulated mobile | Before | After |
|---|---:|---:|
| First navigable view | 2.29 s | 2.48 s |
| Heap peak at opening | 102.2 MB | 86.1 MB |
| Pan p95 | 18.2 ms | 18.4 ms |
| Draw calls / triangles per frame | 32 / 144,863 | 71 / 185,226 |

Detail built in a worker. `node scripts/qa-sectors.mjs` blocks the first detail request, forces WebGL loss, tours four places three times (~45–50 MB within 48 MiB) and drives across a sector border with a patrol. Nearest road node 0.0043 ms indexed vs 0.0638 ms linear. Regeneration kept all 168 file hashes.

## Graphics Robustness · November 21, 2026

Driving survives context loss (suspended, resumes on input; `held` in `data-drive`). Adaptive resolution (historical, now `dynamic-quality.ts`): levels 1 / 0.85 / 0.7. Shader warm-up compiles all driving materials at entry (15 programs mobile, 16–17 desktop). Limit: one unidentified program still compiles mid-game on desktop.

## Solid-Color Roofs

PNOA colors checked for 4,698 city and 1,108 pilot parts; zero WebP loaded; suites pass within 48 MiB.

## Three driving views

`node scripts/qa-drive-camera.mjs` covers rotation limit, reversal, stability and obstacle re-entry at 30/120 Hz. Pan p95 18.3 → 18.4 ms. Clips in `.cache/camera-clips/`.

## TypeScript Migration

`npm.cmd run typecheck` checks all `src/` with `strict: true`; the build includes the worker; inputs are validated at load. Sectors load with and without `OffscreenCanvas`. JS vs TS: pan p95 18.2 / 18.1 ms, identical draw calls and triangles, opening 1,675 / 1,672 ms. Full suite and sector circuit pass on both.

## Driving Startup, Place Index, and Streaming Recovery

`npm.cmd run build` validates scenes, catalog, palette and sectors. `qa-recovery.mjs`: map usable without roads or places, local build fallback after a 10 s worker stall. `qa-drive-route.mjs`: route, coin spacing, magnet, scoring, destination change.

## Wind and cloud shadows · November 22, 2026

The suite checks two still-map frames 800 ms apart differ while `data-view` is unchanged. Idle cadence ~28 draws/s (replaces "zero draws at rest"). Screenshots are no longer deterministic. Open: phone power; shadow-map tree shadows don't sway.

## Sea and contact shadow · November 22, 2026

`python scripts/data.py city` adds `sea.json` (8 KB) and keeps other files byte-identical. Contact shadow = footprint mask at ~4 m/px (city texture 72 → 390 ms; a first outline version raised startup 2.1 → 6.4 s and was dropped). Startup 2,091 → 2,828 ms desktop, 1,451 → 1,781 ms mobile. Limits: shadows ignore neighbouring sectors; sea level −0.9 m.

## Pedestrians · November 22, 2026

`node scripts/qa-pedestrians.mjs`: car at 16.5 m/s on a pedestrian street, nobody within 2.3 m (min 5.14 m), jumps in a 2 m corridor. 40 pedestrians, two draw calls. Lab tests are registered in `src/lab/main.ts`; `qa-road-lab.mjs` covers the road lab. Retired tests: [history](STORICO_PROVE_VISIVE.md).

## Map rotation

`npm.cmd test` covers the four 90° rotations (center and zoom kept), keyboard, orientation change, leaving Play and WebGL restore; captures go to `QA_SCREENSHOT_DIR`. The Isométrica drive view starts from the map orientation.

## Geometric roadways on sector boundaries

Pilot on Calle San Nicolás (`-2_-2`/`-1_-2`): 962 triangles, +30,909 B. [Texture and Geometry Comparison](screenshots/carreggiate-san-nicolas.png). All 80 sectors: 37,487 triangles, 124 boundaries continuous within 1 cm, 10 bridge/level ways excluded; detail JSON 4.29 → 5.66 MB.

| Chrome Profile | p95 textures | p95 geometry | Texture memory | Geometry memory |
|---|---:|---:|---:|---:|
| Mobile emulated, 390 × 844 | 18.3 ms | 18.3 ms | 46.81 MiB | 46.97 MiB |
| Desktop, 1024×720 | 18.2 ms | 18.3 ms | 59.81 MiB | 59.98 MiB |

Within the +10% p95 threshold; main-thread build, context recovery and three street-circuit laps verified. Open: turn stability and thermals on a phone.

## 5- and 9-Meter Roadways

45,088 triangles; lab sections 5 m (Calle Rafael Mesa y López), 9 m (Avenida Marítima), 4.75 m (Calle Párroco Villar Reina). [Comparison at the Same Position](screenshots/larghezza-carreggiata.png). p95 unchanged (18.2–18.3 ms); resident detail +0.02 MiB; pan outline adds 469 kB to the index (~173 kB gzip).

## LOD transitions in the main game

Map and Conducir share a 250 ms fade, detail in at 520 m and out above 580 m; diagnostics expose `near` and `fading`. `node scripts/qa-main-lod.mjs` covers a delayed sector, context loss mid-fade, both directions and budget. Pan p95 18.3 → 18.4 ms.

## LOD transitions in the lab

`lab.html?test=lod` compares current, hysteresis and hysteresis + dither fade; `node scripts/qa-lod-lab.mjs` runs three scenarios on Calle San Nicolás. [Crosshatch at Mid-Transition and Full Detail](screenshots/lod-laboratorio.png). Detail swaps during zoom 14 → 0 with hysteresis; p95 18.2–18.3 ms for all variants. With `--citta` all variants had 11 swaps (priority did not help).

## Municipal heights against LiDAR (November 22, 2026)

Tile 459-3109: 554 buildings, LiDAR p95 minus municipal median +0.8 m, MAE 1.82 m, 93% within 5 m. Landmarks agree within ~1 m; building 41667 is 16.2 m, not the 9 m estimate.

## Roof colors: 20 cm orthophoto 2024 against PNOA (22 November 2026)

4,820 buildings vs SITCAN at 1 m: median ΔE 2.9, p95 7.0, 99.5% under 10; no data changed. `python -I scripts/roof-compare-20cm.py`.

## Baseline before coastal expansion (November 22, 2026)

3.04 km², 80 sectors, 4,698 parts. Suite green (3 min 2 s). `benchmark.mjs`: opening 3,162 ms, heap 80.9 MB, p95 18.4 ms, 115 draw calls, 263,657 triangles. `qa-sectors.mjs` 4/5 (buffer-growth failure, explained below).

## Sector test: measurement with meters stopped (22 November 2026)

Not a leak: counters were read before the first draw or mid-fade. The test now waits for `pending` and `fading` at zero and two equal readings; max gap 14 buffers (threshold 24), 6/6 green.

## Three-level viewer and 6× scale test (November 22, 2026)

Core (0.67 MB + 0.62 MB terrain) replaces `city.json` (4.6 MB), plus on-demand zones and sectors.

| Measurement | Base | Three levels | Replica 6× |
|---|---|---|---|
| Opening | 3,162 ms | 3,649 ms | 4,669 ms |
| Heap peak at opening | 80.9 MB | 21.5 MB | 77.6 MB |
| p95 close / far | 18.4 / – ms | 18.7 / 18.2 ms | 18.3 / 18.3 ms |
| Draw calls far | – | 120 | 267 |

`qa-sectors.mjs` 11/11 (now with far view); `qa-main-lod.mjs` 4/5. Limit: ~18 ms p95 is the bench floor.

## Vegueta, Vega de San José and San Cristóbal (November 22, 2026)

OSM barrio relations 16905756, 16905755, 16905754. Land 3.04 → 4.53 km²; parts 4,698 → 6,073; road sections 1,433 → 2,350; trees 10,376 → 15,367; 16 zones, 126 sectors; new places Iglesia de Santo Domingo and Parroquia de San Cristóbal. OSM extracts now use a fixed 0.01° grid. Suite green (opening 2,996 / 1,225 ms); `qa-sectors.mjs` 2/2.

- Benchmark (Intel UHD): close-up p95 35.8–70.9 ms vs 18.7 before, 142 draw calls, ~371,000 triangles — a real regression, fixed in the next section.
- LiDAR (5 tiles): 679 parts, median +0.44 m, MAE 3.88 m; 70 parts of 13 OBJECTIDs off by >10 m because the complex's max height is applied to low bodies (e.g. 40994: 51.7 vs 3.3 m), listed in `.cache/lidar-control/scarti-vegueta-sur-san-cristobal.csv`.

Limits: Torreón de San Pedro Mártir lies outside the land model; driving in the new area not hand-tested.

## Stable streaming and lighter geometry (November 22, 2026)

Cause: edge sectors were built, evicted and re-requested every frame. `sector-stream.ts` keeps requests valid 600 ms after leaving view, lets in-view sectors evict only unwanted ones and downloads only when there is room; `scene.ts` drops hidden extrusion faces.

| Location | Before p95 | After median / p95 |
|---|---|---|
| Santa Ana | 107-123 ms | 16.7 / 33.4 ms |
| Santo Domingo | 89-124 ms | 16.9 / 33.5 ms |
| San Telmo | 18.3 ms | 16.7 / 16.9 ms |

`benchmark.mjs` close-up p95 36–71 → 16.8 ms, startup 1.9 s. Limit: ~1 frame in 10 still doubles (GPU side).

## Low bodies of the complexes corrected with LiDAR (22 November 2026)

`lidar-check.py --export` writes `parts` whose municipal height exceeds LiDAR p95 by >10 m into `content/lidar-heights.json`; `data.py` applies them (`source: lidar-pnoa`): 72 parts, e.g. 40994 51.7 → 3.3 m. Not checked against the orthophoto.

## Wider view limited to one neighborhood (November 22, 2026)

Widest view 3,000 m desktop / 2,400 m compact (`farthest` in `src/main.ts`), inside zone thresholds. Suite and sector tests green.

## Triana, Arenales, Ciudad Jardín and Alcaravaneras (November 22, 2026)

Seven OSM barrios; land 4.53 → 5.05 km²; parts 6,073 → 6,878; 142 sectors. Close-up p95 18.2 ms, 86 draw calls, heap 43 MB. LiDAR on 13 tiles: median +0.55 m; 137 parts `lidar-pnoa`; `lidar-check.py` 12 → ~1 min.

## Local driver editor

`editor.html` moves pilot buildings, footprint vertices and props and exports corrections as JSON bound to `pilot.json`; `node scripts/qa-editor.mjs` covers it, including on the `/isometric-cities/` build. The pilot editor is now deprecated: no longer linked from the labs, but still built and reachable by URL ([editor.html](https://tatosgames.github.io/isometric-cities/editor.html)).

## Support of vehicles on the ground

Cars, patrols and wrecks follow the terrain triangle under their center; shadows, skids and dust use the same surface (15 m cell index per sector, released with the zone, no extra draws). The shared triangulation matches `ShapeGeometry` on all 23,378 detail ground cells. `scripts/qa-ground.mjs` (in `npm.cmd test`) matches a raycast on the real mesh within 1 cm at `(-1270, 1055)` before and after delayed detail, plus pan, sector edge and out-of-terrain fallback. Driven both ways on a 3.06 m rise over 35.27 m with a patrol. Limit: on sharp bumps one wheel can sink (support computed at the center).

## Santa Catalina–Canteras and Guanarteme (November 22, 2026)

OSM relations 16904433 and 16904431. Land 5.05 → 8.06 km²; parts 6,878 → 10,137; road sections 2,576 → 3,574; zones 19 → 27; sectors 142 → 218. New places: Parque Santa Catalina, Auditorio Alfredo Kraus (14). Data: core 1.6 MB, zones 8.3 MB, sectors 16.5 MB. Reset now returns to Plaza de Santa Ana at max distance.

- Suite green (opening 3,289 / 3,107 ms); `qa-sectors.mjs` 2/2.
- `benchmark.mjs` (Intel UHD): opening 2,304 ms, heap 60.5 MB; close-up p95 18.3 ms, 85 draw calls, 176,654 triangles; wide view over Vegueta p95 35.9 ms, 219 draw calls, 383,282 triangles.
- LiDAR on 20 tiles: 9,471 parts, median +0.6 m, MAE 2.02 m; 189 parts `lidar-pnoa`.

Limits: 97 buildings measure >10 m above municipal (e.g. 25810: 41.7 vs 78.2 m), listed in `.cache/lidar-control/scarti-santa-catalina-guanarteme.csv`; the wide historic-center view misses 60 Hz on the integrated GPU.

## Lighter Dense Isolates (November 22, 2026)

In a dense sector (-8_14, 217 buildings) parapets (36% of triangles) and walls dominate: footprints average 16 sides because of shared-wall vertices.

- `sectors.py` `lighter()` drops footprint vertices within 0.1 m of a straight wall: 237,142 → 185,654 (−22%); sectors 16.5 → 15.6 MB, zones 8.3 → 7.5 MB (`city.json` untouched).
- `scene.ts` `buriedTo()` skips windows, frames and parapets buried in a taller neighbour (not in the editor).

`frame-profile.mjs` now accepts `x,y,zoom`. Triangles per frame, emulated phone on Intel UHD:

| View | Before | After |
|---|---|---|
| Santa Catalina (-1800, 3480), close | 320,468 | 268,625 |
| Santa Catalina (-2040, 3480), close | 372,062 | 297,209 |
| Alcaravaneras (-1560, 2760), close | 324,423 | 297,319 |
| Arenales (-840, 1080), close | 342,061 | 296,681 |
| Santa Ana, close | 270,743 | 220,331 |
| Santa Catalina, wide | 335,264 | 264,493 |

`benchmark.mjs`: opening 2,304 → 2,087 ms, heap 60.5 → 51.6 MB, close-up 176,654 → 159,124 triangles (p95 18.2 ms), wide 383,282 → 323,183. Shapes unchanged. Limits: `benchmark.mjs` far view still 35.4 ms p95 (stale requests at start); in 3 of 5 dense blocks one frame in ten takes 35 ms (GPU side). Catalog in [PERFORMANCE.md](PERFORMANCE.md).

## Buildings taller than municipal data corrected with LiDAR (22 November 2026)

157 parts have LiDAR p95 >10 m above municipal; `lidar-check.py --export` corrects only the 54 where the roof median also rises (>5 m above municipal and ≥75% of p95); in the other 103 the p95 hits a tree, overhang or small tall body. Examples: 25810 41.7 → 78.2 m, 22817 3.6 → 29.1 m, 16466 7.8 → 32.6 m. City: 243 parts `lidar-pnoa`, 9,854 municipal, 40 estimated. Suite green; only 25810 inspected visually.

## La Isleta and Puerto de la Luz (23 November 2026)

OSM relation 16904434. Land 8.06 → 19.30 km²; parts 10,137 → 14,973; road sections 3,574 → 4,703; zones 27 → 50; sectors 218 → 487. New places: Castillo de la Luz, Mercado del Puerto (16). Data: core 2.3 MB, terrain 5.8 MB, zones 13 MB, sectors 28 MB. Fixes: elevation −32768 outside coverage read as sea level; closed port basins filled with sea; driving border check indexed by bands (`ringIndex()` in `drive-world.ts`, was 2.7 s at opening).

- `benchmark.mjs` vs `1a37dba`: startup 6.3 → 5.3–5.9 s; close-up p95 18.2 ms, 156,139 triangles; heap peak 88.7 → 112.6 MB.
- LiDAR (30 tiles): 14,160 parts, median +0.66 m, MAE 1.90 m; 361 parts `lidar-pnoa`. Castillo de la Luz 9.0 vs 12.0 m, Mercado del Puerto 13.0 vs 9.5 m, Auditorio 29.0 vs 29.0 m.
- `qa.mjs` stopped at line 75 (footer visible), also on `1a37dba`.

Limits: heap grows with area; one or two ~170 ms frames after a view reset (undiagnosed).

## Port items and three dedicated models (November 23, 2026)

OSM: 21 cranes, 2 smokestacks, 97 tanks, 22 silos. Cranes and chimneys go in a new `props` list (`data.py` → `sectors.py`) drawn by `src/render/port-props.ts` (13 boxes close, 6 as silhouette); the 34 tank/silo buildings get a plain shell. Dedicated models in `src/render/landmarks.ts`: Castillo de la Luz (walls 10 m, turret 13 m), Mercado del Puerto (hipped roof to 9.2 m, skylight to 14 m), Auditorio Alfredo Kraus (stone 29 m, lantern to 48 m). The catalog can style one body with `OBJECTID:floor(x minimo):floor(y minimo)`.

Frame profile median/p95: Castillo 18.0/18.3 ms, Mercado 17.9/36.0, Auditorio 17.9/18.1, La Isleta wide 17.9/18.2 (330,338 triangles). `benchmark.mjs`: opening 5.7 s, p95 18.2 ms, heap 110.7 MB. Heaviest point: La Isleta core (-1200, 5000), 325,393 triangles, median 35.9 / p95 53.8 ms. Limits: OSM crane positions approximate (one ~50 m off); 68 point-only tanks not drawn.

## Dense Neighborhoods, Resident Memory, and the Post-Recovery Surge (November 23, 2026)

- Compact-profile parapets 4 triangles instead of 6; roof cabins lose lids; only balcony sills kept (desktop unchanged).
- Road coverage stored per zone (`coverage`): the old whole-city redraw caused the post-restore spike. Index 1.74 → 0.48 MB; zones 13 → 15 MB.
- Terrain in Int16 (`Terrain.scale`): 6 MB instead of 12 per copy.
- Cranes and chimneys are driving obstacles (`propObstacles()`).

| Close up (median / p90, triangles) | Before | After |
|---|---|---|
| La Isleta Core (-1200, 5000) | 35.9 / 52.6 ms, 325,393 | 18.2 / 36.3 ms, 257,828 |
| Santa Catalina (-2040, 3480) | 17.5 / 18.8 ms, 297,209 | 18.1 / 18.3 ms, 232,517 |
| Santa Ana | 17.5 / 35.6 ms, 220,331 | 17.3 / 18.3 ms, 178,001 |

Worst frame after recovery 175.7 → 36.2 ms; heap peak 110.7 → 101.5 MB. Suite and `qa-sectors.mjs` ×2 green. Limit: one frame in ten still 36 ms in the La Isleta core.

## Glide back to the map

Leaving Play (button or Esc) flies back to the saved center, zoom and angle from Follow, Aerial and Isometric views at 1100×700, 390×844 and 844×390; the drive suite checks it after a game and after capture.

## Neighborhood 5: Ciudad Alta and San Francisco–San Nicolás (November 23, 2026)

District 4 (16 barrios) plus San Francisco - San Nicolás; perimeters from the municipal «Barrios» service (`ENTS_CO_ID` 24, `NUCL_CO_ID`) as a new `municipal` zone type in `content/las-palmas.json`.

| | Before | After |
|---|---|---|
| Area | 19.30 km² | 27.83 km² |
| Building parts | 14,973 | 21,326 |
| Trees | 21,981 | 42,782 |
| Zones / sectors | 50 / 487 | 61 / 639 |

LiDAR (40 tiles): median +0.58 m, 90.6% within 5 m; 551 parts `lidar-pnoa`, 68 at 9 m. Suite, `qa-sectors.mjs`, `check-data.mjs` green. Schamann is the new triangle peak (323,314) at full cadence (16.7 ms); `benchmark.mjs` startup 5.1 s, p95 16.8 ms. Limit: heap after GC 95.7 → 128.7 MB, resident zones 48.7 → 65.6 MB (fixed below).

## Resident memory after Ciudad Alta (November 23, 2026)

Heap snapshot at the widest Schamann view: 144.8 MB (66 MB geometry buffers, 61 MB JS arrays). Zones no longer keep 15 m ground tiles and street coverage; compact middle/far views drop vertex normals (12 of 27 bytes per vertex); far contours released after building.

| Measurement (emulated phone) | Before | After |
|---|---|---|
| Heap, wide view on Schamann | 144.8 MB | 103.5 MB |
| Heap, close up in Vegueta | 88.5 MB | 74.2 MB |
| `benchmark.mjs`, heap after GC | 128.0 MB | 101.4 MB |
| `benchmark.mjs`, resident zones | 65.6 MB | 52.1 MB |

Image diff ≤2/255. Suite green. Limit: opening peak 105–107 MB not analyzed.

## GPU-only geometries (November 23, 2026)

`gpuOnly()` in `sector-stream.ts` frees CPU copies after upload (the far level and ground stay for the elevation sampler); on context loss zones and sectors are released (`forget()`) and reloaded from files.

| Measurement (emulated phone) | Before | After |
|---|---|---|
| Heap, wide view on Schamann | 103.5 MB | 88.5 MB |
| Heap, close up in Vegueta | 74.2 MB | 65.6 MB |
| `benchmark.mjs`, heap after GC | 101.4 MB | 79.4 MB |

`WEBGL_lose_context` with 19 sectors reloads cleanly (0.66% pixel diff from wind). `qa-boot.mjs`, `qa-sectors.mjs`, suite green. Limits: opening peak still 108 MB; 1–2 s without detail after context loss.

## Central Void Filled: Cliffs and Ravines (November 23, 2026)

12 municipal barrios in the central inlet (Miller, Miller Industrial, Lomo Apolinario, San Roque, El Batán, San Juan - San José, Zárate, El Lasso, La Paterna, Los Tarahales, Casablanca III, unlabelled ravine). Area 27.83 → 33.86 km²; parts 21,326 → 27,086; zones/sectors 61/639 → 66/747. LiDAR: 820 parts `lidar-pnoa`, 132 at 9 m. Fixed a `data.py` crash in crane orientation (removed `coast` variable). Suite, `check-data.mjs`, `qa-sectors.mjs` ×2 green; startup 5.6 s, p95 18.2 ms. Limit: heap after GC back up 79.4 → 102.6 MB.

## Southern Ring and El Secadero (November 23, 2026)

Casablanca I, Pedro Hidalgo, Tres Palmas, Hoya de La Plata and El Secadero (Tafira entity: `municipal` zones accept `entity`). Area 33.86 → 36.22 km²; parts 27,086 → 28,748; zones/sectors 66/747 → 75/805; terrain grid 1,259 × 2,868. LiDAR: 887 parts `lidar-pnoa`. Suite green; `qa-sectors.mjs` 4/5. Heap after GC 106.5 MB; timings taken on a busy machine, to remeasure.

## Opening failed on phone: time limit and screen phase (November 23, 2026)

The 25 s total opening limit was too short at 36 km² (15–25 s with a 6× slower CPU). Now it fails only after 45 s without progress (each `atlas:boot-progress` resets it), and a phase note shows the current step and seconds, or «Error en: <fase> · <messaggio>» / «Sin avance en: <fase>». Phases at 6× CPU: data 2.4 s, city 3.3 s, view 5.4 s, barrio 1.4 s, buildings 1.8 s (14.3 s); initial compressed data 2.8 MB. `qa-boot.mjs` ×3 green. Not reproduced on a real phone.

## Faster Startup (November 23, 2026)

Driving world and pedestrians build after opening (`requestIdleCallback`, ≤4 s); the map no longer waits for first-sector detail.

| 6× slower CPU | Before | After |
|---|---|---|
| Map open and usable | 13.2–13.9 s | 9.8–11.2 s |
| Full detail on screen | 22.5–22.8 s | 21.7–23.3 s |

Suite, `qa-sectors.mjs`, `qa-boot.mjs` green. Still before opening: city ground texture (1.3 s), GPU wait (~2 s), JSON parsing.

## Place Names in Conducir

The starting barrio shows at each game start (5 s); street names confirm after 400 ms, barrios after 700 ms (checked every 140 ms). Tests cover named/unnamed intersections, ambiguous matches, real POIs and canceled crossings; replayed at 1440x900, 390x844, 844x390.

## Capture in Conducir

`npm.cmd test` covers capture in a real game (coins, time, records frozen), retry focus, WebGL recovery, desaturation and color restore, rotation with the outcome open; `QA_SCREENSHOT_DIR` saves captures. Score stayed fixed for all 117 frames observed.

### CSS Desaturation and Title

First filtered frame 17.8–18.2 ms (was ~897 ms); no WebGL programs created (was 14). The suite checks pause when hidden or context lost and reset on retry/exit. Open: device check.

## Map preloader

Core, index and terrain download in parallel; until opening the streamer prioritises the central zone and the nearest visible sector; 260 ms fade; the fallback level can enter after 4 s (Play then waits for zone collisions); retry reloads the same URL.

`node scripts/qa-boot.mjs` checks request order, held zones/sectors, focus, fallback opening, module errors, missing data, no WebGL and context restore. Cold cache: interactive after 6.46 s (1440x900) / 3.64 s (390x844); first frame after Play 547 / 461 ms. `atlas:startup-*` and `atlas:play-first-frame` are in the User Timing API. `compileAsync()` warm-up gave no repeatable gain.

### Smoothness and Recovery

Each file is requested once; a single HTTP 503 retries after 200 ms, two failures show `Reintentar`; the startup limit pauses in background tabs; context loss mid-fade restores the opaque preloader.

### Preloader Cleanup Review

One ring, indeterminate until real milestones arrive. Attributions stay visible during loading and move to «Licencias de datos» on first command. Touch emulation: no selection or context menu, driving gestures don't scroll, the places menu does.

## Open sea

`python scripts/data.py sea` regenerates `sea.json` deterministically (128.12 km² open sea; the 11 basins unchanged within 0.04 m²). The offshore cut is gone at min zoom in all rotations; a 2,800 m margin removes the last corner triangle. Suite passed.

## Refactor without Visual Changes (November 23, 2026)

Commits `bb68754`, `1345f97`, `52e544b`: `drive.ts` 735 → 602 lines (`drive-tune.ts`, `drive-types.ts`, `drive-effects.ts`, `drive-crowd.ts`), `main.ts` 498 → 427 (`boot.ts`, `map/framing.ts`); shared `src/geometry.ts`, `scripts/geo.py`, `scripts/qa-browser.mjs` (`CHROME_PATH`). Drive tests give identical values. `qa-main-lod` flaky on software WebGL with old and new code.

## Conducir without police (November 23, 2026)

`?nopolice` starts Conducir without patrols; coins, destinations and pedestrians stay active.

## Coin rotation (November 23, 2026)

Coins now spin around the screen vertical axis, starting face-on, so the full face is visible in all three views (was a dash every half turn).

## Doubled Hit-Stop (November 23, 2026)

Stops doubled: impact 110 ms (`stopWall`), arrival 100 ms (`stopArrive`), capture 220 ms (`stopCaught`); coins still without stop. `qa-drive-pose`, `qa-drive-camera` passed.

## Destination drop with distance (November 23, 2026)

The destination marker is a turquoise drop (`#3cc9b8`) pointing at the place with straight-line distance («4.3km», «850m»); each new destination flies from the car in 0.45 s. Road distance was tried and dropped (too jumpy).

## Places in the new neighborhoods (23 November 2026)

Nine places from named OSM polygons (schools excluded), each reread via the OSM API: valid polygon, matching name, interior point in the expected barrio and inside `city-aoi.geojson`.

| # | Place | OSM | Barrio |
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

Estadio de Gran Canaria and Castillo de Mata were deferred (only terrain on the map). `poi.geojson` updated by reproducing `data.py`'s calculation (no pipeline cache); the first 16 places are byte-identical, points may shift slightly on the next `python scripts/data.py city`. `check:data`, `qa-drive-route` passed.

## Dedicated models: Estadio de Gran Canaria and Castillo de Mata (23 November 2026)

Neither is in the municipal layer: new catalog entry `osmBuildings` (OSM footprint, declared height, negative ids) read by `scripts/osm_buildings.py`. Stadium: base, stands to 20 m, green pitch; Castillo de Mata: 7 m enclosure with battlements and 10 m inner body. Heights are estimates. Typecheck, build and drive tests passed.

## Place cards (November 24, 2026)

Card with photo, barrio, name, 400–600 character text and link (official site, else Spanish Wikipedia) for places with a `card` block; animations via `element.animate`, no dependencies. First four: Plaza de Santa Ana (498 chars), Casa de Colón (556), Teatro Pérez Galdós (531), Mercado de Vegueta (478); facts checked on Spanish Wikipedia; Commons photos (57–111 KB) credited in `DATA_SOURCES.md`. `check:data` rejects out-of-range texts and missing photos.

Layout: 1280 × 800 left panel 376 px with the marker centered in the free area; 390 × 844 bottom sheet up to 70% with fixed link; 844 × 390 photo beside text. Moving the map folds the sheet into the pill; × and Esc close. Drive tests passed; `npm test` with `CHROME_PATH` stops at `qa.mjs` line 49 under software WebGL. Not tested on a phone.

## Shared map camera, zoom to cursor, scroll and tab offset (November 24, 2026)

`MapControls` and a shared orthographic camera (pixel edges, distance, angle) for map, drive, editor and labs (`src/render/map-camera.ts`); the card shifts the image with `setViewOffset`; driving camera damping is exponential per second. Contract in [CAMERA_FRAMING.md](CAMERA_FRAMING.md).

- New `qa-map-camera.mjs` (in `npm test`): offset error < 1e-6 px; identical damping after 1 s at 30/60/144 fps; wheel zoom keeps the cursor point (< 3 px); Plaza de Santa Ana stays centered in the free area after rotation; closing the card moves the image < 1.5 px.
- `qa-drive-camera`, `qa-editor`, `qa-drive-pose`, `qa-drive-location`, `qa-pedestrians`, `qa-ground` passed. `qa.mjs` on phone passes after moving `#status` above the card (`z-index: 5`); on desktop software WebGL the drive part hits real-time limits (capture took 53–224 s on both builds).

**Fix: map chasing the finger.** `enableDamping` applied ~10% of each move per update, so the map lagged during drags. Damping is off, a coast starts on release from measured speed (`coast` in `src/main.ts`), and `GroundControls` corrects the 73% vertical touch pan; `qa-map-camera` checks exact mouse/finger tracking and the coast (3/3). Pedestrian turn/appear damping now uses `approach` instead of `min(1, dt·k)`.

## Beaches and Paseo de Las Canteras (November 24, 2026)

Four OSM `natural=beach` areas become `beach` surfaces (sand `#e4cf9d`); Paseo de Las Canteras drawn 9 m wide in terracotta `#b9755c`; «Playa de Las Canteras» added as a place (26). Drive tests passed. Limit: no umbrellas or lamps (not in OSM).

## Las Arenas, hospitals and wooden balconies (24 November 2026)

Las Arenas, Hospital Doctor Negrín and Hospital Insular added as places (29); Las Arenas without windows, hospitals white without balconies (`balconies: false`). Low houses in Vegueta and Triana get closed wooden balconies on one in two (illustrative).

## Cards of all places (November 24, 2026)

26 cards added: 30 of 31 places have text and link, 21 have photos; every fact sourced, every photo license read from Commons. Unsupported claims removed; no card for Iglesia San Francisco Javier (sources place it in Hoya de la Plata — check the marker). All 29 menu items opened without errors. Not proofread by a local.

## Building Archetypes and Catalog Exceptions (November 25, 2026)

Every municipal building was rendered as housing; OSM tags are sparse (of 617 buildings over 1,500 m², 219 have no OSM building and 213 only `building=yes`), so `data.py` adds a `kind` with two archetypes:

- **`hall`**: industrial, warehouse, retail, commercial, hangar, garage, parking, sports, service or `shop` mall/supermarket; or untagged with an inscribed circle ≥15 m radius, ≥1,200 m² and ≤16 m tall. Windowless walls, a wide door every 16 m, skylights on a 12 m grid.
- **`block`**: hospital, school, university, office, public, civic, government, courthouse, police, townhall, library. Continuous glass band per floor, no balconies.
- The catalog can force `kind` or deny it (`kind: "housing"`).

City: 655 `hall`, 247 `block`, 27,918 homes. Exceptions: `footprint: "osm"` keeps only OSM buildings inside fully extruded lots (40993, 17363 sports field, 15495, 20053, 2034 Cementerio de San Lázaro); model `ciudad-de-la-justicia` (40994: 10 m base, four 67 × 21 m slabs at 51.7 m); Materno Infantil `block`, ramped parking `hall`. Frame profile 16.7/16.8 ms at Justicia (120 draws), industrial zone (85) and hospitals (94). `npm test` stops at `scripts/qa.mjs:181` (pinch), as on `main`. Limits: untagged halls over 16 m are missed; ~25 more extruded lots to check on the orthophoto.

## San Telmo as a whole, Pérez Galdós Theater and soil types (November 25, 2026)

Parque de San Telmo: Estación de Guaguas as `osmBuilding` with the `estacion-san-telmo` model, balustrades, Barco Pirata, kiosk and pavilions; surfaces painted largest-first so gardens inside paved parks show. Teatro Pérez Galdós bodies corrected (stage 30.6 m, historic hall 17 m with hipped roof). Surfaces can declare `ground` (`grass`, `asphalt`, `earth`, `rubber`, `pitch`; colors in `src/data/road-style.json`). San Telmo frame profile median 18.0 ms, 126,651 triangles; all 26 models 8,966 triangles. Heights mostly estimates. `npm.cmd test` stops at `qa.mjs:181` as on `main`.

## Passage over places without a model (November 25, 2026)

Low-poly silhouettes in `src/render/landmarks.ts` for Teatro Pérez Galdós, Mercado de Vegueta, Casa de Colón, four churches, San Telmo kiosks, El Obelisco, Estadio Insular tents, Las Arenas pyramids, Hospital Insular helipad, Metropole courts, Castillo de San Francisco. `data.py` writes pools and `natural=water` (308) as `water` surfaces. Still without model: Plaza de la Feria, Cementerio Inglés, Negrín, Mercado de Altavista, several parks, Playa de Las Canteras. Heights are estimates.

```
Theater (97,-159) zoom 1.59: draws 91.1 -> 90.5; median 18.0 -> 17.4 ms
Las Arenas (-3286,2600) 1.59: draws 79.5 -> 80.5; median 18.0 -> 17.4 ms
San Telmo (-200,385) 1.59: draws 117.2 -> 117.2; median 18.0 -> 17.3 ms
```

## Santa Catalina Port (November 24, 2026)

References: PNOA 1 m and SITCAN 20 cm orthophotos; Commons photos for reference only.

- **Underground roads**: `data.py` drops `highway` ways with all-negative `level` (21: the 20 lanes of Estación Santa Catalina and a sidewalk); 177 streets entering tunnels get `portal: true` and end with a clean cut in `carriageways.py` and the ground raster.
- **El Muelle (29223)**: `split.polygon` (new) separates the semicircular atrium; slab at 38.1 m without windows; glass vault (radii 29–48.5 m), glass facade and pergola at 13 m.
- **Elder (26981)** dark glass cube at 19.7 m plus historic green body at 11 m; **Miller (26979)** white walls and two red slopes to 13.5 m; **station tent** (way 1261817818) as `osmBuildings`.

`city.json` diff limited to those ways and buildings. Frame profile at (-1250, 4000): close 88 → 94.5 draws, 83,848 → 81,219 triangles; wide 306.5 → 308.4 draws; 16.7/16.8 ms unchanged. `qa.mjs` line 180 (pinch) and the `qa-sectors.mjs` Play-click interception also occur on `4de5a3e`. Several heights are estimates.

## Place Card and Sector Reset · November 25, 2026

At 390×844 a reload with Santa Ana selected restores the compact name; tapping it reopens the card and Play still enters driving; saved view restored. `qa-main-lod.mjs` 3/3, full suite and `qa-sectors.mjs` passed.

## Performance in Chrome at 390 × 844 · November 25, 2026

Chrome headless 155, RTX 4060 (ANGLE/D3D11), CPU 6× slower, no HTTP cache, isolated build:

| Opening | Interactive map | First drag visible | Touch → view |
|---|---:|---:|---:|
| 1 | 14.205 s | 15.668 s | 126 ms |
| 2 | 12.972 s | 14.437 s | 101 ms |
| 3 | 12.567 s | 14.091 s | 119 ms |

Ground drawing takes 2.77 of 14.12 s on the main thread. Frame profile at Santa Ana and Santo Domingo: medians 17.3–18.1 ms, p90 18.2 ms. Five-minute `?nopolice` drive (16,871 frames): median 17.9 ms, p90 18.2 ms, four frames >50 ms (worst 128 ms), cause open. Building the ground in a worker gained 1.2–1.4 s, below run-to-run variability (1.4–1.6 s), so it was withdrawn.

## Guagua in Conducir · November 25, 2026

Line 13 runs 230.8 m in Vegueta; the importer checks the 7.2 × 2.2 m vehicle along every segment against roadways, buildings and trees. The 120 Hz test covers both stops, restart and despawn, and an overtake at La Portadilla.

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
node scripts/qa-guagua-browser.mjs
```

Manual: `index.html?lab=guida&area=pilot&start=-60,-818`, aerial view. [Bus and Car at the First Stop, Aerial Pilot View](screenshots/guagua-vegueta.png) · [Model View from the Door Side](screenshots/guagua-modello.png).

## Who occupies the memory · November 25, 2026

New `node scripts/heap-profile.mjs <x,y,zoom> <build> "" <depth>` attributes a Chrome heap snapshot to owners (use a non-minified build: `npx vite build --minify false --outDir .cache/dist-profile`).

| Entry (MB) | Vegueta close (-80, -560, 1.59) | Schamann wide (-2250, 300, 0.352) |
|---|---|---|
| Snapshot total | 88.3 | 113.4 |
| Driving world (`drive.world`), driving off | 22.0 | 38.9 |
| of which zone wall segments (`segs`) | not separated | 21.1 |
| of which road network | 8.5 | 7.6 |
| Pedestrians (`people`) | 4.9 | 4.9 |
| Streaming geometries still in JavaScript | 27.4 | 26.9 |
| Zone footprints (`residentZones.buildings`) | 4.2 | 10.5 |
| Core terrain (+7.6 MB in the worker) | 6.9 | 6.9 |
| Core surfaces and streets | 6.3 | 5.8 |

The resident core (~13 MB) is not the main cost; the driving world kept while not driving and CPU copies of streamed geometry are. Single run per view; GPU memory not measured.

## Memory: guide to the first Play and released geometries · 25 November 2026

Every zone/sector mesh is drawn once on arrival so `gpuOnly()` frees its CPU copy; road network, walls and pedestrians are built by the first Play and freed when the page is hidden.

| Measure (emulated phone) | Before | After |
|---|---|---|
| Heap snapshot, Vegueta close | 88.3 MB | 45.7 MB |
| Heap snapshot, Schamann wide | 113.4 MB | 56.2 MB |
| `benchmark.mjs`, heap after GC | 107.3 MB | 55.2 MB |
| First Play, touch to first frame | 287 ms | 590 ms |
| First Play at 6× CPU | 1,302 ms | 4,958 ms |
| Later Plays (normal / 6×) | 58 / 455-541 ms | 50-61 / 421-555 ms |

GPU buffers rise 1,360 → 1,660 as copies move to the GPU. First Play at 6×: road network 1.7–2.3 s, walls 1.4–1.7 s, pedestrians 0.8–1.1 s. `qa.mjs`, `qa-boot`, `qa-recovery`, `qa-sectors`, `qa-guagua-motion` green; same-camera diffs within run-to-run noise. Limits: `qa-drive-lab.mjs` URL check failed also on the previous build (undiagnosed); zone footprints (4–10 MB) persist between Plays.

**Sky at Parque Doramas.** `scripts/qa-sky.mjs` compares default sky and `sky=0`, draws per effect, reactivation and context recovery. [Desktop Capture](screenshots/sky-doramas.png) · [URL Controls and Code](SKY_EFFECTS.md).

## Local guaguas in Conducir · city network

### Continuity of the guaguas in Guanarteme

#### Adaptive Corridor Widening

1,018 bands widened over 127.38 km of axis (+130,909.60 m² asphalt, 0.50 m from facades); 2,041 sectors and 2,720 roadside joints verified. Continuous sections ≥1 km 169 → 230 (from 27 before the regenerated catalog and directional junctions); GTFS gaps in Guanarteme 7.48 → 2.74 km. Guanarteme p90 18.1 ms unchanged; JS heap 112.8 → 117.5 MB. `qa-guagua-local.mjs` checks buses keep moving through reversals, stops and head-on encounters.

The November 25 feed: 117 variants, 534 stops, 46 lines; city covers 666.6 of 822.1 GTFS km. [Report by Line, Direction, and Neighborhood Gaps](../public/data/guaguas/city/coverage.json). Simulation tests cover stops, queues, priority, the six-bus limit and cancelled loads; the map alone makes zero guagua requests. [Test Links and Commands](GUAGUAS.md). Triana p90 16.8 ms with and without fleet; fleet CPU 0.1 ms.

## Terrain in boxes · November 25, 2026

`sectors.py` publishes only 64-cell terrain boxes near the border; each sector sends the worker its own window (60 m margin); reads via `heightAt()` in `src/geometry.ts`.

| Measure | Before | After |
|---|---|---|
| `city-terrain.bin` | 7.22 MB | 4.31 MB |
| Page terrain (`data.terrain`) | 6.9 MB | 4.1 MB |
| Worker buffer | 7.6 MB | 0.7 MB |
| Heap snapshot, Vegueta close / Schamann wide | 46.5 / 57.0 MB | 43.8 / 54.2 MB |
| `benchmark.mjs`, heap after GC | 54.8 MB | 52.0 MB |

Elevations identical on 362,131 points inside the border; worker windows within 8.5 × 10⁻¹¹ m; only `city-core.json` and `city-terrain.bin` change. `qa.mjs`, `qa-ground`, `qa-boot`, `qa-recovery`, `qa-sectors`, `qa-drive-pose` green. Limits: beyond 100 m from the border elevation reads 0; a model reading >60 m from its building would silently clamp.

## South Block · November 25, 2026

La Montañeta, Marzagán, Tafira and Los Hoyos (26 barrios). Area 36.22 → 62.67 km²; parts 28,748 → 36,321; sectors 805 → 1,290; heap after GC 52.0 → 62.5 MB. LiDAR median −0.43 m. Suite green; p95 16.8 ms. Limits: 975 buildings at the 9 m estimate; no places.

## North-West Block · the whole municipality · 25 November 2026

Almatriche, Los Giles, San Lorenzo, Tamaraceite, Tenoya: the model now covers the whole municipality.

| | South Block | Whole municipality |
|---|---:|---:|
| Area | 62.67 km² | 103.88 km² |
| Building parts | 36,321 | 48,308 |
| Zones / sectors | 110 / 1,290 | 164 / 2,041 |
| Heap after GC | 62.5 MB | 77.1 MB |

`sectors.py` raises PIL's pixel limit for the 178 Mpx roof atlas. Suite green; p95 16.9 / 17.4 ms near/far. Limit: 3,176 buildings at 9 m (no LiDAR west of x = 451 km).

## Optimization passage on the entire municipality · 25 November 2026

All views stay at 16.7 ms median (La Isleta widest: 296,832 triangles, 213 draws). Far silhouettes now drop their CPU copy (`forget()` redraws them after context loss): heap after GC 77.1 → 67.5 MB. Suites green.

## City layers in gzip · November 25, 2026

`city.json` (94.5 MB) is published as `city.json.gz` (14.1 MB, no timestamp, byte-identical content); `scripts/city_layers.py` owns read/write. The streets lab decodes with `DecompressionStream`. The 94.5 MB file never entered Git history.

### Faster square soil

Prepared `shapely` predicates clip only edge squares: `data.py city` 6–20 min → 184 s, output byte-identical.

## Daylight, cover edges and contact

[Capture Parameters](screenshots/look-136/catture.json) · [Original PNGs](screenshots/look-136/originals).

| Board | Change |
|---|---|
| [Santa Ana](screenshots/look-136/torri-prima-dopo.png) | Hemisphere light 1.38 → 1.15. |
| [La Isleta](screenshots/look-136/tetti-prima-dopo.png) | Parapet = 75% roof color + 25% cream. |
| [Vegueta Rooftops](screenshots/look-136/cabina-prima-dopo.png) | Cabin bases 10% darker. |
| [Vegueta Balconies](screenshots/look-136/balcone-prima-dopo.png) | Gradient on wooden balconies. |
| [San Juan – San José](screenshots/look-136/pendio-prima-dopo.png) | Warm tint at wall bases. |
| [Driving and Overview](screenshots/look-136/guida-panorama-prima-dopo.png) | Combined effect. |

p90 unchanged (16.8 ms map, 16.9 → 16.8 ms drive); draw calls and triangles identical. Suite and sector circuit passed.

## Checks after merging the two sessions · November 26, 2026

On `7c7dfa91` (whole municipality + police, light and guaguas from the other session): typecheck, build, `npm.cmd test`, `qa-sectors.mjs` (six laps at 58–60 MiB, driving crossing both ways; the south/north-west failure is closed) and `qa-drive-lab.mjs` green.

| View (`heap-profile.mjs`) | Heap | External | Detail | Zones |
|---|---|---|---|---|
| Santa Ana, place view | 33.3 MB | 20.6 MB | 57.8 MB, 18 sectors | 26.5 MB, 5 zones |
| Tamaraceite Center (heaviest new sector, 216 KB) | 32.2 MB | 22.3 MB | 57.4 MB, 21 sectors | 31.3 MB, 7 zones |
| Tamaraceite, wide view | 32.9 MB | 26.2 MB | none | 68.4 MB, 16 zones |
| Marzagán | 29.4 MB | 21.1 MB | 56.0 MB, 23 sectors | 25.8 MB, 7 zones |

`benchmark.mjs`: open 9.7 s, p95 18.1 ms, heap after GC 67.7 MB, sampled peak 148 MB. No new sector exceeds La Isleta's (≤317 KB).

## Global Dynamic Quality · November 26, 2026

First moving frame at DPR ≤1 with contact shadows; calibration may enable static sun shadows, then FXAA and DPR up to 1.25. Map and drive share thresholds.

| Emulated mobile, 390 px canvas | Pan, avg FPS | Pan, p95 ms | Drive, avg FPS | Drive, p95 ms |
|---|---:|---:|---:|---:|
| Previous build | 56.5 | 18.3 | 49.0 | 18.3 |
| Base startup, new build | 55.7 | 18.1 | 43.2 | 18.1 |
| Static shadows | 55.5 | 18.1 | 44.9 | 18.3 |
| Static shadows + FXAA | 55.8 | 18.1 | 46.1 | 18.4 |

120 RAF intervals per sequence, one run per profile (drive averages hit by streaming spikes), all at DPR 1. Desktop 1440 × 900 keeps native AA (18.1 ms p95 either way). The general suite first crashed opening Chromium with <1 GiB free RAM; rerun below. [square and cathedral](screenshots/qualita-dinamica/plaza.webp), [narrow street](screenshots/qualita-dinamica/calle.webp), [sector boundary](screenshots/qualita-dinamica/sectores.webp). Repeat: `node scripts/qa-quality-views.mjs dist static` (`base`, `fxaa`, `auto`), `node scripts/qa-quality-idle.mjs dist`.

### Verification of centralization

FXAA toggles GPU textures 0 → 2 → 0; shadow mask cap 12 MiB compact / 24 MiB standard; rollback if a mask is still preparing after 6 s. `npm test` passed.

### Idle Cadence at 30 and 60 FPS

`qa-quality-idle.mjs dist 30` / `60` and `qa-dynamic-quality.mjs` cover steady 30 FPS, 60 → 30 while moving and back, and cancelling a costly promotion.

### Extracting the Reusable Controller

Level changes match a pre-extraction trace frame by frame; the copied folder passes standalone (`node --test adaptive-quality.test.mjs`).

### Quality at rest

`qa-quality-idle.mjs dist idle-drop`: at 40 Hz the still map keeps ~30 FPS with shadows; at 20 FPS it drops shadows after ~3 s, then DPR in two steps. Brief stalls keep the level. Suite passed.

## Piper

Regressions cover out-of-coverage stops, cliffs, camera line of sight over tall facades and dive camera rise. [Before](screenshots/piper-dive-before.png) · [After](screenshots/piper-dive-after.png) · [Touch Turn at 390×844](screenshots/piper-turn.png). `qa-flight-simulation.mjs` (takeoff, wing strike, land/sea, borders) and `qa-flight.mjs` (pilot and city flight, WebGL loss, return to the road 0.92 m from a node). [Pilot View](screenshots/piper-pilot.png) · [Vertical City View](screenshots/piper-city.png).

### Controller decisions and WebGL buffers

Fixed transparent frames at DPR 0.85/0.70 (resize ran after render); `idle-drop` checks pixels and context recovery. Four deterministic controller regressions added. Suite passed.

## Piper flight at 1080p

RTX 4060, 1920 x 1080, scripted flight vs `28a99def`:

| Segment | Draw calls before / after | Triangles before / after | p95 |
|---|---:|---:|---:|
| Cruise | 404 / 128 | 1,709,580 / 638,249 | 16.8 / 16.9 ms |
| Turn | 710 / 152 | 2,584,314 / 771,369 | 16.8 / 16.9 ms |
| Dive | 680 / 166 | 2,249,632 / 792,192 | 16.8 / 16.9 ms |

First takeoff still has one 783 ms frame (was 983 ms). `node scripts/benchmark-flight.mjs dist` (`--half-resolution`, `--shots=directory`). At synthetic 18 FPS flight dropped to level -2 (1344 x 756); landing restored 1920 x 1080.
