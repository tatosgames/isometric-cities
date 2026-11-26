# Generate and expand the map

## Add a location

The work catalog is [las-palmas.json](../content/las-palmas.json). Tested example with a seventh place in a test copy:

```json
{"id":"alameda","name":"Alameda de Colón","osm":"way/251673532","areas":["city"],"markerHeight":2}
```
Add the entry to `places`. The name is the local one, the ID is unique and persistent, the height of the marker is in meters above the ground. Order governs numbering. The saved selection follows the ID. Assign `pilot` also in `areas` if the location falls within the pilot and must appear there. `pilotFocus` identifies the place that centers that crop and its detail view.

The script reads a polygonal way or a relationship with a single external way and a way for each internal ring. All members and nodes must be present in the XML. For a point POI, a multi-way split edge, or a relationship with multiple exteriors, first extend the player and check the resulting geometry. The marker uses an internal representative point. Casa de Colón is the control case for the three courtyards. Menu, tab and pin read the same GeoJSON via [places-ui.ts](../src/map/places-ui.ts) and the viewer area filter.

### Location sheet

Add a `card` block to the location entry:

```json
"card": {
  "text": "Testo in spagnolo, da 400 a 600 caratteri.",
  "link": "https://sito-ufficiale-o-wikipedia",
  "photo": {"file": "id-del-luogo.webp", "author": "Autore", "license": "CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:..."}
}
```
- **Text:** verified facts from a citable source, without tourist guide tones. `npm run check:data` (part of `build`) rejects texts outside 400–600 characters.
- **Photos:** free licenses only (Wikimedia Commons: CC BY, CC BY-SA, public domain), never generated. 16:9 crop at 960 × 540, WebP to `public/photos/`, recorded to [DATA_SOURCES.md](DATA_SOURCES.md). The build fails if the file is missing. `photo` is optional: without it, the tab does not show the pane.
- **Link:** official site of the place when it exists, otherwise Wikipedia in Spanish.
- `data.py` copies the block to `poi.geojson`; the neighborhood shown comes from `barrios.json`.

## Expand a neighborhood

1. Edit `coverage.zones` in the catalog. Each zone has a unique `id` and a single shape: `places` with `margin` (envelope of places listed, in meters), `axis` with `radius` (corridor of longitude/latitude pairs) `osm` (boundary relationship in OpenStreetMap, for example a barrio: `relation/16905756`) or `polygon` (longitude/latitude ring). The area is the union of the zones, cut out on the mainland using the OSM coast and Santa Ana as an internal point. Verify that the result is a continuous polygon, includes all locations, and reaches `minimumLandM2`. The pilot remains a 650 m square around `pilotFocus`.
2. Extend `coverage.bounds` beyond the new perimeter. The coast must cross the edge of the window and divide it into land and sea. `coverage.lattice` is the step in degrees of the fixed grid of requests to the Map API (0.01°): by widening the window the cells already in the cache are reused. The script merges nodes, ways and relationships by type and ID, maintaining the latest version. For larger areas consider a regional extract. Preserves the WGS84 origin (−15.415, 28.105) and the EPSG:32628 metric CRS. A place must be on land: a building on the rocks, off the OSM coast, stops generation. Municipal records without geometry are flagged and skipped.
3. OSM, ArcGIS, MDT05 and PNOA answers are in `.cache/sources`. The name contains a digest of the complete URL, including bbox and resolution. To update a source to the same URL, keep the previous snapshot and start a new capture in a separate cache.
4. Check that the municipal count matches the unique OBJECTIDs paged. The pipeline cuts out buildings, preserves courtyards and discards fragments under 2 m². Check the MDT05 soil at the edges. The viewer interpolates a single grid on both faces of each boundary.
5. The pipeline derives boundaries from pilot and city and downloads PNOA tiles up to 1024 px at 1 m/pixel. The viewer reads the impression shades from `roof-tones.json`. The pipeline still generates the WebP atlas and snippets for sectors as legacy assets. Each footprint has only one owner, determined by the center of its bounding box.
6. Check aperture, viewfinder and pan limits. The initial center of the city scene remains in [main.ts](../src/main.ts). A third stage requires changes to the generator and viewer selector, which now distinguish driver and city.

