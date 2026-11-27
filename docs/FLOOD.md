# Floods

A simplified, explainable flood simulator on the city's own terrain. It runs in the lab `lab.html?lab=inondazione`; the buttons on the main map come next (see [Next](#next)). The floods are **design estimates made with the official method, not an official map**: the barranco Guiniguada has no official flood study (see [Return periods](#return-periods)).

## Module

Everything lives in `src/flood/`. Callers import only from `src/flood/index.ts`:

```ts
import { createFlood, makeFloodPanel, GUINIGUADA, rationalFlood } from '../flood/index.ts';
const flood = createFlood({terrain, buildings, sea, box, source, scenario, facilities});
scene.add(flood.group);
// every frame
flood.control({playing, speed, view}); flood.tick(seconds);
```

| File | Role |
|---|---|
| `index.ts` | Public API: the only file callers import |
| `flood-controller.ts` | `createFlood`: grid, worker, water and markers, gauges, history, frame events |
| `flood-solver.ts`, `flood-grid.ts`, `flood-sim.ts`, `flood-worker.ts` | Hydraulics, grid from terrain, buildings and sea, forcing and statistics, worker |
| `flood-hydrology.ts` | Norma 5.2-IC design floods and storms, the Guiniguada basin and its sources |
| `flood-impact.ts` | JRC damage, FD2320 hazard, Clausen & Clark structural states |
| `flood-facilities.ts` | Critical facilities matched to their buildings |
| `flood-water.ts`, `flood-markers.ts` | Water surface; markers over the watched buildings |
| `flood-panel.ts`, `flood-panel.css`, `flood-chart.ts` | Optional event report: figures, hydrograph, gauges, critical buildings, method and sources |

**Dependencies outside the folder:**
- `three`;
- the data types of `src/data/types.ts`;
- `heightWindow` from `src/geometry.ts`;
- the data `public/data/flood-facilities.json`, which is optional.

The collapse uses the demolition code (`src/demolition/`), but from the lab, not from the module. The module only reports which buildings came down.

**To reuse it elsewhere:** copy the folder, pass it a terrain grid (`Terrain`), footprints (`Building`) and sea polygons, and describe a basin as `GUINIGUADA` does.

**To take it out:** delete the following, then run `typecheck`.
- `src/flood/`;
- `src/lab/flood-lab.ts` and the `inondazione` entries in `src/lab/lab-shell.ts` and `src/lab/main.ts`, plus `.flood-lab` in `src/lab/lab.css`. The other labs' checks do not count the labs, and `main.ts` finds each lab by id, so nothing else changes;
- `scripts/qa-flood*.mjs`, with `qa-flood-solver.mjs` also removed from the `test` script in `package.json`;
- `scripts/flood_facilities.py`, `public/data/flood-facilities.json` and this file.

Nothing on the main map depends on it.

## Model

**Hydraulics** (`src/flood/flood-solver.ts`). The local inertial form of the shallow water equations of LISFLOOD-FP:

- Bates, Horritt & Fewtrell (2010), *A simple inertial formulation of the shallow water equations for efficient two-dimensional flood inundation modelling*, Journal of Hydrology 387, 33–45.
- de Almeida, Bates, Freer & Souvignet (2012), *Improving the stability of a simple formulation of the shallow water equations for 2-D flood modeling*, Water Resources Research 48, W05528: the θ weighting (θ = 0.7) that damps the checkerboard oscillations.

Depth lives in the cells and discharge per unit width on the faces between them. Each step:

1. The discharge across each face comes from its previous value, the slope of the water surface and Manning friction (n = 0.03 by default, streets with kerbs and cars).
2. A Froude limiter (Fr ≤ 1, as in LISFLOOD-FP) caps it. The scheme is made for slow flood plains. On the 1 m steps of the DEM it would otherwise race (up to 245 m/s before the limiter, under 12 m/s after).
3. No cell may give away more water than it holds: its outgoing faces are scaled down together. Depth never goes negative and volume is conserved to rounding.

The time step adapts to the deepest water (Courant 0.7, at most 5 s). Only the cells that are wet, plus one cell around them, are computed (spans per row, which only grow). Early on the flood touches a few hundred cells; at its widest about a third of the grid.

