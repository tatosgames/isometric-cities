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

**I · Sterzo arcade.** Velocità massima 16,5 m/s, stesso vantaggio relativo per le pattuglie e rampa di sterzo da 200 ms. Il muso anticipa la traiettoria, la carrozzeria si inclina verso l'interno e scie e polvere seguono il retro visibile. La regressione a 120 Hz misura 14,0° tra muso e traiettoria dopo 100 ms a partire da 13 m/s. [Taratura](docs/JUICE.md#sterzata-e-derapata) e [verifica](docs/QA.md#sterzo-arcade--22-novembre-2026).

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
