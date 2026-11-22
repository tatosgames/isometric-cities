# Verifica locale · 21 novembre 2026

## Velocità e frenata · 23 novembre 2026

La regressione a 120 Hz misura 60 km/h a **1,442 s** e la punta a **5,442 s**, pari a 90 km/h per il giocatore e 94 km/h per le pattuglie. Il giocatore percorre **96,5 m** da fermo prima di arrivare a 90 e si ferma da quella velocità in **0,933 s** e **11,5 m**. A parità di slittamento la pattuglia perde il 50% in più per effetto del coefficiente di derapata. Il controllo ostacoli trova ostacoli a 4, 8 e 13,8 m. La prova camera verifica 0 m da fermo, 5 m a 10 km/h e 12 m da 90 km/h.

In Chrome desktop e touch emulato, la prova strumentata ha raggiunto 90 km/h su un viale del grafo, verificato una curva stretta e fermato l'auto prima di un incrocio partendo da 90. Un urto frontale a circa 10,6 m/s ha prodotto il rimbalzo e quello a circa 11,6 m/s ha attivato anche il fermo.

## Sterzo arcade · 22 novembre 2026

La regressione a 120 Hz misura **1,442 s** fino a 16,5 m/s e **0,658 s** per fermarsi da 13 m/s in rettilineo. Un tocco di 100 ms a 13 m/s cambia la direzione della traiettoria di **2,58°**, contro i **0,96°** della taratura precedente. Dopo 400 ms di sterzo, al rilascio lo slittamento scende sotto 1,5 m/s in **175 ms**. La prova controlla anche rollio, controsterzo entro 50 ms, inclinazione longitudinale, ritorno in posizione neutra, altezza della scocca sulle ruote e limite della posa dopo un urto.

Typecheck, build e regressioni di percorso e camera superati. Una prova strumentata in Chrome desktop (1440×900) e touch emulato (390×844) ha esercitato partenza, curva e controsterzo, frenata e urto frontale. A circa 15 m/s la scocca raggiunge 16,4° di rollio mentre le ruote restano in piano. Il puff bianco compare una volta durante la scivolata e le tracce partono. L'urto produce un saltello lasciando l'ombra a terra e senza emettere un altro puff. Su telefono fisico la sensazione di guida resta da verificare.

`npm.cmd test` superato in Chrome desktop e touch emulato. La suite tiene premuto il freno per verificare la cattura dopo la sterzata e dopo il ripristino WebGL. La corsa libera può proseguire dopo aver sfiorato un muro e aveva fatto scadere l'attesa al secondo tentativo su mobile.

La regressione usa la stessa funzione di sterzo chiamata dal gioco. Un confronto di 2.400 passi per veicolo ha dato lo stesso stato fisico prima e dopo la semplificazione, per il giocatore e per una pattuglia, con frenate, inversioni e reset della rampa. La prova della scocca ruota i vertici del modello per verificare la distanza dal piano delle ruote.

## Verifica di base

Windows, Node 24.13, Chrome desktop e Playwright. Controllo dei tipi superato con `npm.cmd run typecheck`. Build Vite completata con `npm.cmd run build`. Il bundle principale misura circa 604 kB minificato (154 kB gzip) e supera la soglia informativa predefinita di Vite.

| Prova | Esito |
|---|---|
| `node scripts/qa.mjs pilot` | Neutro e stilizzato, identica camera su Santa Ana. La piazza resta aperta di fronte alle due torri. |
| `npm.cmd test` | Build di produzione testata a 1440×900 e 390×844. Tutte le sei schede, indice mobile, pan, zoom, reset, movimento da tastiera e attivazione di un marker con Invio. Pinch via eventi touch Chromium. |
| Richieste della pagina | Nessuna richiesta fallita, risposta HTTP di errore, risorsa esterna o eccezione JavaScript non gestita nei percorsi testati. |
| Apertura | Fino alla prima vista con camera pronta: circa 2,7 s desktop e 2,0 s mobile emulato nella prova registrata. |
| Movimento | Misura precedente al restyling. Chrome desktop locale, viewport 1887×2044. Durante 50 spostamenti alternati da tastiera, intervallo mediano fra frame 17,3 ms, 95° percentile 18,6 ms dopo cinque frame iniziali. Su telefono fisico le prestazioni restano da misurare. |
| Riproduzione dati | Da cache: circa 1,4 s per Santa Ana e 1,6 s per l’area completa. Cache locale con librerie Python circa 225 MB. Scena finale 716 kB su disco. Zero tile raster. |

## Prove visive

- [Vista iniziale a tutto schermo](screenshots/opening.png) · dettaglio di Triana.
- [Panoramica fino a San Telmo](screenshots/overview.png) · perimetro continuo e marker.
- [Santa Ana neutra](screenshots/santa-ana-neutral.png) e [Santa Ana stilizzata](screenshots/santa-ana-styled.png) · stesse geometrie, vista e scala.
- [Mercado e Teatro](screenshots/mercado-teatro.png) · posizione reciproca e attraversamento urbano lungo l’antico Guiniguada.
- [Triana mobile](screenshots/triana-mobile.png) · nome del Gabinete, controlli e attribuzione.

Le prove coprono panoramica e dettaglio. La scena è continua, raggruppata in celle spaziali per il disegno. Ai margini del plastico si vedono i tagli dell’area. Il rilievo delle facciate, le altezze e la vegetazione hanno le approssimazioni descritte nelle [note sui dati](DATA_SOURCES.md).


## Ripristino WebGL su mobile

La prova seleziona San Telmo, forza due cicli consecutivi di perdita e ripristino del contesto sullo stesso canvas e controlla proiezione, scheda e varietà dei pixel al centro della mappa. La suite passa a 1440×900 e 390×844 in Chrome con Playwright. Il test simula l’interruzione WebGL, senza simulare la terminazione del processo del browser da parte del sistema operativo.

Il profilo touch/schermo piccolo usa DPR massimo 1, antialiasing multisample disattivato, illuminazione diretta senza shadow map e geometrie più leggere per alberi e facciate. Per la scena completa, la somma dei byte degli attributi nelle geometrie finali passa da 87.888.600 a 35.822.556; i triangoli da 732.405 a 426.459. Questi valori misurano gli array della mesh e non la memoria totale del dispositivo.

## Camera, memoria e recupero progressivo

Confronto con il commit 1c8f8c0. Chrome locale in Playwright, viewport touch 390×844, stessa build Vite per ciascuna revisione. Il percorso alterna Santa Ana e San Telmo, con otto piccoli pan da tastiera per tappa. Nella misurazione storica le transizioni erano disattivate. Il benchmark corrente attende la fine del volo della camera prima di misurare il pan. Venti tappe misurate dopo le prime due di riscaldamento.

| Misura | Versione precedente | Versione attuale |
|---|---:|---:|
| Array geometrici mobile, inclusi indici, colori e matrici delle istanze | 35.822.556 byte | 21.252.343 byte |
| Picco RSS del processo Node isolato durante la costruzione della scena | 348.628 KiB | 298.176 KiB |
| Massimo campionato di heap e backing storage all’apertura in Chrome | 104,6 MB | 91,0 MB |
| Apertura nel singolo run del benchmark | 2,37 s | 2,47 s |
| Intervallo al 95º percentile durante il pan | 34,6 ms | 34,0 ms |
| Draw call WebGL per frame, media | 17,75 | 30 |
| Triangoli inviati per frame, media | 147.010 | 139.674 |
| Draw call nei cinque secondi a riposo | 0 | 0 |

Le istanze per cella riducono i dati duplicati e aumentano i disegni separati. I buffer e le texture WebGL conteggiati nella nuova versione restano a 245 e 6 tra la fine del riscaldamento e la ventesima tappa misurata. L’apertura e il percentile sono misure di una sessione, sensibili a browser, GPU e carico del computer. Il picco RSS comprende l’intero processo isolato; il campionamento Chrome non misura la VRAM. Ripetizione sul build locale con `node scripts/benchmark.mjs`; un argomento facoltativo seleziona un’altra cartella di build.

La suite browser copre orientamento del viewport, zoom e centro conservati, tre perdite consecutive (pan, transizione, scheda), ripristino dei pixel, profilo ridotto dalla seconda perdita e recupero tramite il pulsante di ricarica. Su mobile verifica anche pinch dopo il ripristino e riduzione temporanea della risoluzione durante un gesto prolungato con intervalli lenti. Controllati i confronti visivi di [Santa Ana](screenshots/santa-ana-styled.png), [Mercado](screenshots/mercado-teatro.png) e [San Telmo](screenshots/san-telmo.png).

Verifica dei monumenti: typecheck, build, confronto neutro/stilizzato a Santa Ana e smoke test desktop/mobile completati. Inquadrature di controllo: [cattedrale](screenshots/santa-ana-styled.png) e [Gabinete Literario](screenshots/triana-mobile.png). Tutte le risorse grafiche della demo vengono servite dal progetto.

## Catalogo e tetti

La suite browser aggiunge un settimo luogo ai dati di prova, cambia l’ordine dei luoghi e controlla la selezione salvata e il filtro del pilota. Una rigenerazione separata con Alameda de Colón ha mantenuto le coordinate dei sei luoghi originali e il perimetro del pilota. Sulla scena cittadina le verifiche geometriche per il posizionamento sui tetti scendono da 18.178 a 15.132 con lo stesso risultato aggregato.

## Strade sul terreno

La [vista mobile del Teatro Pérez Galdós](screenshots/teatro-mobile.png) copre il viale lungo l’aiuola e gli incroci ai lati del teatro. Il colore di strade, percorsi e superfici OSM segue gli stessi triangoli del terreno in tutta l’area. Le strade hanno giunzioni arrotondate e i percorsi pedonali si disegnano per ultimi. La mappa dei colori viene generata una volta per scena con il lato maggiore limitato a 2048 pixel. Verificati il pilota neutro e stilizzato, navigazione desktop e mobile emulato, zoom e ripristino ripetuto del contesto WebGL.

