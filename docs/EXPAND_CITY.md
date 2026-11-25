# Generare e ampliare la mappa

## Aggiungere un luogo

Il catalogo di lavoro è [las-palmas.json](../content/las-palmas.json). Esempio verificato con un settimo luogo in una copia di prova:

```json
{"id":"alameda","name":"Alameda de Colón","osm":"way/251673532","areas":["city"],"markerHeight":2}
```

Aggiungi la voce a `places`. Il nome è quello locale, l’ID è univoco e persistente, l’altezza del marker è in metri sopra il terreno. L’ordine governa la numerazione. La selezione salvata segue l’ID. Assegna `pilot` anche in `areas` se il luogo ricade nel pilota e deve comparirvi. `pilotFocus` identifica il luogo che centra quel ritaglio e la sua vista di dettaglio.

Lo script legge una way poligonale oppure una relazione con un’unica way esterna e una way per ogni anello interno. Tutti i membri e i nodi devono essere presenti nell’XML. Per un POI puntuale, un bordo suddiviso in più way o una relazione con più esterni, estendi prima il lettore e verifica la geometria risultante. Il marker usa un punto rappresentativo interno. Casa de Colón è il caso di controllo per i tre cortili. Menu, scheda e pin leggono lo stesso GeoJSON tramite [places-ui.ts](../src/map/places-ui.ts) e il filtro per area del viewer.

### Scheda del luogo

Aggiungi alla voce del luogo un blocco `card`:

```json
"card": {
  "text": "Testo in spagnolo, da 400 a 600 caratteri.",
  "link": "https://sito-ufficiale-o-wikipedia",
  "photo": {"file": "id-del-luogo.webp", "author": "Autore", "license": "CC BY-SA 4.0", "source": "https://commons.wikimedia.org/wiki/File:..."}
}
```

- **Testo:** fatti verificati su una fonte citabile, senza toni da guida turistica. `npm run check:data` (parte di `build`) rifiuta testi fuori da 400–600 caratteri.
- **Foto:** solo licenze libere (Wikimedia Commons: CC BY, CC BY-SA, pubblico dominio), mai generate. Ritaglio 16:9 a 960 × 540, WebP in `public/photos/`, registrata in [DATA_SOURCES.md](DATA_SOURCES.md). La build fallisce se il file manca. `photo` è facoltativa: senza, la scheda non mostra il riquadro.
- **Link:** sito ufficiale del luogo quando esiste, altrimenti Wikipedia in spagnolo.
- `data.py` copia il blocco in `poi.geojson`; il quartiere mostrato viene da `barrios.json`.

## Ampliare un quartiere

1. Modifica `coverage.zones` nel catalogo. Ogni zona ha un `id` univoco e una sola forma: `places` con `margin` (inviluppo dei luoghi elencati, in metri), `axis` con `radius` (corridoio di coppie longitudine/latitudine) `osm` (relazione di confine in OpenStreetMap, ad esempio un barrio: `relation/16905756`) oppure `polygon` (anello longitudine/latitudine). L’area è l’unione delle zone, ritagliata sulla terraferma usando la costa OSM e Santa Ana come punto interno. Verifica che il risultato sia un poligono continuo, includa tutti i luoghi e raggiunga `minimumLandM2`. Il pilota rimane un quadrato di 650 m attorno a `pilotFocus`.
2. Estendi `coverage.bounds` oltre il nuovo perimetro. La costa deve attraversare il bordo della finestra e dividerla in terra e mare. `coverage.lattice` è il passo in gradi del reticolo fisso delle richieste alla Map API (0,01°): allargando la finestra le celle già in cache vengono riusate. Lo script unisce nodi, way e relazioni per tipo e ID, conservando la versione più recente. Per aree maggiori valuta un estratto regionale. Conserva l’origine WGS84 (−15.415, 28.105) e il CRS metrico EPSG:32628. Un luogo deve stare sulla terraferma: un edificio sugli scogli, fuori dalla costa OSM, ferma la generazione. I record comunali senza geometria vengono segnalati e saltati.
3. Le risposte OSM, ArcGIS, MDT05 e PNOA sono in `.cache/sources`. Il nome contiene un digest dell’URL completo, compresi bbox e risoluzione. Per aggiornare una fonte allo stesso URL conserva lo snapshot precedente e avvia una nuova acquisizione in una cache separata.
4. Controlla che il conteggio comunale coincida con gli OBJECTID univoci paginati. La pipeline ritaglia gli edifici, conserva i cortili e scarta frammenti sotto 2 m². Controlla il terreno MDT05 ai bordi. Il viewer interpola un’unica griglia su entrambe le facce di ogni confine.
5. La pipeline ricava i limiti da pilota e città e scarica riquadri PNOA fino a 1024 px a 1 m/pixel. Il viewer legge le tinte per impronta da `roof-tones.json`. La pipeline genera ancora l’atlante WebP e i ritagli per i settori come asset legacy. Ogni impronta ha un solo proprietario, determinato dal centro del suo rettangolo di ingombro.
6. Verifica apertura, mirino e limiti del pan. Il centro iniziale della scena cittadina resta in [main.ts](../src/main.ts). Un terzo stage richiede modifiche al generatore e al selettore del viewer, che oggi distinguono pilota e città.

