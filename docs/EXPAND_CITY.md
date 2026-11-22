# Generare e ampliare la mappa

## Aggiungere un luogo

Il catalogo di lavoro è [las-palmas.json](../content/las-palmas.json). Esempio verificato con un settimo luogo in una copia di prova:

```json
{"id":"alameda","name":"Alameda de Colón","osm":"way/251673532","areas":["city"],"markerHeight":2}
```

Aggiungi la voce a `places`. Il nome è quello locale, l’ID è univoco e persistente, l’altezza del marker è in metri sopra il terreno. L’ordine governa la numerazione. La selezione salvata segue l’ID. Assegna `pilot` anche in `areas` se il luogo ricade nel pilota e deve comparirvi. `pilotFocus` identifica il luogo che centra quel ritaglio e la sua vista di dettaglio.

Lo script legge una way poligonale oppure una relazione con un’unica way esterna e una way per ogni anello interno. Tutti i membri e i nodi devono essere presenti nell’XML. Per un POI puntuale, un bordo suddiviso in più way o una relazione con più esterni, estendi prima il lettore e verifica la geometria risultante. Il marker usa un punto rappresentativo interno. Casa de Colón è il caso di controllo per i tre cortili. Menu, scheda e pin leggono lo stesso GeoJSON tramite [places-ui.ts](../src/map/places-ui.ts) e il filtro per area del viewer.

## Ampliare un quartiere

1. Modifica `coverage` nel catalogo. `axis` contiene le coppie longitudine/latitudine del corridoio, `radius` è in metri e `historicPlaces` conserva l’inviluppo dei sei luoghi iniziali con margine di 95 m. L’unione viene ritagliata sulla terraferma usando la costa OSM e Santa Ana come punto interno. Verifica che il risultato sia un poligono continuo, includa tutti i luoghi e raggiunga `minimumLandM2`. Il pilota rimane un quadrato di 650 m attorno a `pilotFocus`.
2. Estendi `coverage.bounds` oltre il nuovo perimetro. La costa deve attraversare il bordo della finestra e dividerla in terra e mare. `coverage.grid` indica colonne e righe delle piccole richieste alla Map API. Lo script unisce nodi, way e relazioni per tipo e ID, conservando la versione più recente. Per aree maggiori valuta un estratto regionale. Conserva l’origine WGS84 (−15.415, 28.105) e il CRS metrico EPSG:32628.
3. Le risposte OSM, ArcGIS, MDT05 e PNOA sono in `.cache/sources`. Il nome contiene un digest dell’URL completo, compresi bbox e risoluzione. Per aggiornare una fonte allo stesso URL conserva lo snapshot precedente e avvia una nuova acquisizione in una cache separata.
4. Controlla che il conteggio comunale coincida con gli OBJECTID univoci paginati. La pipeline ritaglia gli edifici, conserva i cortili e scarta frammenti sotto 2 m². Controlla il terreno MDT05 ai bordi. Il viewer interpola un’unica griglia su entrambe le facce di ogni confine.
5. La pipeline ricava i limiti da pilota e città e scarica riquadri PNOA fino a 1024 px a 1 m/pixel. Il viewer legge le tinte per impronta da `roof-tones.json`. La pipeline genera ancora l’atlante WebP e i ritagli per i settori come asset legacy. Ogni impronta ha un solo proprietario, determinato dal centro del suo rettangolo di ingombro.
6. Verifica apertura, mirino e limiti del pan. Il centro iniziale della scena cittadina resta in [main.ts](../src/main.ts). Un terzo stage richiede modifiche al generatore e al selettore del viewer, che oggi distinguono pilota e città.

## Generazione riproducibile

Dalla radice del progetto, con Python 3.13 e curl:

```powershell
python -m pip install --target .cache/pylib -r scripts/requirements.txt
python scripts/data.py pilot
python scripts/data.py city
python scripts/roof-colours.py
python scripts/sectors.py
```

Controlla in `public/data` le due scene, i due `*-aoi.geojson`, il `poi.geojson` condiviso e i due file dei tetti. Entrambi gli stage riscrivono i POI condivisi. L’atlante usa entrambe le scene già generate. Confronta i confini prima/dopo e le coordinate dei luoghi preesistenti. Per un’estensione verifica su ogni nuovo bordo la continuità di strade, suolo, edifici e colori.

## Settori, guida e memoria