## Modo «Conducir» · 21 novembre 2026

`npm.cmd test` copre, a 1440×900 e 390×844: ingresso nella modalità, scia di monete presente, avvio al primo input (tastiera su desktop, tocco sul lato sinistro su mobile), sterzata antioraria e avanzamento automatico, cattura con pannello «¡Atrapado!», «Otra vez» con punteggio azzerato, raccolta di almeno una moneta, uscita con ritorno alla vista precedente. Nessuna eccezione JavaScript né richiesta fallita.

- Senza guidare, in tre prove desktop la cattura è arrivata dopo circa 10, 16 e 31 s.
- Chrome con emulazione 390×844, 10 s di guida: intervallo mediano fra frame 17,5 ms, 95º percentile 18,3 ms. È il computer di sviluppo, non un telefono.
- [Schermata mobile](screenshots/conducir-mobile.png).

Limiti noti: nessuna prova su telefono fisico (tocco reale, vibrazione, prestazioni). Lo swipe non ha un test automatico. La cattura nel test dipende dall'arrivo casuale delle pattuglie, con attesa massima di 120 s. Le auto sono cerchi di 1,15 m di raggio; solo gli alberi a più di 4,5 m da una facciata sono ostacoli. Le ombre dinamiche sono macchie, la shadow map resta statica. Gli edifici possono coprire l'auto nelle vie strette: la sagoma gialla segue i pixel coperti e la freccia compare quando un volume edilizio copre il centro dell’abitacolo.

### Interfaccia a icone e game feel

HUD, guida e pannello finale senza testo visibile: icone SVG proprie, numeri, zone tattili animate (lezione del freno dopo 4 s, una sola volta, ricordata nel browser), indicatore di destinazione con il numero del luogo, fascio luminoso sul traguardo e record nel solo pannello finale. Etichette e annunci restano per i lettori di schermo. Aggiunti: calamita delle monete, numeri che saltano fuori alla raccolta, lampeggianti delle pattuglie, testacoda dei rottami, muso che si abbassa in frenata, pausa prima del pannello di cattura.

Camera: anticipo smussato a parte, inseguimento stretto, zoom con costante di tempo di circa 1 s. Misurato a campioni di 0,5 s durante la guida: zoom tra 0,91 e 0,97 del valore base, variazione massima fra due campioni 0,012. Ingresso in planata dallo zoom della mappa in circa 1,5 s.

- [HUD di guida su mobile](screenshots/conducir-mobile.png) · [pannello di cattura](screenshots/conducir-fin.png).
- Il rilevatore di design segnala il footer a 10 px e il font Inter, preesistenti e non modificati.
- Non provato su telefono fisico. La sensazione rispetto al video di Pako va giudicata giocando.

### Hit-stop e colpo di camera · 22 novembre 2026

Fermo della simulazione per urto forte (55 ms, oltre 9 m/s, al più uno ogni 0,6 s), arrivo (50 ms) e cattura (110 ms); polvere, camera e interfaccia continuano. Il tremolio casuale della camera è sostituito da una spinta verso ciò che ha colpito, con ritorno a molla. Regole e catalogo in [JUICE.md](JUICE.md).

- Molla calcolata fuori dal browser con gli stessi passi del codice: colpo pieno 0,99 m di picco e rientro sotto 3 cm in 0,28 s a 60 fotogrammi al secondo; 0,93 m a 20.
- `npm.cmd test` verifica che la cattura produca almeno un fermo e che lo spostamento della camera torni sotto 2 cm.
- Non verificato: soglia e intervallo degli urti in una via stretta giocando a mano, e l'effetto dei fermi insieme alla vibrazione su telefono fisico.

## Corridoio Vegueta–Arenales–Ciudad Jardín

La prova iniziale ha suddiviso i 487.313 m² originari in 17 settori. Sul viewport touch 390 × 844 l’apertura ha costruito 9 settori e 16,02 MB di array di dettaglio. Dopo San Telmo, Santa Ana e ritorno, 20,73 MB di array restavano residenti e il mirino mostrava soltanto il livello semplificato. Questa prima misura riguardava le geometrie prima dell’introduzione delle texture locali.

L’area finale ritagliata sulla costa misura 3.040.938 m² (6,24×); i vertici esportati con precisione di un decimetro danno 3.040.955 m². Il controllo sui dati generati ha confrontato i multinsiemi degli edifici, dei poligoni di terreno e degli alberi tra sorgente e settori. Ogni elemento ha un proprietario, tutti i tratti stradali sono rappresentati e i 160 file richiamati dagli 80 settori sono presenti. I sei POI originali hanno mantenuto le coordinate locali e gli ID. [Panoramica](screenshots/overview.png) · [Parque Doramas](screenshots/ciudad-jardin.png)

| Benchmark in Chrome con viewport mobile emulato | Prima, 0,487 km² | Dopo, 3,041 km² |
|---|---:|---:|
| Prima vista navigabile | 2,29 s | 2,48 s |
| Picco campionato sull’isolate principale durante l’apertura | 102,2 MB | 86,1 MB |
| Intervallo p95 durante il pan | 18,2 ms | 18,4 ms |
| Draw call medie per frame | 32,44 | 70,75 |
| Triangoli medi per frame | 144.863 | 185.226 |
| Disegni in 5 s a riposo | 0 | 0 |

Misure di una singola esecuzione locale per versione. Il percorso alterna Santa Ana e San Telmo. La versione a settori attende il dettaglio prima di campionare il pan. La prima vista è già esplorabile mentre il worker prepara il dettaglio. L'heap campionato esclude il worker e la VRAM. Il percentile durante il pan non misura il picco di un caricamento a freddo. La versione ampliata invia più draw call e triangoli. In un primo prototipo la preparazione sincrona del dettaglio interferiva con le interazioni; il risultato finale usa un worker e array trasferibili.

La prova specifica `node scripts/qa-sectors.mjs` blocca la prima richiesta di dettaglio, forza la perdita WebGL e verifica il ritorno del dettaglio dopo il ripristino. Visita Santa Ana, Plaza de la Feria, Parque Doramas e Metropole per tre giri e verifica espulsioni, budget e stabilizzazione. Nel giro osservato, dopo il riscaldamento, il dettaglio ai quattro arresti occupava circa 45–50 MB entro 48 MiB (50,33 MB). Queste cifre stimano i dati dei settori residenti. Poi usa come punti di partenza e arrivo due nodi stradali reali su Calle Luis Doreste Silva e guida in entrambi i sensi attraverso il confine x = −480 m, con veicolo e pattuglia attivi. Il grafo del gioco, la fisica e i comandi sono quelli di produzione.

Sul grafo stradale di 5.067 nodi i dieci punti di interesse hanno dato gli stessi nodi più vicini e gli stessi vettori di distanze del calcolo esaustivo. Con Node locale, media su dieci posizioni, la ricerca del nodo ha richiesto 0,0043 ms con indice e 0,0638 ms con scansione lineare. Il percorso completo ha richiesto 0,67 ms con la coda a priorità e 0,76 ms con la vecchia scansione. A sorgente invariata il campo si riusa.

ADB era disponibile e la lista dei dispositivi collegati era vuota. Le verifiche di tocco, orientamento, pressione di memoria e recupero sono prove browser simulate. Temperatura, VRAM e fluidità su telefono fisico restano da misurare.

Ripetuta l’intera generazione da cache in ordine pilota, città, colori e settori. I 168 file sotto `public/data` hanno mantenuto lo stesso SHA-256.

Nel secondo e terzo giro di controllo i conteggi WebGL di buffer/texture agli arresti sono stati rispettivamente 922/30 e 922/30 a Santa Ana, 944/32 e 944/32 a Plaza de la Feria, 1.010/36 e 1.010/36 a Doramas, 1.040/36 e 1.036/36 a Metropole. Si tratta di contatori di risorse, non di byte di VRAM.

I crediti si vedono con il menu dei luoghi, la scheda di un luogo, il riepilogo finale e il popup di recupero WebGL. Si nascondono durante l’esplorazione e la guida.

## Robustezza grafica · 21 novembre 2026

- **Perdita del contesto in guida.** La partita resta sospesa invece di chiudersi: punteggio, pattuglie e posizione sono conservati, nessun passo di simulazione senza grafica, e la corsa riparte solo al primo input dopo il ripristino. Coperto da `npm.cmd test` su desktop e mobile emulato (stato `held` in `data-drive`). Cambiare scheda o finestra rilascia i tocchi in corso, senza pannello di pausa.
- **Risoluzione adattiva continua** (`src/render/adaptive-resolution.ts`, dal criterio di superstudiorecover). Attiva durante trascinamento, voli e guida, su tutti i dispositivi; tre livelli (1, 0,85, 0,7 del pixel ratio di base). Scende dopo due finestre di 30 frame con mediana oltre 33 ms, risale dopo sei finestre con 75º percentile sotto 20 ms, e raddoppia l’attesa se il livello appena risalito non regge. A vista ferma torna subito al pieno. Simulazione: 40 ms per frame porta a 0,85 dopo 60 frame e a 0,7 dopo 120; a 16 ms risale a 0,85 dopo 190 frame e a 1 dopo 370.
- **Warm-up degli shader.** All’ingresso in guida si compilano tutti i materiali della modalità, compresi quelli che compaiono dopo (rottami, lampeggianti, colori della polvere). Programmi contati in 45 s di guida con una cattura: 15 all’ingresso e 15 al massimo su mobile emulato; 16 e 17 su desktop.

Limiti: sul desktop resta un programma compilato a partita in corso, non identificato (probabile materiale di un settore caricato in streaming). In Chrome con rendering software la guida scende a 0,7 per il caricamento dei settori: non è una misura di un telefono. La prima esecuzione della suite dopo la modifica ha segnalato quattro richieste di settori fallite durante la perdita del contesto in guida; non si è ripetuto nelle sei esecuzioni successive e la causa non è accertata. Nessuna prova su telefono fisico.

## Coperture a tinta unita

