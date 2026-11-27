# AGENTS.md · Indice base

Las Palmas · Island atlas: interactive urban model of Las Palmas de Gran Canaria (Three.js + Vite, framework-free TypeScript). Processed geodata is in `public/data`, with no dependency on external tiles.

Project roadmap

| Percorso | Ruolo |
|---|---|
| `index.html`, `style.css` | Page shell and styles (minimal UI) |
| `editor.html`, `src/editor/` | **Deprecated** (not linked from the labs, kept in the build for possible reuse). Local pilot editor: dragging buildings, vertices and props (`building-drag`, `pilot-preview`, `props`); test `scripts/qa-editor.mjs` |
| `lab.html`, `src/lab/` | Visual lab (`?lab=roads&case=mercado\|widths\|sectors\|lod`): roadways and LOD transitions. Interface and URL in English |
| `src/url-state.ts` | The query string of map, drive and labs: nine names (`lab`, `case`, `mode`, `area`, `at`, `on`, `off`, `look`, `tune`), helpers to read and write them, old links rewritten at start (`upgradeUrl`); test `scripts/qa-url-state.mjs` |
| `src/drive/drive-weapon.ts`, `scripts/qa-drive-fire.mjs` | Car's gun in the drive (bottom-centre button and F, 3 s cooldown ring): level slug straight ahead against buildings, patrols and guaguas, screen shake, thrown bodies; buildings come down through `demolition/demolish.ts` and are rebuilt out of view (`showBuilding`, `restoreBuilding`) |
| `lab.html?lab=demolition`, `src/lab/demolition-lab.ts`, `src/demolition/`, `scripts/qa-demolition.mjs` | Demolition lab: wrecking ball, dynamite and the drive's gun (key 3, `TUNE.weapon`, `shotBlast`) with the mouse; 2.5D fracture of the footprint (`fracture.ts`), visual debris, dust and rubble (`debris.ts`), shared demolisher (`demolish.ts`) and ray against footprints (`ray.ts`); buildings hidden through `trackBuildings`/`hideBuilding` of the sector stream |
| `lab.html?lab=flood`, `src/lab/flood-lab.ts`, `src/flood/` (public API `src/flood/index.ts` only), `scripts/qa-flood.mjs`, `scripts/qa-flood-solver.mjs`, `scripts/flood_facilities.py`, `public/data/flood-facilities.json`, [docs/FLOOD.md](docs/FLOOD.md) | Flood module and lab: `createFlood` (grid, worker, water, markers, gauges, history) around the LISFLOOD-FP inertial solver on the 5 m DEM; design floods by return period with Norma 5.2-IC (`flood-hydrology.ts`); JRC damage, FD2320 hazard and Clausen & Clark collapse (`flood-impact.ts`); OSM critical facilities; optional event report (`flood-panel.ts`). Self-contained: FLOOD.md says how to reuse or remove it |
| `src/lab/drive-lab.ts`, `scripts/qa-drive-lab.mjs` | `index.html?lab=drive&area=pilot` Driving simulator: the real game with a panel that changes `TUNE` live (player, patrols, cars, camera), police yes/no, values in the URL (`tune=`) and copy for `drive-tune.ts` |
| `src/main.ts` | Camera, input, filter by area and WebGL context recovery |
| `src/data/` | Contracts and validation of geodata and saved view |
| `src/data/load.ts`, `types.ts`, `sector-index.ts`, `pilot-edits.ts`, `src/required.ts` | Three-level loading, types shared with the worker, sector index, editor corrections, mandatory DOM access |
| `src/boot.ts`, `src/map/dom.ts`, `src/map/framing.ts` | Start (phase, progress, error, attribution note), DOM references, orientation and zoom limits of the map camera |
| `src/drive/drive-tune.ts`, `drive-types.ts`, `drive-effects.ts`, `drive-crowd.ts` | `TUNE` parameters and constants, shared types, particles and skid marks, pedestrian view (extracted from `drive.ts`); particles and trails moved by the GPU |
| `src/drive/drive-route.ts`, `drive-location.ts`, `drive-pose.ts`, `road-grade.ts`, `building-occlusion.ts`, `car-model.ts` | Destinations and currencies, place names, ground clearance, gradient and recovery, camera above buildings, car model |
| `src/render/city-materials.ts`, `ground-surface.ts`, `ground-map.ts`, `building-stencil.ts`, `port-props.ts`, `sectors/lod-transition.ts`, `sectors/protocol.ts` | Shared materials, ground and roadways, building hatching, cranes and port objects, LOD transitions from 250 ms, worker protocol |
| `scripts/check-data.mjs`, `audit-city.py`, `osm_extract.py`, `carriageways.py`, `road_sections.py`, `source_cache.py`, `requirements.txt` | Data index check (part of `build`), city audit, OSM extracts on grid, roadways, source caches |
| `scripts/qa-browser.mjs` | Shared launch of browser tests: choice of browser (`CHROME_PATH`) and build server (`MAP_URL` for a map already running) |
| `scripts/osm_buildings.py` | Monuments missing from the municipal layer (`osmBuildings` in the catalog): OSM footprint, estimated height, negative IDs |
| `scripts/geo.py` | Map origin and EPSG:32628/4083 conversions shared by Python scripts |
| `src/geometry.ts` | Angle in the range ±π, point inside a polygon and exponential damping (`approach`), shared by map, guide and data |
| `src/render/map-camera.ts`, `scripts/qa-map-camera.mjs` | Orthographic camera shared by map, guide, editor and workshops: pixel edges, distance, isometric angle, view offset next to the tab; dedicated test |
| `scripts/qa-*.mjs` (boot, drive-*, pedestrians, recovery, sectors, ground, carriageways, lod, road-lab…) | Targeted Playwright tests; `qa.mjs` is the complete suite |
| `src/drive/drive-camera.ts` | Calculation of camera positions and transitions in the guide |
| `tsconfig.json` | Strict control of browser runtime and worker |
| `src/render/game-renderer.ts`, `src/lab/lab-city.ts` | The game's renderer (look, output/FXAA, lights, adaptive quality, static shadows, wind clock) shared by map and labs; the labs' city streamed from the published sectors |
| `src/render/gl-diagnostics.ts` | `[atlas:gl]` console reports: GPU at start, context lost/restored with view, sectors, quality and GPU objects, restore that never comes, GL errors such as OUT_OF_MEMORY |
| `src/render/dynamic-quality.ts` | Device profiles and adaptive quality of shadows, anti-aliasing and resolution for map and guide |
| `src/render/wind.ts` | Single wind: shadows of moving clouds, swaying treetops and palm trees, 30 fps cycle with static map |
| `src/render/sea.ts` | Sea from the coast OSM: seabeds, waves with wind and foam on the shore with a distance texture |
| `src/drive/drive.ts` | "Driving" mode, Pako style: game cycle, patrols, coins, rendering, HUD, and `TUNE` parameters |
| `src/drive/drive-world.ts` | Obstacle grid (with internal water), visibility and road network for driving |
| `src/drive/drive-surface.ts`, `scripts/qa-drive-surface.mjs` | Surface under the wheels (asphalt, paving, grass, soil, sand) on painted tiles on request; test of classes, times and driving on sand |
| `src/drive/drive-physics.ts`, `drive-chase.ts` | Single driving model for player and patrol cars (`steerCar`: front end, skidding, gears; `TUNE.player` and `TUNE.patrol` profiles), collisions with obstacles and vehicles; steering of patrol cars toward the player. Tests `scripts/qa-drive-handling.mjs`, `qa-drive-chase.mjs`, `qa-drive-pose.mjs` |
| `src/drive/pedestrians.ts` | Pedestrians in the driving environment: routes, avoiding vehicles, rule preventing collisions |
| `src/drive/drive-input.ts` | Touch and keyboard controls, input capture and release |
| `src/render/sectors/sector-stream.ts`, `src/render/sectors/sector-builder.ts`, `src/render/sectors/sector-worker.ts`, `src/render/overview.ts` | Priorities and budget, out-of-thread construction, overview |
| `src/drive/road-routing.ts` | Index of patrol nodes and routes |
| `scripts/sectors.py`, `scripts/qa-sectors.mjs` | Generation of core, zones and sectors (`--stress N` for load replication) and crossing test |
| `public/data/city-core.json`, `city-terrain.bin`, `city-zones/`, `city-sectors/` | The three levels loaded by the viewer: core with merged blocks, 960 m zones, 240 m sectors |
| `src/render/scene.ts` | Scene construction: buildings, roads, surfaces, trees, optimized meshes |
| `content/las-palmas.json` | Catalog of locations, pilot center and styles by building |
| `src/map/places-ui.ts`, `src/render/landmarks.ts` | Menus and markers with persistent IDs, dedicated procedural models |
| `src/map/place-card.ts`, `public/photos/` | Location card (photo, neighborhood, name, text, link) with its animations; panel on the left or sheet from the bottom. Photo under free license, credits in `docs/DATA_SOURCES.md` |
| [Map expansion guide](docs/EXPAND_CITY.md) | POIs, neighborhoods, new cities, caches and verifications |
| `public/data/` | `city.json.gz` (city layers, gzip without date: read and written with `scripts/city_layers.py`), `pilot.json` (+ AOI), `poi.geojson`, `roof-tones.json`, `roof-colours.webp`, `sea.json` (sea and coast, from `data.py city`) |
| `scripts/data.py` | Data acquisition/regeneration (`pilot`, `city`), cache in `.cache` |
| `scripts/roof-colours.py` | Roof palette |
| `scripts/qa.mjs`, `scripts/benchmark.mjs`, `scripts/frame-profile.mjs`, `scripts/heap-profile.mjs`, `scripts/shot.mjs` | QA Playwright, benchmark, frame profile in a location (frame rate, triangles, main thread time), who occupies memory in a view (heap snapshot by owner), and identical camera capture for before/after comparisons (`x,y,zoom[,turn]`) |
| `docs/UI_ANTI_SLOP.md`, `docs/CAMERA_FRAMING.md`, `docs/JUICE.md` | UI rules (no in-game text, one fact one indicator), camera framing contract and driving game feel catalog (hit-stop, camera shake): read before touching HUD, camera or effects |
| `docs/DATA_SOURCES.md`, `docs/QA.md` | Data sources/attributions, QA report and screenshots |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Catalog of optimizations that do not affect yield, with measurements, and step to be repeated after each section |
| [docs/GEODATA_SOURCES.md](docs/GEODATA_SOURCES.md) | Catalogue of additional sources: PNOA LiDAR, 20 cm SITCAN orthophoto, GRAFCAN, licences, access and outcomes |
| `scripts/lidar-check.py`, `content/lidar-heights.json`, `scripts/roof-compare-20cm.py` | Height check with LiDAR (and correction of buildings without municipal data only), comparison of roof colors with the 20-cm orthophoto |
| `PLAN.md` | Original brief for the agent (perimeter, style, checkpoint) |
| `PROGRESS.md` | Checkpoint corrente (A Santa Ana, B Vegueta–Triana, C studio futuro) |
| `.github/workflows/pages.yml` | Pubblicazione su GitHub Pages |

