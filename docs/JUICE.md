# Game feel della guida

Cosa risponde a cosa nella modalità «Conducir», con quali valori e con quali limiti. Va letto prima di aggiungere o ritoccare un effetto. Sul modello di `doc/JUICE.md` di Butter Run e delle regole di juice di Smash Royale, tenendo solo ciò che serve a una guida arcade vista dall'alto.

I valori sono quelli di `TUNE` in `src/drive/drive.ts` al 23 novembre 2026. Se cambiano nel codice, vale il codice e questo file va aggiornato. Per l'interfaccia vedi [UI_ANTI_SLOP.md](UI_ANTI_SLOP.md), per l'inquadratura [CAMERA_FRAMING.md](CAMERA_FRAMING.md).

## Regole

1. **Gli effetti sono presentazione.** Nessun effetto cambia collisioni, percorsi o punteggio. L'unica eccezione è l'hit-stop, che ferma il tempo di gioco per tutti allo stesso modo.
2. **Un evento, una risposta riconoscibile.** Ogni evento ha la sua combinazione di segnali e non la condivide con un altro. Due segnali che dicono la stessa cosa sono rumore: se ne toglie uno.
3. **La forza segue l'evento.** Strisciare lungo un muro non produce quasi nulla, un urto frontale produce tutto. La cattura è l'evento più forte della partita e niente altro la eguaglia.
4. **Mai due volte di fila.** Gli effetti che interrompono (hit-stop) hanno un intervallo minimo. Quelli continui (polvere, segni) non ne hanno.
5. **Niente caso nella camera.** La camera si sposta solo in una direzione che ha un significato. Il tremolio casuale è stato tolto.
6. **Stesso comportamento su ogni dispositivo.** Gli effetti non si spengono né si attenuano in base alle preferenze di movimento del sistema (regola di `AGENTS.md`). Per questo devono restare piccoli e brevi per tutti.
7. **Si spegne da solo.** Gli effetti di gioco tornano a riposo in meno di mezzo secondo. La sequenza finale mantiene la scena in bianco e nero fino al retry o al ritorno alla mappa.

## Catalogo

| Evento | Simulazione | Camera | Auto e scena | Interfaccia | Vibrazione |
|---|---|---|---|---|---|
| Moneta raccolta | – | – | La moneta è attirata entro 6 m | «+1» che sale dal punto, pillola delle monete che pulsa | 8 ms |
| Accelerazione | 60 km/h in 1,44 s, poi 90 km/h in altri 4 s | Zoom lento con la velocità | Muso che si solleva fino a 6° | – | – |
| Sterzata e derapata | Risposta dal 35% al pieno in 140 ms | Zoom lento con la velocità | Scocca fino a 28° verso l'interno, puff all'innesco, due tracce durante la scivolata | Zona tattile accesa | – |
| Frenata | 27 m/s², grip da freno prioritario | – | Muso che si abbassa fino a 8°, effetti di derapata se slitta | Entrambe le zone accese | – |
| Strisciata laterale contro una facciata | La velocità lungo il muro perde il 12% della velocità in entrata | – | Fino a tre scintille brevi dal contatto del giocatore | – | – |
| Urto leggero (oltre 3 m/s) | – | – | Saltello dell'auto | – | – |
| Urto medio (oltre 6 m/s) | – | Spinta verso il muro, in proporzione | Saltello | – | 18 ms |
| Urto forte (oltre 11 m/s) | Fermo di 110 ms | Spinta verso il muro | Saltello | – | 18 ms |
| Spinta di una pattuglia (oltre 6 m/s) | – | Spinta verso la pattuglia, al 70% | – | – | – |
| Schianto di una pattuglia | – | Spinta verso il rottame entro 40 m, più debole da lontano | Rottame scuro che gira, fumo per 3 s | «+2» con icona dell'urto | – |
| Pedone vicino a un veicolo in arrivo | – | – | Il pedone scatta di lato a 6,2 m/s per 0,9 s, saltellando; se un muro non lascia spazio salta sopra l'auto | – | – |
| Arrivo a destinazione | Fermo di 100 ms | – | Corona di polvere, nuovo fascio di luce | «+10» grande; la goccia della nuova meta vola dall'auto al suo posto in 0,45 s | 40 ms |
| Cattura | Fermo di 220 ms, poi fine partita | Spinta piena verso la pattuglia; dopo il fermo, avvicinamento lento del 14% | Polvere al rilascio | Pannello dopo altri 420 ms, record che pulsa se battuto | 140 ms |

