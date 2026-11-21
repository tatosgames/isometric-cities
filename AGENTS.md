# AGENTS.md · Indice base

Vegueta y Triana · Atlas insular: plastico urbano interattivo di Las Palmas de Gran Canaria (Three.js + Vite, JS senza framework). Geodati elaborati in `public/data`, nessuna dipendenza da tile esterni.

## Mappa del progetto

| Percorso | Ruolo |
|---|---|
| `index.html`, `style.css` | Shell della pagina e stili (UI minimale) |
| `main.js` | Camera, input, filtro per area e recupero contesto WebGL |
| `scene.js` | Costruzione scena: edifici, strade, superfici, alberi, mesh ottimizzate |
| `content/las-palmas.json` | Catalogo dei luoghi, centro del pilota e stili per edificio |
| `places-ui.js`, `landmarks.js` | Menu e marker con ID persistenti, modelli procedurali dedicati |
| [Guida per ampliare la mappa](docs/EXPAND_CITY.md) | POI, quartieri, nuove città, cache e verifiche |
| `public/data/` | `city.json`, `pilot.json` (+ AOI), `poi.geojson`, `roof-tones.json`, `roof-colours.webp` |
| `scripts/data.py` | Acquisizione/rigenerazione dati (`pilot`, `city`), cache in `.cache` |
| `scripts/roof-colours.py` | Palette tetti |
| `scripts/qa.mjs`, `scripts/benchmark.mjs` | QA Playwright e benchmark |
| `docs/DATA_SOURCES.md`, `docs/QA.md` | Fonti dati/attribuzioni, rapporto QA e screenshot |
| `PLAN.md` | Brief originale per l'agente (perimetro, stile, checkpoint) |
| `PROGRESS.md` | Checkpoint corrente (A Santa Ana, B Vegueta–Triana, C studio futuro) |
| `.github/workflows/pages.yml` | Pubblicazione su GitHub Pages |

## Comandi (Windows, Node 24)

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5197
npm.cmd run typecheck
npm.cmd run build
npm.cmd test            # scripts/qa.mjs, richiede Chrome
```

## Regole

- Leggere `PLAN.md` e `PROGRESS.md` prima di cambiare perimetro, stile o dati.
- Non inventare strade, edifici o acqua; nomi dei luoghi in spagnolo; mantenere le attribuzioni visibili.
- Nessuna spesa, credenziale, push o pubblicazione senza autorizzazione. Nessuna generazione AI di immagini finché non autorizzata (punto C).
- `.cache`, `dist`, `node_modules` non vanno in Git. Un solo agente scrive per volta nel checkout.
- Dopo modifiche a scena o dati: `typecheck`, `build`, `npm.cmd test` e aggiornare `docs/QA.md` / `PROGRESS.md`.

## Skill Codex

**Di progetto** (`.agents/skills/`, copia per Claude in `.claude/skills/`): `threejs-performance` (misura e ottimizza draw call, memoria, istanziamento, LOD); `expand-city` (guida per aggiungere aree, POI o città: fonti, CRS, pipeline, QA, limiti mobile).

**Globali** (`~/.codex/skills/`), rilevanti qui:
- Three.js: `threejs-choose-skills`, `threejs-visual-validation`, `threejs-particles-trails-and-effects`, `diorama`, `shader-art-coding`
- Browser/QA: `chrome-devtools`, `chrome-devtools-cli`
- Design UI: `impeccable`
- Gioco: `ohmygame-studio`
- Qualità codice: `ponytail`, `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`

Non pertinenti a questo repo: `linkedin-*`, `rising-pixel-*`, `supabase*`, `lovable`.

**Globali** (`~/.agents/skills/`, gestite da `.skill-lock.json`): `frontend-design`, `web-perf`, `find-skills`, `impeccable`, `seo`, `seo-audit`, `frontend-react-best-practices`, `framer-motion-animator`, più skill Cloudflare/Supabase/sandbox non pertinenti.