Verificate le tinte PNOA per tutte le 4.698 parti di edificio della città e le 1.108 del pilota. A Parque Doramas, con Chrome mobile emulato e la stessa camera, la cattura della build coincide con la variante piatta del confronto visivo. La build carica zero WebP nel pilota e nei settori, sia con il worker sia con costruzione sincrona. Typecheck e build superati.

Superate le suite Playwright della città su desktop e mobile emulato, del pilota neutro e stilizzato e dei settori. Nel circuito mobile i byte stimati del dettaglio sono rimasti entro 48 MiB, con contatori WebGL identici negli ultimi due giri a ogni arresto. Verificati il recupero dopo perdita del contesto e l’attraversamento in guida nei due sensi.

## Tre viste di guida

Verificati typecheck, build, suite browser della città e circuito dei settori. Il controllo ripetibile `node scripts/qa-drive-camera.mjs` prova il limite di rotazione, un’inversione, la stabilità da fermi e il rientro dopo un ostacolo, con passi a 30 e 120 Hz. Chrome ha verificato il cambio durante lo sterzo da tastiera e con due dita, il recupero WebGL, il ritorno alla vista precedente e il recupero della preferenza dopo ricaricamento.

Nel benchmark di pan in Chrome mobile emulato, un’esecuzione per build, il p95 è passato da 18,3 a 18,4 ms e i triangoli medi da 198.485 a 223.617. A Parque Doramas il dettaglio residente è passato da 14 settori e 50.037.827 byte a 13 settori e 48.340.157 byte entro il budget di 48 MiB. Il benchmark misura la mappa in pan. La fluidità su telefono fisico resta da misurare.

Registrate sei clip dello stesso avvio e sequenza di sterzo su Chrome a 390×844 e 1440×900, una per vista: partenza, svolta di circa 90° e inversione. I video locali sono in `.cache/camera-clips/`, con nomi come `390-high.webm` e `1440-chase.webm`.

## Migrazione TypeScript

- Il comando `npm.cmd run typecheck` controlla tutto `src/` con `strict: true`. La build Vite include il worker separato. Restano disponibili gli stessi asset e formati di salvataggio.
- I controlli all’ingresso accettano entrambe le scene, il catalogo POI, la palette dei tetti, l’indice e tutti gli 80 settori distribuiti. Provati anche una selezione numerica salvata dalla prima versione e il rifiuto di una vista con coordinate incomplete.
- Chrome carica e mostra settori dalla build sotto `/isometric-cities/`, sia usando il worker sia con `OffscreenCanvas` disattivato e costruzione sul thread principale. Il controllo Node della camera di guida passa prima e dopo la migrazione.
- Nel benchmark mobile emulato, il p95 durante il pan è passato da 18,2 a 18,1 ms. Entrambe le build hanno registrato 90,75 draw call e 223.617 triangoli per frame, con zero disegni a riposo. Si tratta di un’esecuzione per build in Chrome con rendering software.

La suite browser completa, il pilota neutro e stilizzato e il circuito dei settori passano sia sulla build JavaScript di riferimento sia sulla build TypeScript. Il circuito mantiene lo stesso massimo osservato di 49.868.015 byte di dettaglio residente, entro il budget mobile di 48 MiB. La guida attraversa lo stesso confine di settore in entrambi i sensi con una pattuglia attiva.

Tre aperture in Chrome mobile emulato con un nuovo processo per prova, eseguite alternando le build, danno una mediana di 1.675 ms per JavaScript e 1.672 ms per TypeScript. Il confronto misura il tempo fino alla prima vista navigabile, su questa macchina.

## Avvio della guida, indice e recupero dello streaming

- `npm.cmd run build` verifica prima le scene, il catalogo, la palette e gli 80 settori distribuiti. Un indice con un’associazione edificio–settore mancante è respinto anche all’apertura nel browser, prima di creare il renderer.
- `node scripts/qa-recovery.mjs` verifica che la mappa resti navigabile senza strade o senza luoghi. Verifica anche il passaggio alla costruzione locale quando il worker non risponde per 10 s, sia con il settore ancora richiesto sia dopo l’annullamento.
- `node scripts/qa-drive-route.mjs` verifica la scelta del percorso, la spaziatura delle monete, la calamita, gli eventi di punteggio, il bonus assegnato una volta sola e il cambio di destinazione. `node scripts/qa-drive-camera.mjs` passa anche dopo il refactoring.
- Superati anche la suite browser desktop e mobile emulato, il pilota e il circuito dei settori. Nel circuito il picco osservato del dettaglio residente è stato di 49.868.015 byte su un budget compatto di 48 MiB. La guida ha attraversato il confine di settore in entrambi i sensi con una pattuglia attiva.

## Vento e ombre di nuvole · 22 novembre 2026

- `npm.cmd run typecheck`, `npm.cmd run build` e `npm.cmd test` passano su desktop e mobile emulato. La suite ora controlla che, a mappa ferma e settori caricati, due immagini del canvas a 800 ms di distanza siano diverse e che `data-view` resti identico.
- Cadenza a riposo misurata contando le chiamate `clear` di WebGL in Chrome con rendering software: 28,3 disegni al secondo su desktop e 27,5 su mobile emulato, con `requestAnimationFrame` a 55–57 al secondo. Sostituisce il dato «zero disegni a riposo» della sezione sulla migrazione TypeScript.
- I disegni a riposo aggiornano solo l'orologio del vento e ridisegnano la scena: camera, settori, marker e risoluzione adattiva restano quelli dell'ultimo fotogramma completo.
- Controllo a vista sugli screenshot rigenerati: chiome e palme restano attaccate ai tronchi, l'ombra di nuvola si legge come fascia più scura nella panoramica e a zoom medio.
- Non verificato: consumo e temperatura su telefono fisico, e la leggibilità dell'oscillazione alla scala di guida su schermo reale. Le ombre degli alberi nella shadow map restano ferme mentre le chiome si muovono di circa mezzo metro.
- Gli screenshot in `docs/screenshots` non sono più identici tra due esecuzioni, perché le ombre di nuvola dipendono dall'istante dello scatto.

## Mare e ombra di contatto · 22 novembre 2026