## Sterzata e derapata

- L'accelerazione in rettilineo è 11,574 m/s² fino a 60 km/h, poi scende gradualmente tra 60 e 63 km/h. Sopra i 63 la spinta è 1,957 m/s² per il giocatore e 2,240 m/s² per le pattuglie. I limiti di velocità in avanti sono 90 e 94 km/h. La prima ondata ha già la stessa punta delle successive.
- Le pattuglie hanno un coefficiente di perdita longitudinale da slittamento di 0,0525, contro 0,035 del giocatore. Frenano anche prima dei muri, con un controllo da 4 m fino alla distanza di arresto più il raggio dell'auto, circa 13,8 m a 94 km/h.
- Per la cattura vale la soglia di 4,5 m/s. Per le monete il raggio di richiamo è 6 m e la trazione è 25 m/s.
- La pendenza lungo la marcia frena la ripresa in salita e la aiuta in discesa. È neutra fino al 2%, poi applica 0,06 m/s² per ogni punto percentuale aggiuntivo fino a 0,6 m/s². La stessa correzione aiuta il freno in salita e lo riduce in discesa. I limiti in avanti restano 90 e 94 km/h.
- A ogni cambio di lato la rampa ricomincia dal 35%. Al rilascio il peso della derapata cala di 10 al secondo e il coefficiente di aderenza laterale tende a 9,5 s⁻¹. La frenata usa il proprio coefficiente di 2,2 s⁻¹.
- La posa si aggiorna a 120 Hz. La risposta allo sterzo cresce tra 2 e 10 m/s. A pieno sterzo la rotazione aggiuntiva va da 10,5° a 21° e il rollio da 14° a 28°, secondo lo slittamento. Quando amplifica lo slittamento, la rotazione aggiuntiva porta il muso fino a 45° dalla direzione di marcia.
- Le ruote seguono l'orientamento e l'altezza dell'auto. La sola scocca si inclina. La variazione di velocità prima degli urti determina l'inclinazione longitudinale, che torna neutra in crociera. Lo smorzamento copre il 90% del percorso in 85 ms all'ingresso, 170 ms al rilascio e 40 ms durante l'inversione della posa.
- Tre particelle bianco caldo compaiono dietro le ruote per 220 ms quando lo slittamento laterale supera 2,5 m/s durante una manovra senza contatti. Il puff si riarma sotto 1,5 m/s. Le due tracce partono da 4 m/s. Sagoma, freccia, tracce e puff seguono l'orientamento visivo. Camera e collisioni usano la simulazione.
- L'ombra di contatto delle auto è un rettangolo di 4,15 × 2,5 m con opacità 0,38. Ruota con l'auto e resta a terra durante rollio e saltelli.

Il campionamento della pendenza usa la griglia del terreno a 6 m dietro e a 6 m davanti. Segue la velocità di marcia e usa il muso sotto 2 m/s. Il filtro ha costante di tempo di 180 ms. Entro 11 m dai tracciati OSM marcati come ponte o a un altro livello, la correzione torna a zero perché la quota del suolo può differire da quella della carreggiata. Le pattuglie usano la stessa correzione per calcolare da quanto lontano iniziare la frenata.

## Strisciata contro una facciata

- Quando la componente verso il muro vale al massimo metà della componente lungo il muro, il contatto annulla la prima e riduce la seconda del 12% di quanto è stato annullato. Il muso si riallinea verso la tangente e il veicolo può continuare lungo la facciata.
- Da 5 m/s lungo il muro, il contatto del giocatore può produrre tre scintille di 160 ms, con almeno 75 ms fra emissioni separate. La strisciata esclude saltello, vibrazione, colpo di camera e hit-stop. Per gli urti più diretti, il bordo della mappa, gli alberi e le altre auto si usa la risposta d'urto abituale.

## Hit-stop

Per alcuni fotogrammi la simulazione non avanza: auto, pattuglie, monete e cronometro restano fermi. Polvere, saltello, camera e interfaccia continuano, così lo schermo non sembra bloccato.

Il saltello del giocatore arriva fino a 0,9 m e rientra in circa 0,41 s alla massima altezza. Un secondo urto più debole lascia finire il saltello in corso. L'ombra resta a terra.