### Borderless neighborhoods in OpenStreetMap

If OSM has only one `place=suburb` node, it uses the perimeter of the Municipality's «Barrios» service: a `{"id": "...", "municipal": <NUCL_CO_ID>, "name": "<nome in spagnolo>"}` zone. `data.py` downloads the layer once (`ENTS_CO_ID=24`), expands the perimeter by 10 m to close the junction with the OSM boundaries and fills the holes below 2,000 m². The name must be written by hand with accents: the service gives it in capital letters without accents. First check that the union with the area already covered remains a single polygon. A barrio of another service entity (for example Tafira, 50) is indicated with `"entity": 50`; without it, the city is worth it (24). If the area exceeds the `coverage.bounds` window, enlarge it: towards the south it must contain the coastline beyond the edge of the model, otherwise the sea does not close. A `municipal` area without `name` is covered but not labeled (the «Diseminado» between one barrio and another). The filled holes reach 5,000 m².

## Reproducible generation
From the project root, with Python 3.13 and curl:

```powershell
python -m pip install --target .cache/pylib -r scripts/requirements.txt
python scripts/data.py pilot
python scripts/data.py city
python scripts/roof-colours.py
python scripts/sectors.py
```
To update only the hues read by the viewer, run `python scripts/roof-colours.py --palette-only`. To also update the colors of the distant view, regenerate the sectors. The full roofs command also updates the legacy Atlas and WebP. The filtered tiles are reused as long as the source JPEGs match, including neighboring ones. Before cutting the sector WebPs, the generator checks the extension, atlas footprint and limits of the cuts. If you reuse published WebPs, check their limits and digest in the name. When a new crop is needed, regenerate the complete atlas first.

Regenerations reuse the projected OSM, roadway masks, terrain faces, and sector meshes based on the data they depend on. Derived caches are local and rebuild on first use if they are missing or unreadable. From the same layers, `python scripts/data.py city` produces the canonical gzip at layer 9. For a working file, `python scripts/data.py city --gzip-level 6` uses the same output path and produces the same decompressed JSON. Rerun the default command to restore canonical gzip before comparing release files.

Check in `public/data` the two scenes, the two `*-aoi.geojson`, the shared `poi.geojson` and the two roof files. Both stages rewrite the shared POIs. The atlas uses both scenes already generated. Compare before/after boundaries and coordinates of pre-existing locations. For an extension, check the continuity of roads, ground, buildings and colors on each new edge.

## Public buildings and houses in historic neighborhoods

- **Large public building:** in `catalog.buildings`, `"balconies": false` removes the protruding balconies and leaves the windows (hospitals); `"windows": false` also removes those (shopping centers, warehouses).
- **Canarian balcony:** the houses up to 15 m inside the perimeters of `src/data/historic-quarters.json` (today Vegueta and Triana, copied from `barrios.json`) have a closed wooden balcony with a roof. To add a historic district, add its ring to that file.

## Beaches and seafront