- `python scripts/data.py city` rigenera dalla cache locale: `city.json`, `poi.geojson` e `city-aoi.geojson` restano identici byte per byte e si aggiunge `sea.json` (8 KB). 5.309 m dei 10.679 m del perimetro coincidono con la costa cartografata.
- `npm.cmd run typecheck`, `npm.cmd run build` (che ora valida anche `sea.json`), `npm.cmd test` e `node scripts/qa-sectors.mjs` passano. Il picco del dettaglio residente nel circuito resta 49.868.015 byte.
- Il mare è una sola mesh con una texture di distanza dalla costa dipinta una volta su canvas. La vista panoramica inquadra terra e mare; lo spostamento resta limitato alla terra. Il mare non compare nel pilota né nella modalità neutra.
- Ombra di contatto: le impronte degli edifici sono riempite su una maschera a circa 4 m per pixel e moltiplicate sulla texture del suolo. La prima versione, con contorni larghi tracciati su canvas, portava l'apertura da circa 2,1 a 6,4 s in Chrome con rendering software ed è stata scartata. Con la maschera la costruzione della texture dell'intera città passa da 72 a 390 ms nella stessa prova.
- Apertura misurata dalla suite dopo le modifiche: 2.828 ms su desktop e 1.781 ms su mobile emulato (prima del mare e dell'ombra: 2.091 e 1.451 ms nella stessa sessione). È una sola esecuzione per configurazione.
- Limiti noti: nei settori dettagliati l'ombra considera solo gli edifici del settore stesso, quindi può mancare lungo i bordi; i moli del porto esterni al perimetro appaiono come vuoti contornati di schiuma; il livello del mare è fissato a −0,9 m perché il modello del terreno arriva a 0 m sulle banchine.
- Non verificato: aspetto e costo su telefono fisico; il movimento delle onde è stato controllato solo su immagini fisse e con il test che confronta due fotogrammi.

## Pedoni · 22 novembre 2026

- `node scripts/qa-pedestrians.mjs` (incluso in `npm.cmd test`) guida un'auto a 16,5 m/s lungo una via pedonale per 600 fotogrammi: su terreno aperto i pedoni scappano e nessuno a terra arriva a meno di 2,3 m dal centro dell'auto (minimo osservato 5,14 m); in un corridoio largo 2 m saltano sopra l'auto; nessuno finisce dentro un ostacolo; un'auto ferma muove solo chi la tocca.
- La suite browser controlla che all'ingresso in guida ci siano pedoni e che nessuno sia a meno di 2,2 m dall'auto. I due valori sono il tredicesimo e il quattordicesimo campo di `data-drive`: pedoni presenti e distanza minima dal giocatore.
- In una corsa di 4 s su desktop emulato: 40 pedoni presenti, distanza minima campionata 7,5 m.
- Costo: due draw call (corpo colorato e testa) e nessun nuovo dato.
- Non verificato: prova a mano in vie strette, leggibilità su telefono fisico (le figure sono alte circa 3 m in scala, come le auto maggiorate), comportamento con molte pattuglie insieme.

Il catalogo `lab.html` carica ogni prova tramite un ingresso dedicato in `src/lab/main.ts`. Per aggiungere un test, registrare ID, titolo, descrizione e import dinamico del modulo. La suite `node scripts/qa-road-lab.mjs` verifica il collegamento alla prova strade, i tre materiali, la tendina A/B sullo stesso fotogramma e il replay in Chrome desktop e mobile emulato. Per i risultati delle prove visive ritirate, vedi lo [storico](STORICO_PROVE_VISIVE.md).

## Rotazione della mappa

`npm.cmd test` esercita i quattro scatti da 90° e controlla che centro e zoom restino invariati. Prova anche clic ravvicinati nei due sensi, attivazione da tastiera, panoramica con tutti i marker visibili, cambio di orientamento dello schermo, uscita da Play e ripristino WebGL con e senza ricarica della pagina. Le catture `rotation-desktop.png`, `rotation-mobile.png` e `rotation-landscape.png` vengono salvate nella directory scelta con `QA_SCREENSHOT_DIR`.

`node scripts/qa-drive-camera.mjs` controlla che la vista Isométrica in guida parta dall'orientamento scelto sulla mappa.

Typecheck, build e suite Chrome completati. Controllate le catture a 1440×900, 390×844 e 844×390. La prova tattile è stata eseguita in emulazione Chrome.

## Carreggiate geometriche sui confini dei settori

Prima prova su Calle San Nicolás, settori `-2_-2` e `-1_-2`. Il generatore produce 962 triangoli e il dettaglio residente cresce di 30.909 byte. Su cinque passaggi per configurazione il p95 mediano resta a 18,2 ms sul profilo mobile e passa da 18,2 a 18,3 ms su desktop. La cattura alla stessa posizione mostra il bordo dell'asfalto in curva accanto all'auto. [Confronto texture e geometria](screenshots/carreggiate-san-nicolas.png)

L'estensione a 80 settori produce 37.487 triangoli. Il controllo dei dati verifica 124 confini attraversati dall'asfalto, con tolleranza di 1 cm in pianta e quota, e l'esclusione dei corridoi attorno a 10 way OSM con ponte o livello esplicito. I JSON di dettaglio dell'intera città crescono da 4.291.052 a 5.661.927 byte prima della compressione HTTP. Ogni settore scarica soltanto il proprio file.

Il test del gioco attraversa il confine nei due sensi in Conducir con pattuglia attiva. Il laboratorio riproduce inoltre l'arrivo ritardato del settore est. I tempi misurati con Chrome su computer e viewport mobile coprono lo streaming e il disegno del percorso. La stabilità percepita durante una sterzata e il comportamento termico richiedono ancora una prova su telefono fisico.

Ripetizione con l'indice completo e cinque passaggi per configurazione. La memoria indica i dati residenti conteggiati dallo streamer al punto di confronto.

| Profilo Chrome | p95 texture | p95 geometria | Memoria texture | Memoria geometria |
|---|---:|---:|---:|---:|
| Mobile emulato, 390 × 844 | 18,3 ms | 18,3 ms | 46,81 MiB | 46,97 MiB |
| Desktop, 1024 × 720 | 18,2 ms | 18,3 ms | 59,81 MiB | 59,98 MiB |

Entrambi i profili rispettano la soglia di +10% sul p95 a caldo. Durante il singolo avvio a freddo, il massimo intervallo osservato con una richiesta pendente è stato 1.614 ms / 960 ms su mobile e 1.516 ms / 1.295 ms su desktop (texture / geometria). Questi valori includono il caricamento iniziale e dipendono dalla macchina di test. Verificati anche costruzione sul thread principale con OffscreenCanvas disabilitato, recupero del contesto WebGL e tre giri del circuito cittadino con espulsione dei settori dal budget mobile di 48 MiB.

## Carreggiate da 5 e 9 metri

La verifica sui file distribuiti conta 45.088 triangoli in 80 settori, 124 confini stradali coerenti entro 1 cm e 10 eccezioni per ponti e livelli. Il controllo della fascia aggiunta usa 1 mm di tolleranza per gli arrotondamenti. Le tre sezioni centrali del laboratorio misurano 5 m in Calle Rafael Mesa y López, 9 m in Avenida Marítima e 4,75 m in Calle Párroco Villar Reina. In quest'ultima i bordi distano rispettivamente 2,50 e 2,25 m dall'asse. [Confronto alla stessa posizione](screenshots/larghezza-carreggiata.png)

| Profilo | p95 precedente | p95 nuovo | Dettaglio residente precedente / nuovo |
|---|---:|---:|---:|
| Mobile emulato | 18,3 ms | 18,2 ms | 46,97 / 46,99 MiB |
| Desktop | 18,2 ms | 18,3 ms | 59,98 / 60,01 MiB |

Mediane di cinque passaggi a caldo sul percorso di Calle San Nicolás, confronto con la geometria di `85b05aa`. Il budget del dettaglio mobile è 48 MiB. Il contorno usato per la panoramica aggiunge 469 kB all'indice JSON (circa 173 kB con gzip locale). L'emulazione Chrome verifica i due profili sulla stessa macchina.

Il test di Conducir attraversa il confine in entrambi i sensi con pattuglia attiva. Il primo giro di QA sui settori ha segnalato una crescita dei contatori WebGL a Santa Ana. La ripetizione dell'intero circuito ha superato la stessa soglia, con 48.584.527 byte residenti a Santa Ana in entrambi gli ultimi due giri. Il test del laboratorio copre il selettore delle tre sezioni, il cambio di larghezza e la posizione dell'auto conservata.

## Transizioni LOD nel gioco principale

Mappa cittadina e Conducir condividono il fade di 250 ms del laboratorio. La mappa entra nel dettaglio a 520 m e lo mantiene fino a 580 m. La diagnostica dello streamer espone `near` e `fading` (settori in transizione). Il renderer richiede altri frame fino al completamento e conserva il ridisegno ambientale della mappa ferma.

La prova `node scripts/qa-main-lod.mjs` ritarda un settore, forza la perdita del contesto al primo fade a camera ferma e verifica il ripristino. Con camera ortografica a zoom unitario verifica le due direzioni attorno a 550 m, il completamento dei fade, il budget e la modalità neutra. Il benchmark sul percorso Santa Ana–San Telmo in Chrome mobile emulato misura un p95 di 18,3 ms sulla build di riferimento `5d75c91` e 18,4 ms sulla nuova build (+0,55%). I risultati riguardano il computer di prova.

## Transizioni LOD nel laboratorio

Aprire `lab.html?test=lod`. Le tre varianti confrontano il comportamento attuale, l'isteresi (ingresso a 520 m e uscita oltre 580 m) con una preferenza temporanea in guida per i settori visibili recenti, e la stessa politica con transizione visiva. La durata iniziale è 250 ms. La carreggiata campiona la texture panoramica nelle coordinate del mondo durante il passaggio al materiale locale. Le sagome di edifici e alberi usano maschere complementari su una matrice di 4 × 4 pixel. Le espulsioni necessarie a rispettare il budget avvengono subito.

`node scripts/qa-lod-lab.mjs` dopo la build ripete tre scenari su due settori di Calle San Nicolás. Il primo ritarda artificialmente di 1,8 s il settore est con la camera ferma. Il secondo oscilla attorno a 550 m dopo essere entrato in dettaglio. Il terzo percorre la curva nei due sensi con la camera di prova. Il browser controlla errori, budget e variazioni dell'immagine abilitando separatamente i due effetti con la transizione ferma al 50%. [Retino a metà transizione e dettaglio completo](screenshots/lod-laboratorio.png)

| Profilo Chrome | Cambi durante lo zoom, attuale / stabile / visivo | p95 durante il percorso, attuale / stabile / visivo |
|---|---|---|
| Mobile emulato (390 × 844) | 14 / 0 / 0 | 18,2 / 18,2 / 18,3 ms |
| Desktop (1024 × 720) | 14 / 0 / 0 | 18,2 / 18,3 / 18,3 ms |

Un cambio conta la richiesta di mostrare o nascondere il dettaglio di un singolo settore. I tempi misurano gli intervalli di requestAnimationFrame sul computer di prova. Sul profilo mobile le catture finali della variante attuale e della transizione completata coincidono. Il retino è distinguibile sulle finestre e lungo i bordi delle chiome nella cattura al 50%. Il telefono fisico serve per giudicarne la visibilità in movimento.

Con `node scripts/qa-lod-lab.mjs --citta` lo stesso percorso usa l'indice completo sul profilo mobile emulato. Il p95 è stato 18,3 ms per la variante attuale, 18,2 ms con le soglie stabili e 18,2 ms con gli effetti visivi. Tutte e tre hanno registrato 11 cambi durante il percorso e 2 espulsioni cumulative. La priorità sperimentale non ha ridotto i cambi in questa prova. La memoria del dettaglio al termine è stata 49.412.515 byte su 48 MiB disponibili (47,12 MiB residenti). La posa finale ha richiesto 28 draw call, salite a 34 forzando la transizione al 50% dei dettagli presenti. Questa sovrapposizione simultanea è una prova di carico. I primi intervalli di caricamento sono sensibili al riscaldamento del browser e non dimostrano un vantaggio tra le varianti.

## Altezze comunali contro LiDAR (22 novembre 2026)

Tile PNOA-LiDAR 459-3109 (2023, 6,7 punti/m²): 577 edifici, 554 misurati, 8 senza punti sufficienti. Differenza LiDAR p95 meno comunale: mediana +0,8 m, errore medio assoluto 1,82 m, 74 % entro 2 m, 93 % entro 5 m. Edifici ≥ 20 m (73): differenza media −0,26 m. Luoghi di controllo, comunale / LiDAR p95: Teatro 30,6 / 30,7, Mercado 13,5 / 12,4, Gabinete 25,3 / 24,7, Casa de Colón 13,4 / 12,9. Cattedrale (41,5 m comunali): 38,4 m al p95 e 47,5 m al p99 sul corpo principale, le altre quattro parti da 10 a 20 m. Edificio 41667, senza dato comunale: 9 m di stima contro 16,2 m misurati. Restano scarti di 10 m e più su singoli edifici (ad esempio 40750 e 41183) non verificati. Controllati solo il tile citato: Arenales e Ciudad Jardín mancano. La mesh pubblicata non è stata rigenerata.

## Tinte dei tetti: ortofoto 20 cm 2024 contro PNOA (22 novembre 2026)

Finestra di `roof-tones.json` letta da remoto dall'ortofoto SITCAN (CC BY 3.0), ridotta a 1 m e trattata con lo stesso algoritmo di `roof-colours.py`. Su 4.820 edifici: ΔE mediano 2,9, 75° percentile 4,3, 95° percentile 7,0; 82,7 % sotto 5 e 99,5 % sotto 10; luminosità mediana −0,4. Navata 41119: `#e5e3e0` contro `#e6e4e1`. I casi peggiori (ΔE 12-14, ad esempio 38573 e 40126) non sono stati ispezionati. Il confronto è a 1 m: il vantaggio dei 20 cm non è misurato. Nessun dato pubblicato è stato modificato. Riproduzione: `python -I scripts/roof-compare-20cm.py`.

## Base di misura prima dell'espansione costiera (22 novembre 2026)

Branch `espansione-costa`, perimetro invariato (3,04 km², 80 settori, 4.698 parti di edificio). `data.py city`, `roof-colours.py` e `sectors.py` rigenerati: rispetto ai dati precedenti cambia un solo edificio (41667, da 9 m di stima a 16,2 m dal LiDAR) e un solo file di settore (`0_-2`). Strade, superfici, alberi, terreno e confine sono identici.

- `typecheck` e `build`: verdi. `npm.cmd test`: verde in 3 min 2 s (apertura 2.617 ms desktop, 2.076 ms mobile emulato).
- `node scripts/benchmark.mjs`: apertura 3.162 ms, picco heap campionato 80,9 MB, p95 18,4 ms, 115 draw call e 263.657 triangoli per frame, 701 buffer e 18 texture alla base, 736 e 18 alla fine, 17.290 draw a riposo.
- `node scripts/qa-sectors.mjs`: 4 esecuzioni verdi su 5. Una è fallita con «WebGL resources grew on the repeated circuit» (buffer 1004 → 1052, texture 24 → 25 a Santa Ana, byte stimati invariati). Sui dati committati in `main` un'esecuzione è passata. Il fallimento è intermittente e non è stato diagnosticato: va chiarito prima di allargare l'area, perché la soglia serve a rilevare perdite di risorse.

## Prova dei settori: misura a contatori fermi (22 novembre 2026)

Il fallimento intermittente di `qa-sectors.mjs` non era una perdita di risorse. Su otto giri del circuito i buffer WebGL si fermano dal quarto giro (1054, 1160 e 1257 a Plaza de la Feria, Parque Doramas e Metropole) e le espulsioni crescono regolarmente. Oscillava solo Santa Ana, di circa 40 buffer e 1 texture: un settore residente carica i propri buffer al primo fotogramma disegnato, e la prova leggeva i contatori prima di quel fotogramma o durante la dissolvenza LOD. Ora la prova attende `pending` e `fading` a zero e due letture uguali dei contatori a 150 ms. Dopo la correzione: scarto massimo 14 buffer fra giri (soglia 24) e sei esecuzioni verdi su sei. Il viewer non è stato modificato.

## Viewer a tre livelli e prova a scala 6× (22 novembre 2026)

Branch `espansione-costa`. Il viewer carica un nucleo (0,67 MB più 0,62 MB di terreno binario) al posto di `city.json` (4,6 MB), 10 zone a richiesta e gli 80 settori. Chrome con emulazione mobile 390×844, stessa procedura della base.

| Misura | Base (Fase 0) | Città, tre livelli | Replica 6× |
|---|---|---|---|
| Apertura | 3.162 ms | 3.649 ms | 4.669 ms |
| Picco heap campionato all'apertura | 80,9 MB | 21,5 MB | 77,6 MB |
| p95 fotogramma, vista ravvicinata | 18,4 ms | 18,7 ms | 18,3 ms |
| Draw call e triangoli per fotogramma | 115 / 263.657 | 116 / 266.280 | 107 / 265.653 |
| p95 fotogramma, vista lontana | non misurato | 18,2 ms | 18,3 ms |
| Draw call e triangoli, vista lontana | non misurato | 120 / 25.963 | 267 / 155.132 |
| Heap dopo la raccolta, vista lontana | non misurato | 21,9 MB | 49,1 MB |

`npm.cmd test` verde (apertura 2.649 ms desktop, 1.255 ms mobile emulato, contro 2.617 e 2.076 della base). `qa-sectors.mjs` verde 8 volte su 8 con il nuovo controllo e 3 su 3 dopo l'ultima modifica alla visibilità delle zone; ora include la vista lontana (nessuna zona richiesta, al massimo due in memoria) e il ritorno. `qa-recovery.mjs` e `qa-drive-route.mjs` verdi. `qa-main-lod.mjs` verde 4 volte su 5: un'esecuzione non ha visto la dissolvenza entro il tempo limite; non diagnosticato.

Limiti delle misure: il p95 di circa 18 ms coincide in tutti i casi, quindi è il limite del banco di prova e non distingue i carichi. La replica 6× ha coordinate non arrotondate e file più pesanti del reale (zone 36 MB contro 3,3 × 6), e non ha costa. In guida, la replica non è stata percorsa: l'attraversamento di confine è provato solo sulla città reale. Nessuna prova su telefono fisico. Su desktop la panoramica della città attuale resta edificio per edificio; nel profilo compatto la vista intera passa agli isolati fusi.

La prova dei settori confronta ora il massimo dei buffer WebGL degli ultimi due giri con quello dei due precedenti, dopo due giri di assestamento (sei giri in tutto): su nove giri i contatori restano fermi, con oscillazioni di circa 20 buffer legate alla panoramica disegnata.

## Vegueta, Vega de San José e San Cristóbal (22 novembre 2026)

Primo quartiere dell'espansione, branch `espansione-costa`. Le tre zone nuove usano i confini dei barrios in OpenStreetMap (relazioni 16905756, 16905755 e 16905754). Terraferma da 3,04 a 4,53 km²; parti di edificio da 4.698 a 6.073 (12.361 record comunali nel rettangolo di acquisizione); tratti stradali da 1.433 a 2.350; alberi da 10.376 a 15.367; 16 zone e 126 settori. Le coordinate dei dieci luoghi precedenti non cambiano. Luoghi nuovi: Iglesia de Santo Domingo (way 38062759) e Parroquia de San Cristóbal (way 842431973).

Gli estratti OSM usano ora un reticolo fisso di 0,01° nella finestra [-15.44, 28.07, -15.40, 28.14]. Con la finestra allargata e i dati riscaricati, la città precedente è risultata identica salvo l'ordine degli elementi.

- `typecheck`, `build`, `npm.cmd test`: verdi (apertura 2.996 ms desktop, 1.225 ms mobile emulato). `qa-sectors.mjs`: 2 esecuzioni verdi su 2.
- Benchmark, Chrome con emulazione mobile, quattro esecuzioni: p95 del fotogramma nella vista ravvicinata 52,8, 70,5, 70,9 e 35,8 ms, contro 18,7 ms prima del quartiere; 142 draw call e circa 371.000 triangoli per fotogramma contro 116 e 266.000. A Santa Ana ora sono visibili 13 settori invece di 11 e 58,9 MB di dettaglio invece di 43,0: la vista è piena dove prima a sud c'era il vuoto. Vista lontana: p95 18,2 ms in tre esecuzioni su quattro, 201 draw call, 35.634 triangoli. Picco heap all'apertura 36-40 MB. Il banco usa la GPU integrata Intel UHD di questa macchina (non il rendering software, come scritto in una prima stesura): il peggioramento era reale e la causa è descritta nella sezione seguente.
- Altezze con il LiDAR (tile 458-3108, 459-3106, 459-3107, 459-3108, 459-3109): nell'area nuova 679 parti misurate, scarto mediano +0,44 m, errore medio assoluto 3,88 m, 66 % entro 2 m, 87 % entro 5 m. Santo Domingo 15,6 m comunali contro 13,4 m; Parroquia de San Cristóbal 16,2 contro 12,5 m. 70 parti di 13 OBJECTID superano 10 m di scarto, tutte con il comunale più alto e tutte in complessi con più parti: l'«altura máxima» del complesso è applicata anche ai corpi bassi (ad esempio 40994: 51,7 m comunali, 3,3 m misurati su due parti; 39616: 30 parti). Elenco in `.cache/lidar-control/scarti-vegueta-sur-san-cristobal.csv`. Non corretti: decisione di Luca. Nessuna altezza nuova esportata: l'edificio 39623, senza altezza comunale, non ha punti classificati come edificio nel LiDAR (81 m², resta a 9 m e va controllato sull'ortofoto); il 36746 cade fuori dai tile scaricati. I tile 458-3106 e 458-3107 (50 parti) non sono stati scaricati.