### Barrio senza confine in OpenStreetMap

Se OSM ha solo un nodo `place=suburb`, usa il perimetro del servizio «Barrios» del Comune: una zona `{"id": "...", "municipal": <NUCL_CO_ID>, "name": "<nome in spagnolo>"}`. `data.py` scarica il layer una volta (`ENTS_CO_ID=24`), allarga il perimetro di 10 m per chiudere la giunzione con i confini OSM e riempie i buchi sotto 2.000 m². Il nome va scritto a mano con gli accenti: il servizio lo dà in maiuscole senza accenti. Controlla prima che l'unione con l'area già coperta resti un solo poligono. Un barrio di un'altra entità del servizio (per esempio Tafira, 50) si indica con `"entity": 50`; senza, vale la città (24). Se l'area supera la finestra `coverage.bounds`, allargala: verso sud deve contenere la linea di costa oltre il bordo del modello, altrimenti il mare non si chiude. Una zona `municipal` senza `name` viene coperta ma non etichettata (i «Diseminado» tra un barrio e l'altro). I buchi riempiti arrivano a 5.000 m².

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

## Edifici pubblici e case dei quartieri storici

- **Edificio pubblico grande:** in `catalog.buildings`, `"balconies": false` toglie i balconi sporgenti e lascia le finestre (ospedali); `"windows": false` toglie anche quelle (centri commerciali, capannoni).
- **Balcone canario:** le case fino a 15 m dentro i perimetri di `src/data/historic-quarters.json` (oggi Vegueta e Triana, copiati da `barrios.json`) hanno il balcone chiuso di legno con tettuccio. Per aggiungere un quartiere storico, aggiungi il suo anello a quel file.

## Spiagge e lungomare

- **Acqua:** `data.py` scrive come superficie `water` le aree OSM `leisure=swimming_pool` e `natural=water` tra 4 e 20.000 m²; `ground-map.ts` le dipinge per ultime con `color.water`. Una piscina dentro un'impronta comunale resta coperta dall'edificio: abbassa quella parte con `split.polygon` (Club Metropole).
- **Sabbia:** `data.py` scrive come superficie `beach` ogni area OSM `natural=beach` di sabbia; `ground-map.ts` la dipinge con `color.beach` di `src/data/road-style.json` e lo shader del suolo le dà increspature invece dei giunti del selciato.
- **Paseo:** una via pedonale il cui nome è in `promenade.names` di `road-style.json` viene disegnata alla larghezza e nel colore indicati lì, con la fascia chiara al centro. Larghezza e colori vengono da fotografie di riferimento; il tracciato resta quello di OSM.
- **Settori senza atlante dei tetti:** se `.cache/roof-atlas.png` manca, `sectors.py` conserva la piastrella dei tetti pubblicata di ogni settore e si ferma con un errore se un settore ha cambiato edifici. Basta per rigenerare dopo modifiche a superfici e strade.

## Oggetti e modelli dedicati

- **Oggetti puntuali** (gru, ciminiere): `data.py` li legge da OpenStreetMap e li scrive in `city.json` come `props`, cioè `[tipo, x, y, orientamento, dimensione]`. `sectors.py` li distribuisce in settori e zone. Un tipo nuovo richiede una voce in `data.py` e un disegno in `src/render/port-props.ts`, con la versione semplificata per la vista intermedia. Non disegnare oggetti che OSM non mappa e non dare una dimensione a quelli mappati come solo punto.
- **Modello dedicato di un edificio:** una voce in `catalog.buildings` con `landmark`, colori e `windows: false`, e una funzione in `src/render/landmarks.ts` registrata in `models`. `frame()` dà centro, direzione e mezze misure dell'impronta; `facade()` posiziona le parti lungo un lato. Prendi le altezze dal LiDAR (tabella per celle di 5 m), la pianta dall'ortofoto a 20 cm e le facciate da fotografie usate solo come riferimento. Se il record comunale ha più corpi, usa la chiave del singolo corpo `OBJECTID:floor(x minimo):floor(y minimo)`. Resta entro circa 1.500 triangoli e controlla il modello da almeno due orientamenti. Per tetti e corpi semplici riusa `roof()` (falde o padiglione su un rettangolo), `block()`, `bounds()` (rettangolo orientato dell'impronta), `eaves()` (fasce di tegole lungo i muri e i patii) e `pitched()` (tetto sull'intera impronta). Disegna ciò che l'ortofoto mostra dall'alto; campanili, portali e facciate solo se la posizione è verificata.
- **Monumento che il Comune non mappa:** una voce in `catalog.osmBuildings` con la way OSM dell'impronta (`osm`, più eventuali `holes`), l'altezza in metri, il `landmark` e l'aspetto. `scripts/osm_buildings.py` la trasforma in un edificio con id negativo e `source: "osm-estimate"`; `data.py city` la aggiunge a `city.json` e `sectors.py` la distribuisce, collisioni di guida comprese. L'altezza è una stima dichiarata finché `lidar-check.py` non la misura. `heightOverride` può abbassare la sola parte estrusa quando il modello disegna il resto (gradinate dello stadio). Esempi: Estadio de Gran Canaria e Castillo de Mata.

## Settori, guida e memoria

Dopo ogni quartiere nuovo ripeti il passaggio di ottimizzazione descritto in [PERFORMANCE.md](PERFORMANCE.md): misura i settori più pesanti con `node scripts/frame-profile.mjs <x,y,zoom>` e controlla che i trucchi già applicati reggano. `sectors.py` semplifica le impronte di settori e zone entro 0,1 m; `city.json` conserva i vertici originali.

Il catalogo dei settori è `public/data/city-index.json`. I JSON e i WebP dettagliati in `city-sectors/` hanno nomi derivati dal contenuto. Distribuiscili insieme all’indice. Il passaggio `sectors.py` rimuove i propri vecchi file generati. Per una rigenerazione ripetibile conserva il mosaico intermedio `.cache/roof-atlas.png` oppure rigeneralo prima.

Il viewer cittadino non carica più `city.json`. `sectors.py` scrive tre livelli:

- **Nucleo** (`city-core.json` e `city-terrain.bin`): confine, strade, superfici, griglia del terreno in Int16 a decimetri e, per ogni zona, il livello lontano: un prisma per isolato (unione delle impronte, altezza e tinta medie pesate sull'area) e il suolo a maglia di 60 m. È sempre residente.
- **Zone** da 960 m (`city-zones/`, 4×4 settori): sagoma di ogni edificio, chiome, suolo a 15 m e impronte per le collisioni. Si caricano quando il lato lungo della vista scende sotto 3.200 m nel profilo compatto e 6.000 m su desktop, con isteresi del 9 %. Due zone uscite dalla vista restano in memoria, mostrate come livello lontano.
- **Settori** da 240 m (`city-sectors/`): dettaglio, solo dentro una zona caricata, sotto circa 550 m di vista.

Il budget del dettaglio è 58 MiB nel profilo compatto e 115 MiB su desktop. Comprende array geometrici, pixel delle bitmap e una stima delle texture RGBA con mipmap. Le zone sono contate a parte (`zoneBytes`) e limitate dalla vista. La memoria totale del browser comprende anche nucleo, worker, driver e risorse temporanee. Misura sul dispositivo obiettivo. Leggi i contatori `data-sectors` sul contenitore della scena: `near`, `mid`, zone residenti, settori in attesa, residenti, visibili, espulsioni e byte stimati.

In Conducir la rete stradale e i percorsi valgono su tutta la città. Muri, tetti e alberi arrivano con le zone: il terreno di una zona non ancora caricata conta come occupato, e la partenza attende la zona sotto la vista.

Per misurare a scala piena senza dati nuovi: `python scripts/sectors.py --stress 6` affianca sei copie della città in `public/data/stress-*` (ignorato da Git), poi `npm.cmd run build` e `node scripts/benchmark.mjs dist "?area=stress"`. Il dataset misura il carico, non la resa.

La maglia del terreno è allineata all’origine metrica a passi di 15 m. Ogni cella da 240 m include i tratti OSM che intersecano un margine e dipinge il terreno a 2 px/m, con 5 m esterni per il filtro. Il grafo stradale e la griglia di collisione sono residenti a prescindere dai settori visivi. I percorsi riusano il campo di distanze quando il nodo sorgente è lo stesso.

## Architettura e resa visiva

Nel catalogo, `buildings` è indicizzato per OBJECTID comunale. Usa `heightOverride`, `wallColor`, `windows` e `roofFurniture` per personalizzare il fabbricato. `pavedParks` contiene gli ID delle way OSM per i parchi pavimentati. Per Santa Ana, `split.osmWay` divide l’impronta comunale tra interno della maschera e resto. Il ramo `inside` definisce i propri attributi e `toneSuffix` distingue la tinta della navata a parità di OBJECTID. Quando OSM non mappa la parte, `split.polygon` accetta un anello in metri locali tracciato sull'ortofoto a 20 cm (El Muelle: atrio e piazzale; Edificio Elder: cubo di vetro). Controlla dopo `data.py city` che la divisione non lasci schegge alte di pochi m².

**Strade sotto terra.** `data.py` scarta le way `highway` con `tunnel` e quelle con ogni `level` negativo (le corsie della stazione di Santa Catalina hanno `level=-1` senza `tunnel`). Una strada di superficie che finisce dove inizia un tratto sotterraneo riceve `portal: true`: carreggiate e suolo la chiudono con un taglio netto, come un imbocco, invece del tappo tondo.

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
