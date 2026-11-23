# Checkpoint

**A · Santa Ana.** Quadrato 650 × 650 m. Acquisiti 1.059 record comunali, vie OSM e MDT05. Primo confronto neutro/stilizzato completato. Il massimo dell’intero fabbricato nascondeva le torri della cattedrale. Divisi i volumi in base all’impronta della chiesa e ripetute le catture. Per Casa de Colón sono stati esclusi i cortili prima di collocare il punto.

**B · Vegueta–Triana.** Acquisiti 1.047 record comunali nel rettangolo di ricerca finale. Dopo il ritaglio e la separazione dei volumi si disegnano 828 parti di edificio, 388 tratti stradali, 95 superfici e 684 alberi. Sei POI verificati, scena locale, controlli e build testati. [Rapporto e immagini](docs/QA.md).

**C · Studio futuro di ridipintura.** Conservare l’attuale plastico come baseline. Su autorizzazione futura, preparare 4–9 finestre contigue di Santa Ana alla camera fissata con colore, quota, palette unica e sovrapposizione. Mantenere i marker nel viewer. Confrontare in overlay bordi della piazza, impronte, incroci e continuità di ogni bordo al medesimo zoom. Scartare il campione se un riferimento cambia posizione o le giunzioni restano visibili. L’eventuale risultato sarà una vista illustrata aggiuntiva. Per il gioco restano utilizzabili i geodati e la geometria live. Nessuna generazione eseguita.

Santa Ana e Gabinete Literario hanno ora facciate procedurali dedicate e profili dei tetti distinti. Le immagini di consultazione restano nella cache privata. Catture aggiornate nella cartella QA.

Il catalogo di Las Palmas governa luoghi, appartenenza al pilota e personalizzazioni degli edifici. Menu e modelli dei monumenti sono moduli separati. Verificati riordino, settimo luogo di prova e recupero del contesto nel browser. La mappa pubblicata conserva i sei luoghi originali.

Corretto l’affioramento del terreno attraverso le carreggiate. Il viewer compone strade, sentieri e superfici dai geodati direttamente sulla mesh del terreno. Aggiunta la cattura mobile del Teatro Pérez Galdós alla suite QA.

**D · Modalità «Conducir».** Richiesta da Luca dopo la v1 (il brief originale escludeva il gameplay). Guida arcade stile Pako in `src/drive/drive.ts`: accelerazione automatica, sterzo sinistra/destra, freno con entrambi, derapata, deflessione lungo i muri, pattuglie in aumento che seguono il grafo stradale, scia di monete verso i luoghi, record locale. Interfaccia di gioco a sole icone con guida interattiva, zoom dinamico lento, calamita monete e lampeggianti. Suite browser verde su desktop e mobile emulato. Da fare: prova e taratura su telefono fisico, confronto di sensazione con il video di riferimento (Pako 3), eventuale audio.

Mappa, guida e HUD condividono lo stesso comportamento animato su tutti i dispositivi. La suite browser attende il completamento del volo verso Santa Ana prima di verificare il recupero della vista.

**E · Estensione verso Ciudad Jardín.** Il corridoio ricavato da edifici comunali, OSM, MDT05 e PNOA copre 3,041 km² di terraferma (6,24×), con dieci luoghi e 80 settori da 240 m. Il viewer mantiene una panoramica residente, precarica il dettaglio in direzione di guida, scarta i risultati obsoleti e gestisce separatamente le risorse di ciascun settore. Guida e collisioni usano un grafo globale. Controllati viaggio fra quartieri, passaggio di confine nei due sensi, stabilità del budget e perdita di contesto durante il caricamento. Dettagli, limiti e misure in [QA](docs/QA.md); procedura in [EXPAND_CITY](docs/EXPAND_CITY.md).

Durante la guida il contatore mostra monete e tempo. La coppa compare a fine partita. Una freccia nello stesso anello 3D segue l’orientamento visivo del veicolo, anche in derapata e dietro gli edifici. Rimossi il bordo di allarme e la sirena dal pannello finale.

