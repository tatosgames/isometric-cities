# Optimizations that do not affect performance

Catalog of tricks already applied to the model, with the measure that justifies them. It must be reread after each new neighborhood: almost all of them are valid for the entire city without further work, but they must be remeasured where the blocks are denser or higher. Full numbers are in [QA.md](QA.md).

## Step to do after each neighborhood

1. Find the heaviest sectors in the neighborhood: the largest files in `public/data/city-sectors/`.
2. Measure closely and at maximum distance over those sectors, not just menu places:
   `node scripts/frame-profile.mjs <x,y,zoom>` (local meters; on the emulated phone 1.59 is the view of a place, 0.352 the widest). Read triangles, draw calls, medians and p90.
3. If the triangles exceed those of the already optimized neighborhoods, count what makes them up in a sector (walls, roofs, parapets, windows, trees) before touching the code. Intuition is wrong: in the northern neighborhoods the parapets were heavy, not the windows.
4. After editing compare identical camera screenshots, then `typecheck`, `build`, `npm.cmd test`, `node scripts/qa-sectors.mjs` and `node scripts/benchmark.mjs dist`.
5. Measure on a free machine. Another heavy process doubles frames at random and makes comparison useless.

## Data (pipeline)

| Makeup | Where | Measured effect |
|---|---|---|
| Footprints without vertices within 0.1 m of a straight wall (data accuracy). The first vertex remains first, because it anchors the building to the ground. | `lighter()` to `scripts/sectors.py`; `city.json` remains intact | −22% of footprint vertices in the city; sectors −5 % and zones −10 % in bytes; fewer walls, parapets and roof triangles |
| Far level at fused blocks: footprint union, simplified contour at 3 m, area-weighted average height and hue | `far_blocks()` to `sectors.py` | The entire city remains resident in 1.6 MB |
| Land in binary Int16 in decimeters instead of JSON | `city-terrain.bin` | No analysis of a list of numbers at the opening |
| Ground held in Int16 also in memory (`Terrain.scale`) | `coreWithTerrain()` to `load.ts` | 6 MB instead of 12 |
| Terrain in boxes of 64 cells, published only where they touch the mainland plus 100 m; the worker receives with each sector the only quota window he needs (60 m of margin) | `terrain_tiles()` to `sectors.py`, `heightAt()` and `heightWindow()` to `geometry.ts`, `sector-builder.ts` | Terrain from 6.9 to 4.1 MB in the page and from 7.6 to 0.7 MB in the worker; files from 7.2 to 4.3 MB. It no longer grows with the sea and the countryside inside the rectangle |
| Road coverage cut out by area; in the index only a simplified copy at 1.5 m for the distant map | `sectors.py`, `sector-stream.ts` | Shooting after reset 176 to 36 ms; index from 1.74 to 0.48 MB; heap at sight stops from 98 to 86 MB |
| In sectors with 240 buildings and up, list `fused` for the compact profile: neighbors with roofs and soil within 1.5 m and close color, merged into groups of up to 4. Desktop, zones and collisions use the full list | `fused()` to `sectors.py`, `sector-stream.ts` | 10 sectors from 3,148 to 2,207 buildings; approximately −9 % of triangles in the core of La Isleta in addition to the parapet. Cost: Level roofs and one color per group, visible from very close up; +0.83 MB in sector files |
| Three levels: core, 960 m zones, 240 m sectors, with names derived from the content | `sectors.py` | The viewer no longer downloads the entire city; browser cache remains valid between versions |

## Geometry (viewer)

