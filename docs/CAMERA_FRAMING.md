# Contratto di inquadratura

Cosa deve garantire la camera in ogni stato del viewer. È solo presentazione: l'inquadratura non cambia mai geometria, collisioni, percorsi o esiti di gioco. Sul modello di `CAMERA_FRAMING.md` di Smash Royale, adattato a una camera ortografica isometrica.

I valori citati sono quelli del codice al 24 novembre 2026. Se cambiano nel codice, vale il codice e questo file va aggiornato.

## Regole comuni

1. **Una sola camera, un solo proprietario.** La camera ortografica nasce da `makeMapCamera()` in `src/render/map-camera.ts`, la stessa di editor e laboratori, con bordi in pixel (`fitPixels`), distanza dal bersaglio `CAMERA_DISTANCE` (1500 m) e angolo `mapViewDirection()`. Solo `src/main.ts` la sposta, con la funzione `view(target, zoom, offset)`: la guida chiede un'inquadratura chiamando `view`.
2. **Orientamento.** La mappa ruota a scatti attorno alla verticale mantenendo l'inclinazione isometrica. La vista Isométrica in guida riprende l'orientamento all'ingresso. Le altre viste di guida orientano la stessa camera ortografica lungo la traiettoria.
3. **Lo zoom è in pixel per metro.** I bordi della camera sono in pixel CSS, quindi `camera.zoom` dice quanti pixel occupa un metro. Tutte le soglie si ragionano così.
4. **Il bersaglio resta dentro il perimetro.** `draw()` riporta il bersaglio nel riquadro del confine a ogni frame e la camera a 1500 m da esso: lo zoom verso il cursore la fa scivolare nel proprio piano, e in proiezione ortografica la distanza non cambia l'immagine.
5. **Niente salti.** Ogni cambio di inquadratura è un volo o una rincorsa smorzata. Gli smorzamenti sono esponenziali in secondi (`approach` in `src/geometry.ts`), quindi uguali a 30, 60 o 120 fotogrammi al secondo. I pulsanti `+`, `−` e panoramica animano per 300 ms. Un taglio netto è ammesso solo al ripristino dopo la perdita del contesto, dove si torna all'ultima vista salvata.

## Mappa

- **Apertura:** dettaglio sul luogo indicato da `data.focus`, non la panoramica.
- **Panoramica** (mirino o tasto Inizio): mantiene l'orientamento e inquadra tutto il perimetro con un margine (`fitAt`).
- **Trascinamento:** il terreno resta sotto il puntatore (`MapControls`). Al rilascio la mappa scivola ancora e rallenta (`coastRate` 6 al secondo); un nuovo tocco, un pulsante o Play la fermano.
- **Rotellina e pizzico:** lo zoom va verso il punto indicato, non verso il centro.
- **Pulsanti zoom:** `+`, `−` e panoramica interpolano bersaglio e zoom in 300 ms; nuovi input sostituiscono il volo in corso partendo dalla vista corrente.
- **Pulsanti di rotazione:** ±90° attorno al bersaglio, a zoom e inclinazione costanti. Uno scatto dura 300 ms. I clic ravvicinati si sommano e ripartono dalla posa visibile.
- **Limiti di zoom interattivo:** minimo di 0,8 × il minore dei livelli di panoramica, massimo di 12 × il maggiore con un minimo di 4 px/m e spazio per lo zoom di apertura.
- **Luogo selezionato:** volo di 320 ms con zoom tale che il lato corto copra circa 245 m. Il luogo diventa il bersaglio e un offset della vista (`setViewOffset`) lo porta al centro della parte che la scheda lascia libera: a destra del pannello sugli schermi larghi, sopra il foglio sul telefono in verticale (`frame()` in `src/map/place-card.ts`). Con la sola pillola il marker va al centro. Con la scheda aperta zoom e rotazione girano attorno al luogo, che resta nella parte libera.
- **Chiusura o piegatura della scheda:** il bersaglio torna al centro dello schermo e l'offset sparisce senza che l'immagine si muova. La vista salvata e `data-view` riportano sempre il punto al centro dello schermo.
- **Rotazione dello schermo e ridimensionamento:** bersaglio, zoom, orientamento e offset in pixel restano invariati.
- **Marker:** proiettati a ogni frame, nascosti quando escono dallo schermo.

## Guida