Limiti: il Torreón de San Pedro Mártir sta sugli scogli fuori dalla terraferma del plastico e non è tra i luoghi. Il confine di Vegueta include una lingua stretta lungo il Guiniguada. Su desktop la città intera supera 6 km e la vista completa passa agli isolati fusi. La prova di trascinamento e zoom in `qa.mjs` è stata resa indipendente dalla scala. Nessuna prova su telefono fisico; la guida nel quartiere nuovo non è stata provata a mano.

## Streaming stabile e geometria più leggera (22 novembre 2026)

Il peggioramento misurato dopo il primo quartiere non dipendeva dal carico di disegno. Con il budget pieno, un settore sul bordo dello schermo veniva scaricato e costruito, poi scartato perché nel frattempo la camera si era spostata di un passo, e subito richiesto di nuovo: 160 fotogrammi su 160 con un caricamento in corso, p95 oltre 100 ms. Tre correzioni in `sector-stream.ts`:

- una richiesta di zona o settore resta valida 600 ms dopo l'uscita dalla vista, e lo stesso vale per lo stato «in vista»;
- un settore in vista può far posto solo espellendo settori non richiesti o precaricati attorno alla vista; settori dello stesso tipo non si espellono a vicenda;
- un settore di cui è nota la dimensione viene scaricato solo se c'è posto.

In `scene.ts` gli edifici non costruiscono più il fondo e il coperchio dell'estrusione (uno è interrato, l'altro sta sotto il tetto) e, nel profilo compatto, i parapetti hanno tre facce invece di una scatola chiusa.

Chrome con emulazione mobile 390×844 su GPU Intel UHD, `node scripts/frame-profile.mjs <luogo>` (160 fotogrammi di piccoli spostamenti alternati):

