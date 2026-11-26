# Additional geodata: where they are, how they are obtained, what they are for

Catalog of work for improving buildings, 3D objects, roads and colors. The sources already in production are in [DATA_SOURCES.md](DATA_SOURCES.md). Here are those evaluated on November 22, 2026, with links, reproducible access, license and outcome. Attributions should be added to `DATA_SOURCES.md` when data enters the published map.

## Summary

| Source | Outcome | License | Usage |
|---|---|---|---|
| LiDAR PNOA 3rd coverage, Canary Islands (CNIG) | Validated on 554 buildings | CC BY 4.0 compliant, attribution required | Height control and correction; heights of crowns and roofs |
| Orthophoto 20 cm 2024 (SITCAN) | Hues coinciding with PNOA (median ΔE 2.9) | CC BY 3.0, commercial use permitted | Second source for colors and visual inspection of buildings and streets; coverage of the whole island |
| SITCAN Open Data, other datasets | Evaluated, little interest | CC BY 3.0 or Aviso Legal SITCAN | See table below |
| WMS and GRAFCAN store | Do not use in pipeline | Consultation only, commercial use and mass dumping prohibited | Visual reference |
| Microsoft Building Footprints, Overture | Not necessary | ODbL | Polygon cross-check only |
| Wikimedia Commons | Reference photo for monuments | By file (CC BY, CC BY-SA, public domain) | Landmark silhouettes and palettes |

## LiDAR PNOA, third coverage (CNIG)

- **Product:** NPC02 classified point clouds, Canary Islands flight November 2023 – January 2024, at least 5 points/m², declared vertical accuracy 10 cm, 1×1 km tile in LAZ. Page: <https://centrodedescargas.cnig.es/CentroDescargas/lidar-tercera-cobertura>.
- **License:** compatible with CC BY 4.0, mandatory attribution: «© Instituto Geográfico Nacional» (see the «Licencia» section of the page). The file remains in `.cache/lidar/` and does not go to Git.
- **File name:** `PNOA-2023-CANAR-<E km>-<N km>-H28-NPC02.laz`. The number is the northwest corner of the tile. The Vegueta tile is `PNOA-2023-CANAR-459-3109-H28-NPC02.laz` (E 459–460 km, N 3108–3109 km, 50.9 MB, 6.7 points/m², REGCAN95 / UTM 28N).
- **Classes present in the tile:** 1, 2 (soil), 3, 4, 5 (low, medium, high vegetation), 6 (buildings), 7, 9 (water), 12. The meaning follows the ASPRS standard; the NPC02 edition also adds bridges, vehicles, cables and panels. Grades 7, 9, and 12 were not analyzed.
- **How ​​to download (cannot be automated):** the server responds 403 to any script request, even from the browser integrated with `fetch`, and the download module uses reCAPTCHA. From the browser, as a person:
  1. Open the page, set «Scope» to **Coordenadas**, choose UTM, huso 28, insert E and N of a point inside the tile (example: 459500, 3108500). You don't need the search button.
  2. Press «Apply filters»: the list is reduced to the tile that covers the point.
  3. Press the download button next to the file and accept the license.
  The default filter, without coordinates, lists Catalonia (`CAT`, UTM 31N): check that the name contains `CANAR` and `H28`.