**Grid** (`src/flood/flood-grid.ts`). The MDT05 nodes of `city-terrain` at 5 m: each node is a cell centre, and the water surface is drawn on the same nodes as the terrain. Buildings of `city.json.gz` whose footprint covers a cell centre are walls. Sea cells (from `sea.json`) drain whatever reaches them. The grid edges let water out at normal depth on the local slope.

**Forcing** (`src/flood/flood-sim.ts`):

- **Flood hydrograph:** gamma-shaped, Q = Qp (t/tp)^m e^{m(1 − t/tp)}, with m = 3.7, the closest fit to the SCS dimensionless unit hydrograph (NEH-4, ch. 16). It peaks at tp = D/2 + 0.6 tc with D = 0.133 tc, that is 0.667 tc. The clock starts when the rising limb reaches 10% of the peak. The flow spreads over the channel bed within 25 m of the source.
- **Covered channel:** a "covered channel takes" value subtracts what the culvert under the street still carries. The default 0 means a blocked culvert: its real capacity is not published.
- **Rain:** intensity × runoff share. Rain on roofs is led to the street.

**What the water does** (`src/flood/flood-impact.ts`):

- **Damage:** JRC residential depth-damage curve for Europe, Huizinga, de Moel & Szewczyk (2017), *Global flood depth-damage functions*, EUR 28552 EN: share of value lost at 0.5 / 1 / 2 / 3 / 6 m = 25 / 40 / 60 / 75 / 100%. A building's depth is the highest water ever seen in the cells against its walls. "Value lost" weights each building by its footprint.
- **Danger to people:** flood hazard rating of Defra / Environment Agency R&D FD2320 (2005, 2008), HR = d (v + 0.5) + DF, with the urban debris factor. The four classes are low, danger for some (< 1.25), for most (< 2) and for all.
- **Structural damage and collapse:** the criteria of Clausen & Clark (1990), *The development of criteria for predicting dambreak flood damages using modelling of historical dam failures*, International Conference on River Flood Hydraulics, 369–380. They apply to masonry and brick houses:
  - partial damage when depth × velocity reaches 3 m²/s at the walls;
  - total destruction from 7 m²/s with a velocity of at least 2 m/s.

  A building that collapses stops being a wall, so the water runs through its ruins. In the lab it comes down with the demolition code. Its value counts as entirely lost.
- **Critical buildings:** 383 facilities from OpenStreetMap (`scripts/flood_facilities.py` → `public/data/flood-facilities.json`): 25 hospitals, 90 health centres and clinics, 246 schools and academies, 20 emergency services and 2 care homes. They are matched to the footprint under them; 65 fall in the Guiniguada grid. Each has a marker above its roof, coloured by state, and is listed in the report from the worst down.

## Return periods

The barranco Guiniguada is **not an ARPSI** of Gran Canaria. ARPSIs are the areas with a significant potential flood risk, and only they get official flood maps; the latest list is the Preliminary Flood Risk Assessment (EPRI) of the 3rd cycle (Consejo Insular de Aguas de Gran Canaria, 2025). Las Palmas has five coastal ARPSIs, among them **ES120_ARPSI_0009, Barrio de Triana**, and no fluvial one. So there is no official discharge to take.

The lab works it out with the method the Plan Hidrológico de Gran Canaria prescribes for barranco flood studies (Decreto 2/2019, art. 46.2): the rational method of **Norma 5.2-IC** (Orden FOM/298/2016) of the Instrucción de Carreteras (`flood-hydrology.ts`):

| Value | Guiniguada | Source |
|---|---|---|
| Catchment area A | 65 km² (6,500 ha), highest point 1,891 m | Plan Hidrológico de Gran Canaria, description of the demarcation, 2.3.4 |
| Main channel Lc | 27 km, slope 0.070 | Estimate: 9.3 km mapped in OSM up to Santa Brígida, plus a straight-line distance to the head × 1.15 |
| Runoff coefficient C | 0.75 (Zona Este, which begins at the Guiniguada) | Plan Hidrológico de Gran Canaria (Decreto 2/2019), art. 39.2 |
| Torrentiality I1/Id | 8 | Cabildo de Gran Canaria, hydrology annex of the Salto del Negro project (Norma 5.2-IC map) |
| Daily rainfall Pd | Station 183 (Capón), Gumbel fit (Ven Te Chow) | Same annex |

