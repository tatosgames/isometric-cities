# Ottimizzazioni che non toccano la resa

Catalogo dei trucchi già applicati al plastico, con la misura che li giustifica. Va riletto dopo ogni quartiere nuovo: quasi tutti valgono per l'intera città senza altro lavoro, ma vanno rimisurati dove gli isolati sono più densi o più alti. I numeri completi sono in [QA.md](QA.md).

## Passaggio da fare dopo ogni quartiere

1. Trova i settori più pesanti del quartiere: i file più grandi in `public/data/city-sectors/`.
2. Misura da vicino e alla distanza massima sopra quei settori, non solo sui luoghi del menu:
   `node scripts/frame-profile.mjs <x,y,zoom>` (metri locali; sul telefono emulato 1.59 è la vista di un luogo, 0.352 la più ampia). Leggi triangoli, draw call, mediana e p90.
3. Se i triangoli superano quelli dei quartieri già ottimizzati, conta cosa li compone in un settore (muri, tetti, parapetti, finestre, alberi) prima di toccare il codice. L'intuizione sbaglia: nei quartieri del nord pesavano i parapetti, non le finestre.
4. Dopo la modifica confronta schermate a camera identica, poi `typecheck`, `build`, `npm.cmd test`, `node scripts/qa-sectors.mjs` e `node scripts/benchmark.mjs dist`.
5. Misura su una macchina libera. Un altro processo pesante raddoppia fotogrammi a caso e rende inutile il confronto.

## Dati (pipeline)

| Trucco | Dove | Effetto misurato |
|---|---|---|
| Impronte senza i vertici entro 0,1 m da un muro dritto (la precisione dei dati). Il primo vertice resta primo, perché ancora l'edificio al terreno. | `lighter()` in `scripts/sectors.py`; `city.json` resta intatto | −22 % di vertici d'impronta in città; settori −5 % e zone −10 % in byte; meno muri, parapetti e triangoli di tetto |
| Livello lontano a isolati fusi: unione delle impronte, contorno semplificato a 3 m, altezza e tinta medie pesate sull'area | `far_blocks()` in `sectors.py` | La città intera resta residente in 1,6 MB |
| Terreno in binario Int16 a decimetri invece che in JSON | `city-terrain.bin` | Niente analisi di una lista di numeri all'apertura |
| Terreno tenuto in Int16 anche in memoria (`Terrain.scale`), sul thread principale e nel worker | `coreWithTerrain()` in `load.ts` | 6 MB invece di 12 per copia |
| Copertura stradale ritagliata per zona; nell'indice solo una copia semplificata a 1,5 m per la mappa lontana | `sectors.py`, `sector-stream.ts` | Scatto dopo il ripristino da 176 a 36 ms; indice da 1,74 a 0,48 MB; heap a vista ferma da 98 a 86 MB |
| Tre livelli: nucleo, zone da 960 m, settori da 240 m, con nomi derivati dal contenuto | `sectors.py` | Il viewer non scarica più la città intera; la cache del browser resta valida tra una versione e l'altra |

## Geometria (viewer)

| Trucco | Dove | Effetto misurato |
|---|---|---|
| Estrusione senza fondo e coperchio: uno è interrato, l'altro sta sotto il tetto | `wallsOnly()` in `src/render/scene.ts` | Con i parapetti a tre facce: Santa Ana da 359.000 a 264.000 triangoli |
| Parapetti a due facce (sopra e fuori) invece di una scatola chiusa, nel profilo compatto; niente coperchio delle cabine sul tetto e niente davanzali semplici | `parapet()` e `scene.ts` | Nucleo di La Isleta da 325.000 a 258.000 triangoli e da 36 a 18 ms di mediana; Santa Ana stabile a 18 ms. Costo: bordo dei tetti più sottile sul lato lontano |
| Niente finestre, cornici e parapetti sepolti in un edificio adiacente più alto. Si chiede cosa c'è 0,5 m fuori dal muro e fino a che quota. Disattivato nell'editor, dove gli edifici si spostano. | `buriedTo()` in `scene.ts` | Insieme alle impronte semplificate: da −8 a −21 % di triangoli negli isolati densi |
| Finestre e davanzali come rettangoli piatti; cornici di piano solo su desktop | `scene.ts` | — |
| Chiome a icosaedro senza suddivisione e 4 per albero invece di 7; palme a 8 fronde invece di 13, nel profilo compatto | `scene.ts` | — |
| Geometrie fuse per cella di 120 m e materiale; alberi istanziati per cella di 320 m | `add()`, `instance()` | 85-150 draw call per fotogramma da vicino |
| Normali in Int8, colori in Uint8, niente UV | `add()` | Meno memoria per vertice |

