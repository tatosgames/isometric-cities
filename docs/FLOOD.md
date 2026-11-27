# Floods

A simplified, explainable flood simulator on the city's own terrain. Phase 1 is the lab `lab.html?lab=inondazione`; the buttons on the main map come next (see [Next](#next)). The values are **scenarios, not forecasts**: they show how water moves through Las Palmas and what it does, with published methods, and must not be read as the official flood risk.

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

- **Flood hydrograph:** gamma-shaped, Q = Qp (t/tp)³ e^{3(1 − t/tp)}, the form of the SCS synthetic unit hydrograph (NEH-4). It spreads over the channel bed within 25 m of the source.
- **Covered channel:** a "covered channel takes" value subtracts what the culvert under the street still carries. 0 means a blocked culvert.
- **Rain:** intensity × runoff share. Rain on roofs is led to the street.

**What the water does** (`src/flood/flood-impact.ts`):

- **Damage:** JRC residential depth-damage curve for Europe, Huizinga, de Moel & Szewczyk (2017), *Global flood depth-damage functions*, EUR 28552 EN: share of value lost at 0.5 / 1 / 2 / 3 / 6 m = 25 / 40 / 60 / 75 / 100%. A building's depth is the highest water ever seen in the cells against its walls. "Value lost" weights each building by its footprint.
- **Danger to people:** flood hazard rating of Defra / Environment Agency R&D FD2320 (2005, 2008), HR = d (v + 0.5) + DF, with the urban debris factor. The four classes are low, danger for some (< 1.25), for most (< 2) and for all.

## Scenarios

| `scenario=` | What | Default |
|---|---|---|
| `guiniguada` | A flood comes down the barranco Guiniguada. It enters on its OSM line 2.3 km above the mouth (−2309, −1582), on a 2950 × 2250 m grid (592 × 452 cells) down to Vegueta–Triana. | Peak 500 m³/s at 15 min, culvert 0 |
| `pioggia` | A cloudburst on a 1280 m square around the view. | 120 mm/h for 1 h, runoff 0.9 |

The lower Guiniguada runs covered under the GC-110 (the OSM line has `layer=-1`). The DEM only sees the surface, so the scenario is the water that the covered channel cannot take. **The 500 m³/s peak is a placeholder,** chosen to be seen: it is to be replaced with the T = 100 and T = 500 discharges of the Plan de Gestión del Riesgo de Inundación de Gran Canaria and checked against the SNCZI flood maps (computed in Spain with Iber, a 2D model of the same family).

URL: `portata` (m³/s), `salita` (min to peak), `tombino` (m³/s carried by the culvert), `pioggia` (mm/h), `durata` (min), `deflusso` (runoff share), `manning`, `velocita` (× real time), `vista=profondita|pericolo|massimo`, `pausa=1`, `x`, `y`, `zoom`.

## Look

`flood-water.ts` draws the water opaque and low poly in one draw call. Being opaque, it needs no blending or sorting.
- **Facets:** a swell in the vertex shader tilts the 5 m triangles. It is taller and faster where the current runs, and none at the edge. Each triangle has its own normal (from screen derivatives), so its facets turn pale, dark or bright against the sun.
- **Colour:** turquoise to blue with depth, with a little silt where the current is fast.
- **Foam:** a white rim where the water meets the ground, and crisp whitecaps drifting downstream at the speed of currents above 1.5 m/s. The worker packs each cell's velocity next to its depth for this.
- **Hazard view:** keeps the four classes on the same facets.

**Technical parameters.** The Solver folder of the panel changes the scheme's constants live: Manning n, θ, Courant number and Froude limit (URL `manning`, `theta`, `courant`, `froude`). The readout shows:
- the current Δt;
- the highest Froude number v/√(gd) in water deeper than 5 cm;
- how many cells are being computed.

## Limits

- **The DEM is in whole metres** (as published in `city-terrain.bin`): terraces of 1 m on slopes and flat steps on the coast. The decimetres of MDT05 would need a change in the generation (`scripts/data.py`).
- **Buildings are solid at 5 m:** a lane narrower than a cell may close. Building porosity (shares of a cell open to water) is the known fix.
- **No sewer network, no infiltration model** beyond the runoff share, no culvert hydraulics, no sediment.
- **The water does not knock buildings down.** Demolition (`demolish.ts`) is for later scenarios (tsunami), not for a river flood.

## Measures

Node, one core, 592 × 452 grid (`scripts/qa-flood-solver.mjs` for the checks): 1.4 ms per step on a wet valley (11 ms before spans), drawn state 10 ms, statistics 7 ms. In the browser with software WebGL the Guiniguada runs at ×60–100 real time at its widest. The worker keeps its own clock, independent of the page's frame rate, and drops what it owes beyond a quarter of a second.

## Next

1. **Main map:** buttons for flood, rain and sea level on the area in view, plus sea level for the whole city on a coarser grid.
2. **Effects:** buildings tinted by damage, pedestrians and cars swept away (stability thresholds of Martínez-Gomariz et al. 2016 for people, 2018 for vehicles), validation against SNCZI.
3. **Earthquake**, on the demolition code.
