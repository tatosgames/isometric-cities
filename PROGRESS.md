# Checkpoint

**A · Santa Ana.** Quadrato 650 × 650 m. Acquisiti 1.059 record comunali, vie OSM e MDT05. Primo confronto neutro/stilizzato completato. Il massimo dell’intero fabbricato nascondeva le torri della cattedrale. Divisi i volumi in base all’impronta della chiesa e ripetute le catture. Per Casa de Colón sono stati esclusi i cortili prima di collocare il punto.

**B · Vegueta–Triana.** Acquisiti 1.047 record comunali nel rettangolo di ricerca finale. Dopo il ritaglio e la separazione dei volumi si disegnano 828 parti di edificio, 388 tratti stradali, 95 superfici e 684 alberi. Sei POI verificati, scena locale, controlli e build testati. [Rapporto e immagini](docs/QA.md).

**C · Studio futuro di ridipintura.** Conservare l’attuale plastico come baseline. Su autorizzazione futura, preparare 4–9 finestre contigue di Santa Ana alla camera fissata con colore, quota, palette unica e sovrapposizione. Mantenere i marker nel viewer. Confrontare in overlay bordi della piazza, impronte, incroci e continuità di ogni bordo al medesimo zoom. Scartare il campione se un riferimento cambia posizione o le giunzioni restano visibili. L’eventuale risultato sarà una vista illustrata aggiuntiva. Per il gioco restano utilizzabili i geodati e la geometria live. Nessuna generazione eseguita.

Santa Ana e Gabinete Literario hanno ora facciate procedurali dedicate e profili dei tetti distinti. Le immagini di consultazione restano nella cache privata. Catture aggiornate nella cartella QA.

Il catalogo di Las Palmas governa luoghi, appartenenza al pilota e personalizzazioni degli edifici. Menu e modelli dei monumenti sono moduli separati. Verificati riordino, settimo luogo di prova e recupero del contesto nel browser. La mappa pubblicata conserva i sei luoghi originali.

Corretto l’affioramento del terreno attraverso le carreggiate. Il viewer compone strade, sentieri e superfici dai geodati direttamente sulla mesh del terreno. Aggiunta la cattura mobile del Teatro Pérez Galdós alla suite QA.

**D · Modalità «Conducir».** Richiesta da Luca dopo la v1 (il brief originale escludeva il gameplay). Guida arcade stile Pako in `drive.js`: accelerazione automatica, sterzo sinistra/destra, freno con entrambi, derapata, deflessione lungo i muri, pattuglie in aumento che seguono il grafo stradale, scia di monete verso i luoghi, record locale. Interfaccia di gioco a sole icone con guida interattiva, zoom dinamico lento, calamita monete e lampeggianti. Suite browser verde su desktop e mobile emulato. Da fare: prova e taratura su telefono fisico, confronto di sensazione con il video di riferimento (Pako 3), eventuale audio.

Mappa, guida e HUD condividono lo stesso comportamento animato su tutti i dispositivi. La suite browser attende il completamento del volo verso Santa Ana prima di verificare il recupero della vista.

**E · Estensione verso Ciudad Jardín.** Il corridoio ricavato da edifici comunali, OSM, MDT05 e PNOA copre 3,041 km² di terraferma (6,24×), con dieci luoghi e 80 settori da 240 m. Il viewer mantiene una panoramica residente, precarica il dettaglio in direzione di guida, scarta i risultati obsoleti e gestisce separatamente le risorse di ciascun settore. Guida e collisioni usano un grafo globale. Controllati viaggio fra quartieri, passaggio di confine nei due sensi, stabilità del budget e perdita di contesto durante il caricamento. Dettagli, limiti e misure in [QA](docs/QA.md); procedura in [EXPAND_CITY](docs/EXPAND_CITY.md).