1. **L'auto è il soggetto.** La camera insegue l'auto in modo stretto (`followRate` 9): l'auto resta quasi ferma sullo schermo, è il mondo a scorrere.
2. **Si vede dove si sta andando.** Il bersaglio avanza lungo la direzione di marcia da 0 m da fermo a 5 m a 10 km/h, poi cresce fino a 12 m a 90 km/h e resta entro quel limite. L'anticipo è smorzato a parte (`leadRate` 2,4). Il colpo di camera segue la propria molla (punto 6).
3. **Campo visivo di base:** il lato corto dello schermo copre 62 m su telefono e 95 m su desktop (`viewSpanCompact`, `viewSpanWide`). A 390 px di larghezza sono circa 6,3 px/m, con l'auto intorno ai 25 px.
4. **Zoom dinamico lento e piccolo.** Si allarga fino al 10% a 90 km/h e fino all'8% con una pattuglia entro 45 m, e si stringe del 14% alla cattura. I due ingressi sono filtrati (`paceRate` 0,7) e lo zoom li insegue con `zoomRate` 1,1. `followRate`, `leadRate`, `paceRate` e `zoomRate` sono tassi esponenziali al secondo.
5. **Ingresso e uscita in planata.** Entrando in guida la camera raggiunge l'auto in circa un secondo e mezzo. All'uscita, la stessa camera torna in 1,5 s al punto, allo zoom e all'orientamento della mappa prima di Play. Dalle viste mobili torna all'angolo isometrico lungo l'arco più breve.
6. **Spinta direzionale, mai tremolio.** Per urti oltre 6 m/s, spinte di pattuglie, rottami entro 40 m e cattura, il bersaglio scatta verso ciò che ha colpito e torna con una molla smorzata (`kick` 36, `kickStiff` 220, `kickDamp` 22). Un colpo pieno sposta la vista di circa 1 m e rientra in 0,28 s; il limite è `kickMax` 1,2 m. Non c'è alcuno spostamento casuale. Mai mentre si è fermi in attesa del primo tocco. Dettagli in [JUICE.md](JUICE.md).
7. **Nessun limite di zoom della mappa.** In guida `controls.maxZoom` è infinito; all'uscita tornano i limiti della mappa e l'inquadratura di prima.

Il pulsante camera e il tasto C alternano Isométrica, Aérea (65°) e Seguimiento (48°, scala 1,22×). Il gioco ricorda la scelta sul dispositivo. La transizione dura mezzo secondo. Le viste mobili ruotano lungo il percorso angolare più breve, fino a 100°/s. Nei vicoli verificano la visuale verso la cabina, salgono fino a 85° e attendono mezzo secondo di visuale libera prima di tornare alla quota normale.

## Cosa deve restare visibile in guida

- La parte nascosta dell’auto si legge come sagoma sulla facciata o sul tetto. La freccia segue il muso quando il centro della cabina è coperto.
- Le prossime monete della scia lungo la direzione di marcia.
- Una pattuglia che si avvicina, prima che arrivi a contatto: è la ragione dell'allargamento del punto 4.
- La destinazione: sulla scena con il fascio di luce, o sul bordo dello schermo con la goccia turchese della distanza quando è fuori campo.
- L'attribuzione in basso.

L'interfaccia sta fuori da queste zone: statistiche in alto a sinistra, uscita in alto a destra, zone tattili negli angoli in basso. La ficha della destinazione non entra nella fascia delle statistiche né in quella delle zone tattili.

## Da non fare

- In derapata, usare la direzione di marcia smorzata per orientare le viste mobili. Sotto 2 m/s conservare la direzione.
- Rimettere uno spostamento casuale della camera.
- Legare lo zoom a eventi istantanei (urto, moneta, comparsa di una pattuglia). Passa sempre dai due ingressi filtrati.
- Risolvere un problema di leggibilità di una singola zona cambiando i valori globali di campo visivo. Si interviene sulla scena o sulla sagoma dell’auto.
- Aggiungere una seconda camera o spostare la camera da un modulo diverso da `src/main.ts`.

## Verifica

- `node scripts/qa-map-camera.mjs` (incluso in `npm.cmd test`) controlla zoom verso il cursore, scivolata dopo il trascinamento, luogo accanto alla scheda dopo rotazione e zoom, chiusura senza salto, e la geometria dell'offset.
- `npm.cmd test` controlla anche il ciclo di quattro scatti, la panoramica ai quattro angoli e il ripristino della posa dopo ridimensionamento, uscita dalla guida e perdita del contesto.
- Dopo una modifica alla camera di guida, campionare lo zoom ogni mezzo secondo per una decina di secondi (nono campo di `data-drive` su `#scene`) e confrontarlo con i valori del punto 4.
- Guardare almeno uno screenshot a 390×844 e uno a 1440×900 con l'auto in una via stretta.
- Su telefono fisico la sensazione di movimento non è stata ancora provata.