## Commands (Windows, Node 24; on Linux/macOS use `npm` instead of `npm.cmd`)

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5197
npm.cmd run typecheck
npm.cmd run build
npm.cmd test            # scripts/qa.mjs; requires Chrome
```

The browser tests start from `scripts/qa-browser.mjs`. If Chrome is not installed (e.g., on Linux), another Chromium is indicated with `CHROME_PATH`, e.g., `CHROME_PATH=/opt/pw-browsers/chromium npm test`.

## Rules

- Maintain a single animated behavior for each room, guide, and interface across all devices, regardless of the system's motion preferences.

- Read `PLAN.md` and `PROGRESS.md` before changing the perimeter, style or data.
- Do not invent roads, buildings or bodies of water; use place names in Spanish; keep attributions visible.
- No expenses, credentials, push notifications, or publications without authorization. No AI-generated images until authorized (point C).
- `.cache`, `dist`, `node_modules` do not go into Git. Only one agent writes to the checkout at a time.
- After changes to the scene or data: `typecheck`, `build`, `npm.cmd test` and update `docs/QA.md` / `PROGRESS.md`.

## Skill Codex

**Project** (`.agents/skills/`, copy for Claude in `.claude/skills/`): `threejs-performance` (measure and optimize draw calls, memory, instancing, LOD); `expand-city` (guide for adding areas, POIs or cities: sources, CRS, pipelines, QA, mobile limits).

Also from the project, copied from other Rising Pixel repositories: `threejs-fundamentals`, `threejs-geometry`, `threejs-materials`, `threejs-lighting`, `threejs-textures`, `threejs-shaders`, `threejs-postprocessing`, `threejs-animation`, `threejs-interaction`, `threejs-loaders`, `threejs-asset-pipeline` (MIT license in `THREEJS-SKILLS-LICENSE`), `game-design`, `web-games`. These are general recommendations: they do not authorize new dependencies and do not take precedence over this file.

**Globali** (`~/.codex/skills/`), rilevanti qui:
- Three.js: `threejs-choose-skills`, `threejs-visual-validation`, `threejs-particles-trails-and-effects`, `diorama`, `shader-art-coding`
- Browser/QA: `chrome-devtools`, `chrome-devtools-cli`
- Design UI: `impeccable`
- Gioco: `ohmygame-studio`
- Quality code: `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`

Non pertinenti a questo repo: `linkedin-*`, `rising-pixel-*`, `supabase*`, `lovable`.

**Global** (`~/.agents/skills/`, managed by `.skill-lock.json`): `frontend-design`, `web-perf`, `find-skills`, `impeccable`, `seo`, `seo-audit`, `frontend-react-best-practices`, `framer-motion-animator`, plus Cloudflare/Supabase/sandbox skills that are not relevant.