**F · Robustezza grafica.** La guida sopravvive alla perdita del contesto WebGL (corsa sospesa e ripresa al primo input), i materiali della modalità si compilano all’ingresso e la risoluzione segue la cadenza dei frame anche in guida e nei voli. Aggiunti `docs/UI_ANTI_SLOP.md`, `docs/CAMERA_FRAMING.md` e le skill `threejs-*`, `game-design`, `web-games`. Da fare: prova su telefono fisico; identificare lo shader ancora compilato in partita su desktop.

**G · Game feel della guida.** Hit-stop (urto forte, arrivo, cattura) e colpo di camera direzionale con molla al posto del tremolio casuale; catalogo e regole in `docs/JUICE.md`. Senza audio per scelta. Da fare: prova in mano su telefono fisico.

Le coperture usano una tinta uniforme per impronta, ricavata dai mezzitoni dell’ortofoto PNOA. La panoramica, i settori dettagliati e il pilota condividono le tinte di `roof-tones.json`. Il viewer carica il JSON delle tinte e usa l’illuminazione della scena.

**Camere di guida.** Il pulsante camera e C alternano la vista isometrica iniziale, una vista aerea che segue la traiettoria e un inseguimento rialzato. La scelta è salvata sul dispositivo. Le viste mobili si alzano quando un edificio copre la cabina. Le facciate dettagliate hanno finestre anche sui lati visibili ruotando.