| Luogo | Prima: p95, triangoli | Dopo: mediana / p90 / p95, triangoli |
|---|---|---|
| Santa Ana | 107-123 ms, 359.000 | 16,7 / 33,3 / 33,4 ms, 264.000 |
| Santo Domingo | 89-124 ms, 384.000 | 16,9 / 33,4 / 33,5 ms, 277.000 |
| San Telmo | 18,3 ms, 304.000 | 16,7 / 16,8 / 16,9 ms, 229.000 |

`benchmark.mjs`: p95 da vicino 16,8 ms (era 36-71), 93 draw call e 190.000 triangoli per fotogramma, apertura 1,9 s. Thread principale 4,5 ms per fotogramma a Santa Ana.

Limiti: a Santa Ana e Santo Domingo circa un fotogramma su dieci dura ancora il doppio. Togliere altri triangoli (prova senza davanzali, −11 %) non lo cambia e il thread principale è scarico: il costo residuo è lato GPU e non è diagnosticato. La misura della vista lontana in `benchmark.mjs` ora parte mentre le richieste precedenti sono ancora valide (429 draw call, 483.000 triangoli): va letta con questa riserva. `qa-sectors.mjs` attende 800 ms prima di leggere i contatori e tollera 64 buffer (un settore ne vale circa 45): 5 esecuzioni verdi su 5. `qa-main-lod.mjs` registra nella pagina la comparsa dell'avviso di recupero, che ora dura meno dell'intervallo di campionamento: 6 verdi su 6. `npm.cmd test` verde. Nessuna prova su telefono fisico.

## Corpi bassi dei complessi corretti con il LiDAR (22 novembre 2026)

Il dato comunale assegna a ogni parte di un complesso l'altezza massima del complesso. `scripts/lidar-check.py --export` scrive ora in `content/lidar-heights.json` anche le singole parti (`parts`) dove l'altezza comunale supera di oltre 10 m il p95 misurato, solo per OBJECTID con più poligoni, impronta di almeno 30 m² e almeno 50 punti di tetto. `data.py` le applica con `source: lidar-pnoa`. Nei cinque tile scaricati: 72 parti di 15 OBJECTID, altezze da 2,1 a 23,8 m (ad esempio 40994 da 51,7 a 3,3 m, 40032 da 50,6 a 2,7 m). Strade, superfici, alberi, terreno e confine sono identici a prima. Una delle parti appartiene alla cattedrale (41119), che conserva l'altezza del catalogo.

`typecheck`, `build`, `npm.cmd test` e `qa-sectors.mjs` verdi. Limiti: le parti corrette non sono state confrontate una a una con l'ortofoto; un corpo demolito o coperto da vegetazione darebbe un valore basso sbagliato. La regola vale solo dove esiste un tile: Arenales, Ciudad Jardín e i margini ovest non sono coperti. Gli scarti in cui il LiDAR è più alto del comunale non vengono toccati.

## Vista più ampia limitata a un quartiere (22 novembre 2026)

Su richiesta di Luca la mappa non si allontana più fino a mostrare tutta la città. Il lato lungo della vista più ampia copre 3.000 m su desktop e 2.400 m nel profilo compatto (`farthest` in `src/main.ts`); il pulsante di ripristino e le rotazioni usano lo stesso limite. Il limite sta dentro la soglia delle zone (6.000 e 3.200 m), quindi ogni vista mostra un edificio per impronta e gli isolati fusi compaiono solo mentre una zona si carica. `npm.cmd test`, `qa-sectors.mjs` (2 su 2) e `qa-main-lod.mjs` verdi. Le prove non pretendono più tutti i segnaposto visibili nella vista più ampia, e `qa-sectors.mjs` verifica che quella vista conservi le zone senza dettaglio. La vista di ripristino resta centrata sul centro geometrico della città, che ora inquadra in parte terreno fuori dal perimetro.

## Triana, Arenales, Ciudad Jardín e Alcaravaneras (22 novembre 2026)

Sette zone nuove dai confini dei barrios in OpenStreetMap: Triana (16904602), Canalejas (16904534), Fincas Unidas (16904535), Lugo (16904536), Ciudad del Mar (16904537), Ciudad Jardín (16904538) e Alcaravaneras (16904432). Le prime sei aggiungono solo 125 parti di edificio, perché il corridoio precedente le copriva quasi per intero; Alcaravaneras ne aggiunge 680. Terraferma da 4,53 a 5,05 km²; parti di edificio da 6.073 a 6.878; tratti stradali 2.576; alberi 16.506; 19 zone e 142 settori. I dodici luoghi non si spostano. Nessun luogo nuovo.

- `typecheck`, `build`, `npm.cmd test` verdi (apertura 1.991 ms desktop, 917 ms mobile emulato). `qa-sectors.mjs` 2 su 2.
- Benchmark: p95 da vicino 18,2 ms, 86 draw call e 178.000 triangoli per fotogramma, apertura 1,9 s, picco heap 43 MB. Profilo dei fotogrammi (mediana / p95): Santa Ana 17,5 / 35,8 ms, Plaza de la Feria 17,5 / 18,2 ms, Metropole 17,7 / 18,3 ms, con 270-282.000 triangoli.
- LiDAR: tredici tile (aggiunti 457-3110, 457-3111, 457-3112, 458-3109, 458-3110, 458-3111, 458-3112, 459-3110). Su 6.194 parti misurate lo scarto mediano LiDAR meno comunale è +0,55 m, l'errore medio assoluto 1,98 m, 72 % entro 2 m e 91 % entro 5 m. Esportate 16 altezze per edifici senza dato comunale e 114 corpi bassi di complessi: in tutto 137 parti con `source: lidar-pnoa`. Restano 31 parti a 9 m di stima: 29 senza punti sufficienti e alcune dove il LiDAR non trova un tetto (ad esempio 30904, misurato a 0 m). `lidar-check.py` scarta ora le altezze sotto 2,5 m per gli edifici senza dato e sotto 2 m per i corpi bassi, ed è passato da 12 minuti a circa un minuto con tredici tile (punti ordinati per fascia, indice spaziale dei vicini) con risultati identici sui cinque tile precedenti.

Limiti: il tile 457-3113 (112 parti, nessuna senza altezza) non è uscito dal filtro del Centro de Descargas e non è stato scaricato. Le correzioni non sono state confrontate una a una con l'ortofoto. Nessuna prova su telefono fisico; la guida nei quartieri nuovi non è stata provata a mano.

## Editor locale del pilota