- **Building archetype:** `data.py` assigns `kind` (`hall` or `block`) from OSM tags and floor plan depth to buildings without a catalog entry; in the catalog `kind` imposes it and `"housing"` denies it. A municipal record that is an entire lot takes `footprint: "osm"` after verification on the orthophoto: only the buildings that OSM maps within it remain.
- **Soil type:** a surface takes `ground` (`grass`, `asphalt`, `earth`, `rubber`, `pitch`; colors in `src/data/road-style.json`) from the OSM tag `surface`, from the type (`leisure=playground`, `leisure=pitch` at street level) or from the catalog entry `grounds` (way id → type), to be used when the orthophoto shows a ground that OSM does not declare. The surfaces are painted from largest to smallest: a flowerbed inside a square remains visible.
- **Water:** `data.py` writes the OSM areas `leisure=swimming_pool` and `natural=water` between 4 and 20,000 m² as surfaces `water`; `ground-map.ts` paints them last with `color.water`. A swimming pool within a municipal footprint remains covered by the building: lower that part with `split.polygon` (Club Metropole).
- **Sand:** `data.py` writes each OSM area `natural=beach` of sand as a surface `beach`; `ground-map.ts` paints it with `color.beach` from `src/data/road-style.json` and the ground shader gives it ripples instead of pavement joints.
- **Paseo:** a pedestrian street whose name is in `promenade.names` of `road-style.json` is drawn at the width and color indicated there, with the light band in the center. Width and colors come from reference photographs; the route remains that of OSM.
- **Sectors without a roof atlas:** if the PNG atlas and its metadata are missing or incompatible, `sectors.py` keeps each sector's published roof tile and stops with an error if a sector's buildings have changed. This is sufficient for regeneration after surface and road changes.
## Dedicated objects and models

- **Point objects** (cranes, chimneys): `data.py` reads them from OpenStreetMap and writes them to `city.json.gz` as `props`, i.e. `[type, x, y, orientation, size]`. `sectors.py` distributes them into sectors and zones. A new type requires an entry in `data.py` and a drawing in `src/render/port-props.ts`, with a simplified version for the intermediate view. Do not draw objects that OSM does not map or assign dimensions to objects mapped only as points.
- **Dedicated model of a building:** an entry in `catalog.buildings` with `landmark`, colors and `windows: false`, and a function in `src/render/landmarks.ts` registered in `models`. `frame()` gives the footprint center, direction and half-dimensions; `facade()` places parts along one side. Take heights from LiDAR (5 m cell grid), the plan from a 20 cm orthophoto, and facades from photographs used only as references. If the municipal record contains multiple bodies, use the individual body key `OBJECTID:floor(x minimum):floor(y minimum)`. Stay within approximately 1,500 triangles and inspect the model from at least two orientations. For simple roofs and bodies, reuse `roof()` (pitched or hip roof on a rectangle), `block()`, `bounds()` (oriented footprint rectangle), `eaves()` (tile bands along walls and courtyards), and `pitched()` (roof over the entire footprint). Draw what the orthophoto shows from above; add bell towers, portals and facades only when their positions are verified.
- **Monument that the Municipality does not map:** an entry in `catalog.osmBuildings` with the OSM way of the footprint (`osm`, plus any `holes`), the height in meters, the `landmark` and the appearance. `scripts/osm_buildings.py` transforms it into a building with a negative id and `source: "osm-estimate"`; `data.py city` adds it to `city.json` and `sectors.py` distributes it, including driving collisions. Height is a stated estimate until `lidar-check.py` measures it. `heightOverride` can lower only the extruded part when the model draws the rest (stadium bleachers). Examples: Estadio de Gran Canaria and Castillo de Mata.

## Sectors, guidance and memory

After each new neighborhood repeat the optimization step described in [PERFORMANCE.md](PERFORMANCE.md): measure the heaviest sectors with `node scripts/frame-profile.mjs <x,y,zoom>` and check that the tricks already applied hold up. `sectors.py` simplifies sector and zone footprints within 0.1 m; `city.json` retains the original vertices.

The sector catalog is `public/data/city-index.json`. The JSON and WebP detailed in `city-sectors/` have names derived from the content. Distribute them together with the index. The `sectors.py` step removes your old generated files. For repeatable regeneration, keep the intermediate mosaic `.cache/roof-atlas.png` or regenerate it first.

The city viewer no longer loads `city.json`. `sectors.py` writes three levels:

