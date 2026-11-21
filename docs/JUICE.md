# Game feel della guida

Cosa risponde a cosa nella modalità «Conducir», con quali valori e con quali limiti. Va letto prima di aggiungere o ritoccare un effetto. Sul modello di `doc/JUICE.md` di Butter Run e delle regole di juice di Smash Royale, tenendo solo ciò che serve a una guida arcade vista dall'alto.

I valori sono quelli di `TUNE` in `src/drive/drive.ts` al 22 novembre 2026. Se cambiano nel codice, vale il codice e questo file va aggiornato. Per l'interfaccia vedi [UI_ANTI_SLOP.md](UI_ANTI_SLOP.md), per l'inquadratura [CAMERA_FRAMING.md](CAMERA_FRAMING.md).

## Regole

1. **Gli effetti sono presentazione.** Nessun effetto cambia collisioni, percorsi o punteggio. L'unica eccezione è l'hit-stop, che ferma il tempo di gioco per tutti allo stesso modo.
2. **Un evento, una risposta riconoscibile.** Ogni evento ha la sua combinazione di segnali e non la condivide con un altro. Due segnali che dicono la stessa cosa sono rumore: se ne toglie uno.
3. **La forza segue l'evento.** Strisciare lungo un muro non produce quasi nulla, un urto frontale produce tutto. La cattura è l'evento più forte della partita e niente altro la eguaglia.
4. **Mai due volte di fila.** Gli effetti che interrompono (hit-stop) hanno un intervallo minimo. Quelli continui (polvere, segni) non ne hanno.
5. **Niente caso nella camera.** La camera si sposta solo in una direzione che ha un significato. Il tremolio casuale è stato tolto.
6. **Stesso comportamento su ogni dispositivo.** Gli effetti non si spengono né si attenuano in base alle preferenze di movimento del sistema (regola di `AGENTS.md`). Per questo devono restare piccoli e brevi per tutti.
7. **Si spegne da solo.** Ogni effetto torna a riposo in meno di mezzo secondo senza che nessuno lo fermi, tranne il pannello di cattura.

## Catalogo

| Evento | Simulazione | Camera | Auto e scena | Interfaccia | Vibrazione |
|---|---|---|---|---|---|
| Moneta raccolta | – | – | La moneta è attirata entro 6 m | «+1» che sale dal punto, pillola delle monete che pulsa | 8 ms |
| Sterzata e derapata | – | Zoom lento con la velocità | Coda che sbanda, rollio, segni a terra, polvere | Zona tattile accesa | – |
| Frenata | – | – | Muso che si abbassa, segni, polvere | Entrambe le zone accese | – |
| Urto leggero (oltre 3 m/s) | – | – | Saltello dell'auto | – | – |
| Urto medio (oltre 6 m/s) | – | Spinta verso il muro, in proporzione | Saltello | – | 18 ms |
| Urto forte (oltre 9 m/s) | Fermo di 55 ms | Spinta verso il muro | Saltello | – | 18 ms |
| Spinta di una pattuglia (oltre 6 m/s) | – | Spinta verso la pattuglia, al 70% | – | – | – |
| Schianto di una pattuglia | – | Spinta verso il rottame entro 40 m, più debole da lontano | Rottame scuro che gira, fumo per 3 s | «+2» con icona dell'urto | – |
| Arrivo a destinazione | Fermo di 50 ms | – | Corona di polvere, nuovo fascio di luce | «+10» grande, nuova ficha | 40 ms |
| Cattura | Fermo di 110 ms, poi fine partita | Spinta piena verso la pattuglia; dopo il fermo, avvicinamento lento del 14% | Polvere al rilascio | Pannello dopo altri 420 ms, record che pulsa se battuto | 140 ms |

## Hit-stop

Per alcuni fotogrammi la simulazione non avanza: auto, pattuglie, monete e cronometro restano fermi. Polvere, saltello, camera e interfaccia continuano, così lo schermo non sembra bloccato.

