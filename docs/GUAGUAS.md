# Guaguas in Conducir

Start the local Vite server, open one of these drives and press a driving key. The camera button cycles to an aerial view.

| Drive | What to look for |
|---|---|
| [Vegueta](http://127.0.0.1:5197/?lab=guida&area=pilot&start=-60,-818) | The original line 13 passes stops 73 and 75 towards Tres Palmas. |
| [Pedro Hidalgo](http://127.0.0.1:5197/?lab=guida&start=-360,-3720) | Both directions of line 13 serve this neighbourhood, alongside other lines. |
| [Guanarteme](http://127.0.0.1:5197/?lab=guida&start=-3400,2700) | The L2 has a continuous 2.07 km stretch. |
| [Hoya de La Plata](http://127.0.0.1:5197/?lab=guida&start=-296,-3975) | Buses turn back when they reach the end of a visible open piece. |
| [Triana](http://127.0.0.1:5197/?lab=guida&start=120,120) | Several overlapping services near Teatro. |
| [La Isleta](http://127.0.0.1:5197/?lab=guida&start=-1040,6048) | Calle Coronel Rocha starts outside the 300 m service radius. |

## Coverage

The static operator feed supplied 46 lines, 111 shapes and 117 distinct service patterns. In the city, the importer accepted 923.7 of 983.1 km inside the model (94.0%), covering 787 distinct stops. Distance totals count each service pattern separately, including streets shared by different lines. The smaller pilot has 12 active lines and 12 distinct stops. Each coverage file gives totals by line and direction, then the stops, OSM way IDs, location and reason for each gap. Gaps are grouped by the barrio containing their midpoint. [City coverage](../public/data/guaguas/city/coverage.json) · [Pilot coverage](../public/data/guaguas/pilot/coverage.json)

The importer follows connected directed OSM edges in GTFS travel order. It scores nearby candidates along the sequence and can skip ambiguous samples when a short legal connection exists within a 48 m GTFS window. It tests the rounded trajectory against the game's widened carriageways, boundary, buildings, trees and water. On tight city turns the front and rear may overhang the pavement while the full-width corridor stays on it. The pilot retains the full body rotation check and the reviewed two-stop alignment in Vegueta. An unmatchable gap or an obstructed through path still ends the piece. [Road matching and geometry](../scripts/guagua_roads.py)

## Local traffic

Conducir opens a 2.0 kB city directory on entry. Every half-second of game time it queries the 240 m cells within 300 m of the player. Zone indexes contain distance **and time** intervals, including cell re-entry. Only services whose passages could be nearby need geometry from a local road bundle. The same geometry can serve multiple schedules. Offscreen vehicles beyond 450 m are released. No object or timer tracks a remote bus. [Fleet manager](../src/drive/guagua-fleet.ts)

At most six buses share the model geometry. City traffic requires at least 500 m of continuous verified road per bus. Shorter pieces still describe coverage in the generated reports. The pilot retains the reviewed line 13 route. Service entries are scheduled every 90 game seconds per line and direction, rotating the distinct variants. The timetable reconstructs each entry position. Once active, buses travel at 6 m/s through stops. A visible bus follows a closed path continuously or turns around at the end of an open path. It can retrace a one-way piece as part of this gameplay behavior. Buses yield locally to traffic, with a turn-back when a prolonged blockage leaves room to retreat. Patrols and the player collide with a 7.2 × 2.2 m body. Walkers react to the front, centre and rear of a nearby bus. The fleet freezes with the drive and is released on exit.

## Regeneration and checks

The city corridor candidate is built separately from the checked-in data:

```sh
python scripts/widen_guagua_corridors.py --output .cache/guagua-widening/candidate
python scripts/test_road_widening.py
python scripts/qa-carriageway-data.py --root .cache/guagua-widening/candidate/public/data --widening-added .cache/guagua-widening/candidate/added.wkb
```

The candidate takes corridors from the directed GTFS match before vehicle clearance. A documented width or a lane-based estimate permits up to 40% growth, limited by that width. Other corridors can grow by at most 20%. New pavement keeps 0.50 m from building footprints and preserves mapped obstacles and separate carriageways. The optional `--width-survey` JSON is a list of entries with `way`, `line` (local map coordinates along the measured interval) and `width` in metres. Only add entries checked against the source imagery.

The resulting `public` directory contains the city sectors, ground coverage and bus packages from the same candidate. The drive surface index retains exact geometry up to 2 m from the new paving and keeps the regular map simplification farther away. `report.json` gives lengths, gains per side, sources and exclusion reasons. An interval that crosses a barrio boundary is assigned to its midpoint. The published pilot is copied as the test reference. Use the same corridor command to regenerate the widened city sectors and guagua bundles together.

Run from the repository root with the existing Python geodata environment, the original city OSM extracts in the source cache and the operator ZIP. The importer writes immutable, content-addressed packs and switches the public indexes after both areas have been generated. Use `--output .cache/guaguas/candidate-network` for a separate candidate. The original two-stop fixture can still be rebuilt by omitting `--network`. [Feed acquisition](GEODATA_SOURCES.md#guaguas-municipales--modalità-guida)

```sh
python scripts/guaguas.py .cache/guaguas/feed.zip --network
python scripts/test_guagua_index.py
python scripts/test_guagua_roads.py
npm run typecheck
npm run build
npm test
node scripts/qa-guagua-browser.mjs
node scripts/qa-guagua-network-browser.mjs
node scripts/qa-guagua-network-benchmark.mjs
```

The benchmark compares the same seeded mobile drive with the fleet enabled and disabled. The optional argument is the starting point in map metres. The lab supports `&nobuses` and exposes its active vehicles, loading errors, local update count and fleet CPU time in the scene dataset.
