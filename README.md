# Las Palmas · Atlas insular

Interactive urban model of Las Palmas de Gran Canaria, in Three.js, TypeScript and Vite. The processed data is included in `public/data`. The browser reads all assets from the local source.

## Start on Windows

From the project folder, with Node 24 and Chrome with WebGL2:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5197
```
Open http://127.0.0.1:5197/ . Drag to move, use wheel or pinch to zoom. The index and markers open the place card. With the focus on the map, use arrows, +, − and Home. The viewfinder resets the overview.

The home page opens a full-screen view of Triana. The menu at the top left lists 25 places, from Vegueta and Triana to La Isleta, Ciudad Alta, the cliffs, and the southern ring. The viewfinder at the top right shows the entire area. Use `/?area=pilot` for Santa Ana Square and add `&neutral` for an identical room comparison. With `?nopolice`, the "Drive" mode starts without patrols: no captures, and the race lasts until you exit.

## Editor del pilota (deprecated)

Deprecated and no longer linked from the labs; kept in the build in case it is needed again. The editor opens on [GitHub Pages](https://tatosgames.github.io/isometric-cities/editor.html) or locally on `http://127.0.0.1:5197/editor.html`. Download the fixes in JSON and reload them in the editor or in **Test Drive**. The browser reads the file from the device.

## Labs

Open `lab.html` for the five labs. The labs share navigation and a collapsible Controls panel. **Copy link** captures the current test parameters.

| Lab | Entry and useful parameters |
|---|---|
| Rendering, effects & quality | `index.html?lab=qualita`. Use `look=base\|sole\|matcap`, the Matcap panel parameters (`matcap`, `gain`, `bounce`, `shade`, `clouds`, `palette`, `tilt`, `glow`), `sky=0`, `stats` or `preview=base\|static\|fxaa&diagnostics`. The look dropdown carries the current map view. |
| Driving & flight | `index.html?lab=guida&area=pilot`. Use `start=x,y`, `seed`, `nopolice`, `nobuses`, `t` and `diagnostics`. Use the plane button to switch to flight and the Flight folder for Piper tuning. |
| Map, LOD & roads | `lab.html?lab=strade`. Pick `scenario=mercado\|larghezze\|settori\|lod` from the selector. The old `lab.html?test=…` links still open their original scenarios. |
| Demolition | `lab.html?lab=demolizione`. Left button swings the wrecking ball, places dynamite or fires the drive's gun (keys 1, 2 and 3), right button pans, wheel zooms. Use `x`, `y`, `zoom`, `strumento=palla\|dinamite\|sparo`, `quota` (ball height, m) and `distanza` (m from which the gun fires). Reload to rebuild the city. |
| Flood | `lab.html?lab=inondazione`. `scenario=guiniguada\|pioggia`, `ritorno=10\|25\|50\|100\|500\|1000\|1954\|1989` (design floods by Norma 5.2-IC, or observed rains). Shift + click places a gauge. The report shows the hydrograph, gauges, critical buildings, and the method with its sources. Model, URL values, and how to reuse or remove the module: [FLOOD.md](docs/FLOOD.md). |

## Replay the data

Vision requires only Node. To reconstruct the data, from the root with Python 3.13 and curl:

```powershell
python -m pip install --target .cache/pylib -r scripts/requirements.txt
python scripts/data.py pilot
python scripts/data.py city
python scripts/roof-colours.py
python scripts/sectors.py
```

The playable land surface is 3,041 km². The pipeline generates an index and 80 240m sectors. The first step saves public responses to `.cache/sources` with a key derived from the complete request. Regenerations read local copies. For a new acquisition, keep the old cache separately and use a clean project directory. Cache and credentials are excluded from Git.

## Struttura del runtime

`src/main.ts` links the map, rendering and driving. `src/data/` contains the geodata contracts, `src/map/` the location markers and controls, `src/render/` the scene and streaming, `src/drive/` the simulation. Vite prepares the build and `npm.cmd run typecheck` checks everything `src/` in strict mode.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run build
node scripts/qa.mjs pilot
npm.cmd test
node scripts/qa-sectors.mjs
node scripts/qa-drive-route.mjs
node scripts/qa-recovery.mjs
```

The tests start a temporary build server and shut it down at the end. Require Chrome installed. `MAP_URL` allows you to point to an already started server.

## Riutilizzo nel gioco

The JSON scenes contain buildings identified from the municipal record, streets with OSM ID, name and class, pedestrian surfaces, greenery, trees and elevation grid. The rings include the courtyards. Multiple parties can share the original building ID. Units in meters, local coordinates east/north relative to [-15.415, 28.105] in WGS84 projected into UTM 28N. Three.js uses (east, elevation, −north). Boundaries and ten POIs are also available in GeoJSON WGS84. Markers are interactive elements projected from the camera.

The model maintains the geodata/scene separation and the fixed origin of the project [IsometricWorld at the inspected revision](https://github.com/krasun/isometricworld/tree/8f9e3bb9f9533bcc5dfb3c6481ec0a1306e5ca3a). Local capture and renderer are specific to the live 3D version.

[Sources](docs/DATA_SOURCES.md) · [Tests and screenshots](docs/QA.md) · [Checkpoint](PROGRESS.md)



## Add a place

Insert in `content/las-palmas.json` an entry in `places` with a stable ID, name, OSM reference, areas to which it belongs and marker height in meters. Regenerate the data with the commands from the previous section. Menu, marker and tab read the same list. Preserve IDs when reordering or renaming places to preserve saved selections.

The catalog also contains the pilot center and municipal building customizations. Dedicated procedural templates are found in `src/render/landmarks.ts`, location controls in `src/map/places-ui.ts`.

To extend your perimeter, update your acquisitions, or prepare a new city, follow the [generation and expansion guide](docs/EXPAND_CITY.md).

## Modo «Conducir»

The 🚗 button on the tools opens an arcade chase on the model, inspired by Pako. The car accelerates on its own.

- Touch: press the left or right half to turn, both at the same time to brake. A horizontal slide is equivalent to the side you slide toward.
- Keyboard: left/right arrows or A/D, both at the same time (or down arrow) to brake, Space or F to shoot, Escape to exit.
- Shooting: the crosshair button at the bottom centre (or Space / F) fires straight ahead, once every 3 seconds; the ring inside the button fills while it reloads. A building comes down and is rebuilt once it has been out of view for a while; a patrol is wrecked and thrown; a guagua is thrown off its run.
- The coins mark the route through the streets to one of the places; When you arrive there is a bonus and another route appears.
- Patrols increase every 18 seconds. They catch you if they catch up with you when you're going slow; At full speed they only push. The record is saved in the browser.

The game interface does not use text: icons for coins and time during the game, and the record in the final summary; two animated touch zones teach you how to turn and, after a few seconds, how to brake with both; a turquoise blob with straight-line distance (4.3km, then 850m) points to the destination from the edge of the screen and flies out of the car every time it changes; a beam of light of the same color marks it on the model. An arrow inside the car's circle points to the nose only when a building blocks the cabin. Names are announced to screen readers only.

All physics and pacing are set in the `TUNE` object at the start of `src/drive/drive.ts`.

The map and guide always use the same animations, regardless of system preferences. The camera accompanies the selection of places and reacts to speed, impacts and proximity of patrols while driving.