| Makeup | Where | Measured effect |
|---|---|---|
| Extrusion without bottom and lid: one is underground, the other is under the roof | `wallsOnly()` to `src/render/scene.ts` | With three-sided railings: Santa Ana from 359,000 to 264,000 triangles |
| Single-sided parapet in the compact profile: the wall rises 0.56 m (`RIM`) and acts as the external face, the parapet is only the strip at the top. No roof cabin covers and no simple window sills | `parapet()` and `scene.ts` | With three faces, then two, then one: La Isleta core from 325,000 to 258,000 to 208,000 triangles with the merger; Santa Catalina from 233,000 to 208,000 with the parapet only. Cost: thinner roofs edge on the far side and band under the edge of the wall color |
| No windows, frames and parapets buried in a taller adjacent building. He wonders what is 0.5 m outside the wall and to what height. Disabled in the editor, where buildings move. | `buriedTo()` to `scene.ts` | Together with the simplified footprints: −8 to −21 % of triangles in dense isolates |
| Dedicated models without faces facing downwards (bottom of boxes, frames, cylinders and cones): the camera always looks from above and never frames them. This applies to every model, including the future. | `seen()` to `src/render/landmarks.ts` | The 24 models from 8,614 to 7,520 triangles (−12.7%); Santa Ana 1,905 → 1,657, Castillo de Mata 1,332 → 1,110, Mercado del Puerto 1,170 → 978. Identical camera screens: differences only from wind and clouds (0.02-1.2 % of pixels, scattered across the entire picture). |
| Windows and sills as flat rectangles; piano frames only on desktop | `scene.ts` | — |
| Icosahedron crowns without subdivision and 4 per tree instead of 7; palm trees with 8 fronds instead of 13, in a compact profile | `scene.ts` | — |
| Fused geometries for 120 m cell and material; trees instantiated per 320 m cell | `add()`, `instance()` | 85-150 draw calls per frame up close |
| Normals in Int8, colors in Uint8, no UV | `add()` | Less memory per vertex |

## Light and pixels
| Makeup | Where | Effect |
|---|---|---|
| Initial compact profile (can add static masks after calibration): contact shadow painted in ground texture, occlusion at base of walls in vertex colors, flat shadow patch under trees | `main.ts`, `ground-map.ts`, `scene.ts` | One step drawing |
| Default desktop Matcap starts with static shadows. Base and Sole can use a solar shadow map that updates only when needed (`autoUpdate=false`). | `dynamic-quality.ts`, `main.ts` | Matcap starts at L1, the highest usable level for its shadow mode. |
| Adaptive quality shared by map and guide. The phone starts with maximum DPR 1, then tries static silhouettes, FXAA and maximum DPR 1.25 | `src/render/dynamic-quality.ts` | Initial calibration up to 6 s. Subsequent promotions require at least 8 s of smooth movement. On the compact profile the controller can recognize a smooth 30 FPS at the base level or lower. Below 27 FPS or with p95 over 42 ms for two seconds reduces quality. Frames painted while sectors load count towards a reduction, never towards a promotion. |
| Ambient rendering targets 30 FPS for wind and clouds. The scheduler carries its deadline across display callbacks to sustain the cadence on displays such as 40 and 50 Hz. | `src/main.ts`, `src/quality/adaptive-quality.ts` | The ground profile lowers quality one level after about three continuous seconds below 24 FPS. |

## Streaming