Aprire `editor.html` su GitHub Pages. In locale, avviare `npm.cmd run dev -- --host 127.0.0.1 --port 5197` e aprire `http://127.0.0.1:5197/editor.html`. Selezionare un edificio nella scena per muoverlo o correggere un vertice del contorno o di un cortile. Il catalogo include panchina, paletto e fioriera. `Download JSON` esporta le correzioni. `Open edits` le riapre nell’editor e `Test Drive` apre il selettore di file del pilota. [Editor del pilota su GitHub Pages](https://tatosgames.github.io/isometric-cities/editor.html)

`node scripts/qa-editor.mjs` avvia Vite e Chrome. La prova copre selezione, trascinamento sul gizmo, modifica di un vertice del cortile, posa e rotazione di props, rimozione, annulla/ripristina e download con riapertura in una sessione nuova. Controlla il rifiuto atomico di JSON non valido, versione della mappa diversa e impronta invalida. Verifica l’avvio di Conducir con il file ricaricato e interroga la stessa griglia di collisione della guida per confrontare la posizione vecchia e quella nuova del muro.

Passati `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd test` e `node scripts/qa-editor.mjs`. In Chrome mobile emulato a 390 × 844, verificati posa di una panchina con tap e download del JSON.

In **Move**, trascinare direttamente un edificio o un prop oppure usare le frecce. Durante il gesto si vede muovere il modello 3D. **Vertices** consente di trascinare i punti delle impronte e dei cortili. **Frame** inquadra la selezione e **Overview** ripristina la vista iniziale. Il test controlla anche il trascinamento senza gizmo, l’annullamento con Esc e la variazione di inquadratura.

Il test dell’editor è passato anche sulla build di produzione servita sotto `/isometric-cities/`, il percorso usato da GitHub Pages. Apre **Test Drive** dal link dell’editor e verifica il caricamento del JSON nella pagina aperta.

L’editor e il caricamento delle correzioni sono disponibili per il solo pilota. La lettura del JSON avviene nel browser. Il file è legato ai byte di `pilot.json` dalla sua impronta SHA-256. Santa Ana e Gabinete Literario sono in sola lettura. Il catalogo contiene arredo decorativo senza collisioni.

## Appoggio dei veicoli sul terreno

Auto, pattuglie e rottami seguono la quota del triangolo sotto il loro centro. Ombre, sgommate e polvere usano la stessa superficie. L'indice in celle da 15 m viene costruito al primo uso del terreno di ciascun settore e viene rilasciato quando esce la zona. Usa i buffer esistenti e non aggiunge draw call.

`ShapeGeometry` e la funzione condivisa producono le stesse facce nello stesso ordine per tutte le 23.378 celle del suolo di dettaglio. Le zone e i 142 settori contengono gli stessi anelli. La triangolazione resta compatibile con le carreggiate già generate.

`scripts/qa-ground.mjs`, incluso in `npm.cmd test`, confronta la quota con un raycast verticale sulla mesh effettiva. A `(-1270, 1055)` il terreno visibile è 6,89 m sopra la quota della griglia nei geodati attuali. La misura resta entro 1 cm dal raycast prima e dopo l'arrivo ritardato del dettaglio. La prova copre anche panoramica, bordo di settore, diagonale di una cella del pilota e fallback fuori dal terreno.

In Chrome desktop e mobile emulato (390 × 844), percorsi entrambi i sensi di un tratto con 3,06 m di dislivello su 35,27 m. L'auto era visibile durante il rettilineo e la sterzata, con una pattuglia attiva.

`npm.cmd run typecheck`, `npm.cmd run build` e `npm.cmd test` completati. `node scripts/qa-sectors.mjs` è passato in esecuzione isolata, con attraversamento nei due sensi e una pattuglia attiva. Il tentativo precedente aveva superato di un buffer la tolleranza del circuito.

Sui dossi più netti può ancora compenetrare una singola ruota, perché l'appoggio si calcola al centro. Resta da riprodurre il punto preciso degli screenshot originali.

## Santa Catalina-Canteras e Guanarteme (22 novembre 2026)

Terzo quartiere dell'espansione. Due zone nuove dai confini dei barrios in OpenStreetMap (relazioni 16904433 e 16904431). Terraferma da 5,05 a 8,06 km²; parti di edificio da 6.878 a 10.137; tratti stradali da 2.576 a 3.574; alberi da 16.506 a 18.983; zone da 19 a 27; settori da 142 a 218. Gli edifici precedenti sono invariati, salvo uno sul vecchio bordo. Luoghi nuovi: Parque Santa Catalina (way 265760472) e Auditorio Alfredo Kraus (way 585709389), 14 in tutto. Dati pubblicati: nucleo 1,6 MB, zone 8,3 MB, settori 16,5 MB.

La finestra OSM passa a [-15.47, 28.07, -15.40, 28.16] (63 celle, 35 nuove). Il record comunale 16913 non ha geometria: `data.py` lo segnala e lo salta. Il confine di Santa Catalina-Canteras include i moli mappati in OSM; quello di Guanarteme include il versante spoglio verso El Rincón.

Il pulsante di ripristino ora torna alla Plaza de Santa Ana alla distanza massima, perché la città non entra più nella vista più ampia e il suo centro geometrico cade lontano da ogni luogo.

- `typecheck`, `build`, `npm.cmd test`: verdi (apertura 3.289 ms desktop, 3.107 ms mobile emulato). `qa-sectors.mjs`: 2 esecuzioni verdi su 2.
- Benchmark, Chrome con emulazione mobile su GPU integrata Intel UHD: apertura 2.304 ms, picco heap 60,5 MB. Vista ravvicinata: p95 18,3 ms, 85 draw call e 176.654 triangoli per fotogramma. Vista più ampia sopra Vegueta: p95 35,9 ms, 219 draw call e 383.282 triangoli. Prima il ripristino inquadrava in parte terreno vuoto; ora inquadra il centro storico, che è il punto più denso.
- Profilo dei fotogrammi (`frame-profile.mjs`): Parque Santa Catalina mediana 17,8 e p95 18,5 ms; Auditorio Alfredo Kraus 17,8 e 18,4 ms; Santa Ana 17,5 e 35,8 ms, come prima.
- LiDAR: venti tile (aggiunti 455-3112, 456-3111, 456-3112, 456-3113, 457-3113, 457-3114, 458-3113). Su 9.471 parti misurate lo scarto mediano LiDAR meno comunale è +0,6 m, errore medio assoluto 2,02 m, 72 % entro 2 m, 90 % entro 5 m. Nell'area nuova: 3.108 parti, mediana +0,75 m, errore medio assoluto 2,23 m, 70 % entro 2 m, 89 % entro 5 m. Altezze misurate esportate: da 16 a 43 edifici senza dato comunale e da 114 a 131 corpi bassi. 189 parti usano ora `lidar-pnoa`; 40 restano a 9 m di stima.
- Schermate di controllo a occhio dei due luoghi nuovi, da vicino e alla distanza massima: edifici, moli, spiaggia e versante coerenti; nessun errore in console.

Limiti. Nell'area nuova 97 edifici hanno un tetto misurato oltre 10 m più alto del dato comunale (ad esempio 25810: 41,7 m comunali, 78,2 m misurati; 22817: 3,6 contro 29,1 m) e 16 lo hanno più basso. Non corretti: decisione di Luca. Elenco in `.cache/lidar-control/scarti-santa-catalina-guanarteme.csv`. Mancano i tile 454-3112, 455-3111, 458-3106 e 458-3107 (61 parti in tutto). La vista più ampia sul centro storico supera il fotogramma a 60 Hz sulla GPU integrata. Nessuna prova su telefono fisico; la guida nei quartieri nuovi non è stata provata a mano. I due luoghi nuovi non hanno un modello dedicato. La Isleta e il porto non sono ancora inclusi.

## Isolati densi più leggeri (22 novembre 2026)

Passaggio di ottimizzazione dopo Triana–Alcaravaneras e Santa Catalina–Guanarteme. Il conteggio di un settore denso (-8_14, 217 edifici) ha mostrato che pesano i parapetti (36 % dei triangoli) e i muri, non le finestre: le impronte comunali hanno in media 16 lati per edificio, con un vertice ovunque un vicino tocca il muro. Due interventi, entrambi senza cambiare la sagoma:

- `sectors.py` toglie dalle impronte di settori e zone i vertici entro 0,1 m da un muro dritto (`lighter()`); `city.json` resta intatto. In città i vertici d'impronta scendono da 237.142 a 185.654 (−22 %); i settori da 16,5 a 15,6 MB, le zone da 8,3 a 7,5 MB.
- `scene.ts` non costruisce finestre, cornici e parapetti sepolti in un edificio adiacente più alto (`buriedTo()`). Nell'editor del pilota resta tutto, perché lì gli edifici si spostano.

`frame-profile.mjs` accetta ora una vista per coordinate (`x,y,zoom`). Telefono emulato 390×844 su GPU Intel UHD, triangoli per fotogramma:

| Vista | Prima | Dopo |
|---|---|---|
| Santa Catalina (-1800, 3480), da vicino | 320.468 | 268.625 |
| Santa Catalina (-2040, 3480), da vicino | 372.062 | 297.209 |
| Alcaravaneras (-1560, 2760), da vicino | 324.423 | 297.319 |
| Arenales (-840, 1080), da vicino | 342.061 | 296.681 |
| Santa Ana, da vicino | 270.743 | 220.331 |
| Santa Catalina, vista più ampia | 335.264 | 264.493 |
| Santa Ana, vista più ampia | 169.321 | 138.222 |

Da vicino il calo a schermo è minore di quello per settore, perché il budget di memoria si riempie con più settori (da 14 a 15, da 16 a 17). `benchmark.mjs`: apertura 2.087 ms (era 2.304), picco heap 51,6 MB (era 60,5), vista ravvicinata p95 18,2 ms con 159.124 triangoli (erano 176.654), vista più ampia 323.183 triangoli (erano 383.282).

`typecheck`, `build`, `npm.cmd test` e due esecuzioni di `qa-sectors.mjs`: verdi su una copia pulita del commit. Confronto a camera identica su Parque Santa Catalina e controllo a occhio di un isolato denso a zoom 3,2: nessuna differenza di sagoma; un edificio a gradoni ha ora un volume tecnico sul tetto, perché la triangolazione del tetto è cambiata.

Limiti. Le viste più ampie sono stabili a 18 ms in `frame-profile.mjs`, ma `benchmark.mjs` misura ancora 35,4 ms di p95 nella vista lontana: la sua misura parte con le richieste precedenti ancora valide. Da vicino, in tre dei cinque isolati densi misurati un fotogramma su dieci dura ancora 35 ms, come a Santa Ana prima: il costo è lato GPU e non dipende dal solo numero di triangoli. Le misure dei tempi sono state prese con un altro processo attivo sulla macchina e vanno ripetute a macchina libera. Nessuna prova su telefono fisico. Il catalogo dei trucchi applicati è in [PERFORMANCE.md](PERFORMANCE.md).

## Edifici più alti del dato comunale corretti con il LiDAR (22 novembre 2026)

In 157 parti di edificio il tetto misurato (p95) supera di oltre 10 m l'altezza comunale. `scripts/lidar-check.py --export` ne corregge 54: solo quelle in cui anche la mediana dei punti del tetto sale (oltre 5 m sopra il comunale e almeno il 75 % del p95). Nelle altre 103 la mediana resta vicina al dato comunale: il p95 legge un albero, una sporgenza del vicino o un corpo alto su una piccola parte dell'impronta, e l'altezza non cambia. Delle 54 corrette, 34 stanno tra Santa Catalina e Guanarteme e 20 nei quartieri precedenti.

Esempi: 25810 (torre accanto al Parque Santa Catalina) da 41,7 a 78,2 m; 22817 da 3,6 a 29,1 m; 16466 da 7,8 a 32,6 m. Le impronte non cambiano. In città 243 parti usano ora `lidar-pnoa`, 9.854 il dato comunale e 40 la stima di 9 m.

`typecheck`, `build`, `npm.cmd test` e `qa-sectors.mjs`: verdi su una copia pulita del commit. Controllo a occhio della torre 25810 nella mappa.

Limiti. Le 54 correzioni non sono state confrontate una a una con l'ortofoto; solo la torre 25810 è stata guardata nella mappa. Un corpo alto che copre meno di metà dell'impronta resta al dato comunale. Il valore applicato è il p95, che su tetti con volumi tecnici può superare di qualche metro la gronda.

## La Isleta e Puerto de la Luz (23 novembre 2026)

Quarto quartiere dell'espansione: tutto il barrio di La Isleta dal confine in OpenStreetMap (relazione 16904434), con abitato, zona industriale, moli del porto, versante vulcanico ed El Confital. Terraferma da 8,06 a 19,30 km²; parti di edificio da 10.137 a 14.973; tratti stradali da 3.574 a 4.703; alberi da 18.983 a 21.981; zone da 27 a 50; settori da 218 a 487. Gli edifici precedenti sono invariati. Luoghi nuovi: Castillo de la Luz (way 126808548) e Mercado del Puerto (way 119110526), 16 in tutto. Dati pubblicati: nucleo 2,3 MB, terreno 5,8 MB, zone 13 MB, settori 28 MB.

La finestra OSM passa a [-15.47, 28.07, -15.39, 28.19] (96 celle). Tre correzioni emerse dalla scala:

- Il servizio delle quote risponde -32768 oltre la propria copertura senza dichiararlo come dato mancante (quattro righe a nord della penisola, in mare): `data.py` lo legge come livello del mare.
- Il mare era disegnato solo entro 260 m dalla terra e lasciava un buco nel bacino del porto: ora i bacini chiusi da terra e moli sono pieni.
- Il mondo della guida chiedeva a ogni nodo stradale se sta dentro il confine scorrendo tutti i suoi lati: 2,7 s all'apertura con la costa nuova. Il confine è ora indicizzato per fasce (`ringIndex()` in `drive-world.ts`) e il controllo non compare più nel profilo.

Verifiche su una copia pulita del commit:

- `typecheck` e `build`: verdi. `qa-sectors.mjs`: 2 esecuzioni verdi su 2. In `npm.cmd test` passano le prove di posa, pedoni e appoggio al terreno; `qa.mjs` si ferma alla riga 75 (piè di pagina visibile sulla mappa). Lo stesso arresto avviene sul commit precedente `1a37dba`, senza queste modifiche: non dipende da La Isleta e il resto di `qa.mjs` non è stato eseguito.
- `benchmark.mjs`, Chrome con emulazione mobile su GPU Intel UHD, confrontato con `1a37dba` nelle stesse condizioni di macchina: apertura 5,3-5,9 s (era 6,3), vista ravvicinata p95 18,2 ms con 156.139 triangoli (era 18,1 ms, 158.928), picco heap 112,6 MB (era 88,7).
- `frame-profile.mjs`: Santa Ana da vicino 17,4 / 18,4 ms (mediana / p95), vista più ampia su Santa Ana 17,4 / 18,2 ms, vista più ampia su Santa Catalina 17,5 / 18,3 ms.
- LiDAR: trenta tile (aggiunti 457-3115, 457-3116, 458-3114, 458-3115, 459-3113, 459-3114, 459-3115, 459-3116, 460-3115, 460-3116). Su 14.160 parti misurate lo scarto mediano LiDAR meno comunale è +0,66 m, errore medio assoluto 1,90 m, 72 % entro 2 m, 91 % entro 5 m. Nell'area nuova: 4.647 parti, mediana +0,86 m, errore medio assoluto 1,96 m, 72 % entro 2 m, 92 % entro 5 m. Esportate 40 altezze per edifici senza dato comunale, 40 corpi bassi e 32 tetti più alti del dato comunale. In città 361 parti usano `lidar-pnoa`, 14.563 il dato comunale, 49 la stima di 9 m. Castillo de la Luz 9,0 m comunali contro 12,0 m misurati; Mercado del Puerto 13,0 contro 9,5 m; Auditorio Alfredo Kraus 29,0 contro 29,0 m, con il p99 a 40,9 m per la torre.
- Schermate viste a occhio: abitato di La Isleta, zona industriale, moli e bacino del porto, penisola con il rilievo vulcanico e i serbatoi del porto, già presenti come edifici comunali.

Limiti. Il picco heap cresce con la superficie (112,6 MB): il livello sempre residente va alleggerito prima di aggiungere Ciudad Alta. Subito dopo il ripristino della vista `benchmark.mjs` misura uno o due fotogrammi da circa 170 ms (p95 su 40 fotogrammi; 35 ms sul commit precedente), mentre a vista ferma la cadenza è regolare: causa non diagnosticata. Nella vista più ampia su Santa Catalina le zone residenti stimano 93 MB. Mancano ancora i tile 454-3112, 455-3111, 458-3106 e 458-3107. La penisola a nord non ha edifici comunali: è terreno con sentieri. Nessuna prova su telefono fisico; guida non provata a mano nell'area nuova. Gru, silos e modelli dedicati non sono in questo passo.

## Toponimi in Conducir

L’audit della HUD ha verificato l’occupazione del margine alto da parte di statistiche e controlli e l’attribuzione OSM nascosta durante la partita. La via usa il centro su desktop e una riga sotto i controlli su schermi stretti. Il nome del barrio compare in una regione di stato e resta visibile per una dissolvenza di 2,8 s. L’attribuzione resta visibile in guida.

Il controllo gira ogni 140 ms. Il nome della via richiede 400 ms di conferma, il quartiere 700 ms. Agli incroci contano distanza e allineamento con la marcia. I test verificano l’incrocio fra una via con nome e una senza nome, una corrispondenza ambigua, i POI reali di Vegueta e Triana e un attraversamento del confine annullato prima della conferma. Il dataset locale copre i 12 confini OSM presenti nel catalogo.

Replay con coordinate stradali reali in Chrome a 1440×900, 390×844 e 844×390. Da Calle Mayor de Triana a Calle Pelota compare una sola volta «Vegueta». Il titolo termina, la via si svuota fuori copertura e la HUD sparisce tornando alla mappa. I due nomi usano testo avorio con un contorno verde scuro e restano distinti dai comandi in tutti e tre i formati.

`typecheck`, build e suite Playwright desktop/mobile passati. La suite completa è stata ripetuta su una build isolata dopo un errore di servizio dei settori nella build condivisa.

## Cattura in Conducir

`npm.cmd test` copre la cattura durante una partita reale, il blocco di monete, tempo e record, il focus sul pulsante di riprova e il recupero WebGL a sequenza iniziata. Un campione della scena a fine cattura verifica che i canali RGB coincidano e che il colore torni al riavvio. La prova mobile ruota lo schermo con l'esito aperto, controlla lo spazio sopra le attribuzioni e usa il pulsante della mappa dopo una seconda cattura. Impostare `QA_SCREENSHOT_DIR` per salvare fuori dal checkout le schermate desktop, mobile verticale e orizzontale.

`typecheck`, `build` e `npm.cmd test` passati. Schermate controllate in Chrome a 1440×900, 390×844 e 844×390. Titolo, statistiche e pulsanti lasciano libera l'area centrale attorno all'auto. In una cattura campionata sul lungomare, l'auto si è assestata di circa 45 cm dopo il contatto e il punteggio è rimasto fisso per tutti i 117 fotogrammi osservati. La verifica mobile è in emulazione.

### Desaturazione CSS e titolo

Sul pilota in Chrome con emulazione mobile a 390×844, tre prime catture dopo caricamenti nuovi hanno registrato 17,8, 18,1 e 18,2 ms al primo fotogramma filtrato. Il valore precedente era circa 897 ms. Durante la transizione le mediane erano tra 17,6 e 18,0 ms. La desaturazione ha creato zero programmi WebGL in tutte e tre le prove, rispetto ai 14 del passaggio precedente. In una prova titolo e pulsanti sono comparsi insieme a circa 844 ms dalla cattura, dopo un ritardo successivo all'avvio del filtro. Nelle altre due sono comparsi separatamente, nei primi fotogrammi utili dopo le rispettive soglie.

`typecheck`, `build` e `npm.cmd test` passati. La suite controlla la pausa della desaturazione a scheda nascosta e con WebGL interrotto, la rimozione del contorno del titolo e il ripristino del filtro al retry e all'uscita. Schermate controllate su desktop e in emulazione mobile, in verticale e orizzontale. L'emulazione desktop non riproduce il font di sistema Android. La verifica sul dispositivo resta aperta.

## Preloader della mappa

La città scarica core, indice e terreno in parallelo. Fino all’apertura lo streamer dà priorità alla zona centrale e, a zoom ravvicinato, al settore visibile più vicino al bersaglio. La dissolvenza dura 260 ms e parte dopo il frame con il dettaglio assestato. Il livello di riserva può entrare dopo quattro secondi dal primo frame di base. In quel caso Play attende le collisioni della zona. Il retry per un errore essenziale ricarica lo stesso URL.

`node scripts/qa-boot.mjs` verifica l’ordine delle richieste, la schermata ancora visibile a zona o settore sospesi, le attribuzioni e il focus da tastiera, l’apertura di riserva con Play in attesa, il retry dopo un errore del modulo, i dati essenziali mancanti, WebGL indisponibile e il ripristino del contesto. Passati anche `typecheck`, `build`, `npm.cmd test`, `qa-sectors.mjs`, `qa-recovery.mjs` e `qa-editor.mjs`.

Nel test locale a cache fredda che sospende e rilascia le richieste, la mappa è interattiva dopo 6,46 s a 1440×900 e 3,64 s a 390×844 emulato. Il primo frame dopo Play arriva rispettivamente in 547 ms e 461 ms. I traguardi `atlas:startup-*` e la misura `atlas:play-first-frame` sono leggibili nella User Timing API del browser. Il confronto a cache fredda in Vite dev, con due prove per variante e per viewport, non mostra un guadagno ripetibile per il warm-up della scena con `compileAsync()`. Il pre-bake di costa e panoramica resta una prova separata.

### Fluidità e recupero

Il test trattiene il modulo d’ingresso e verifica che core e terreno inizino a scaricarsi durante l’attesa e che ciascun file sia richiesto una sola volta. La suite è passata anche dalla build servita sotto `/atlas/`. Con il core ancora in attesa, il completamento dell’indice ha fatto passare l’anello dal 30 al 36 per cento, con un valore visivo intermedio campionato dopo 80 ms. Il dettaglio iniziale viene disegnato direttamente al livello finale finché il preloader copre la scena. Le transizioni visibili dello streaming usano la dissolvenza esistente.

Un HTTP 503 isolato viene recuperato con un secondo tentativo dopo 200 ms. Due fallimenti portano a `Reintentar`. Il test verifica anche che il limite di avvio sia sospeso con la scheda in background. Se il contesto WebGL si perde durante la dissolvenza, il preloader torna subito opaco e l’anello diventa indeterminato fino al recupero. Il confronto dei tempi tra singole esecuzioni in Chrome headless varia da un profilo all’altro. La prova su telefono fisico resta aperta.

### Revisione anti-slop del preloader

Un solo anello. Ruota mentre il progresso è ignoto e interpola i traguardi reali quando iniziano ad arrivare. Le attribuzioni restano visibili durante il caricamento e sulla prima vista. Il test verifica che il primo comando sposti i crediti in «Licencias de datos» e che la barra resti assente in guida e al ritorno sulla mappa.