Il catalogo dei settori è `public/data/city-index.json`. I JSON e i WebP dettagliati in `city-sectors/` hanno nomi derivati dal contenuto. Distribuiscili insieme all’indice. Il passaggio `sectors.py` rimuove i propri vecchi file generati. Per una rigenerazione ripetibile conserva il mosaico intermedio `.cache/roof-atlas.png` oppure rigeneralo prima.

La panoramica contiene sagome, chiome semplificate e terreno. Il passaggio al dettaglio usa la dimensione in metri della vista. I gruppi piccoli mantengono il frustum culling di Three.js. La priorità dei settori segue la camera e, in guida, anticipa la direzione di avanzamento. Un worker crea mesh trasferibili e bitmap. Una risposta obsoleta viene scartata prima del caricamento sulla GPU. Il materiale globale rimane di proprietà della panoramica. Ogni dettaglio possiede le proprie geometrie, istanze, materiali e bitmap, che vengono liberati allo scaricamento.

Il budget del dettaglio è 48 MiB nel profilo compatto e 96 MiB su desktop. Comprende array geometrici, pixel delle bitmap e una stima delle texture RGBA con mipmap. La memoria totale del browser comprende anche scena base, worker, driver e risorse temporanee. Misura sul dispositivo obiettivo. Leggi i contatori `data-sectors` sul contenitore della scena per settore in attesa, residenti, visibili, espulsioni e byte stimati.

La maglia del terreno è allineata all’origine metrica a passi di 15 m. Ogni cella da 240 m include i tratti OSM che intersecano un margine e dipinge il terreno a 2 px/m, con 5 m esterni per il filtro. Il grafo stradale e la griglia di collisione sono residenti a prescindere dai settori visivi. I percorsi riusano il campo di distanze quando il nodo sorgente è lo stesso.

## Architettura e resa visiva

Nel catalogo, `buildings` è indicizzato per OBJECTID comunale. Usa `heightOverride`, `wallColor`, `windows` e `roofFurniture` per personalizzare il fabbricato. `pavedParks` contiene gli ID delle way OSM per i parchi pavimentati. Per Santa Ana, `split.osmWay` divide l’impronta comunale tra interno della maschera e resto. Il ramo `inside` definisce i propri attributi e `toneSuffix` distingue la tinta della navata a parità di OBJECTID.

Per un modello dedicato registra la chiave `landmark` in [landmarks.ts](../src/render/landmarks.ts). Ogni chiave genera un modello per scena anche quando il ritaglio divide l’edificio in più parti. Verifica posizione, orientamento e quota del modello sulla sua impronta. Confronta pilota neutro e stilizzato a camera identica. Usa foto e Google Maps come riferimenti privati per sagome e palette. Distribuisci geodati e immagini derivate dalle fonti aperte documentate, con attribuzioni visibili e stime illustrative dichiarate. [Fonti e limiti](DATA_SOURCES.md)

## Portare la pipeline in un’altra città

Prepara catalogo e cartella dati distinti. Scegli una fonte primaria delle impronte e delle altezze, un terreno nudo e un’ortofoto riutilizzabile. Registra fonte, data, licenza, unità e risoluzione. Sostituisci bbox, origine, trasformazioni in entrambe le pipeline Python, endpoint e campi locali, riferimento del terreno, estensione dell’atlante, vista iniziale e selezione del dataset nel viewer. Verifica l’allineamento di un edificio, una piazza e una strada in un pilota. I modelli di Las Palmas usano riferimenti locali al sito.

