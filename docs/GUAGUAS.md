# Guaguas in Conducir

Start the local Vite server, open one of these drives and press a driving key. The camera button cycles to an aerial view.

| Drive | What to look for |
|---|---|
| [Vegueta](http://127.0.0.1:5197/?lab=guida&area=pilot&start=-60,-818) | The original line 13 passes stops 73 and 75 towards Tres Palmas. |
| [Pedro Hidalgo](http://127.0.0.1:5197/?lab=guida&start=-360,-3720) | Both directions of line 13 serve this neighbourhood, alongside other lines. |
| [Triana](http://127.0.0.1:5197/?lab=guida&start=120,120) | Several overlapping services near Teatro. |
| [La Isleta](http://127.0.0.1:5197/?lab=guida&start=-1040,6048) | Calle Coronel Rocha starts outside the 300 m service radius. |

## Coverage

The static operator feed supplied 46 lines, 111 shapes and 117 distinct service patterns. In the city, the importer accepted 666.6 of 822.1 km inside the model (81.1%), covering 534 distinct stops. These totals count each service pattern separately, including streets shared by different lines. The smaller pilot has 12 active lines and 12 distinct stops. Each coverage file gives totals by line and direction, then the stops, OSM way IDs, location and reason for each gap. Gaps are grouped by the barrio containing their midpoint. [City coverage](../public/data/guaguas/city/coverage.json) · [Pilot coverage](../public/data/guaguas/pilot/coverage.json)

The importer follows connected directed OSM edges in GTFS travel order. It checks surface roads, access and turn restrictions, then tests the rounded vehicle path and intermediate body rotations against the road width, boundary, buildings, trees and water for each map. An unmatchable gap, unsafe turn or obstructed street ends the piece. Pieces shorter than the vehicle are discarded. A bus may wait visibly at the end of a verified fragment until the player looks away. The original two-stop alignment in Vegueta remains a reproducible fixture. [Road matching and geometry](../scripts/guagua_roads.py)

## Local traffic

Conducir opens a 2.0 kB city directory on entry. Every half-second of game time it queries the 240 m cells within 300 m of the player. Zone indexes contain distance **and time** intervals, including cell re-entry. Only services whose passages could be nearby need geometry from a local road bundle. The same geometry can serve multiple schedules. Offscreen vehicles beyond 450 m are released. No object or timer tracks a remote bus. [Fleet manager](../src/drive/guagua-fleet.ts)

At most six buses share the model geometry. Service runs every 90 game seconds per line and direction, rotating its distinct variants. A deterministic clock reconstructs the current position, braking and three-second dwell at actual stops. Vehicles yield locally to a bus ahead or at a crossing. Patrols and the player collide with a 7.2 × 2.2 m body. Walkers react to the front, centre and rear of a nearby bus. The fleet freezes with the drive and is released on exit.

## Regeneration and checks

Run from the repository root with the existing Python geodata environment, the original city OSM extracts in the source cache and the operator ZIP. The importer writes immutable, content-addressed packs and switches the public indexes after both areas have been generated. Use `--output .cache/guaguas/candidate-network` for a separate candidate. The original two-stop fixture can still be rebuilt by omitting `--network`. [Feed acquisition](GEODATA_SOURCES.md#guaguas-municipales--modalità-guida)

```sh
python scripts/guaguas.py .cache/guaguas/feed.zip --network
python scripts/test_guagua_index.py
npm run typecheck
npm run build
npm test
node scripts/qa-guagua-browser.mjs
node scripts/qa-guagua-network-browser.mjs
node scripts/qa-guagua-network-benchmark.mjs
```

The benchmark compares the same seeded mobile drive with the fleet enabled and disabled. The optional argument is the starting point in map metres. The lab supports `&nobuses` and exposes its active vehicles, loading errors, local update count and fleet CPU time in the scene dataset.