- **Core** (`city-core.json` and `city-terrain.bin`): border, roads, surfaces, terrain grid in Int16 in decimetres, in boxes of 64 cells (320 m) and only where they touch the mainland plus 100 m (`terrain.tile` and `terrain.tiles` in the core; outside it is 0), and, for each zone, the far level: one prism per block (footprint union, area-weighted average height and hue) and the 60 m mesh ground. He is always resident.
- **Zones** from 960 m (`city-zones/`, 4×4 sectors): outline of each building, crowns, ground at 15 m and footprints for collisions. They load when the long side of the view drops below 3,200 m in the compact profile and 6,000 m on desktop, with hysteresis of 9%. Two zones removed from view remain in memory, shown as a distant level.
- **Sectors** from 240 m (`city-sectors/`): detail, only inside a loaded area, under approximately 550 m of view.

The detail budget is 58 MiB in the compact profile and 115 MiB on desktop. It includes geometry arrays, bitmap pixels and an estimate of RGBA textures with mipmaps. Zones are counted separately (`zoneBytes`) and limited by the view. Total browser memory also includes the core, worker, driver and temporary resources. Measure on the target device. Read the `data-sectors` counters on the scene container: `near`, `mid`, resident zones, pending sectors, resident sectors, visible sectors, evictions and estimated bytes.
In Conducir the road network and routes are valid throughout the city. Walls, roofs and trees come with zones: the terrain of a zone not yet loaded counts as occupied, and the departure awaits the zone under view.

To measure at full scale without new data: `python scripts/sectors.py --stress 6` tile six copies of the city into `public/data/stress-*` (ignored by Git), then `npm.cmd run build` and `node scripts/benchmark.mjs dist "?area=stress"`. The dataset measures load, not throughput.

The terrain mesh is aligned to the metric origin in 15 m steps. Each 240m cell includes OSM strokes that intersect an edge and paints the terrain at 2px/m, with an outer 5m for the filter. The road graph and the collision grid are resident regardless of the visual sectors. Routes reuse the distance field when the source node is the same.

## Architecture and visual rendering

In the catalog, `buildings` is indexed by municipal OBJECTID. Use `heightOverride`, `wallColor`, `windows` and `roofFurniture` to customize the building. `pavedParks` contains the OSM way IDs for paved parks. For Santa Ana, `split.osmWay` divides the municipal footprint between the inside of the mask and the rest. The `inside` branch defines its own attributes and `toneSuffix` distinguishes the color of the nave for the same OBJECTID. When OSM does not map the part, `split.polygon` accepts a ring in local meters drawn on the orthophoto at 20 cm (El Muelle: atrium and forecourt; Elder Building: glass cube). Check after `data.py city` that the division does not leave splinters a few m² high.

**Roads below ground.** `data.py` discards ways `highway` with `tunnel` and those with every negative `level` (Santa Catalina Station lanes have `level=-1` without `tunnel`). A surface road that ends where an underground section begins receives `portal: true`: roadways and soil close it with a clean cut, like an entrance, instead of a round cap.

For a dedicated model, record the `landmark` key in [landmarks.ts](../src/render/landmarks.ts). Each key generates one model per scene even when cropping divides the building into multiple parts. Check the position, orientation and height of the model on its footprint. Compare neutral and stylized pilot with identical chamber. Use photos and Google Maps as private references for templates and palettes. Deploy geodata and imagery derived from documented open sources, with visible attributions and stated illustrative estimates. [Fonti e limiti](DATA_SOURCES.md)

## Take the pipeline to another city

Prepare separate catalog and data folder. Choose a primary source of footprints and heights, bare ground, and a reusable orthophoto. Record source, date, license, unit and resolution. Override bbox, source, transformations in both Python pipelines, local endpoints and fields, terrain reference, atlas extent, initial view, and dataset selection in the viewer. Check the alignment of a building, a square and a street in a pilot. Las Palmas models use site-local references.

