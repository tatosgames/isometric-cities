# Vegueta + Triana in isometria
Operational brief for Codex or Claude Code · November 21, 2026

## Start in 2 minutes

1. Create a dedicated project folder, for example, `tiny-las-palmas`. Save this file here as `PLAN.md`. Open **Codex CLI or Desktop** with that folder as the workspace, not in the home directory and not inside a production repo. Use a persistent machine with Node 24+ and Chromium/Chrome; run the agent in a local checkout. If Git is not initialized, it can create it in the workspace.
2. Paste the command below into the **interactive** session. If `/goal` does not appear, check the [official guide](https://learn.chatgpt.com/docs/cli/slash-commands#set-or-view-a-task-goal-with-goal) and the version; you can also send the sentence without `/goal` as a normal task and resume from the checkpoint file. Do not put the entire brief in the Goal field.
3. Keep write permissions limited to the workspace. Autonomy over implementation choices, not over expenses, credentials or publication. If the network is blocked, only authorize or pre-load the necessary dependencies and public data, without disabling the sandbox.

### Goal to paste

```text
/goal Read PLAN.md and build in this workspace a local, navigable isometric map of the historic centre of Las Palmas de Gran Canaria, with Vegueta and Triana. Validate Santa Ana–Casa de Colón first, then complete the pilot area defined in the brief. Deliver a procedural demo based on real geodata, with mobile and desktop pan/zoom, six verified POIs, visible attributions and no dependency on tiles from other cities. Verify with local tests, screenshots and docs/QA.md; leave reproducible commands and an updated PROGRESS.md. Fix problems with focused iterations. Do not spend, publish, push or use unauthorised credentials. AI repainting is not required: prepare the plan and stop before calling it. If a blocker prevents the goal and the brief fallbacks are insufficient, preserve the usable part and document evidence, limit and next step; do not claim the Goal complete.
```
### Why Codex; alternative Claude Code

Both support a persistent Goal in the session. I would choose **Codex** for this repo, not because there is a comparative benchmark on the project: IsometricWorld trains agents directly via `AGENTS.md` and its optional painter already includes the Codex CLI. With Claude Code you can use the same `PLAN.md` and the same `/goal`, in an updated interactive session; Claude can complete the entire procedural path without casting Codex. If available, use GPT‑6.2 Astra with High reasoning; Sol High is the fallback. The choice is about the development agent, not the image model. Don't have two agents write in the same checkout. If you already have a stable Claude environment on a persistent machine, it's a viable alternative.
[Goals in Codex](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex) · [Goal in Claude Code](https://code.claude.com/docs/en/goal).

---

## Agent brief

### Result and style

Build an **interactive illustrated map, not a poster and not a GIS navigator**. Urban model aesthetics: legible volumes, terracotta roofs where appropriate, cream and pastel colored facades, sober vegetation, coherent soft shadows. Make the square and the Cathedral of Santa Ana recognizable and the passage towards Triana. Don't invent roads, bridges, buildings, beaches or water: the Guiniguada must be shown as it is in current cartography, without transforming it into a historic canal. Use illustrative details for aesthetics, not to modify geometry. Place names are in Spanish. No animated traffic, weather, day/night, accounts, analytics, databases or gameplay in v1.

### Perimeter and checkpoint

- **Checkpoint A**: an area of about 500–800 m over Santa Ana and Casa de Colón. It must have a raw reference render and a stylized procedural render with the same camera. Check the points on the map before extending, without asking for approval for this normal iteration.
- **Delivery B**: Vegueta–Triana historic center, from Santa Ana/Museo Canario towards Calle Mayor de Triana and Parque de San Telmo, passing through Mercado and Teatro. Obtain the perimeter from the verified points with a small margin; don't extend it to all of Las Palmas. The exploration bbox, in west/south/east/north order, is `[-15.424,28.093,-15.409,28.113]` (EPSG:4326). It is a search boundary, not the final rectangle to render. Record AOI and points in GeoJSON WGS84 [lon, lat]; if the adapter works in meters it uses UTM 28N (EPSG:32628) or the upstream local metric reference, not Web Mercator as the measurement metric. The upstream AREAS array has [south, west, north, east] order, different from the ArcGIS bbox. Set origin, heading and scale before final tiles.
- **At least six POIs**: Plaza/Catedral de Santa Ana, Casa de Colón, Mercado de Vegueta, Teatro Pérez Galdós, Gabinete Literario/Plaza de Cairasco, Parque de San Telmo. Verify coordinates/boundaries on geodata and names with [official Vegueta sources](https://www.grancanaria.com/turismo/serviciosmultimedia/audioguias/las-palmas-de-gran-canaria/ruta-vegueta/) and [Triana](https://www.grancanaria.com/turismo/es/isla-de-gran-canaria/municipios-de-gran-canaria/las-palmas-de-gran-canaria/triana/). Optional: Canario Museum, Calle Mayor de Triana. Do not place POIs using generated images.
- **Optional Phase C, not to be carried out**: repainting plan for 4–9 contiguous windows around Santa Ana. Do not include it in the factual definition of v1; no purchase or use of a generation service. Explain how to compare the sample with the baseline and what would prevent the extension.
- **Optional Phase C, not to be carried out**: repainting plan for 4–9 contiguous windows around Santa Ana. Do not include it in the factual definition of v1; no purchase or use of a generation service. Explain how to compare the sample with the baseline and what would prevent the extension.
### Sources, order and checks

| Data | First choice | Fallback / verification |
| --- | --- | --- |
| Buildings and heights | [Municipal catalog](https://datosabiertos.laspalmasgc.es/dataset/?id=ubicaciones-edificios-geoespaciales) and [ArcGIS layer](https://services-eu1.arcgis.com/eV9RayDSwR2BokOl/ArcGIS/rest/services/Building/FeatureServer/0). Polygons, GeoJSON supported, nullable numeric field `MAX_BLDGHEIGHT_1`. | In the exploratory bbox, public queries from November 21: 5,216 polygons, 5,201 with positive height (99.7%). This is field coverage, **not** validation of units or measurements. Check units, range, and 3–5 landmarks. [Catastro INSPIRE BU](https://www.catastro.hacienda.gob.es/webinspire/) or OSM for alternative geometry; if measurements are missing, use OSM layers or an estimate of the declared class, never as a verified height. |
| Roads, coastline, green areas and POIs | [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL. Narrow query and cache, or local extract. | If Overpass does not respond, use an OSM extract with the same boundaries; do not repeatedly query endpoints that are returning errors, and do not use Google Maps/Earth screenshots as data. |
| Elevation | [IGN PNOA LiDAR/MDT](https://pnoa.ign.es/web/portal/pnoa-lidar/productos-a-descarga), prefer a bare, clipped DEM if accessible and licensed. | [GRAFCAN MDT25](https://datos.canarias.es/catalogos/general/dataset/modelo-digital-de-terreno-mdt-de-25x25-metros) or the Copernicus DEM already supported by the upstream. Document resolution and approximations: do not treat a surface model as bare ground without verification. |

For ArcGIS, use `/query` with `geometryType=esriGeometryEnvelope`, `inSR=4326`, `spatialRel=esriSpatialRelIntersects`, `outSR=4326`, `f=geojson` and only the required fields (technical ID, height). First compare the count with the download; use ordered pagination or an ID query if the service truncates, with at most 2,000 records per response. Do not export cadastral references or other unnecessary attributes to the viewer. Keep inputs and outputs separate; check reversed coordinates, CRS, invalid geometries, duplicates and overlaps between sources. Do not mix two footprints for the same building: choose one primary source and use the other for documented gaps. Keep an inventory of source, date, licence, geometry, units, query/cache and fallback. Check licences and attributions before sharing anything; data and asset terms are separate from the code licence. Attribute OSM in the interface too.

### Stack and minimum path

1. Use [krasun/isometricworld](https://github.com/krasun/isometricworld) as a base and read its [AGENTS.md](https://github.com/krasun/isometricworld/blob/main/AGENTS.md). Record the initial Git revision; inspect scripts/config before running third-party tools. [Roma / Mondo Isometrico](https://github.com/dg996/mondoisometrico) is the aesthetic reference; [the Pantheon test](https://raw.githubusercontent.com/dg996/mondoisometrico/main/docs/sviluppo.md) is not a substitute for upstream commands. [Pixel Chennai](https://github.com/rcdexta/pixelchennai/blob/main/STARTER_AGENTS.md) is useful for understanding cutouts, borders, and costs; there is no need to add its Python pipeline.
2. Define the region/city in `pipeline/src/places.ts` and the two AOI stages in `pipeline/src/areas.ts`. Add the theme to `pipeline/src/styles.ts` with `look: "styled"`. First, obtain the OSM/terrain reference with the existing path; then, only merge the verified municipal data. Avoid rewriting the renderer or frontend if the Three.js and Astro/OpenSeadragon stack works. If you use an equivalent local pipeline because the upstream is truly blocked, keep the verification criteria identical.
3. Upstream sequence to verify at the chosen SHA: `boundaries <region>` if needed, then `fetch <area>` → `ground <area>` → `scene <area>` → `render <area> -j 2` → `export <area>` → viewer. Prefer workspace scripts, for example `npm -w pipeline run render -- <area> -j 2`, after checking forwarding in package.json. `npm run dev` opens the viewer; `npm run typecheck` is available in the inspected upstream. Configure and demonstrate the Las Palmas route with local assets, without a silent fallback to R2 or a demo city. Test and report the exact final commands in the project README.
4. Export the web tile pyramid and add POIs and attributions. Minimal UI: drag and zoom, reset view, POI tab on tap/click, keyboard controls. If you can, toggle between neutral and stylized rendering; otherwise, attach a comparable screenshot of each. Do not republish the tiles of Rome. Leave cache and secrets out of Git; no deploy/publish/archive, push, or calls to image services.
5. Plan the potential repainting without carrying it out: color render + height pass + reusable stylistic reference, overlapping windows, same camera and palette, masks, and seam correction. Keep titles and markers in the viewer, not in the model. Check the revision flags: Upstream documents `--plan` and `--window` (singular); Rome uses different flags. Do not make v1 dependent on painter or credentials.

### Tests and definition of done
- The demo opens locally at the correct point with the Vegueta–Triana assets and works in a 1440×900 desktop viewport and a 390×844 mobile viewport. Test dragging, zooming, resetting, and opening all six POIs. No unhandled JavaScript exceptions, failed requests for expected tiles, or requests for tiles from other cities in the test interactions. Check the name, keyboard access, and readable attribution.
- Visually check at least the Santa Ana and Cathedral axis, the position of the Market in relation to the Theater, the continuity of the neighborhood near the Guiniguada, and the arrival at San Telmo. Compare at least one junction per side and two zoom levels. The six POIs must correspond to verified data, not just images. Indicate approximate areas; do not declare cadastral accuracy.
- Run typecheck and automatic smoke test with the available browser runner; save at least three screenshots: overview, Santa Ana and mobile in Triana. Minimum files: `README.md`, `PROGRESS.md`, `docs/DATA_SOURCES.md`, `docs/QA.md`, boundaries and POIs in data format, tests and visual checks. `docs/QA.md` lists commands, true result, known defects, and links to screenshots.
- Maintain a reproducible path from cached input, log the number of tiles, size, and real-time durations. Preflight disk and dependencies; maximum of 2 concurrent renderings and initial operating target of maximum 5 GB of local cache. If a phase risks exceeding it, first reduce the margin, resolution, or zoom level, without excluding POIs; if that is not enough, stop. No large-scale downloads beyond the perimeter if a crop is available.
- Proceed autonomously with development, tests, fallbacks and internal fixes. At each checkpoint record what works, what does not, the data used and the next action. If a source cannot be used, make one targeted attempt and move to the fallback; do not loop. If you cannot verify a result, say so. The final message must give the start command, what was verified, what remains out of scope and where to find the evidence. Do not ask Luca to approve routine technical details.


### Draft for the painter, only for a future authorized phase

Use the [upstream painter](https://github.com/krasun/isometricworld/blob/main/pipeline/src/paint.ts) as reference. Keep the neutral render separate. With the revision pinned, check the plan without generation and explicitly select 4–9 windows; in the inspected source the singular form uses semicolon-separated pairs, for example `--window='i,j;k,l'`. Run one job at a time, with one retry and an explicit time limit. Do not use `PAINT_BUDGET_USD=0` as a block: in that revision zero means no cap and the limit does not cover every backend. The v1 gate is **do not start the painter**.

```text
Only repaint the masked viewport of the given isometric scene.
The color render and the height map define the camera, scale, and position:
retain building perimeters, alignment of streets, squares and
terrain levels. Use the edges that have already been painted as constraints, not as new ones.
objects. Look: contemporary scale model of Vegueta and Triana, Canarian
sun, cream and pastel plaster, roofs consistent with the reference.
Do not add buildings, bridges, waterways, text, labels or borders.
Do not change dimensions, perspective, vanishing points or crop.
```
The prompt does not guarantee correctness: compare the output and render as an overlay, discard tiles that move a reference, and keep clickable points as separate data. Do not move to the full neighborhood until the small sample is repeatable.