**G · Runtime TypeScript.** I moduli browser e il worker sono in `src/`, divisi per dati, mappa, rendering e guida. Il controllo TypeScript rigoroso copre tutto il runtime. I geodati e la vista salvata vengono controllati all’ingresso. Il worker e il thread principale condividono i tipi per richieste, geometrie trasferibili, bitmap ed errori. [Verifiche della migrazione](docs/QA.md#migrazione-typescript).

**H · Avvio e recupero.** La guida verifica il punto di partenza prima di prendere il controllo della mappa. Il caricamento dei settori passa al thread principale se il worker non risponde entro 10 s. La build verifica la coerenza dell’indice dei geodati. La logica di destinazioni e monete è separata dal rendering e verificabile in Node.

**I · Sterzo arcade.** Da fermo, il giocatore arriva a 60 km/h in 1,44 s e a 90 km/h in altri 4 s. Le pattuglie raggiungono 94 km/h negli stessi tempi in rettilineo e perdono più velocità in derapata. La frenata è a 27 m/s² e lo sterzo parte dal 35% e raggiunge il pieno in 140 ms. La scocca si inclina sulle ruote, un puff breve segnala l'inizio della scivolata e l'ombra rettangolare segue l'auto a terra. [Taratura](docs/JUICE.md#sterzata-e-derapata) e [verifica](docs/QA.md#velocità-e-frenata--23-novembre-2026).

Le auto scorrono lungo gli edifici nei contatti radenti. Il giocatore vede brevi scintille nel punto di contatto. [Taratura](docs/JUICE.md#strisciata-contro-una-facciata) e [verifica](docs/QA.md#strisciata-nei-vicoli).

Il rollio del giocatore arriva a 28° e il saltello visivo da urto a 0,9 m per distinguere meglio la risposta dell'auto alla scala del telefono.

Salita e discesa cambiano la ripresa e la frenata fino a ±0,6 m/s² per giocatore e pattuglie. L'effetto usa la quota stabile del terreno ed è neutro presso ponti e tracciati OSM su livelli diversi. [Verifica](docs/QA.md#pendenza-e-ripresa).

**J · Vento e nuvole.** Un solo vento, l'aliseo da nord-est, muove insieme ombre di nuvole, chiome e fronde delle palme (`src/render/wind.ts`). Le ombre sono una texture di rumore che scorre nello shader di suolo, tetti e alberi: nessuna draw call in più, attive anche su telefono. Per questo la mappa ferma ora ridisegna a circa 30 fotogrammi al secondo invece di restare immobile. Da fare: misura di consumo e calore su telefono fisico; nastri di vento, pedoni e mare restano proposte. [Verifica](docs/QA.md#vento-e-ombre-di-nuvole--22-novembre-2026).

**K · Mare e ombra di contatto.** Il mare accanto al plastico viene dalla linea di costa OSM già usata per ritagliare la terra: `scripts/data.py city` scrive `public/data/sea.json` (1,16 km² entro 260 m dal perimetro, 7,8 km di costa). `src/render/sea.ts` lo disegna con fondali più chiari a riva, onde lunghe che seguono il vento e creste di schiuma che rotolano verso la costa. La texture del suolo ora scurisce il terreno a ridosso dei muri, senza costo a runtime. Da fare: i moli fuori dal perimetro restano vuoti dentro l'acqua; giudizio su telefono fisico. [Verifica](docs/QA.md#mare-e-ombra-di-contatto--22-novembre-2026).

**L · Pedoni.** In guida le strade hanno pedoni che camminano ai bordi, sulle vie pedonali e nelle piazze, e scattano di lato all'arrivo dell'auto o di una pattuglia. Non possono essere investiti e non cambiano il punteggio. Logica in `src/drive/pedestrians.ts`, regole in [JUICE](docs/JUICE.md#pedoni). Da fare: giudizio su dimensione e densità giocando a mano e su telefono fisico.

Laboratorio visivo disponibile su GitHub Pages in `lab.html`. La prova strade rimane sperimentale; i cinque preset precedenti sono archiviati. La scelta per le strade resta aperta. [Storico delle prove](docs/STORICO_PROVE_VISIVE.md).

**M · Rotazione della mappa.** Due pulsanti ruotano il plastico di 90° attorno al bersaglio. La panoramica si adatta all'orientamento scelto. Centro, zoom e angolo tornano all'uscita da Play e dopo il recupero WebGL. [Verifica](docs/QA.md#rotazione-della-mappa).

## Transizioni dei settori

La città usa le transizioni LOD da 250 ms in mappa e in Conducir. Il laboratorio conserva il confronto con lo scambio immediato. [Verifica nel gioco principale](docs/QA.md#transizioni-lod-nel-gioco-principale)

## Carreggiate cittadine

La mappa e Conducir mostrano l'asfalto geometrico quando il settore dettagliato è pronto. La panoramica e gli incroci con dislivello segnalato da OSM usano la texture. Il laboratorio conserva il confronto del Mercado e aggiunge il percorso di Calle San Nicolás, con camera di guida o mappa, senso inverso e caricamento ritardato del settore est. Per provare il percorso con i settori circostanti apri `lab.html?test=settori&intera=1`. [Procedura di espansione](docs/EXPAND_CITY.md#carreggiate-nei-nuovi-quartieri)

Le carreggiate raggiungono 5 e 9 m nei tratti liberi. Un bordo può crescere anche quando quello opposto incontra un ostacolo mappato. Il laboratorio `lab.html?test=larghezze` confronta tre sezioni reali con la versione precedente alla stessa posizione. [Risultati e misure](docs/QA.md#carreggiate-da-5-e-9-metri)

Il laboratorio comprende la prova `lab.html?test=lod` per l'isteresi di zoom e priorità, la sfumatura suolo/strade e il retino per edifici/alberi. I controlli includono arrivo in ritardo a camera ferma, zoom oscillante, curva con inversione e ispezione della transizione. [Prove LOD](docs/QA.md#transizioni-lod-nel-laboratorio)

Altezze con il LiDAR PNOA: `scripts/lidar-check.py` e `content/lidar-heights.json` sono pronti e `data.py` usa l'altezza misurata per gli edifici senza dato comunale (49 in città, 1 coperto dal tile 459-3109). I dati in `public/data` non sono ancora rigenerati. [Procedura](docs/EXPAND_CITY.md#controllo-delle-altezze-con-il-lidar) · [Risultati](docs/QA.md#altezze-comunali-contro-lidar-22-novembre-2026)

Fonti aggiuntive documentate in [docs/GEODATA_SOURCES.md](docs/GEODATA_SOURCES.md): LiDAR PNOA (validato sulle altezze), ortofoto 20 cm SITCAN (tinte coincidenti con il PNOA), restrizioni GRAFCAN. Le palme SITCAN sono rinviate. Nessun dato in `public/data` è stato rigenerato.

**N · Espansione alla città costiera.** Piano approvato da Luca il 22 novembre 2026: da La Isleta e il porto fino a San Cristóbal, per quartieri, con mappa e Conducir ovunque, 8-12 edifici simbolo, LiDAR per controllo e buchi, oggetti portuali dove OSM li mappa, budget di dettaglio +20 %. Fase 0 chiusa sul branch `espansione-costa`: dati rigenerati e misure di riferimento in [QA](docs/QA.md#base-di-misura-prima-dellespansione-costiera-22-novembre-2026). Da fare: pipeline a zone, viewer per area grande, poi i quartieri. Il fallimento intermittente di `qa-sectors.mjs` era un errore di misura della prova, corretto: [dettagli](docs/QA.md#prova-dei-settori-misura-a-contatori-fermi-22-novembre-2026).

**N · Fase 2, viewer per l'area grande.** Chiusa sul branch `espansione-costa`. La città si carica in tre livelli (isolati fusi sempre residenti, zone da 960 m a richiesta, settori di dettaglio), il terreno è binario e in Conducir le collisioni seguono le zone caricate. Budget del dettaglio 58 / 115 MiB. Una replica a sei volte l'area regge con lo stesso tempo di fotogramma e meno heap della base attuale. [Misure e limiti](docs/QA.md#viewer-a-tre-livelli-e-prova-a-scala-6-22-novembre-2026) · [Architettura](docs/EXPAND_CITY.md#settori-guida-e-memoria). Da fare: reticolo fisso per gli estratti OSM e primo quartiere nuovo (Vegueta sud e San Cristóbal); prova su telefono fisico; guida sulla replica; `city.json` resta in `public/data` solo come input della pipeline.

**N · Quartiere 1: Vegueta, Vega de San José, San Cristóbal.** Sul branch `espansione-costa`. La mappa passa da 3,04 a 4,53 km² e da 4.698 a 6.073 parti di edificio, con 12 luoghi. I confini vengono dai barrios di OpenStreetMap e gli estratti OSM stanno su un reticolo fisso. [Verifiche e limiti](docs/QA.md#vegueta-vega-de-san-josé-e-san-cristóbal-22-novembre-2026). Il peggioramento del fotogramma era un caricamento a vuoto ripetuto con il budget pieno, corretto: p95 da vicino di nuovo a 16,8 ms nel banco ([dettagli](docs/QA.md#streaming-stabile-e-geometria-più-leggera-22-novembre-2026)). 72 corpi bassi di 15 complessi hanno ora l'altezza misurata dal LiDAR ([dettagli](docs/QA.md#corpi-bassi-dei-complessi-corretti-con-il-lidar-22-novembre-2026)). Aperto: un fotogramma su dieci dura il doppio a Santa Ana e Santo Domingo, causa lato GPU non diagnosticata; prova su telefono reale. Prossimo quartiere proposto: Arenales e Lugo, Ciudad Jardín completa.

**N · Quartiere 2 e vista limitata.** Su `main`. Aggiunti i barrios da Triana ad Alcaravaneras: 5,05 km², 6.878 parti di edificio, 19 zone. La vista più ampia inquadra un quartiere (3.000 m su desktop, 2.400 m su telefono). Altezze controllate su tredici tile LiDAR. [Verifiche](docs/QA.md#triana-arenales-ciudad-jardín-e-alcaravaneras-22-novembre-2026). Prossimo: Santa Catalina-Canteras, Guanarteme e La Isleta, che richiedono di allargare la finestra OSM a nord e a ovest (i loro confini oggi sono incompleti).

**Editor del pilota.** Trascinamento diretto di edifici, props e vertici, con anteprima 3D durante il gesto e controlli per inquadrare la selezione. `editor.html` consente di spostare impronte, correggere i vertici dei cortili e posare arredi dal catalogo. Le correzioni scaricate si riaprono nell’editor e nella prova di Conducir, dove la guida usa le impronte corrette. Entrambi i flussi sono disponibili nella build di GitHub Pages. [Avvio, verifiche e limiti](docs/QA.md#editor-locale-del-pilota).

**Conducir · Appoggio dei veicoli.** Auto, pattuglie, ombre e sgommate seguono la quota dei triangoli del terreno. Vista intermedia e dettaglio condividono la triangolazione, così il caricamento del settore non sposta i veicoli. Il campione è al centro del veicolo. [Verifica](docs/QA.md#appoggio-dei-veicoli-sul-terreno).

**P · Quartiere 3: Santa Catalina-Canteras e Guanarteme.** La mappa passa da 5,05 a 8,06 km² e da 6.878 a 10.137 parti di edificio, con 14 luoghi (nuovi: Parque Santa Catalina e Auditorio Alfredo Kraus). Il ripristino torna a Santa Ana. Venti tile LiDAR controllano 9.471 parti. [Verifiche e limiti](docs/QA.md#santa-catalina-canteras-e-guanarteme-22-novembre-2026). Aperto: 97 edifici con tetto misurato oltre 10 m sopra il dato comunale, da decidere; vista più ampia sul centro storico a 36 ms di p95 sulla GPU integrata. Prossimo: La Isleta e il porto.

**Q · Isolati densi più leggeri.** Impronte senza vertici superflui e niente dettaglio sepolto nei vicini più alti: da −8 a −21 % di triangoli negli isolati densi, picco heap da 60,5 a 51,6 MB. I trucchi che non toccano la resa sono raccolti in [docs/PERFORMANCE.md](docs/PERFORMANCE.md), con il passaggio da ripetere dopo ogni quartiere. [Misure e limiti](docs/QA.md#isolati-densi-più-leggeri-22-novembre-2026).

**R · Edifici più alti del dato comunale.** 54 parti prendono l'altezza misurata dal LiDAR dove anche la mediana del tetto la conferma; altre 103 con scarto oltre 10 m restano al dato comunale. [Regola e limiti](docs/QA.md#edifici-più-alti-del-dato-comunale-corretti-con-il-lidar-22-novembre-2026).

**S · Quartiere 4: La Isleta e Puerto de la Luz.** La mappa passa da 8,06 a 19,30 km² e da 10.137 a 14.973 parti di edificio, con 16 luoghi (nuovi: Castillo de la Luz e Mercado del Puerto). Trenta tile LiDAR controllano 14.160 parti. [Verifiche e limiti](docs/QA.md#la-isleta-e-puerto-de-la-luz-23-novembre-2026). Aperto: picco heap a 112,6 MB; `qa.mjs` fermo alla riga 75 già sul commit precedente. Prossimo: oggetti del porto e modelli dedicati di Castillo de la Luz, Auditorio Alfredo Kraus e Mercado del Puerto.

**T · Porto e modelli dedicati.** 21 gru e 2 ciminiere da OpenStreetMap come oggetti (`props`), serbatoi e silos con guscio dedicato, e tre modelli: Castillo de la Luz, Mercado del Puerto e Auditorio Alfredo Kraus. [Dettagli, misure e limiti](docs/QA.md#oggetti-del-porto-e-tre-modelli-dedicati-23-novembre-2026). Aperto: il nucleo di La Isleta va a metà cadenza sul telefono emulato (325.000 triangoli da vicino); picco heap 110,7 MB; gru senza collisione nella guida.

**U · Quartieri densi, memoria e scatto dopo il ripristino.** Sul telefono il nucleo di La Isleta scende da 325.000 a 258.000 triangoli e torna a 18 ms di mediana; Santa Ana diventa stabile. La copertura stradale è per zona: lo scatto dopo il ripristino passa da 176 a 36 ms. Terreno in Int16, gru come ostacoli. [Misure e limiti](docs/QA.md#quartieri-densi-memoria-residente-e-scatto-dopo-il-ripristino-23-novembre-2026).

**V · Edifici fusi e parapetto a una faccia sul telefono.** Nei 10 settori più densi i vicini simili sono fusi in gruppi di al massimo quattro (da 3.148 a 2.207 edifici) e in tutta la città il parapetto è una sola striscia. Nucleo di La Isleta da 258.000 a 208.000 triangoli. Desktop invariato. [Misure e limiti](docs/QA.md#edifici-fusi-nei-settori-densi-e-parapetto-a-una-faccia-23-novembre-2026).

**W · Quartiere 5: Ciudad Alta.** Tutto il distrito 4 (16 barrios) più San Francisco - San Nicolás, con i perimetri del servizio «Barrios» del Comune perché OpenStreetMap non li mappa. Città a 27,83 km², 21.326 parti di edificio, 61 zone e 639 settori. LiDAR su 40 tessere: 20.174 edifici misurati, 90,6 % entro 5 m. [Dettagli, misure e limiti](docs/QA.md#quartiere-5-ciudad-alta-e-san-francisco---san-nicolás-23-novembre-2026). Aperto: heap dopo la raccolta a 129 MB; nessun luogo o modello dedicato in Ciudad Alta.

**X · Memoria residente.** Le zone caricate non tengono più piastrelle di suolo e copertura stradale, la vista intermedia e lontana del telefono non ha normali per vertice e i contorni del livello lontano si rilasciano dopo l'uso. Heap dopo la raccolta da 128 a 101 MB nel benchmark, da 145 a 104 MB alla vista più ampia su Schamann, resa identica. [Misure e limiti](docs/QA.md#memoria-residente-dopo-ciudad-alta-23-novembre-2026).

**Conducir · Toponimi.** La via compare in alto quando il tratto è riconoscibile. Al passaggio tra quartieri, il nome entra ed esce in dissolvenza. I confini coprono le 12 relazioni OSM del catalogo. [Verifiche](docs/QA.md#toponimi-in-conducir).

**Conducir · Cattura.** Dopo il colpo, auto e pattuglia si assestano al rallentatore e il plastico passa al bianco e nero. «ATRAPADO» e i tre valori stanno sopra la scena, con due pulsanti a icona più in basso. [Verifiche](docs/QA.md#cattura-in-conducir).

**Conducir · Titolo e fluidità della cattura.** Il titolo avorio usa un'ombra corta. La scena passa al bianco e nero con un filtro CSS. Nelle tre prove in Chrome con emulazione mobile il primo fotogramma filtrato scende da circa 897 ms a circa 18 ms. [Misure](docs/QA.md#desaturazione-css-e-titolo).

**Preloader.** L’anello di avvio segue i traguardi reali del caricamento. La mappa entra in dissolvenza dopo il primo frame della vista iniziale con la zona e il dettaglio previsti dallo zoom. Se lo streaming tarda, entra il livello già disegnato e il dettaglio continua in background. Il terreno si scarica in parallelo al core. [Verifiche](docs/QA.md#preloader-della-mappa).

**Preloader · Fluidità e recupero.** Core e terreno partono dall’HTML mentre si scarica il modulo principale. L’anello avanza con i completamenti dei dati e il settore iniziale viene renderizzato al livello finale sotto la schermata di avvio. Gli errori transitori dei dati ricevono un tentativo automatico e il limite di avvio si sospende in background. [Verifiche](docs/QA.md#fluidità-e-recupero).

**Preloader · Revisione anti-slop.** Un solo indicatore per l’attesa e il progresso. Attribuzioni visibili fino al primo comando e poi consultabili da «Licencias de datos» nel menu. [Verifiche](docs/QA.md#revisione-anti-slop-del-preloader).

**Conducir · Planata di ritorno.** All’uscita, la camera torna in 1,5 s al centro, allo zoom e all’orientamento della vista salvata prima di Play. [Verifiche](docs/QA.md#planata-di-ritorno-alla-mappa).

**Mare aperto.** L’oceano prosegue oltre l’inquadratura del plastico nei profili verificati. La costa OpenStreetMap guida ancora il disegno della schiuma e il terreno determina la vista generale. [Verifiche](docs/QA.md#mare-aperto).
