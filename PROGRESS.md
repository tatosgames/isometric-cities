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

**Laboratorio visivo A/B.** Disponibile su `lab.html` in locale e su GitHub Pages. Cinque campioni consentono di confrontare suolo OSM, facciate, coperture PNOA, contatto col pendio e chiome. I preset restano sperimentali e vengono salvati nel laboratorio. [Prove e due ricette riproducibili](docs/QA.md#laboratorio-visivo-ab--22-novembre-2026).

**Test strade al Mercado.** Nel laboratorio, «Test strade» confronta la resa attuale, una texture pulita a 4 px/m e una carreggiata geometrica su un percorso ripetibile con l’auto del gioco. [QA e costi misurati](docs/QA.md#test-strade-al-mercado).
