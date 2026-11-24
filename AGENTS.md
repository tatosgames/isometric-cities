# AGENTS.md · Indice base

Las Palmas · Atlas insular: plastico urbano interattivo di Las Palmas de Gran Canaria (Three.js + Vite, TypeScript senza framework). Geodati elaborati in `public/data`, nessuna dipendenza da tile esterni.

## Mappa del progetto

| Percorso | Ruolo |
|---|---|
| `index.html`, `style.css` | Shell della pagina e stili (UI minimale) |
| `editor.html`, `src/editor/` | Editor locale del pilota: trascinamento di edifici, vertici e props (`building-drag`, `pilot-preview`, `props`); prova `scripts/qa-editor.mjs` |
| `lab.html`, `src/lab/` | Laboratorio visivo (`?test=lod`, `?test=larghezze`, `?test=settori`): carreggiate e transizioni LOD |
| `src/main.ts` | Camera, input, filtro per area e recupero contesto WebGL |
| `src/data/` | Contratti e validazione dei geodati e della vista salvata |
| `src/data/load.ts`, `types.ts`, `sector-index.ts`, `pilot-edits.ts`, `src/required.ts` | Caricamento a tre livelli, tipi condivisi con il worker, indice dei settori, correzioni dell'editor, accesso obbligatorio al DOM |
| `src/boot.ts`, `src/map/dom.ts`, `src/map/framing.ts` | Avvio (fase, progresso, errore, nota delle attribuzioni), riferimenti DOM, orientamento e limiti di zoom della camera della mappa |
| `src/drive/drive-tune.ts`, `drive-types.ts`, `drive-effects.ts`, `drive-crowd.ts` | Parametri `TUNE` e costanti, tipi condivisi, particelle e segni di sgommata, vista dei pedoni (estratti da `drive.ts`) |
| `src/drive/drive-route.ts`, `drive-location.ts`, `drive-pose.ts`, `road-grade.ts`, `building-occlusion.ts`, `car-model.ts` | Destinazioni e monete, toponimi, appoggio al terreno, pendenza e ripresa, camera sopra gli edifici, modello dell'auto |
| `src/render/city-materials.ts`, `ground-surface.ts`, `ground-map.ts`, `building-stencil.ts`, `port-props.ts`, `sectors/lod-transition.ts`, `sectors/protocol.ts` | Materiali condivisi, suolo e carreggiate, retino edifici, gru e oggetti del porto, transizioni LOD da 250 ms, protocollo worker |
| `scripts/check-data.mjs`, `audit-city.py`, `osm_extract.py`, `carriageways.py`, `road_sections.py`, `source_cache.py`, `requirements.txt` | Controllo dell'indice dati (parte di `build`), audit della città, estratti OSM su reticolo, carreggiate, cache delle fonti |
| `scripts/qa-browser.mjs` | Avvio condiviso delle prove browser: scelta del browser (`CHROME_PATH`) e server della build (`MAP_URL` per una mappa già in esecuzione) |
| `scripts/osm_buildings.py` | Monumenti assenti nello strato comunale (`osmBuildings` nel catalogo): impronta OSM, altezza stimata, id negativi |
| `scripts/geo.py` | Origine della mappa e conversioni EPSG:32628/4083 condivise dagli script Python |
| `src/geometry.ts` | Angolo nell'intervallo ±π, punto dentro un poligono e smorzamento esponenziale (`approach`), condivisi da mappa, guida e dati |
| `src/render/map-camera.ts`, `scripts/qa-map-camera.mjs` | Camera ortografica condivisa da mappa, guida, editor e laboratori: bordi in pixel, distanza, angolo isometrico, offset della vista accanto alla scheda; prova dedicata |
| `scripts/qa-*.mjs` (boot, drive-*, pedestrians, recovery, sectors, ground, carriageways, lod, road-lab…) | Prove Playwright mirate; `qa.mjs` è la suite completa |
| `src/drive/drive-camera.ts` | Calcolo delle pose e transizioni della camera in guida |
| `tsconfig.json` | Controllo rigoroso del runtime browser e del worker |
| `src/render/adaptive-resolution.ts` | Politica di risoluzione in base alla cadenza dei frame (mappa in movimento e guida) |
| `src/render/wind.ts` | Vento unico: ombre di nuvole in movimento, oscillazione di chiome e palme, ciclo a 30 fps a mappa ferma |
| `src/render/sea.ts` | Mare dalla costa OSM: fondali, onde con il vento e schiuma a riva da una texture di distanza |
| `src/drive/drive.ts` | Modalità «Conducir» stile Pako: ciclo di partita, pattuglie, monete, rendering, HUD e parametri `TUNE` |
| `src/drive/drive-world.ts` | Griglia degli ostacoli, visibilità e rete stradale della guida |
| `src/drive/drive-physics.ts` | Sterzo, derapata e risposta agli urti con ostacoli e veicoli |
| `src/drive/pedestrians.ts` | Pedoni d'atmosfera della guida: percorsi, fuga dai veicoli, regola che impedisce di investirli |
| `src/drive/drive-input.ts` | Comandi touch e tastiera, registrazione e rilascio degli input |
| `src/render/sectors/sector-stream.ts`, `src/render/sectors/sector-builder.ts`, `src/render/sectors/sector-worker.ts`, `src/render/overview.ts` | Priorità e budget, costruzione fuori thread, panoramica |
| `src/drive/road-routing.ts` | Indice dei nodi e percorsi delle pattuglie |
| `scripts/sectors.py`, `scripts/qa-sectors.mjs` | Generazione di nucleo, zone e settori (`--stress N` per la replica di carico) e prova di attraversamento |
| `public/data/city-core.json`, `city-terrain.bin`, `city-zones/`, `city-sectors/` | I tre livelli caricati dal viewer: nucleo con isolati fusi, zone da 960 m, settori da 240 m |
| `src/render/scene.ts` | Costruzione scena: edifici, strade, superfici, alberi, mesh ottimizzate |
| `content/las-palmas.json` | Catalogo dei luoghi, centro del pilota e stili per edificio |
| `src/map/places-ui.ts`, `src/render/landmarks.ts` | Menu e marker con ID persistenti, modelli procedurali dedicati |
| `src/map/place-card.ts`, `public/photos/` | Scheda del luogo (foto, quartiere, nome, testo, link) con le sue animazioni; pannello a sinistra o foglio dal basso. Foto con licenza libera, crediti in `docs/DATA_SOURCES.md` |
| [Guida per ampliare la mappa](docs/EXPAND_CITY.md) | POI, quartieri, nuove città, cache e verifiche |
| `public/data/` | `city.json`, `pilot.json` (+ AOI), `poi.geojson`, `roof-tones.json`, `roof-colours.webp`, `sea.json` (mare e costa, da `data.py city`) |
| `scripts/data.py` | Acquisizione/rigenerazione dati (`pilot`, `city`), cache in `.cache` |
| `scripts/roof-colours.py` | Palette tetti |
| `scripts/qa.mjs`, `scripts/benchmark.mjs`, `scripts/frame-profile.mjs` | QA Playwright, benchmark e profilo dei fotogrammi in un luogo (cadenza, triangoli, tempo sul thread principale) |
| `docs/UI_ANTI_SLOP.md`, `docs/CAMERA_FRAMING.md`, `docs/JUICE.md` | Regole UI (niente testi nel gioco, un fatto un indicatore), contratto di inquadratura e catalogo del game feel della guida (hit-stop, colpo di camera): da leggere prima di toccare HUD, camera o effetti |
| `docs/DATA_SOURCES.md`, `docs/QA.md` | Fonti dati/attribuzioni, rapporto QA e screenshot |
| [docs/PERFORMANCE.md](docs/PERFORMANCE.md) | Catalogo delle ottimizzazioni che non toccano la resa, con misure, e passaggio da ripetere dopo ogni quartiere |
| [docs/GEODATA_SOURCES.md](docs/GEODATA_SOURCES.md) | Catalogo di fonti aggiuntive: LiDAR PNOA, ortofoto 20 cm SITCAN, GRAFCAN, licenze, accesso e esiti |
| `scripts/lidar-check.py`, `content/lidar-heights.json`, `scripts/roof-compare-20cm.py` | Controllo altezze con il LiDAR (e correzione dei soli edifici senza dato comunale), confronto tinte dei tetti con l'ortofoto 20 cm |
| `PLAN.md` | Brief originale per l'agente (perimetro, stile, checkpoint) |
| `PROGRESS.md` | Checkpoint corrente (A Santa Ana, B Vegueta–Triana, C studio futuro) |
| `.github/workflows/pages.yml` | Pubblicazione su GitHub Pages |

