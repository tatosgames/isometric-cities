# Verifica locale · 21 novembre 2026

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
- **Risoluzione adattiva continua** (`adaptive-resolution.js`, dal criterio di superstudiorecover). Attiva durante trascinamento, voli e guida, su tutti i dispositivi; tre livelli (1, 0,85, 0,7 del pixel ratio di base). Scende dopo due finestre di 30 frame con mediana oltre 33 ms, risale dopo sei finestre con 75º percentile sotto 20 ms, e raddoppia l’attesa se il livello appena risalito non regge. A vista ferma torna subito al pieno. Simulazione: 40 ms per frame porta a 0,85 dopo 60 frame e a 0,7 dopo 120; a 16 ms risale a 0,85 dopo 190 frame e a 1 dopo 370.
- **Warm-up degli shader.** All’ingresso in guida si compilano tutti i materiali della modalità, compresi quelli che compaiono dopo (rottami, lampeggianti, colori della polvere). Programmi contati in 45 s di guida con una cattura: 15 all’ingresso e 15 al massimo su mobile emulato; 16 e 17 su desktop.

Limiti: sul desktop resta un programma compilato a partita in corso, non identificato (probabile materiale di un settore caricato in streaming). In Chrome con rendering software la guida scende a 0,7 per il caricamento dei settori: non è una misura di un telefono. La prima esecuzione della suite dopo la modifica ha segnalato quattro richieste di settori fallite durante la perdita del contesto in guida; non si è ripetuto nelle sei esecuzioni successive e la causa non è accertata. Nessuna prova su telefono fisico.

## Coperture a tinta unita

Verificate le tinte PNOA per tutte le 4.698 parti di edificio della città e le 1.108 del pilota. A Parque Doramas, con Chrome mobile emulato e la stessa camera, la cattura della build coincide con la variante piatta del confronto visivo. La build carica zero WebP nel pilota e nei settori, sia con il worker sia con costruzione sincrona. Typecheck e build superati.

Superate le suite Playwright della città su desktop e mobile emulato, del pilota neutro e stilizzato e dei settori. Nel circuito mobile i byte stimati del dettaglio sono rimasti entro 48 MiB, con contatori WebGL identici negli ultimi due giri a ogni arresto. Verificati il recupero dopo perdita del contesto e l’attraversamento in guida nei due sensi.

## Tre viste di guida

Verificati typecheck, build, suite browser della città e circuito dei settori. Il controllo ripetibile `node scripts/qa-drive-camera.mjs` prova il limite di rotazione, un’inversione, la stabilità da fermi e il rientro dopo un ostacolo, con passi a 30 e 120 Hz. Chrome ha verificato il cambio durante lo sterzo da tastiera e con due dita, il recupero WebGL, il ritorno alla vista precedente e il recupero della preferenza dopo ricaricamento.

Nel benchmark di pan in Chrome mobile emulato, un’esecuzione per build, il p95 è passato da 18,3 a 18,4 ms e i triangoli medi da 198.485 a 223.617. A Parque Doramas il dettaglio residente è passato da 14 settori e 50.037.827 byte a 13 settori e 48.340.157 byte entro il budget di 48 MiB. Il benchmark misura la mappa in pan. La fluidità su telefono fisico resta da misurare.

Registrate sei clip dello stesso avvio e sequenza di sterzo su Chrome a 390×844 e 1440×900, una per vista: partenza, svolta di circa 90° e inversione. I video locali sono in `.cache/camera-clips/`, con nomi come `390-high.webm` e `1440-chase.webm`.
