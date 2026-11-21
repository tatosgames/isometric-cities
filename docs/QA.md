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
- [Panoramica fino a San Telmo](screenshots/overview.png) · perimetro continuo, marker e attribuzione.
- [Santa Ana neutra](screenshots/santa-ana-neutral.png) e [Santa Ana stilizzata](screenshots/santa-ana-styled.png) · stesse geometrie, vista e scala.
- [Mercado e Teatro](screenshots/mercado-teatro.png) · posizione reciproca e attraversamento urbano lungo l’antico Guiniguada.
- [Triana mobile](screenshots/triana-mobile.png) · nome del Gabinete, controlli e attribuzione.

Le prove coprono panoramica e dettaglio. La scena è continua, raggruppata in celle spaziali per il disegno. Ai margini del plastico si vedono i tagli dell’area. Il rilievo delle facciate, le altezze e la vegetazione hanno le approssimazioni descritte nelle [note sui dati](DATA_SOURCES.md).


## Ripristino WebGL su mobile

La prova seleziona San Telmo, forza due cicli consecutivi di perdita e ripristino del contesto sullo stesso canvas e controlla proiezione, scheda e varietà dei pixel al centro della mappa. La suite passa a 1440×900 e 390×844 in Chrome con Playwright. Il test simula l’interruzione WebGL, senza simulare la terminazione del processo del browser da parte del sistema operativo.

Il profilo touch/schermo piccolo usa DPR massimo 1, antialiasing multisample disattivato, illuminazione diretta senza shadow map e geometrie più leggere per alberi e facciate. Per la scena completa, la somma dei byte degli attributi nelle geometrie finali passa da 87.888.600 a 35.822.556; i triangoli da 732.405 a 426.459. Questi valori misurano gli array della mesh e non la memoria totale del dispositivo.

## Camera, memoria e recupero progressivo

Confronto con il commit 1c8f8c0. Chrome locale in Playwright, viewport touch 390×844, stessa build Vite per ciascuna revisione. Il percorso alterna Santa Ana e San Telmo, con otto piccoli pan da tastiera per tappa. Movimento ridotto attivo nel benchmark per isolare il costo del disegno dalle nuove transizioni. Venti tappe misurate dopo le prime due di riscaldamento.

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

La suite browser copre orientamento del viewport, zoom e centro conservati, movimento ridotto, tre perdite consecutive (pan, transizione, scheda), ripristino dei pixel, profilo ridotto dalla seconda perdita e recupero tramite il pulsante di ricarica. Su mobile verifica anche pinch dopo il ripristino e riduzione temporanea della risoluzione durante un gesto prolungato con intervalli lenti. Controllati i confronti visivi di [Santa Ana](screenshots/santa-ana-styled.png), [Mercado](screenshots/mercado-teatro.png) e [San Telmo](screenshots/san-telmo.png).

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

Limiti noti: nessuna prova su telefono fisico (tocco reale, vibrazione, prestazioni). Lo swipe non ha un test automatico. La cattura nel test dipende dall'arrivo casuale delle pattuglie, con attesa massima di 120 s. Le auto sono cerchi di 1,15 m di raggio; solo gli alberi a più di 4,5 m da una facciata sono ostacoli. Le ombre dinamiche sono macchie, la shadow map resta statica. Gli edifici possono coprire l'auto nelle vie strette: un alone resta visibile attraverso i volumi.

### Interfaccia a icone e game feel

HUD, guida e pannello finale senza testo visibile: icone SVG proprie, numeri, zone tattili animate (lezione del freno dopo 4 s, una sola volta, ricordata nel browser), indicatore di destinazione con il numero del luogo, fascio luminoso sul traguardo, bordo rosso di pericolo. Etichette e annunci restano per i lettori di schermo. Aggiunti: calamita delle monete, numeri che saltano fuori alla raccolta, lampeggianti delle pattuglie, testacoda dei rottami, muso che si abbassa in frenata, pausa prima del pannello di cattura.

Camera: anticipo smussato a parte, inseguimento stretto, zoom con costante di tempo di circa 1 s. Misurato a campioni di 0,5 s durante la guida: zoom tra 0,91 e 0,97 del valore base, variazione massima fra due campioni 0,012. Ingresso in planata dallo zoom della mappa in circa 1,5 s. Con movimento ridotto attivo zoom e scossa sono disattivati.

- [Guida del freno su mobile](screenshots/conducir-mobile.png) · [pannello di cattura](screenshots/conducir-fin.png).
- Il rilevatore di design segnala il footer a 10 px e il font Inter, preesistenti e non modificati, e il bordo rosso di pericolo, voluto.
- Non provato su telefono fisico. La sensazione rispetto al video di Pako va giudicata giocando.