- **Control and use:** `python scripts/lidar-check.py [--export] [file_o_cartella]` (requires `laspy[lazrs]` in `.cache/pylib`, installed outside `requirements.txt`). For each building measure the p95 of the class 6 point shares in the footprint minus the median of the class 2 points in an 8 m ring. Writes `.cache/lidar-control/report.json` and `buildings.csv`. With `--export` updates `content/lidar-heights.json`: `heights` for OBJECTIDs without valid municipal height and `parts` for the low buildings of a complex, where the municipal exceeds the measured roof by more than 10 m, and for buildings where the measured roof exceeds the municipal by more than 10 m and the median of the points confirms it (over 5 m above the municipal, at least the 75% of p95). `data.py` uses both. With twenty tiles the check takes about two minutes.
- **Results on Vegueta** (577 buildings, 554 measured): median LiDAR minus municipal deviation +0.8 m, average absolute error 1.82 m, 74 % within 2 m, 93 % within 5 m. Theater 30.6 / 30.7 m, Mercado 13.5 / 12.4 m, Gabinete 25.3 / 24.7 m, Casa de Colón 13.4 / 12.9 m. Details in [QA.md](QA.md#municipal-heights-against-lidar-november-22-2026).
- **Limitations:** The multi-part municipal field for OBJECTID (cathedral 41119, five parts) must be read by part. There remain gaps of 10 m or more on individual unverified buildings. Thirty tiles downloaded as of November 23, 2026, from San Cristóbal to La Isleta; 454-3112, 455-3111, 458-3106 and 458-3107 are missing. The peninsula north of La Isleta has no municipal buildings and requires no tiles. After each download the filter is reset: it must be reset for the next tile. With Ciudad Alta there are 40 cached tiles; 454-3109 arrived truncated (download it again and make sure `laspy` reads it all the way through before using it).

### Possible uses not yet implemented
- **Buildings:** heights per side, roof volumes (ridges, towers, skylights) from class 6 points, heights of eaves against ridge, buildings built after the municipal survey.
- **3D objects:** real heights of the canopies from points 3-5, to calibrate the procedural trees; verification of towers, domes and landmark roofs.
- **Roads:** soil profile (class 2) along the roadways to control the DEM levels in the differences in height, bridges and ramps.

## Orthophoto 20 cm of 2024 (SITCAN)

- **Dataset:** <https://opendata.sitcan.es/dataset/ortofoto-20-cm-pixel-de-canarias-2024>. One GeoTIFF per island. Gran Canaria: <https://opendata.sitcan.es/upload/251/OTARM20/tif/251_OTARM20_GC.tif>, 10.3 GB, EPSG:32628, 0.2 m/pixel, 3 bands, extension E 417–466 km, N 3067–3118 km. There is also the infrared CIR version (`ortofoto-cir-20-cm-pixel-de-canarias-2024`) and the 2018 and 2021 series in JPEG 2000.
- **License:** `gobcan-aviso-legal`: CC BY 3.0 from the Gobierno de Canarias, commercial use permitted. Obligations: cite «Fuente: Gobierno de Canarias» with the update date (August 2025) and not alter the meaning of the information. Text: <https://opendata.sitcan.es/notice>.
- **Do not download the entire file.** The TIFF is tiled with JPEG compression and overview (4, 8, 16, 32, 64), and the server accepts partial requests. `rasterio` reads a window with `/vsicurl/`:

```python
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif'):
    with rasterio.open('/vsicurl/https://opendata.sitcan.es/upload/251/OTARM20/tif/251_OTARM20_GC.tif') as r:
        data = r.read(window=Window(col0, row0, w, h))
```
The Las Palmas window (3.4 × 5.2 km at 20 cm) weighs approximately 30-60 MB. The transition from local coordinates to pixels is in [roof-compare-20cm.py](../scripts/roof-compare-20cm.py).
- **Comparison with PNOA:** `python -I scripts/roof-compare-20cm.py` returns the file to 1 m and recalculates the shades with the `roof-colours.py` algorithm. Out of 4,820 buildings: median ΔE 2.9, 82.7% below 5, 99.5% below 10. The two flights also agree on the location of the buildings. The viewer uses a uniform tint per print, so 20cm does not improve the current result.
- **Possible uses:** colors for pitch or roof details (terraces, panels, tiles) if the rendering requires it; visual verification of road widths, sidewalks, squares and pedestrian crossings; inspection of new or demolished buildings; coverage of new neighborhoods with clear source and license.
- **Warning:** shadows, overhangs and parallax have the same effect as in PNOA. Aerial source and municipal ranges may have different dates.

## SITCAN Open Data: other datasets

CKAN Portal: <https://opendata.sitcan.es/>, API <https://opendata.sitcan.es/api/3/action/package_search?rows=200> (174 datasets as of November 2026; `package_show?id=<nome>` gives the resources). Licenses: `gobcan-aviso-legal` (150 datasets, CC BY 3.0) and `sitcan-aviso-legal` (24, similar terms with mandatory citation).

| Datasets | Outcome |
|---|---|
| Urban plan of Las Palmas de Gran Canaria (SIPU, PDF, HTML) | Exists, unread. It can be used for quotas, permitted heights and protections. |
| Topographic Base 1:5,000 (2004-2006), Gran Canaria, SHP 588 MB | 20 year old: little interest; useful only as a historical comparison. |
| MDT 25 m | Useless: the pipeline already uses MDT05 at 5 m. |
| Map of Palmeras de Canarias (SHP, 12.5 MB, scale 1:500) | **Delayed by request.** Not downloaded or rated. |
| EIEL, Islands and municipalities, Atlas Climático, environmental themes | Not relevant to the urban map. |

## GRAFCAN (WMS and shop)

- WMS <https://idecan1.grafcan.es/ServicioWMS/MTL> (Modelo de Terreno LIDAR, 2.5 m/pixel, synthetic color image, not numerical dimensions) and <https://idecan1.grafcan.es/ServicioWMS/Ortofoto>. The metadata states «Acceso libre. Commercial use and massive download of information are prohibited: do not use in the pipeline, for consultation only.
- Paid data in the <https://tiendavirtual.grafcan.es/> store, with the `CONTRATO_LICENCIA_USO.pdf` license: unread.
- The free LiDAR and orthophoto of IGN and SITCAN cover the same needs without these constraints.

## Other sources evaluated
- **Microsoft Global ML Building Footprints** and **Overture Maps** (ODbL): heights cover USA and Western Europe only; municipal ranges are better. Useful only for cross-checking.
- **Wikimedia Commons**: categories by monument, for example <https://commons.wikimedia.org/wiki/Category:Main_facade_of_the_Cathedral_of_Santa_Ana> (51 files). Check the license of each file and use photos as private reference, unless attribution.
- **Spanish Land Registry (INSPIRE)**: number of floors per building, second independent estimate of heights. Not verified.
- Bing Maps and Microsoft images are not reusable as data.

## How to add a source to this catalog
Record links, license and attribution requirement, how to access reproducibly (and what cannot be automated), a measurement on a building or control zone, and the known limit. Then update `DATA_SOURCES.md` only when the data enters the map.

## Guaguas Municipales · driving mode

The plan involves a guagua between two consecutive stops on the same route, using the GTFS geometry to identify the corridor and the lane layout to determine its path. The simulation uses game time. The initial extract covers line 13 towards Tres Palmas, on Calle Hernán Pérez de Grado. The first candidate on line 54 required a turn from Reyes Católicos onto Doctor Chil where the model's tail crossed the road boundary.

**Acquired November 25, 2026.** The operator feed contains 46 lines, 845 stops, 7,009 trips and 20,564 track points. Keep the original ZIP in cache. The small local extract includes the source, SHA-256, route, track and OSM reference. The municipal documents state this condition of use: “Reuse of public sector information for the context of the public sector of the state.” [Operator ZIP](https://www.guaguas.com/transit/google_transit.zip) · [Municipal GTFS catalog](https://datosabiertos.laspalmasgc.es/data/?q=&tags=gtfs) · [Stops](https://datosabiertos.laspalmasgc.es/dataset/?id=guaguas-municipales-paradas) · [Trips](https://datosabiertos.laspalmasgc.es/dataset/?id=guaguas-municipales-viajes) · [Routes](https://datos.gob.es/es/catalogo/l01350167-guaguas-municipales-trazados).

To upgrade, download a new edition in a separate file. A download with browser identifier returned the official ZIP. From the project root, using the geodata Python environment:

```powershell
New-Item -ItemType Directory -Force .cache/guaguas | Out-Null
curl.exe -fL --retry 2 -A "Mozilla/5.0" https://www.guaguas.com/transit/google_transit.zip -o .cache/guaguas/candidate.zip
py -3.14 scripts/guaguas.py .cache/guaguas/candidate.zip
```
The importer links line, stroke, geometry and stop sequence of the same edition. Converts WGS84 to UTM 28N meters relative to the layout origin, checks the proximity to the alignment and the entire 7.2 × 2.2 m footprint on each segment in both maps. Only after verification does it replace the extract. If a new edition shifts the route, review geometry, stops and roadway before updating identifiers. Repeat the parking, overtaking, collisions and off-field reappearance tests reported in [QA](QA.md).

For city network run `py -3 scripts/guaguas.py .cache/guaguas/candidate.zip --network` from the root of the repository. You need the same cached OSM XMLs used to generate the city. The result contains city and pilot directories, spatial indexes, shared geometries, and variant reports. [Driving data and tests](GUAGUAS.md).