| Makeup | Where | Measured effect |
|---|---|---|
| Detail budget 58 MiB compact, 115 MiB desktop; the zones are counted separately | `sector-stream.ts` | Stable memory on the repeating circuit of `qa-sectors.mjs` |
| Detail sectors released 3 s after the view widens past them (they were kept, invisible, until another sector needed room); zone budget 48 MiB compact, 96 MiB desktop: over it a zone at least 1.5× farther from the centre makes room for a nearer one, the rest keep the merged blocks. Flight is exempt | `update()` and `roomForZone()` in `sector-stream.ts`, `zoneMiB` in `dynamic-quality.ts` | Widest view on a 1909×910 desktop (`.cache/zoom-memory.mjs`, three centres): detail from 108–115 MB to 0, zones from 86–108 MB to 86–97 MB, total stream from 131–247 MB to 110–121 MB. Zooming back in reloads the detail |
| A request remains valid 600 ms after leaving the view, like the "in view" state | `sector-stream.ts` | End of load-and-discard at the edge of the screen: p95 from over 100 ms to 17-35 ms |
| Sectors of the same type do not expel each other; a sector of known size is downloaded only if there is room | `sector-stream.ts` | See above |
| Wider view limited to 3,000m (desktop) and 2,400m (compact) | `farthest()` to `main.ts` | Each building is always designed; merged isolates only appear during a load |
| A loaded area only holds footprints, trees and objects: ground tiles and road cover drop after drawing. Beware of release functions that share scope with the downloaded data - they keep it as alive as the | zone `loadZoneLevel()` to `sector-stream.ts` | With the two lines below: heap from 145 to 104 MB at the widest view on Schamann, from 128 to 101 MB in the benchmark |
| No normals per vertex in the middle and far view of the compact profile: flat-shaded materials and no shadow map | `overview.ts` | 12 out of 27 bytes per vertex; geometry buffer from 66 to 41 MB at largest view |
| Far layer contours released after doing geometry | `streamCity()` | Approximately 4 MB |
| Far layer silhouette without copy in memory after upload; the outlines of the blocks remain in typed arrays (1.6 MB) and serve only to redraw them after the loss of the WebGL context. The distant ground remains in memory: the elevation sampler reads the triangles | `packBlocks()`, `farSilhouettes()` and `forget()` to `sector-stream.ts` | Overall: Benchmark heap 77.1 to 67.5 MB; buffer 29.1 to 21.5 MB at close range and 32.6 to 24.1 MB at widest view. Identical rendering (differences in wind and cloud noise) |
| Distant-level silhouette without an in-memory copy after upload; block outlines remain in typed arrays (1.6 MB) and are used only to redraw them after WebGL context loss. The distant ground remains in memory: the elevation sampler reads its triangles | `packBlocks()`, `farSilhouettes()` and `forget()` in `sector-stream.ts` | Across the city: benchmark heap from 77.1 to 67.5 MB; buffers from 29.1 to 21.5 MB up close and from 32.6 to 24.1 MB at the widest view. Identical output (differences within wind and cloud noise) |
| Copy in memory of the geometries freed after uploading to the GPU; when the WebGL context is lost, zones and sectors are reloaded from the | `gpuOnly()` and `forget()` to `sector-stream.ts` | Heap from 104 to 89 MB at widest view, 101 to 79 MB in benchmark |
| Each zone and sector mesh drawn once upon arrival, even out of sight: without the first drawing there is no upload and the copy in memory is never free | `gpuOnly()` to `sector-stream.ts` | Heap 88 to 73 MB up close, 113 to 100 MB at widest view; the share passes to the GPU |
| Driving world (road network, walls, pedestrians) built on first Play, in steps, and released when the page is hidden without playing | `build()` and `release()` to `drive.ts`, `play.onclick` to `main.ts` | Heap 73 to 46 MB up close, 100 to 56 MB at widest view, 107 → 55 MB in benchmark. Cost: first Play from 0.3 to 0.6 s, from 1.3 to 5 s with 6× CPU |
| Guide: global road graph, walls and trees by zone; an unloaded area is considered full | `drive-world.ts` | The obstacle index does not grow with the city |
| City boundary indexed by 25m bands: a point only meets the sides of its own band | `ringIndex()` to `drive-world.ts` | −2.7 s at the opening with the coast of La Isleta (2,451 sides) |

## Proven things that are useless

- Removing sills (−11 % of triangles) does not eliminate double frames in Santa Ana.
- Merging with narrow thresholds (roofs within 0.6 m, tint within 26): in the densest sector merges only 14 buildings out of 385, because neighboring roofs almost always differ more. Without leveling the roofs, fusion is not profitable.
- Lightening the sectors does not proportionally reduce the triangles on the screen: the budget fills with more preloaded sectors. Count the number per sector, not just the number per frame.
- Double frames (one in ten, 35 ms) in the densest blocks remain with 220,000 as with 300,000 triangles. The main thread is unloaded (2-4 ms): the cost is in the integrated GPU and is not diagnosed.
- Reducing the dedicated models further does not change the cadence: all together there are 7,520 triangles against 80,000-280,000 on the screen, and their parts already end up in the single mesh of the buildings (no extra draw calls). Fewer segments on domes and arches would be seen up close.