## Comandi (Windows, Node 24; su Linux/macOS usare `npm` al posto di `npm.cmd`)

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5197
npm.cmd run typecheck
npm.cmd run build
npm.cmd test            # scripts/qa.mjs, richiede Chrome
```

Le prove browser partono da `scripts/qa-browser.mjs`. Senza Chrome installato (per esempio su Linux) si indica un altro Chromium con `CHROME_PATH`, ad esempio `CHROME_PATH=/opt/pw-browsers/chromium npm test`.

## Regole

- Mantenere un solo comportamento animato per camera, guida e interfaccia su tutti i dispositivi, indipendentemente dalle preferenze di movimento del sistema.

- Leggere `PLAN.md` e `PROGRESS.md` prima di cambiare perimetro, stile o dati.
- Non inventare strade, edifici o acqua; nomi dei luoghi in spagnolo; mantenere le attribuzioni visibili.
- Nessuna spesa, credenziale, push o pubblicazione senza autorizzazione. Nessuna generazione AI di immagini finché non autorizzata (punto C).
- `.cache`, `dist`, `node_modules` non vanno in Git. Un solo agente scrive per volta nel checkout.
- Dopo modifiche a scena o dati: `typecheck`, `build`, `npm.cmd test` e aggiornare `docs/QA.md` / `PROGRESS.md`.

## Skill Codex

**Di progetto** (`.agents/skills/`, copia per Claude in `.claude/skills/`): `threejs-performance` (misura e ottimizza draw call, memoria, istanziamento, LOD); `expand-city` (guida per aggiungere aree, POI o città: fonti, CRS, pipeline, QA, limiti mobile).

Sempre di progetto, copiate da altri repo di Rising Pixel: `threejs-fundamentals`, `threejs-geometry`, `threejs-materials`, `threejs-lighting`, `threejs-textures`, `threejs-shaders`, `threejs-postprocessing`, `threejs-animation`, `threejs-interaction`, `threejs-loaders`, `threejs-asset-pipeline` (licenza MIT in `THREEJS-SKILLS-LICENSE`), `game-design`, `web-games`. Sono consigli generici: non autorizzano nuove dipendenze e non prevalgono su questo file.

**Globali** (`~/.codex/skills/`), rilevanti qui:
- Three.js: `threejs-choose-skills`, `threejs-visual-validation`, `threejs-particles-trails-and-effects`, `diorama`, `shader-art-coding`
- Browser/QA: `chrome-devtools`, `chrome-devtools-cli`
- Design UI: `impeccable`
- Gioco: `ohmygame-studio`
- Qualità codice: `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`

Non pertinenti a questo repo: `linkedin-*`, `rising-pixel-*`, `supabase*`, `lovable`.

**Globali** (`~/.agents/skills/`, gestite da `.skill-lock.json`): `frontend-design`, `web-perf`, `find-skills`, `impeccable`, `seo`, `seo-audit`, `frontend-react-best-practices`, `framer-motion-animator`, più skill Cloudflare/Supabase/sandbox non pertinenti.