## Checks before delivery

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
node scripts/qa.mjs pilot
npm.cmd test
node scripts/qa-sectors.mjs
node scripts/benchmark.mjs
```
Tests require Chrome. Compare the neutral/stylized Santa Ana pair, open the new markers and check names, index, zoom and restore after reordering. The city suite includes an additional test location, viewport rotation, pinch, and simulated WebGL context leaks. For large expansions compare the previous and new builds on the same device and browser. The benchmark takes the build directory as an argument. Controls draw calls and triangles for frames, heap peaking, buffer and texture stability after transitions, and draw calls at rest. The restore must report visible geometry, as well as HTML markers. On a real phone it also tests a long session when the GPU load changes.

Record sources or updates in [DATA_SOURCES.md](DATA_SOURCES.md), comparisons and actual results in [QA.md](QA.md), status and approximations in [PROGRESS.md](../PROGRESS.md). The Pages workflow reconstructs the demo from versioned data on push to main. Private caches, visual references, and temporary builds remain local.

## Roadways in new neighborhoods

The ordinary sequence `python scripts/data.py city` and `python scripts/sectors.py` also generates asphalt. You need the `scripts/requirements.txt` dependencies and the project's Node dependencies. Triangulation uses the same version of Three.js as the layout. After an OSM, DEM, grid or width update, it regenerates data and sectors together. The file names depend on the content.

Illustrative measurements and colors are in [road-style.json](../src/data/road-style.json). The generator also considers the roads in the nearby sector, joins the sections at the same altitude and cuts the result on the terrain faces. A corridor of 8 m per side around ways with `bridge` active or `layer` non-zero preserves the raster drawing of the intersection. Check local tags when adding bridges or ramps. The geometry describes the visible asphalt. The practicability and patrol routes continue to depend on the driving graph.

Run `python scripts/qa-carriageway-data.py` to verify protected junctions, dimensions, and crossings. To repeat the pilot use `python scripts/sectors.py --road-pilot`, rebuild the project and launch `node scripts/qa-carriageways.mjs`. Restore full build with `python scripts/sectors.py`, rebuild and repeat with `--full`. The benchmark uses Chrome and reference sectors from the `6bdb2da` commit, which must be available in the clone.

## Widening with free space

The target widths are 5 m for the ordinary ones and 9 m for the main ones. The base of 4.50 or 8 m remains available to calculate only the added band. The generator cuts out the strip with the footprints of buildings, trunks (radius 0.30 m), green and paved areas, pedestrian and cycle paths, the border of the mainland and protected corridors. The availability of space derives from the cartographic sources already included in the project. A sidewalk missing from the data may be free.

The resulting contour feeds panning and cropping of the meshes on the terrain triangles. The new optional field `roadCoverage` is found in the city index. The regeneration also produces three section samples measured in `public/data/road-width-lab`. To redo the width check, run `python scripts/qa-carriageway-data.py`, rebuild the build, then run `node scripts/qa-road-width-lab.mjs` and `node scripts/qa-carriageways.mjs --full --larghezze`. The reference for this comparison is the geometry of the `85b05aa` commit.

## Height control with LiDAR
The complete catalog of sources, licenses and access methods is in [GEODATA_SOURCES.md](GEODATA_SOURCES.md). The SITCAN 20 cm orthophoto can be read in stripes remotely (`python -I scripts/roof-compare-20cm.py`) to compare colors. Stripes resampled to 1 m are reused from the cache. With `--refresh` they are read back from the source.

For each new area, download from the CNIG Centro de Descargas (LiDAR, third coverage) the 1×1 km tiles covering it: filter by UTM 28N coordinates. The download requires an anti-bot check, so do it in the browser. Put the `.laz` files in `.cache/lidar/` and run `python -I scripts/lidar-check.py` (`laspy[lazrs]` is required in `.cache/pylib`, outside `requirements.txt`). Already decoded classified points are reused per tile, based on the LAS/LAZ file bytes. The report in `.cache/lidar-control/` compares municipal heights with LiDAR for each building and place. With `--export`, update `content/lidar-heights.json`, which `data.py` reads for buildings without a municipal height. Then regenerate `data.py city` and `sectors.py`. The cathedral and multi-part complexes must be read per part, not per OBJECTID.