Formulas:
- Q = I·C·A·Kt / 3.6
- I = Id·(I1/Id)^(3.5287 − 2.5287 tc^0.1)
- Id = Pd·KA / 24, with KA = 1 − log10 A / 15
- tc = 0.3 Lc^0.76 Jc^−0.19
- Kt = 1 + tc^1.25 / (tc^1.25 + 14)

Constants for this basin: tc = 6.09 h, KA = 0.879, Kt = 1.406, so Q ≈ 1.97·Pd and the peak comes 4.06 h after the start.

| Event (`ritorno=`) | Pd (mm/24 h) | Qp (m³/s) | Storm over the view, 1 h (mm/h) |
|---|---|---|---|
| T = 10 | 79.4 | 156 | 26.1 |
| T = 25 | 104.9 | 207 | 34.5 |
| T = 50 | 123.8 | 244 | 40.7 |
| **T = 100** (default) | 142.6 | **281** | 46.9 |
| T = 500 | 186.1 | 367 | 61.1 |
| T = 1000 | 204.8 | 403 | 67.3 |
| Observed 22 Nov 1954 (`1954`) | 138.5 | 273 | 45.5 |
| Observed 16 Feb 1989 (`1989`) | 117.5 | 231 | 38.6 |

**Observed rainfalls.** The two are the wettest days at Las Palmas in 1950–1999, from Máyer Suárez (2001), *Lluvias e inundaciones en la ciudad de Las Palmas de Gran Canaria (1950–1999)*, Puerto de la Luz 34, AEMET repository. They were measured on the coast and are applied to the whole basin, where the summit gets more. The Capón quantiles are a cross-check: the 1954 rain sits close to T = 100.

**Other events of the record** (EPRI, 3rd cycle):
- 22–23 Nov 2018: sewers overflowing, Tamaraceite road like a river, mouth of the barranco de La Ballena;
- 3–4 Apr 2019: water inside the Doctor Negrín hospital;
- Tropical storm Hermine, 23–26 Sep 2022: 178 flood calls in the capital;
- 12 Dec 2023: Pérez Muñoz underpass flooded.

They are not replayed yet.

**Climate.**
- **Rain:** the EPRI finds very slight decreases in annual rainfall and runoff for Gran Canaria under RCP 4.5 and 8.5, but could not apply changes in extremes for lack of data.
- **Sea level:** it quotes IPCC AR6 global rises by 2100 of 0.28–0.55 m (SSP1-1.9), 0.44–0.76 m (SSP2-4.5) and 0.63–1.02 m (SSP5-8.5), and the Las Palmas tide gauge trend of 0.39 cm per year.

These are the figures for a coastal scenario on the Triana ARPSI.

**Other sources checked:**
- The CEDEX maps of daily rainfall quantiles cover the Peninsula only (UTM 30). There are none for the Canaries.
- The SNCZI viewer has nothing for the Guiniguada, since it is not an ARPSI.

## Scenarios

| `scenario=` | What |
|---|---|
| `guiniguada` | The design flood enters on the barranco's OSM line 2.3 km above the mouth (−2309, −1582). The grid is 2950 × 2250 m (592 × 452 cells), down to Vegueta–Triana. A first gauge stands at (−1010, −420), where the barranco meets the city. |
| `pioggia` | One hour of the design storm of the same return period, on a 1280 m square around the view. |

The lower Guiniguada runs covered under the GC-110 (its OSM line has `layer=-1`). The DEM only sees the surface, so the scenario is the water that the covered channel cannot take.

