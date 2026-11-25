# Guaguas in drive mode

One yellow bus follows line 13 towards Tres Palmas in Vegueta. To start beside its first stop, open `index.html?lab=guida&area=pilot&start=-60,-818`. Press a driving key to start the simulation. The aerial camera makes the bus easier to see.

**How it works.** The game loads a local extract of the official GTFS feed. It follows a 231 m street segment, brakes at stops 73 and 75, waits three seconds, then accelerates. At the end it waits until both ends of the route are offscreen before starting again. The player and patrols share the same collision response against the 7.2 × 2.2 m bus. Pedestrians react to its front, middle and rear. [Route data](../public/data/guaguas.json) · [Movement and model](../src/drive/guagua.ts) · [Driving integration](../src/drive/drive.ts)

**How to extend it.** Select consecutive stops on one GTFS trip and trace the corresponding drivable street in the direction of service. The current importer uses one OSM way. For a longer route, join the reviewed ways in travel order and check the full bus body through each turn. Update the route number on the model if the line changes. Regenerate the extract from one feed ZIP, then run the checks below from the repository root. [Importer](../scripts/guaguas.py) · [Feed and download instructions](GEODATA_SOURCES.md#guaguas-municipales--modalità-guida)

```sh
python scripts/guaguas.py .cache/guaguas/feed.zip
node scripts/qa-guagua-motion.mjs
npm run build
node scripts/qa-guagua-browser.mjs
```