## Controlli prima della consegna

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
node scripts/qa.mjs pilot
npm.cmd test
node scripts/qa-sectors.mjs
node scripts/benchmark.mjs
```

I test richiedono Chrome. Confronta la coppia neutro/stilizzato di Santa Ana, apri i nuovi marker e verifica nomi, indice, zoom e ripristino dopo riordino. La suite cittadina include un luogo aggiuntivo di prova, rotazione del viewport, pinch e perdite simulate del contesto WebGL. Per espansioni consistenti confronta la build precedente e quella nuova sullo stesso dispositivo e browser. Il benchmark accetta la directory di build come argomento. Controlla draw call e triangoli per frame, picco heap, stabilità di buffer e texture dopo le transizioni e draw call a riposo. Il ripristino deve riportare la geometria visibile, oltre ai marker HTML. Su un telefono reale verifica anche una sessione prolungata quando cambia il carico GPU.

Registra fonti o aggiornamenti in [DATA_SOURCES.md](DATA_SOURCES.md), confronti e risultati effettivi in [QA.md](QA.md), stato e approssimazioni in [PROGRESS.md](../PROGRESS.md). Il workflow Pages ricostruisce la demo dai dati versionati su push a main. Cache private, riferimenti visivi e build temporanee restano locali.

## Carreggiate nei nuovi quartieri

La sequenza ordinaria `python scripts/data.py city` e `python scripts/sectors.py` genera anche l'asfalto. Servono le dipendenze di `scripts/requirements.txt` e le dipendenze Node del progetto. La triangolazione usa la stessa versione di Three.js del plastico. Dopo un aggiornamento di OSM, del DEM, della griglia o delle larghezze, rigenera dati e settori insieme. I nomi dei file dipendono dal contenuto.

Le misure illustrative e i colori sono in [road-style.json](../src/data/road-style.json). Il generatore considera anche le strade del settore vicino, unisce i tratti alla stessa quota e ritaglia il risultato sulle facce del terreno. Un corridoio di 8 m per lato attorno alle way con `bridge` attivo o `layer` diverso da zero conserva il disegno raster dell'incrocio. Controlla i tag locali quando aggiungi ponti o rampe. La geometria descrive l'asfalto visibile. La percorribilità e i percorsi delle pattuglie continuano a dipendere dal grafo di guida.

Esegui `python scripts/qa-carriageway-data.py` per verificare giunzioni, quote e attraversamenti protetti. Per ripetere il pilota usa `python scripts/sectors.py --road-pilot`, ricostruisci il progetto e lancia `node scripts/qa-carriageways.mjs`. Ripristina la generazione completa con `python scripts/sectors.py`, ricostruisci e ripeti con `--full`. Il benchmark usa Chrome e i settori di riferimento del commit `6bdb2da`, che deve essere disponibile nel clone.

## Allargamento con spazio libero

Le larghezze obiettivo sono 5 m per le ordinarie e 9 m per le principali. La base di 4,50 o 8 m resta disponibile per calcolare la sola fascia aggiunta. Il generatore ritaglia la fascia con le impronte degli edifici, i tronchi (raggio 0,30 m), le aree verdi e pavimentate, i percorsi pedonali e ciclabili, il confine della terraferma e i corridoi protetti. La disponibilità di spazio deriva dalle fonti cartografiche già incluse nel progetto. Un marciapiede assente dai dati può risultare libero.

Il contorno risultante alimenta la panoramica e il taglio delle mesh sui triangoli del terreno. Il nuovo campo facoltativo `roadCoverage` si trova nell'indice cittadino. La rigenerazione produce anche tre campioni a sezione misurata in `public/data/road-width-lab`. Per rifare la verifica delle larghezze esegui `python scripts/qa-carriageway-data.py`, ricostruisci la build, poi esegui `node scripts/qa-road-width-lab.mjs` e `node scripts/qa-carriageways.mjs --full --larghezze`. Il riferimento per questo confronto è la geometria del commit `85b05aa`.

## Controllo delle altezze con il LiDAR

Il catalogo completo di fonti, licenze e modi di accesso è in [GEODATA_SOURCES.md](GEODATA_SOURCES.md). L'ortofoto 20 cm del SITCAN si legge a finestra da remoto (`python -I scripts/roof-compare-20cm.py`) e va usata come seconda fonte di colori e controllo visivo, non scaricata per intero.

Per ogni nuova area scarica dal Centro de Descargas del CNIG (LiDAR, 3ª copertura) i tile da 1×1 km che la coprono: filtra per coordinate UTM 28N. Il download richiede la verifica anti-bot, quindi va fatto dal browser. Metti i `.laz` in `.cache/lidar/` e lancia `python -I scripts/lidar-check.py` (serve `laspy[lazrs]` in `.cache/pylib`, fuori da `requirements.txt`). Il rapporto in `.cache/lidar-control/` confronta le altezze comunali con il LiDAR per edificio e per luogo. Con `--export` aggiorna `content/lidar-heights.json`, che `data.py` legge per gli edifici senza altezza comunale. Rigenera poi `data.py city` e `sectors.py`. Cattedrale e complessi con più parti vanno letti per parte, non per OBJECTID.