**URL parameters:**
- `scenario`, `ritorno` (10, 25, 50, 100, 500, 1000, 1954 or 1989);
- the "what if" values `portata` (m³/s), `tombino` (m³/s carried by the culvert), `pioggia` (mm/h), `deflusso` (runoff share);
- the solver's `manning`, `theta`, `courant`, `froude`;
- `velocita` (× real time, default 300), `vista=profondita|pericolo|massimo`, `pausa=1`, `x`, `y`, `zoom`.

**Report** (`flood-panel.ts`):
- the event and its peak, with the clock;
- four figures: area flooded, area of danger to all, buildings wet and down, value lost;
- the hydrograph: the dashed design curve, against what overflows and what reaches the sea;
- up to four gauges (Shift + click), with depth and speed;
- the critical buildings, from the worst down;
- the method, folded: seven values, the models and the sources in one line each.

Each fact appears once (Luca, 27 November 2026). The discharge is in the chart rather than in a figure, the deepest point was dropped (it reads DEM pits), the full sources are in this file, and the lab's text readout keeps only the solver's health.

## Look

`flood-water.ts` draws the water opaque and low poly in one draw call. Being opaque, it needs no blending or sorting.
- **Palette:** the sea's own (`render/sea.ts`): `#74c4bd` in shallow water to `#2b7888` in deep water, with a touch of silt where the current is fast. Flood and sea read as the same water.
- **Facets:** a low swell in the vertex shader tilts the 5 m triangles, each with its own normal, for a gentle light and shade.
- **Movement:** a slow swell of tone runs along the current.
- **Foam:** soft, and only where the water meets the ground, as on the shore.

There are no mirror glints and no whitecaps: from afar they speckled the water (Luca, 27 November 2026).

**Technical parameters.** The Solver folder of the panel changes the scheme's constants live: Manning n, θ, Courant number and Froude limit (URL `manning`, `theta`, `courant`, `froude`). The readout shows:
- the current Δt;
- the highest Froude number v/√(gd) in water deeper than 5 cm;
- how many cells are being computed.

## Limits

- **The DEM is in whole metres** (as published in `city-terrain.bin`): terraces of 1 m on slopes and flat steps on the coast. The decimetres of MDT05 would need a change in the generation (`scripts/data.py`).
- **Buildings are solid at 5 m:** a lane narrower than a cell may close. Building porosity (shares of a cell open to water) is the known fix.
- **No sewer network, no infiltration model** beyond the runoff share, no culvert hydraulics, no sediment.
- **Collapse thresholds are for masonry.** Clausen & Clark's thresholds come from masonry and brick houses, so they are conservative for reinforced concrete, which most of Las Palmas is. No data on construction type is used yet.
- **The hydrology is an estimate:**
  - the main channel length is approximate;
  - the rainfall comes from one coastal station;
  - the rational method is meant for basins of a few tens of km² and gives a peak, not a shape: the gamma hydrograph is an assumption.
- **Collapse uses the solver's speeds,** which are capped at Froude 1. A depth of about 2.5 m at critical speed already exceeds 7 m²/s, so collapses follow the deepest stretches of the overflow.

## Measures

Node, one core, 592 × 452 grid (`scripts/qa-flood-solver.mjs` for the checks): 1.4 ms per step on a wet valley (11 ms before spans), drawn state about 1 ms, statistics 7 ms.

**The state for the GPU** is four half floats a cell (`RGBA16F`), with the surface stored above the ground; the ground is a separate texture uploaded once. That is 2.1 MB a frame instead of 4.3 MB. The texture takes the worker's buffer as its own data, so there is no copy on the main thread. The water mesh draws only the rows the water spans: about 8% of its 535k triangles in a narrow valley, all of them once the flood is at its widest. In the browser with software WebGL the Guiniguada runs at ×60–100 real time at its widest. The worker keeps its own clock, independent of the page's frame rate, and drops what it owes beyond a quarter of a second.

## Next

1. **Main map:** buttons for flood, rain and sea level on the area in view, plus sea level for the whole city on a coarser grid.
2. **Effects:** pedestrians and cars swept away (stability thresholds of Martínez-Gomariz et al. 2016 for people, 2018 for vehicles); a coastal scenario on the Triana ARPSI with AR6 sea level; replays of the 2018–2023 events.
3. **Earthquake**, on the demolition code.
