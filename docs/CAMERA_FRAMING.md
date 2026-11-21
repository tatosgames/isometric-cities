# Contratto di inquadratura

Cosa deve garantire la camera in ogni stato del viewer. È solo presentazione: l'inquadratura non cambia mai geometria, collisioni, percorsi o esiti di gioco. Sul modello di `CAMERA_FRAMING.md` di Smash Royale, adattato a una camera ortografica isometrica.

I valori citati sono quelli del codice al 21 novembre 2026. Se cambiano nel codice, vale il codice e questo file va aggiornato.

## Regole comuni

1. **Una sola camera, un solo proprietario.** La camera ortografica e la funzione `view(target, zoom)` vivono in `main.js`. Nessun altro modulo sposta la camera: la guida chiede un'inquadratura chiamando `view`.
2. **Direzione fissa.** La camera guarda sempre lungo la stessa direzione isometrica (`direction` in `main.js`). Non ruota, né sulla mappa né in guida: è ciò che rende leggibile il plastico e riconoscibili i luoghi.
3. **Lo zoom è in pixel per metro.** I bordi della camera sono in pixel CSS, quindi `camera.zoom` dice quanti pixel occupa un metro. Tutte le soglie si ragionano così.
4. **Il bersaglio resta dentro il perimetro.** `draw()` riporta il bersaglio nel riquadro del confine a ogni frame.
5. **Niente salti.** Ogni cambio di inquadratura è un volo o una rincorsa smorzata. I pulsanti `+`, `−` e panoramica animano per 300 ms. Un taglio netto è ammesso solo al ripristino dopo la perdita del contesto, dove si torna all'ultima vista salvata.

## Mappa

- **Apertura:** dettaglio sul luogo indicato da `data.focus`, non la panoramica.
- **Panoramica** (mirino o tasto Inizio): tutto il perimetro entra nello schermo con un margine (`fit` in `sizeCamera`).
- **Pulsanti zoom:** `+`, `−` e panoramica interpolano bersaglio e zoom in 300 ms; nuovi input sostituiscono il volo in corso partendo dalla vista corrente.
- **Limiti di zoom:** da 0,8 × la panoramica fino a 12 × la panoramica, con un minimo di 4 px/m.
- **Luogo selezionato:** volo di 320 ms verso il punto del marker, con zoom tale che il lato corto copra circa 245 m.
- **Rotazione dello schermo e ridimensionamento:** bersaglio e zoom restano invariati.
- **Marker:** proiettati a ogni frame, nascosti quando escono dallo schermo.

## Guida

1. **L'auto è il soggetto.** La camera insegue l'auto in modo stretto (`followRate` 9): l'auto resta quasi ferma sullo schermo, è il mondo a scorrere.
2. **Si vede dove si sta andando.** Il bersaglio è spostato in avanti lungo la velocità (`lookAhead` 0,42 s). Lo spostamento è smorzato a parte (`leadRate` 2,4), così un urto contro un muro non lo fa oscillare: l'unico movimento dovuto all'urto è la spinta del punto 6.
3. **Campo visivo di base:** il lato corto dello schermo copre 62 m su telefono e 95 m su desktop (`viewSpanCompact`, `viewSpanWide`). A 390 px di larghezza sono circa 6,3 px/m, con l'auto intorno ai 25 px.
4. **Zoom dinamico lento e piccolo.** Si allarga fino al 10% con la velocità e fino all'8% con una pattuglia entro 45 m, e si stringe del 14% alla cattura. I due ingressi sono filtrati (`paceRate` 0,7) e lo zoom li insegue con `zoomRate` 1,1: un singolo urto non lo muove. Misurato in guida: tra 0,91 e 0,97 del valore base, al più 1,2% di variazione ogni mezzo secondo.
5. **Ingresso in planata.** Entrando in guida la camera parte dall'inquadratura della mappa e raggiunge quella di gioco in circa un secondo e mezzo.
6. **Spinta direzionale, mai tremolio.** Per urti oltre 6 m/s, spinte di pattuglie, rottami entro 40 m e cattura, il bersaglio scatta verso ciò che ha colpito e torna con una molla smorzata (`kick` 36, `kickStiff` 220, `kickDamp` 22). Un colpo pieno sposta la vista di circa 1 m e rientra in 0,28 s; il limite è `kickMax` 1,2 m. Non c'è alcuno spostamento casuale. Mai mentre si è fermi in attesa del primo tocco. Dettagli in [JUICE.md](JUICE.md).
7. **Nessun limite di zoom della mappa.** In guida `controls.maxZoom` è infinito; all'uscita tornano i limiti della mappa e l'inquadratura di prima.

## Cosa deve restare visibile in guida

- L'auto, sempre: dietro gli edifici resta l'anello con la freccia, disegnato sopra i volumi.
- Le prossime monete della scia lungo la direzione di marcia.
- Una pattuglia che si avvicina, prima che arrivi a contatto: è la ragione dell'allargamento del punto 4.
- La destinazione: sulla scena con il fascio di luce, o sul bordo dello schermo con la ficha numerata quando è fuori campo.
- L'attribuzione in basso.

L'interfaccia sta fuori da queste zone: statistiche in alto a sinistra, uscita in alto a destra, zone tattili negli angoli in basso. La ficha della destinazione non entra nella fascia delle statistiche né in quella delle zone tattili.

## Da non fare

- Ruotare la camera con l'auto. La direzione fissa è una scelta di prodotto.
- Rimettere uno spostamento casuale della camera.
- Legare lo zoom a eventi istantanei (urto, moneta, comparsa di una pattuglia). Passa sempre dai due ingressi filtrati.
- Risolvere un problema di leggibilità di una singola zona cambiando i valori globali di campo visivo. Si interviene sulla scena o sull'anello dell'auto.
- Aggiungere una seconda camera o spostare la camera da un modulo diverso da `main.js`.

## Verifica

- `npm.cmd test` controlla che l'inquadratura cambi entrando in guida e torni identica all'uscita, e che rotazione e ripristino del contesto conservino la vista della mappa.
- Dopo una modifica alla camera di guida, campionare lo zoom ogni mezzo secondo per una decina di secondi (nono campo di `data-drive` su `#scene`) e confrontarlo con i valori del punto 4.
- Guardare almeno uno screenshot a 390×844 e uno a 1440×900 con l'auto in una via stretta.
- Su telefono fisico la sensazione di movimento non è stata ancora provata.
