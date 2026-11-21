# Vegueta y Triana · Atlas insular

Plastico urbano interattivo di Las Palmas de Gran Canaria, in Three.js e Vite. I dati elaborati sono inclusi in `public/data`. Il browser legge tutti gli asset dall’origine locale.

## Avvio su Windows

Dalla cartella del progetto, con Node 24 e Chrome con WebGL2:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5197
```

Aprire http://127.0.0.1:5197/ . Trascinare per spostarsi, usare rotella o pinch per ingrandire. L’indice e i marker aprono la scheda del luogo. Con il focus sulla mappa, usare frecce, +, − e Home. Il mirino ripristina la panoramica.

La pagina iniziale apre un dettaglio di Triana a tutto schermo. Il menu in alto a sinistra raccoglie i sei luoghi. Il mirino in alto a destra mostra l’intera area. Usare `/?area=pilot` per il quadrato di Santa Ana e aggiungere `&neutral` per il confronto a camera identica.

## Riprodurre i dati

La visione richiede solo Node. Per ricostruire i dati, dalla radice con Python 3.13 e curl:

```powershell
python -m pip install --target .cache/pylib -r scripts/requirements.txt
python scripts/data.py pilot
python scripts/data.py city
python scripts/roof-colours.py
```

Il primo passaggio di ciascuna area salva le risposte pubbliche in `.cache`. Le rigenerazioni leggono le copie locali. Per una nuova acquisizione conservare separatamente la vecchia cache e usare una directory di progetto pulita. La cache e le credenziali sono escluse da Git.

## Verifiche

```powershell
npm.cmd run typecheck
npm.cmd run build
node scripts/qa.mjs pilot
npm.cmd test
```

I test avviano un server temporaneo della build e lo chiudono alla fine. Richiedono Chrome installato. `MAP_URL` permette di puntare a un server già avviato.

## Riutilizzo nel gioco

Le scene JSON contengono edifici identificati dal record comunale, strade con ID OSM, nome e classe, superfici pedonali, verde, alberi e griglia delle quote. Gli anelli comprendono i cortili. Più parti possono condividere l’ID dell’edificio originale. Unità in metri, coordinate locali est/nord rispetto a [-15.415, 28.105] in WGS84 proiettate in UTM 28N. Three.js usa (est, quota, −nord). Confini e sei POI sono disponibili anche in GeoJSON WGS84. I marker sono elementi interattivi proiettati dalla camera.

Il modello mantiene la separazione geodati/scena e l’origine fissa del progetto [IsometricWorld alla revisione consultata](https://github.com/krasun/isometricworld/tree/8f9e3bb9f9533bcc5dfb3c6481ec0a1306e5ca3a). Acquisizione locale e renderer sono specifici della versione 3D live.

[Fonti](docs/DATA_SOURCES.md) · [Prove e screenshot](docs/QA.md) · [Checkpoint](PROGRESS.md)



## Aggiungere un luogo

Inserisci in `content/las-palmas.json` una voce in `places` con un ID stabile, nome, riferimento OSM, aree di appartenenza e altezza del marker in metri. Rigenera i dati con i comandi della sezione precedente. Menu, marker e scheda leggono lo stesso elenco. Mantieni gli ID quando riordini o rinomini i luoghi per conservare le selezioni salvate.

Il catalogo contiene anche il centro del pilota e le personalizzazioni degli edifici comunali. I modelli procedurali dedicati si trovano in `landmarks.js`, i controlli dei luoghi in `places-ui.js`.

Per estendere il perimetro, aggiornare le acquisizioni o preparare una nuova città, segui la [guida alla generazione e all’espansione](docs/EXPAND_CITY.md).