- **Eventi:** urto forte contro un muro o un albero, arrivo a destinazione, cattura. Lo schianto di una pattuglia non lo usa (scelta di Luca, 22 novembre 2026).
- **Durate:** `stopWall` 0,055 s, `stopArrive` 0,05 s, `stopCaught` 0,11 s. A 60 fotogrammi al secondo sono circa 3, 3 e 7 fotogrammi.
- **Soglia dell'urto:** `stopImpact` 9 m/s di velocità contro l'ostacolo, cioè un urto quasi frontale oltre il 60% della velocità massima. Le strisciate nelle vie strette restano sotto.
- **Intervallo minimo:** `stopGap` 0,6 s tra due fermi da urto. Arrivo e cattura non hanno intervallo perché non possono ripetersi.
- **Fermi sovrapposti:** vale il più lungo, non si sommano.
- **Alla cattura** il fermo viene prima di tutto il resto: contatto, 110 ms di attesa, poi polvere e avvicinamento della camera, poi il pannello.
- Il tempo fermo non conta nel cronometro. Dopo il fermo la simulazione riparte da dove era, senza recuperare i passi saltati.

## Colpo di camera

La camera scatta **verso ciò che ha colpito** e torna a riposo con una molla smorzata. Un muro urtato la tira verso il muro, una pattuglia che spinge la tira verso la pattuglia. Dice da che parte è arrivato il colpo, cosa che il tremolio di prima non faceva.

- **Forza:** proporzionale alla velocità d'urto, piena a 14 m/s. `kick` 36 è la velocità di lancio di un colpo pieno.
- **Molla:** `kickStiff` 220, `kickDamp` 22. Supera di poco lo zero al ritorno, una volta sola.
- **Misure:** un colpo pieno sposta la vista di 0,99 m al massimo e rientra sotto i 3 cm in 0,28 s; un colpo a metà forza arriva a 0,49 m. Su telefono (6,3 px per metro) sono circa 6 e 3 pixel. A 20 fotogrammi al secondo il picco è 0,93 m.
- **Limite:** `kickMax` 1,2 m, anche con più colpi nello stesso istante.
- La direzione dell'urto contro i muri viene dalla fisica (`hitX`, `hitY` in `src/drive/drive-physics.ts`), non dalla velocità dell'auto.
- La molla sposta solo il bersaglio della camera. Non tocca lo zoom né l'anticipo lungo la marcia.

## Da non fare

- Rimettere il tremolio casuale, anche piccolo, o sommarlo alla spinta.
- Usare l'hit-stop per le monete o per ogni contatto: diventa uno scatto continuo e sembra un calo di prestazioni.
- Allungare un fermo oltre 0,12 s. Oltre quella soglia si legge come blocco del gioco.
- Rallentatori, lampi a tutto schermo, bordi colorati, aberrazioni o sfocature. I primi due cambierebbero il carattere del plastico, gli altri chiedono un passaggio di post-elaborazione che il progetto non ha.
- Legare lo zoom a un evento istantaneo: lo vieta il contratto di camera.
- Aggiungere un effetto senza una riga nel catalogo qui sopra.

## Non deciso

- **Audio.** La guida è muta per scelta (Luca, 21 e 22 novembre 2026). Se si riapre, la proposta è effetti sintetizzati con Web Audio, senza file, avviati solo dopo il primo tocco e con un comando a icona per silenziare.
- **Hit-stop allo schianto di una pattuglia.** Escluso per ora. Con molte pattuglie potrebbe scattare spesso; se lo si prova, va limitato agli schianti vicini e con lo stesso intervallo minimo degli urti.
- **Sensazione su telefono fisico.** Durate e ampiezze sono tarate su Chrome da scrivania e sul profilo mobile emulato. Vibrazione e fermi vanno provati in mano.

## Verifica

- `npm.cmd test` controlla che la cattura produca almeno un fermo e che la spinta della camera torni a zero. I due valori sono il penultimo e l'ultimo campo di `data-drive` su `#scene`: numero di fermi dall'ingresso in guida e spostamento attuale della camera in metri.
- Dopo aver cambiato la molla, ricalcolare picco e tempo di rientro e aggiornare le misure di questo file.
- Provare a mano una via stretta: strisciando lungo i muri non deve mai scattare un fermo.