## Ideas not yet tested

- Boot on phone (with 6× slower CPU: 14-25 s). Major entries in profile: `WebGLRenderer.setSize` and first use of shaders (3.6 s together, waiting for GPU after uploading full city ground texture), `makeGroundMap` of far layer (1.4 s), driving world and pedestrians built before first image (about 1.2 s), JSON validation. Done: driving and pedestrians after opening, opening onto the neighborhood without waiting for the detail (from 13.4 to 10.6 s). Remaining candidates: distant ground texture painted in the worker or smaller, reading and validating JSON in the worker.
- Detail budget also expressed in triangles, not just in bytes: dense sectors weigh more on the GPU than their size indicates.
- Imprints of the loaded areas kept for driving even when driving is off; streets, surfaces and coverage of the entire city always residents.
- After the step on the guide, with the map stopped, the following remain: geometries of the far and ground levels of the areas (12-13 MB), terrain (6.9 MB plus 7.6 in the worker), footprints of the areas (4-10 MB), roads and surfaces (6 MB). It is remeasured with `node scripts/heap-profile.mjs`.
- Faster First Play: road network in typed arrays or calculated in `sectors.py`, walls of the areas around the start only.
- To find what occupies the heap: snapshot with `HeapProfiler.takeHeapSnapshot` via CDP, sum of `self_size` by node type and name. `JSArrayBufferData` are the buffers, `(object elements)` and `Array` are the coordinates of the JSON.
- An object given to each zone does not have to contain the entire city: check what is redrawn or copied with each load before looking elsewhere for a shot.

- Walls entirely buried between two adjacent buildings (2 triangles per side).
- A single parapet where two roofs at the same height share the side.
- Reduced detail (no windows) for preloaded sectors outside the screen.
- Measurement on a real phone: All figures are from Chrome with mobile emulation on Intel UHD integrated GPU.

### Guaguas in Driving

The initial geographic catalog of the city weighs 2,010 bytes. The 960 m indices contain time and distance intervals for 240 m cells. The guide downloads geometries only for neighborhoods with candidate passages and reuses them between lines and variants. Simulation at 120 Hz updates a maximum of six buses. In Triana the A/B test on the emulated phone measures 16.8 ms at p90 both with and without buses and 0.1 ms at p90 for the fleet CPU. [Misura, limiti e riproduzione](QA.md#local-guaguas-in-conducir--city-network).

## Piper flight profile

The flight uses a dedicated [adaptive quality](../src/quality/README.md) system monitor. Enter at basic level the first time. The camera also uses the level's sight distance for haze. Nearby buildings and roadways maintain the geometry of the sector. The sector selection updates after 6 m of movement, a turn of approximately 2° or a maximum of 160 ms. Data arrivals and fades update the selection before expiration.

| Level | Detail close | Zones | Visibility | Buffer Scale | Shadows |
|---|---:|---:|---:|---:|---|
| −2 | 120 m | 360 m | 1,300 m | 70% | Off |
| −1 | 180 m | 480 m | 1,700 m | 85% | Off |
| Basic | 240 m | 640 m | 2,200 m | 100% | Off |
| +1 | 320 m | 800 m | 3,000 m | 100% | Off |
| +2 | 400 m | 960 m | 4,000 m | 100% | Statics |

100% in flight has a ceiling of 1920×1080, even vertically with the axes reversed. The monitor receives frames during ordinary streaming. The measurement is suspended when the Piper has to wait for the collision tracks or the landing road. During a promotion also waits for the visible details required by the new layer and the preparation of the shadows. Returning to the car recovers the confirmed terrestrial level.

To repeat the urban route at 1080p run `node scripts/benchmark-flight.mjs dist` after the build. The `?lab=qualita` lab shows mode, level, effective buffer, FPS and p95.