## Luce e pixel

| Trucco | Dove | Effetto |
|---|---|---|
| Nessuna shadow map nel profilo compatto: ombra di contatto dipinta nella texture del suolo, occlusione alla base dei muri nei colori dei vertici, macchia d'ombra piatta sotto gli alberi | `main.ts`, `ground-map.ts`, `scene.ts` | Un solo passaggio di disegno |
| Su desktop la shadow map si aggiorna solo quando serve (`autoUpdate=false`) | `main.ts` | — |
| Risoluzione adattiva sulla cadenza dei fotogrammi quando la vista si muove | `src/render/adaptive-resolution.ts` | — |
| Ciclo a 30 fps a mappa ferma per vento e nuvole | `src/render/wind.ts` | — |

## Streaming

| Trucco | Dove | Effetto misurato |
|---|---|---|
| Budget di dettaglio 58 MiB compatto, 115 MiB desktop; le zone si contano a parte | `sector-stream.ts` | Memoria stabile sul circuito ripetuto di `qa-sectors.mjs` |
| Una richiesta resta valida 600 ms dopo l'uscita dalla vista, come lo stato «in vista» | `sector-stream.ts` | Fine del carica-e-scarta al bordo dello schermo: p95 da oltre 100 ms a 17-35 ms |
| Settori dello stesso tipo non si espellono a vicenda; un settore di dimensione nota si scarica solo se c'è posto | `sector-stream.ts` | Vedi sopra |
| Vista più ampia limitata a 3.000 m (desktop) e 2.400 m (compatto) | `farthest()` in `main.ts` | Ogni edificio è sempre disegnato; gli isolati fusi compaiono solo durante un caricamento |
| Guida: grafo stradale globale, muri e alberi per zona; una zona non caricata vale come piena | `drive-world.ts` | L'indice degli ostacoli non cresce con la città |
| Confine della città indicizzato per fasce di 25 m: un punto incontra solo i lati della propria fascia | `ringIndex()` in `drive-world.ts` | −2,7 s all'apertura con la costa di La Isleta (2.451 lati) |

## Cose provate che non servono

- Togliere i davanzali (−11 % di triangoli) non elimina i fotogrammi doppi a Santa Ana.
- Alleggerire i settori non riduce in proporzione i triangoli a schermo: il budget si riempie con più settori precaricati. Conta il numero per settore, non solo quello per fotogramma.
- I fotogrammi doppi (uno su dieci, 35 ms) negli isolati più densi restano con 220.000 come con 300.000 triangoli. Il thread principale è scarico (2-4 ms): il costo è nella GPU integrata e non è diagnosticato.

## Idee non ancora provate

- Budget di dettaglio espresso anche in triangoli, non solo in byte: i settori densi pesano sulla GPU più di quanto dica la loro dimensione.
- Livello sempre residente ancora più leggero: il picco heap è a 101 MB. Restano 13 MB di JSON residenti (strade, superfici e isolati di tutta la città) e 7 MB dell'indice dei muri della guida.
- Un oggetto dato a ogni zona non deve contenere la città intera: controlla cosa viene ridisegnato o ricopiato a ogni caricamento prima di cercare altrove uno scatto.

- Muri interamente sepolti tra due edifici adiacenti (2 triangoli per lato).
- Un solo parapetto dove due tetti alla stessa quota condividono il lato.
- Dettaglio ridotto (senza finestre) per i settori precaricati fuori dallo schermo.
- Misura su un telefono reale: tutte le cifre vengono da Chrome con emulazione mobile su GPU integrata Intel UHD.
