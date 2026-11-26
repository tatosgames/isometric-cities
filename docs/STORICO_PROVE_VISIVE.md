# Las Palmas visual evidence history

On November 22, 2026 the five presets listed below were retired after visual evaluation. The laboratory remains available for independent tests. The game uses its ordinary rendering. The choice for the streets remains open.

| Archived experiment | What was compared |
|---|---|
| Soil | OSM materials and step marks on a ground texture |
| Facades | Rhythm of the spans on the street front and openings covered by adjacent buildings |
| Roofs | PNOA backgrounds on large covers and procedural furnishings |
| Slope | Base of buildings adhering to the ground and contact profile |
| Green | Illustrative variation of canopies in rows and groups |

## Road test at the Mercado de Vegueta

The three returns shared the car's route from Calle Pelota to Calle de Mendizábal and Lugar Mercadillos Municipales. Clean texture and geometry used the same illustrative width and asphalt color.

| Yield | p95 desktop | p95 mobile emulated | Estimated Active Ground Memory |
|---|---:|---:|---:|
| Current | 18.2 ms | 18.2 ms | 0.90 MiB |
| Clean texture at 4 px/m | 18.3 ms | 18.3 ms | 4.49 MiB |
| Geometric roadway | 18.3 ms | 18.2 ms | 0.97 MiB |

Medians of three passes per configuration on Chrome with Intel UHD GPU. The mobile profile was emulated on the same computer. In the sample the geometry added 1,045 triangles and one draw call. On the straight the geometric edge appeared clearer and the diagonals showed small steps. Both alternatives also changed the continuity of the asphalt at the intersections. The performance on physical telephone and the transition between sectors remained to be evaluated.

The code, recipes and original samples can be found in [revisione archiviata](https://github.com/tatosgames/isometric-cities/tree/4d6dc949023b60befe00f26b7d2b4c1245552ba3).
