# Generare e ampliare la mappa

## Aggiungere un luogo

Il catalogo di lavoro è [las-palmas.json](../content/las-palmas.json). Esempio verificato con un settimo luogo in una copia di prova:

```json
{"id":"alameda","name":"Alameda de Colón","osm":"way/251673532","areas":["city"],"markerHeight":2}
```

Aggiungi la voce a `places`. Il nome è quello locale, l’ID è univoco e persistente, l’altezza del marker è in metri sopra il terreno. L’ordine governa la numerazione. La selezione salvata segue l’ID. Assegna `pilot` anche in `areas` se il luogo ricade nel pilota e deve comparirvi. `pilotFocus` identifica il luogo che centra quel ritaglio e la sua vista di dettaglio.

Lo script legge una way poligonale oppure una relazione con un’unica way esterna e una way per ogni anello interno. Tutti i membri e i nodi devono essere presenti nell’XML. Per un POI puntuale, un bordo suddiviso in più way o una relazione con più esterni, estendi prima il lettore e verifica la geometria risultante. Il marker usa un punto rappresentativo interno. Casa de Colón è il caso di controllo per i tre cortili. Menu, scheda e pin leggono lo stesso GeoJSON tramite [places-ui.js](../places-ui.js) e il filtro per area del viewer.

## Ampliare un quartiere

1. Ricava il nuovo perimetro dalle impronte dei luoghi. Lo stage `city` prende l’inviluppo convesso dei vertici esterni dei POI con area `city` e aggiunge 95 m. Anche una sola nuova voce può cambiare le richieste dati. Il pilota è un quadrato di 650 m centrato sul punto interno di `pilotFocus`.
2. Verifica che la bbox WGS84 in [data.py](../scripts/data.py) comprenda il nuovo perimetro e che l’estratto contenga gli oggetti OSM completi. Per aree vaste valuta un estratto regionale ritagliato e un adattamento del lettore XML. Conserva l’origine pubblicata a longitudine −15.415, latitudine 28.105. Gli anelli locali sono in metri est/nord in EPSG:32628, Three.js usa (est, quota, −nord). I GeoJSON pubblici usano longitudine/latitudine.
3. Conserva gli input precedenti. In un checkout pulito porta le modifiche al catalogo e agli script, quindi rigenera con cache nuova quando cambia la richiesta. `.cache/osm-full.xml` dipende dalla bbox, `<stage>-count.json` e le pagine `<stage>-<offset>.json` dall’estensione comunale, `<stage>-dem.tif` dal ritaglio WCS, `pnoa-roofs.jpg` dall’origine e dall’estensione WMS. I nomi non includono quei parametri. Una risposta vecchia può superare i controlli di conteggio o di dimensioni. Per una riproduzione identica usa invece lo snapshot originale.
4. Controlla le pagine comunali ordinate per OBJECTID, il conteggio univoco e la copertura ai bordi. La pipeline ripara e ritaglia gli edifici, conserva i cortili e scarta parti sotto 2 m². Le altezze comunali sono provvisorie, il ripiego è 9 m. Verifica la copertura del MDT05 e le zone senza dati, che vengono riempite con zero. Il terreno usa campioni di circa 5 m e una maglia visiva di 15 m.
5. Imposta in [roof-colours.py](../scripts/roof-colours.py) un rettangolo che contenga interamente pilota e città, inclusi i bordi dei tetti, con margine per il campionamento. A 1 m/pixel, `west,south,width,height` sono metri locali. Il WMS usa EPSG:4083. L’immagine ha il nord in alto. Lo script attenua le ombre, campiona i mezzitoni escludendo i cortili e scrive il WebP insieme a `roof-tones.json` con `tones` e `bounds`. Lo shader legge quei limiti.
6. Verifica apertura, mirino e limiti del pan. Il centro iniziale della scena cittadina resta in [main.js](../main.js). Un terzo stage richiede modifiche al generatore e al selettore del viewer, che oggi distinguono pilota e città.

## Generazione riproducibile

Dalla radice del progetto, con Python 3.13 e curl:

```powershell
python -m pip install --target .cache/pylib -r scripts/requirements.txt
python scripts/data.py pilot
python scripts/data.py city
python scripts/roof-colours.py
```

Controlla in `public/data` le due scene, i due `*-aoi.geojson`, il `poi.geojson` condiviso e i due file dei tetti. Entrambi gli stage riscrivono i POI condivisi. L’atlante usa entrambe le scene già generate. Confronta i confini prima/dopo e le coordinate dei luoghi preesistenti. Per un’estensione verifica su ogni nuovo bordo la continuità di strade, suolo, edifici e colori.

## Architettura e resa visiva

Nel catalogo, `buildings` è indicizzato per OBJECTID comunale. Usa `heightOverride`, `wallColor`, `windows`, `roofFurniture` e `roofSurface` per personalizzare il fabbricato. `pavedParks` contiene gli ID delle way OSM per i parchi pavimentati. Per Santa Ana, `split.osmWay` divide l’impronta comunale tra interno della maschera e resto. Il ramo `inside` definisce i propri attributi e `toneSuffix` distingue la tinta della navata a parità di OBJECTID.

Per un modello dedicato registra la chiave `landmark` in [landmarks.js](../landmarks.js). Ogni chiave genera un modello per scena anche quando il ritaglio divide l’edificio in più parti. Verifica posizione, orientamento e quota del modello sulla sua impronta. Confronta pilota neutro e stilizzato a camera identica. Usa foto e Google Maps come riferimenti privati per sagome e palette. Distribuisci geodati e immagini derivate dalle fonti aperte documentate, con attribuzioni visibili e stime illustrative dichiarate. [Fonti e limiti](DATA_SOURCES.md)

## Portare la pipeline in un’altra città

Prepara catalogo e cartella dati distinti. Scegli una fonte primaria delle impronte e delle altezze, un terreno nudo e un’ortofoto riutilizzabile. Registra fonte, data, licenza, unità e risoluzione. Sostituisci bbox, origine, trasformazioni in entrambe le pipeline Python, endpoint e campi locali, riferimento del terreno, estensione dell’atlante, vista iniziale e selezione del dataset nel viewer. Verifica l’allineamento di un edificio, una piazza e una strada in un pilota. I modelli di Las Palmas usano riferimenti locali al sito.

## Controlli prima della consegna

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
node scripts/qa.mjs pilot
npm.cmd test
node scripts/benchmark.mjs
```

I test richiedono Chrome. Confronta la coppia neutro/stilizzato di Santa Ana, apri i nuovi marker e verifica nomi, indice, zoom e ripristino dopo riordino. La suite cittadina include un settimo luogo di prova, rotazione del viewport, pinch e perdite simulate del contesto WebGL. Per espansioni consistenti confronta la build precedente e quella nuova sullo stesso dispositivo e browser. Il benchmark accetta la directory di build come argomento. Controlla draw call e triangoli per frame, picco heap, stabilità di buffer e texture dopo le transizioni e draw call a riposo. Il ripristino deve riportare la geometria visibile, oltre ai marker HTML. Su un telefono reale verifica anche una sessione prolungata quando cambia il carico GPU.

Registra fonti o aggiornamenti in [DATA_SOURCES.md](DATA_SOURCES.md), confronti e risultati effettivi in [QA.md](QA.md), stato e approssimazioni in [PROGRESS.md](../PROGRESS.md). Il workflow Pages ricostruisce la demo dai dati versionati su push a main. Cache private, riferimenti visivi e build temporanee restano locali.