- **Eventi:** urto forte contro un muro o un albero, arrivo a destinazione, cattura. Lo schianto di una pattuglia non lo usa (scelta di Luca, 22 novembre 2026).
- **Durate:** `stopWall` 0,11 s, `stopArrive` 0,1 s, `stopCaught` 0,22 s. A 60 fotogrammi al secondo sono circa 7, 6 e 13 fotogrammi. Raddoppiate su richiesta di Luca il 23 novembre 2026: alla metà non si notavano sul telefono.
- **Soglia dell'urto:** `stopImpact` 11 m/s di velocità nella direzione dell'ostacolo. Le strisciate nelle vie strette restano sotto.
- **Intervallo minimo:** `stopGap` 0,6 s tra due fermi da urto. Arrivo e cattura non hanno intervallo perché non possono ripetersi.
- **Fermi sovrapposti:** vale il più lungo, non si sommano.
- **Alla cattura** il contatto blocca punteggio e cronometro. Dopo 110 ms, camera, polvere, pedoni e vento rallentano al 30%. Auto e pattuglia si assestano per un secondo con l'inerzia residua, limitata da ostacoli e superficie disponibile.
- La saturazione scende a zero in 850 ms con un filtro CSS sulla scena e sul suo sfondo. «ATRAPADO» e i tre valori compaiono dopo 300 ms di rallentatore. I pulsanti a icona compaiono dopo 600 ms. Il tempo dell'esito avanza mentre la scheda è visibile e il contesto WebGL è disponibile. L'inerzia e la camera usano un delta limitato per evitare salti.
- Il tempo fermo non conta nel cronometro. Dopo il fermo la simulazione riparte da dove era, senza recuperare i passi saltati.

## Colpo di camera

La camera scatta **verso ciò che ha colpito** e torna a riposo con una molla smorzata. Un muro urtato la tira verso il muro, una pattuglia che spinge la tira verso la pattuglia. Dice da che parte è arrivato il colpo, cosa che il tremolio di prima non faceva.

- **Forza:** proporzionale alla velocità d'urto, piena a 14 m/s. `kick` 36 è la velocità di lancio di un colpo pieno.
- **Molla:** `kickStiff` 220, `kickDamp` 22. Supera di poco lo zero al ritorno, una volta sola.
- **Misure:** un colpo pieno sposta la vista di 0,99 m al massimo e rientra sotto i 3 cm in 0,28 s; un colpo a metà forza arriva a 0,49 m. Su telefono (6,3 px per metro) sono circa 6 e 3 pixel. A 20 fotogrammi al secondo il picco è 0,93 m.
- **Limite:** `kickMax` 1,2 m, anche con più colpi nello stesso istante.
- La direzione dell'urto contro i muri viene dalla fisica (`hitX`, `hitY` in `src/drive/drive-physics.ts`), non dalla velocità dell'auto.
- La molla sposta solo il bersaglio della camera. Non tocca lo zoom né l'anticipo lungo la marcia.

## Pedoni

Figure semplici senza gambe, un corpo colorato e una testa, che si muovono a saltelli: si allungano salendo e si schiacciano atterrando. Sono atmosfera: nessun punto, nessuna penalità, nessun segnale nell'interfaccia (scelta di Luca, 22 novembre 2026). Compaiono solo in guida.

- **Dove:** ai bordi delle strade carrabili, sulle vie pedonali di OSM e lungo corde interne a piazze e parchi. Non attraversano. Sono 40 su desktop e 26 su telefono, riciclati tra 42 e 82 m dall'auto, di preferenza davanti alla direzione di marcia.
- **Fuga:** un veicolo in avvicinamento li allarma entro 6 m più 0,6 m per ogni m/s di velocità (circa 16 m a velocità massima). Scappano di lato rispetto alla traiettoria, dal giocatore come dalle pattuglie.
- **Mai investiti:** a ogni fotogramma un pedone a meno di 2,3 m dal centro di un veicolo viene spostato fuori; se un muro lo impedisce resta in aria finché il veicolo è passato. Lo verifica `node scripts/qa-pedestrians.mjs`.
- Durante un hit-stop restano fermi come il resto della simulazione. Camminano prima della partenza e continuano al rallentatore dopo la cattura.
- I valori sono in `PEDESTRIANS` in `src/drive/pedestrians.ts`.

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

- `npm.cmd test` controlla che la cattura produca almeno un fermo e che la spinta della camera torni a zero. I due valori sono l'undicesimo e il dodicesimo campo di `data-drive` su `#scene`: numero di fermi dall'ingresso in guida e spostamento attuale della camera in metri.
- Dopo aver cambiato la molla, ricalcolare picco e tempo di rientro e aggiornare le misure di questo file.
- Provare a mano una via stretta: strisciando lungo i muri non deve mai scattare un fermo.
