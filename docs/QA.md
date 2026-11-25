# Verifica locale · 21 novembre 2026

## Deduplicazione del rendering · 25 novembre 2026

Rimosse 31 righe nette in quattro moduli di rendering. Le sagome di zona e gli isolati lontani condividono la costruzione delle geometrie. I landmark condividono la geometria dei tetti a falde, i due canvas del terreno condividono la preparazione del contesto e lo streamer espone soltanto lo stato di apertura che il viewer usa.

Gli hash di vertici, normali, colori e gruppi di materiali coincidono per landmark e sagome LOD. Nel pilota e in un settore con carreggiate, pixel della texture, coordinate della texture e campioni d'ombra coincidono sia con Canvas sia con OffscreenCanvas. Nelle catture a camera identica vicino all'Edificio Miller e a scala di quartiere, la media per pixel della differenza massima fra i tre canali RGB è rispettivamente 0,122 e 0,126 su 255.

Verificati TypeScript, build con controllo dei dati, `qa-ground`, `qa-main-lod`, `qa-recovery` e `qa-sectors`. Il circuito ha completato sei giri e attraversato il confine nei due sensi con pattuglia attiva. La suite completa desktop e mobile emulato è passata su una build isolata dopo un primo giro con errori di richiesta su zone e settori serviti da `dist`.

## Avvio del viewer e modifiche del pilota · 25 novembre 2026

Il viewer carica i dati iniziali in `load-startup-data.ts`. La decisione di apertura usa l'esito dello streaming dopo il disegno del frame. `motion.ts` calcola la velocità al rilascio e l'interpolazione del volo, con la posa applicata dal viewer.

L'editor separa cronologia, bozza, mesh del pilota e gestione del puntatore. `qa-editor.mjs` verifica anche che la perdita del focus o della cattura durante un trascinamento scarti l'anteprima e che un commit equivalente o invalido consenta ancora il redo.

Verificati TypeScript, build con controllo dei dati, suite completa desktop e mobile emulato, `qa-editor` in sviluppo e sulla build, `qa-boot`, `qa-map-camera`, `qa-main-lod`, `qa-drive-lab` e `qa-recovery`. Controllate le catture di apertura desktop e di Triana con la scheda aperta su mobile.

## Seconda riduzione dei valori del lab · 25 novembre 2026

Il pannello scende da 91 a **79** cursori. Prima di scegliere, ogni valore di guida è stato spostato a metà e a una volta e mezza su otto percorsi (anche contro un muro), e ogni valore della posa della scocca su 18 serie.

- Nessun effetto possibile: i sette valori di premio delle pattuglie (non ne prendono mai), quindi la cartella pattuglie mostra sei valori. Nascosta anche la vista isometrica, che è quella della mappa.
- Ricavati da un altro valore con il rapporto esatto di prima, quindi senza effetto ai valori di default: `bonusMin` da `bonusMax`; `boostFade` fissato a 1 (con `bonusRecover` descrive la stessa aderenza extra); `poseMinSpeed` da `poseFullSpeed`, `poseLift` da `poseDive`, `poseAttack` e `poseReverse` da `poseRelease`; `sparkLife` da `puffLife`; `stopArrive` e `stopCaught` da `hitStop` (ex `stopWall`).
- Verifica: angoli della scocca identici entro 2·10⁻¹⁵ gradi su 7.200 passi, 18 traiettorie e inseguimenti identici, nessun valore rimasto fuori dalle cartelle.

Scartata con misura: portare le pattuglie sulla posa del giocatore. In curva il rollio cambierebbe fino a 18° e l'imbardata fino a 9°, e la carrozzeria intera, ruote comprese, si inclinerebbe fino a 28°: non è un effetto piccolo.

Suite completa superata due volte su due in copia isolata; `qa-drive-lab.mjs` superata.

## Valori accorpati e auto che segue la pendenza · 25 novembre 2026

**Accorpamenti.** Il pannello del lab scende da 133 a 91 cursori. Ogni fusione è stata confrontata con le traiettorie di prima: 18 serie (giocatore a 90 e 30 km/h e pattuglia, in slalom, tocchi ripetuti, sterzo tenuto, controsterzi rapidi, frenata in derapata e partenza in curva) e gli inseguimenti simulati.

- Senza effetto, traiettorie identiche al millimetro: `gearLoss` dentro `coast` (erano entrambi 0,8); `kickDamp`, `puffSlip`, `puffRearm` e `zoomRate` ricavati da `kickStiff`, `skidSpeed` e `paceRate` con rapporti che danno esattamente i valori di prima (22; 2,5 e 1,5 m/s; 1,1).
- Soglia unica `hardImpact` di 11 m/s per il fermo del giocatore e la distruzione delle pattuglie (prima 11,5): sugli inseguimenti nessuna differenza.
- Un solo `recover` mentre si sterza al posto della rampa da `recover` a `driftRecover` (con `holdRate` e `holdRelease`): 54°/s per il giocatore, 135°/s per le pattuglie. Le 18 traiettorie restano entro **0,45 m**, il muso entro 0,1° e la velocità entro 0,1 km/h. Su 158 inseguimenti: prima 99 arrivi, 18 distrutte, 4 bloccate, 52 km/h; dopo 99, 16, 3, 56 km/h.
- Solo nascosti nel pannello: cartelle monete e pendenza, `rollbackGrip`, `steerDead` del giocatore (sterza solo −1/0/1), il campo visivo dell'altro tipo di schermo. Le pattuglie mostrano solo i valori propri e `steerDead`; un valore che condividono con il giocatore si cambia nella cartella del giocatore e muove entrambi (verificato in Chrome sul server di sviluppo: `accel` del giocatore porta con sé quello delle pattuglie, `recover` no; «Reset» e il ripristino dall'URL rimettono entrambi).

Scartate perché regressioni: togliere `turnRelease` cambia di **9,5°** la sterzata con tocchi ripetuti dallo stesso lato; fondere `poseReverse` in `poseAttack` raddoppia il tempo del controsterzo visibile (17 → 33 ms), contro i 40 ms d'inversione documentati in `JUICE.md`. Non fatta: portare le pattuglie sulla posa del giocatore, che cambierebbe il loro aspetto in curva e va giudicata a occhio.

**Pendenza.** Prima l'auto seguiva solo l'altezza del terreno e restava sempre in piano; nella fisica la pendenza vale al massimo 0,6 m/s² e il cambio tiene comunque la velocità alla marcia, quindi in crociera salita e discesa non si sentono. Nelle strade della città un tratto su tre supera il 5% e uno su cinque il 10% (90° percentile 8,7°). Ora l'auto intera, ruote e ombra comprese, prende la pendenza della strada lungo il muso, misurata sotto i due assi e smorzata (il terreno è una griglia di 5 m), fino a 22°; vale anche per le pattuglie. La scocca del giocatore si piega in più del 50% (`slopeLean`), muso su in salita e giù in discesa, senza staccare le ruote. `groundPitch` è provato in `qa-drive-pose.mjs`: 10% in salita, inversione girando l'auto, zero di traverso, limite sui dislivelli del terreno. Confronto a schermo su Calle Crucita Arbelo Cruz (13%) con l'auto ferma: in piano, con la strada e con la piega in più. Il lab accetta `start=x,y` per partire su una strada scelta.

Suite completa superata due volte su due in una copia isolata del checkout; prove del lab superate.

## Revisione della guida e lab in inglese · 25 novembre 2026

Revisione del codice della guida unica e del lab, poi correzioni.

Difetti del lab corretti: i cursori dei valori per cui il gioco divide (raggi, campi visivi, durate) si fermano un passo sopra lo zero, e `bonusTime` a zero non produce più NaN nel modello; l'URL si scrive a fine modifica e non a ogni passo del trascinamento (prima 400 scritture in 0,47 s, ora **una**); i tasti premuti in un campo del pannello non guidano più l'auto; da fermi la telemetria mostra la marcia base invece di zero.

Riduzioni: tolta l'opzione `start` di `makeDrive` (resta `startAt()`); tolto `cameraModes.fixed.pitch`, mai letto; lo slittamento si calcola una volta per passo; `spawnChaser` e `restart` ripartono da `restBody()`; tolti dalle prove i parametri serviti solo al confronto col modello precedente. Dopo queste modifiche le misure del giocatore sono identiche (4,58 s, 3,2°, 60°, 0,79°); gli inseguimenti simulati passano da 23/40 a **25/40** a 47 km/h: la simulazione è sensibile a differenze di arrotondamento, quindi vale come ordine di grandezza.

Tutto il lab è in inglese: `lab.html`, il catalogo, i pannelli delle prove di strade, larghezze, settori e LOD e il pannello di guida. Restano invariati gli identificativi negli URL (`?test=larghezze`, `?lab=guida`, `modo=visivo`…) e i toponimi. Prove rieseguite sulla build: `qa-drive-lab.mjs`, `qa-road-lab.mjs`, `qa-lod-lab.mjs`, `qa-road-width-lab.mjs` superate. `qa-lod-lab.mjs` e `qa-road-width-lab.mjs` sono fallite alla prima esecuzione (un'asserzione e un timeout) e passate nelle due successive senza modifiche.

Suite completa (`node scripts/qa.mjs`): **superata due volte su due** in una copia isolata del checkout con queste modifiche. Nel checkout principale era fallita tre volte (due timeout sulla cattura, un errore HTTP al caricamento) mentre un altro agente vi lavorava: ha ricostruito `dist` durante la corsa e la suite serve quella cartella. La stessa suite sul codice già committato, in copia isolata, passa. È probabile che anche i due fallimenti iniziali delle prove del lab vengano da lì; non è dimostrato.

Misura a parte, 12 partenze con l'auto frenata subito: le pattuglie la catturano 12 volte su 12, in 8–59 s. In un'altra serie di 12 con 1,5 s di guida prima della frenata, una partenza su 12 non è stata catturata entro 100 s (le pattuglie restavano oltre 67 m); con il modello precedente (`bed2273`) nella stessa prova ne sono mancate 2 su 12.

## Guida unica e laboratorio di taratura · 25 novembre 2026

La guida della drift-racer è l'unica: `?handling` è stato tolto insieme al modello precedente. `steerCar` in `drive-physics.ts` serve giocatore e pattuglie con due profili della stessa forma, `TUNE.player` e `TUNE.patrol`; lo stato di sterzo (volante, marcia, tempo di derapata, aderenza extra) sta in ogni auto. La sezione qui sotto descrive il modello; dove cita `?handling=drift`, `steerDrift`, `TUNE.drift` e `qa-drive-drift.mjs` vale questa.

`qa-drive-handling.mjs` (parte di `npm.cmd test`) ripete le misure del giocatore con gli stessi risultati di prima del riordino: 90 km/h a **4,58 s**, tocco di 100 ms **3,2°**, limite di derapata 60°, 60 contro 120 Hz **0,79°**. In più: due auto non si influenzano; una pattuglia in curva scivola fino al suo limite di 20°; una correzione leggera (sterzo 0,2) gira senza far scalare marcia né rallentare; un'auto ferma che sterza dopo un urto riparte (oltre 4 m/s in 1,5 s).

Difetto trovato e corretto, presente nel profilo pubblicato il 25 novembre: dopo un urto, con una piccola velocità laterale residua e lo sterzo tenuto, il ramo «rotola all'indietro» azzerava la velocità a ogni passo e l'auto restava ferma finché si sterzava. Ora quel ramo vale solo se l'auto arretra più di quanto la spinta di un passo recuperi. Inoltre lo slittamento lasciato da un urto non viene più tagliato di colpo al limite di derapata: si riassorbe alla velocità di recupero, così un'auto può scorrere lungo un muro.

`qa-drive-chase.mjs` simula 40 inseguimenti nelle strade vere del pilota (`pilot.json`, muri e alberi compresi): la pattuglia parte a 150–300 m di strada da un giocatore fermo.

| Modello | Raggiunto | Distrutte | Bloccate | Oltre 60 s | Media su strada | Urti forti per corsa |
|---|---|---|---|---|---|---|
| Precedente (commit `bed2273`) | 22/40 | 4 | 1 | 12 | 41 km/h | 8,2 |
| Unico, prima delle due correzioni | 9/40 | 5 | 21 | 3 | 62 km/h | 1,4 |
| Unico, profilo `TUNE.patrol` attuale | **23/40** | 5 | 2 | 9 | **51 km/h** | 4,8 |

La prova fallisce sotto 20 arrivi o sopra 4 blocchi. È una simulazione con il giocatore fermo: non dice come le pattuglie si comportano contro un giocatore che derapa, né come appaiono a schermo.

Laboratorio `index.html?lab=guida&area=pilot` (`qa-drive-lab.mjs`, Chrome, sulla build): dal catalogo di `lab.html` si apre il gioco nel pilota di Vegueta con il pannello e le sue cartelle; abbassando `baseSpeed` a 30 km/h l'auto già in corsa resta sotto 45 km/h; l'URL diventa `t=player.baseSpeed:30`; spegnendo «Polizia» le pattuglie spariscono e l'URL prende `nopolice`; «Copia valori» mostra `player: baseSpeed:kmh(30)`; dopo il ricaricamento il pannello riparte da quei valori; fuori dal lab `t=` è ignorato e il pannello non c'è. Nessun errore in console. Non provato su telefono: il pannello è pensato per il desktop.

## Guida alla drift-racer · 24 novembre 2026

`?handling=drift` sostituisce la guida del giocatore con quella di drift-racer (Construct 3), riscritta in `steerDrift` di `drive-physics.ts` con i parametri in `TUNE.drift`. I valori vengono da `carconf.json` del gioco, a 24,4 px per metro (610 px/s = 90 km/h); le costanti che nell'originale valgono per tick (crescita dello sterzo e della derapata) sono convertite in valori al secondo.

Il freno a mano dell'originale non c'è. La derapata nasce dal solo sterzo tenuto: la direzione di marcia insegue il muso a 70°/s, che scendono a 50°/s in 0,45 s di sterzo, mentre il muso gira fino a 190°/s; la deriva è limitata a 60°. Con lo sterzo libero la marcia torna sul muso a 200°/s. Premere i due lati insieme resta la frenata normale.

`qa-drive-drift.mjs` (ora parte di `npm.cmd test`) misura a 120 Hz: velocità base di 90 km/h a **4,58 s**, punta di 116 km/h dopo un lungo rettilineo, ritorno alla marcia base dopo una frenata; un tocco di 100 ms gira il muso di **3,2°**; un secondo di sterzo a 90 km/h porta la deriva al limite di 60° perdendo meno di 1 m/s; 350 ms dopo il rilascio l'auto è dritta, il muso non si è mosso e la velocità è tornata a 90 km/h; un tocco breve non dà premio; fra 60 e 120 passi al secondo la sterzata cambia di 0,79°; dopo un rimbalzo all'indietro l'auto riparte in avanti; le pattuglie danno lo stesso risultato con i due profili.

In Chrome, con `?handling=drift&nopolice`, la guida parte, raccoglie monete, sterza e tiene la direzione al rilascio, senza errori in console. Il feel non è stato giudicato: il pannello era nascosto e la prova è strumentata. Non portati dall'originale: penalità fuori pista, turbo, rimbalzo fisso a velocità negativa (restano gli urti di qui).

## Fisica di guida · 24 novembre 2026

**Interpolazione.** Prima di ogni passo da 1/120 s si salvano posizione e direzione di ogni auto. Il disegno le pone fra l'ultimo passo e il precedente, in proporzione al tempo rimasto nell'accumulatore; finito il disegno si rimettono le pose simulate. Le auto che saltano più di 4 m (ricomparsa, ripartenza) si disegnano dove sono. `data-drive` riporta le pose simulate, non quelle disegnate. Durante il fermo, la cattura e la pausa non si interpola.

**Frenata all'indietro.** Con 3 m/s di rinculo, un passo di frenata porta la velocità a −2,775 m/s; prima la azzerava in un solo passo.

**Sterzo ad alta velocità.** `turnFade` 0,3 entra con uno smoothstep fra 60 km/h e la velocità massima: a 13 m/s lo sterzo è identico (correzione nei primi 100 ms 2,58°, come prima); a 90 km/h vale il 70%. Con sterzo pieno da 90 km/h, un quarto di giro passa da 0,64 a 0,78 s con un raggio più largo; la velocità d'uscita resta circa la stessa (58,9 contro 57,9 km/h): a perdere velocità in curva è soprattutto l'aderenza laterale, non la rapidità dello sterzo.

**Pattuglie in frenata.** Con 4 m/s di slittamento laterale, un passo di frenata lo riduce a 3,93 m/s per il giocatore (aderenza 2,2) e a 3,76 m/s per la pattuglia (aderenza 7,5).

Le regressioni in `qa-drive-pose.mjs` coprono tutti e quattro i punti. Accelerazione, punta e frenata da 90 restano invariate (1,442 s, 5,442 s, 0,933 s / 11,5 m). Typecheck, build e prove mirate (`qa-drive-pose`, `qa-drive-camera`, `qa-drive-route`, `qa-drive-location`, `qa-pedestrians`) e suite `npm.cmd test` superati. In Chrome la guida parte, raccoglie monete e genera una pattuglia senza errori in console; con il pannello nascosto non si è potuto giudicare la fluidità frame per frame.

## Pendenza e ripresa

A 120 Hz la ripresa da 60 a 90 km/h richiede **3,39 s** su una discesa costante all'8%, **4,00 s** sul piano e **4,88 s** su una salita all'8%. La regressione controlla frenata, limite della correzione su pendenze forti, inversione di marcia, transizione fra salita e discesa, neutralità vicino a ponti e strade a livelli diversi, e anticipo della frenata delle pattuglie in discesa.

In Chrome con touch emulato, partendo da 20 m/s per 150 ms sullo stesso tratto di Calle Párroco Villar Reina, l'auto ha raggiunto 20,36 m/s in discesa e 20,23 m/s in salita. Sul tratto piano di Avenida Marítima ha raggiunto 20,29 m/s in entrambi i sensi.

Typecheck, build e suite `npm.cmd test` superati.

## Rollio e saltello più leggibili

La regressione a 120 Hz misura oltre 27° di rollio in curva sostenuta e controlla che la scocca resti sopra il piano delle ruote anche al massimo rollio con beccheggio. In Chrome con touch emulato, un urto frontale a 15 m/s ha prodotto un saltello di 0,9 m. L'ombra è rimasta a terra e l'auto è tornata alla quota di marcia. Typecheck, build e suite `npm.cmd test` superati.

## Strisciata nei vicoli

Con un contatto di 4 m/s verso una facciata e 18 m/s lungo la facciata, la simulazione annulla la velocità verso il muro e conserva 17,52 m/s lungo il muro. Nel corridoio di prova largo 2,6 m, un secondo di sterzo continuo verso la facciata mantiene l'auto dentro il corridoio e sopra 12 m/s in entrambi i sensi. La regressione controlla anche il rimbalzo negli urti frontali, sul bordo della mappa e contro un albero.

In Chrome desktop e touch emulato, una prova strumentata su una facciata della mappa ha verificato tre scintille che si spengono entro 160 ms di animazione, la conservazione della velocità lungo il muro e l'assenza di rimbalzo nei contatti radenti. L'urto frontale sulla stessa facciata produce ancora rimbalzo, saltello e hit-stop.

Typecheck, build e suite `npm.cmd test` superati.

## Velocità e frenata · 23 novembre 2026

La regressione a 120 Hz misura 60 km/h a **1,442 s** e la punta a **5,442 s**, pari a 90 km/h per il giocatore e 94 km/h per le pattuglie. Il giocatore percorre **96,5 m** da fermo prima di arrivare a 90 e si ferma da quella velocità in **0,933 s** e **11,5 m**. A parità di slittamento la pattuglia perde il 50% in più per effetto del coefficiente di derapata. Il controllo ostacoli trova ostacoli a 4, 8 e 13,8 m. La prova camera verifica 0 m da fermo, 5 m a 10 km/h e 12 m da 90 km/h.

In Chrome desktop e touch emulato, la prova strumentata ha raggiunto 90 km/h su un viale del grafo, verificato una curva stretta e fermato l'auto prima di un incrocio partendo da 90. Un urto frontale a circa 10,6 m/s ha prodotto il rimbalzo e quello a circa 11,6 m/s ha attivato anche il fermo.

Typecheck, build e `npm.cmd test` superati. La suite ha evidenziato un aggiornamento del filtro di cattura già accodato quando la pagina viene nascosta. Il rendering ora applica il filtro soltanto a pagina visibile. La verifica del feel su telefono fisico resta aperta.

## Sterzo arcade · 22 novembre 2026

La regressione a 120 Hz misura **1,442 s** fino a 16,5 m/s e **0,658 s** per fermarsi da 13 m/s in rettilineo. Un tocco di 100 ms a 13 m/s cambia la direzione della traiettoria di **2,58°**, contro i **0,96°** della taratura precedente. Dopo 400 ms di sterzo, al rilascio lo slittamento scende sotto 1,5 m/s in **175 ms**. La prova controlla anche rollio, controsterzo entro 50 ms, inclinazione longitudinale, ritorno in posizione neutra, altezza della scocca sulle ruote e limite della posa dopo un urto.

Typecheck, build e regressioni di percorso e camera superati. Una prova strumentata in Chrome desktop (1440×900) e touch emulato (390×844) ha esercitato partenza, curva e controsterzo, frenata e urto frontale. A circa 15 m/s la scocca raggiunge 16,4° di rollio mentre le ruote restano in piano. Il puff bianco compare una volta durante la scivolata e le tracce partono. L'urto produce un saltello lasciando l'ombra a terra e senza emettere un altro puff. Su telefono fisico la sensazione di guida resta da verificare.

`npm.cmd test` superato in Chrome desktop e touch emulato. La suite tiene premuto il freno per verificare la cattura dopo la sterzata e dopo il ripristino WebGL. La corsa libera può proseguire dopo aver sfiorato un muro e aveva fatto scadere l'attesa al secondo tentativo su mobile.

La regressione usa la stessa funzione di sterzo chiamata dal gioco. Un confronto di 2.400 passi per veicolo ha dato lo stesso stato fisico prima e dopo la semplificazione, per il giocatore e per una pattuglia, con frenate, inversioni e reset della rampa. La prova della scocca ruota i vertici del modello per verificare la distanza dal piano delle ruote.

## Verifica di base

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
- **Risoluzione adattiva continua** (`src/render/adaptive-resolution.ts`, dal criterio di superstudiorecover). Attiva durante trascinamento, voli e guida, su tutti i dispositivi; tre livelli (1, 0,85, 0,7 del pixel ratio di base). Scende dopo due finestre di 30 frame con mediana oltre 33 ms, risale dopo sei finestre con 75º percentile sotto 20 ms, e raddoppia l’attesa se il livello appena risalito non regge. A vista ferma torna subito al pieno. Simulazione: 40 ms per frame porta a 0,85 dopo 60 frame e a 0,7 dopo 120; a 16 ms risale a 0,85 dopo 190 frame e a 1 dopo 370.
- **Warm-up degli shader.** All’ingresso in guida si compilano tutti i materiali della modalità, compresi quelli che compaiono dopo (rottami, lampeggianti, colori della polvere). Programmi contati in 45 s di guida con una cattura: 15 all’ingresso e 15 al massimo su mobile emulato; 16 e 17 su desktop.

Limiti: sul desktop resta un programma compilato a partita in corso, non identificato (probabile materiale di un settore caricato in streaming). In Chrome con rendering software la guida scende a 0,7 per il caricamento dei settori: non è una misura di un telefono. La prima esecuzione della suite dopo la modifica ha segnalato quattro richieste di settori fallite durante la perdita del contesto in guida; non si è ripetuto nelle sei esecuzioni successive e la causa non è accertata. Nessuna prova su telefono fisico.

## Coperture a tinta unita

Verificate le tinte PNOA per tutte le 4.698 parti di edificio della città e le 1.108 del pilota. A Parque Doramas, con Chrome mobile emulato e la stessa camera, la cattura della build coincide con la variante piatta del confronto visivo. La build carica zero WebP nel pilota e nei settori, sia con il worker sia con costruzione sincrona. Typecheck e build superati.

Superate le suite Playwright della città su desktop e mobile emulato, del pilota neutro e stilizzato e dei settori. Nel circuito mobile i byte stimati del dettaglio sono rimasti entro 48 MiB, con contatori WebGL identici negli ultimi due giri a ogni arresto. Verificati il recupero dopo perdita del contesto e l’attraversamento in guida nei due sensi.

## Tre viste di guida

Verificati typecheck, build, suite browser della città e circuito dei settori. Il controllo ripetibile `node scripts/qa-drive-camera.mjs` prova il limite di rotazione, un’inversione, la stabilità da fermi e il rientro dopo un ostacolo, con passi a 30 e 120 Hz. Chrome ha verificato il cambio durante lo sterzo da tastiera e con due dita, il recupero WebGL, il ritorno alla vista precedente e il recupero della preferenza dopo ricaricamento.

Nel benchmark di pan in Chrome mobile emulato, un’esecuzione per build, il p95 è passato da 18,3 a 18,4 ms e i triangoli medi da 198.485 a 223.617. A Parque Doramas il dettaglio residente è passato da 14 settori e 50.037.827 byte a 13 settori e 48.340.157 byte entro il budget di 48 MiB. Il benchmark misura la mappa in pan. La fluidità su telefono fisico resta da misurare.

Registrate sei clip dello stesso avvio e sequenza di sterzo su Chrome a 390×844 e 1440×900, una per vista: partenza, svolta di circa 90° e inversione. I video locali sono in `.cache/camera-clips/`, con nomi come `390-high.webm` e `1440-chase.webm`.

## Migrazione TypeScript

- Il comando `npm.cmd run typecheck` controlla tutto `src/` con `strict: true`. La build Vite include il worker separato. Restano disponibili gli stessi asset e formati di salvataggio.
- I controlli all’ingresso accettano entrambe le scene, il catalogo POI, la palette dei tetti, l’indice e tutti gli 80 settori distribuiti. Provati anche una selezione numerica salvata dalla prima versione e il rifiuto di una vista con coordinate incomplete.
- Chrome carica e mostra settori dalla build sotto `/isometric-cities/`, sia usando il worker sia con `OffscreenCanvas` disattivato e costruzione sul thread principale. Il controllo Node della camera di guida passa prima e dopo la migrazione.
- Nel benchmark mobile emulato, il p95 durante il pan è passato da 18,2 a 18,1 ms. Entrambe le build hanno registrato 90,75 draw call e 223.617 triangoli per frame, con zero disegni a riposo. Si tratta di un’esecuzione per build in Chrome con rendering software.

La suite browser completa, il pilota neutro e stilizzato e il circuito dei settori passano sia sulla build JavaScript di riferimento sia sulla build TypeScript. Il circuito mantiene lo stesso massimo osservato di 49.868.015 byte di dettaglio residente, entro il budget mobile di 48 MiB. La guida attraversa lo stesso confine di settore in entrambi i sensi con una pattuglia attiva.

Tre aperture in Chrome mobile emulato con un nuovo processo per prova, eseguite alternando le build, danno una mediana di 1.675 ms per JavaScript e 1.672 ms per TypeScript. Il confronto misura il tempo fino alla prima vista navigabile, su questa macchina.

## Avvio della guida, indice e recupero dello streaming

- `npm.cmd run build` verifica prima le scene, il catalogo, la palette e gli 80 settori distribuiti. Un indice con un’associazione edificio–settore mancante è respinto anche all’apertura nel browser, prima di creare il renderer.
- `node scripts/qa-recovery.mjs` verifica che la mappa resti navigabile senza strade o senza luoghi. Verifica anche il passaggio alla costruzione locale quando il worker non risponde per 10 s, sia con il settore ancora richiesto sia dopo l’annullamento.
- `node scripts/qa-drive-route.mjs` verifica la scelta del percorso, la spaziatura delle monete, la calamita, gli eventi di punteggio, il bonus assegnato una volta sola e il cambio di destinazione. `node scripts/qa-drive-camera.mjs` passa anche dopo il refactoring.
- Superati anche la suite browser desktop e mobile emulato, il pilota e il circuito dei settori. Nel circuito il picco osservato del dettaglio residente è stato di 49.868.015 byte su un budget compatto di 48 MiB. La guida ha attraversato il confine di settore in entrambi i sensi con una pattuglia attiva.

## Vento e ombre di nuvole · 22 novembre 2026

- `npm.cmd run typecheck`, `npm.cmd run build` e `npm.cmd test` passano su desktop e mobile emulato. La suite ora controlla che, a mappa ferma e settori caricati, due immagini del canvas a 800 ms di distanza siano diverse e che `data-view` resti identico.
- Cadenza a riposo misurata contando le chiamate `clear` di WebGL in Chrome con rendering software: 28,3 disegni al secondo su desktop e 27,5 su mobile emulato, con `requestAnimationFrame` a 55–57 al secondo. Sostituisce il dato «zero disegni a riposo» della sezione sulla migrazione TypeScript.
- I disegni a riposo aggiornano solo l'orologio del vento e ridisegnano la scena: camera, settori, marker e risoluzione adattiva restano quelli dell'ultimo fotogramma completo.
- Controllo a vista sugli screenshot rigenerati: chiome e palme restano attaccate ai tronchi, l'ombra di nuvola si legge come fascia più scura nella panoramica e a zoom medio.
- Non verificato: consumo e temperatura su telefono fisico, e la leggibilità dell'oscillazione alla scala di guida su schermo reale. Le ombre degli alberi nella shadow map restano ferme mentre le chiome si muovono di circa mezzo metro.
- Gli screenshot in `docs/screenshots` non sono più identici tra due esecuzioni, perché le ombre di nuvola dipendono dall'istante dello scatto.

## Mare e ombra di contatto · 22 novembre 2026

- `python scripts/data.py city` rigenera dalla cache locale: `city.json`, `poi.geojson` e `city-aoi.geojson` restano identici byte per byte e si aggiunge `sea.json` (8 KB). 5.309 m dei 10.679 m del perimetro coincidono con la costa cartografata.
- `npm.cmd run typecheck`, `npm.cmd run build` (che ora valida anche `sea.json`), `npm.cmd test` e `node scripts/qa-sectors.mjs` passano. Il picco del dettaglio residente nel circuito resta 49.868.015 byte.
- Il mare è una sola mesh con una texture di distanza dalla costa dipinta una volta su canvas. La vista panoramica inquadra terra e mare; lo spostamento resta limitato alla terra. Il mare non compare nel pilota né nella modalità neutra.
- Ombra di contatto: le impronte degli edifici sono riempite su una maschera a circa 4 m per pixel e moltiplicate sulla texture del suolo. La prima versione, con contorni larghi tracciati su canvas, portava l'apertura da circa 2,1 a 6,4 s in Chrome con rendering software ed è stata scartata. Con la maschera la costruzione della texture dell'intera città passa da 72 a 390 ms nella stessa prova.
- Apertura misurata dalla suite dopo le modifiche: 2.828 ms su desktop e 1.781 ms su mobile emulato (prima del mare e dell'ombra: 2.091 e 1.451 ms nella stessa sessione). È una sola esecuzione per configurazione.
- Limiti noti: nei settori dettagliati l'ombra considera solo gli edifici del settore stesso, quindi può mancare lungo i bordi; i moli del porto esterni al perimetro appaiono come vuoti contornati di schiuma; il livello del mare è fissato a −0,9 m perché il modello del terreno arriva a 0 m sulle banchine.
- Non verificato: aspetto e costo su telefono fisico; il movimento delle onde è stato controllato solo su immagini fisse e con il test che confronta due fotogrammi.

## Pedoni · 22 novembre 2026

- `node scripts/qa-pedestrians.mjs` (incluso in `npm.cmd test`) guida un'auto a 16,5 m/s lungo una via pedonale per 600 fotogrammi: su terreno aperto i pedoni scappano e nessuno a terra arriva a meno di 2,3 m dal centro dell'auto (minimo osservato 5,14 m); in un corridoio largo 2 m saltano sopra l'auto; nessuno finisce dentro un ostacolo; un'auto ferma muove solo chi la tocca.
- La suite browser controlla che all'ingresso in guida ci siano pedoni e che nessuno sia a meno di 2,2 m dall'auto. I due valori sono il tredicesimo e il quattordicesimo campo di `data-drive`: pedoni presenti e distanza minima dal giocatore.
- In una corsa di 4 s su desktop emulato: 40 pedoni presenti, distanza minima campionata 7,5 m.
- Costo: due draw call (corpo colorato e testa) e nessun nuovo dato.
- Non verificato: prova a mano in vie strette, leggibilità su telefono fisico (le figure sono alte circa 3 m in scala, come le auto maggiorate), comportamento con molte pattuglie insieme.

Il catalogo `lab.html` carica ogni prova tramite un ingresso dedicato in `src/lab/main.ts`. Per aggiungere un test, registrare ID, titolo, descrizione e import dinamico del modulo. La suite `node scripts/qa-road-lab.mjs` verifica il collegamento alla prova strade, i tre materiali, la tendina A/B sullo stesso fotogramma e il replay in Chrome desktop e mobile emulato. Per i risultati delle prove visive ritirate, vedi lo [storico](STORICO_PROVE_VISIVE.md).

## Rotazione della mappa

`npm.cmd test` esercita i quattro scatti da 90° e controlla che centro e zoom restino invariati. Prova anche clic ravvicinati nei due sensi, attivazione da tastiera, panoramica con tutti i marker visibili, cambio di orientamento dello schermo, uscita da Play e ripristino WebGL con e senza ricarica della pagina. Le catture `rotation-desktop.png`, `rotation-mobile.png` e `rotation-landscape.png` vengono salvate nella directory scelta con `QA_SCREENSHOT_DIR`.

`node scripts/qa-drive-camera.mjs` controlla che la vista Isométrica in guida parta dall'orientamento scelto sulla mappa.

Typecheck, build e suite Chrome completati. Controllate le catture a 1440×900, 390×844 e 844×390. La prova tattile è stata eseguita in emulazione Chrome.

## Carreggiate geometriche sui confini dei settori

Prima prova su Calle San Nicolás, settori `-2_-2` e `-1_-2`. Il generatore produce 962 triangoli e il dettaglio residente cresce di 30.909 byte. Su cinque passaggi per configurazione il p95 mediano resta a 18,2 ms sul profilo mobile e passa da 18,2 a 18,3 ms su desktop. La cattura alla stessa posizione mostra il bordo dell'asfalto in curva accanto all'auto. [Confronto texture e geometria](screenshots/carreggiate-san-nicolas.png)

L'estensione a 80 settori produce 37.487 triangoli. Il controllo dei dati verifica 124 confini attraversati dall'asfalto, con tolleranza di 1 cm in pianta e quota, e l'esclusione dei corridoi attorno a 10 way OSM con ponte o livello esplicito. I JSON di dettaglio dell'intera città crescono da 4.291.052 a 5.661.927 byte prima della compressione HTTP. Ogni settore scarica soltanto il proprio file.

Il test del gioco attraversa il confine nei due sensi in Conducir con pattuglia attiva. Il laboratorio riproduce inoltre l'arrivo ritardato del settore est. I tempi misurati con Chrome su computer e viewport mobile coprono lo streaming e il disegno del percorso. La stabilità percepita durante una sterzata e il comportamento termico richiedono ancora una prova su telefono fisico.

Ripetizione con l'indice completo e cinque passaggi per configurazione. La memoria indica i dati residenti conteggiati dallo streamer al punto di confronto.

| Profilo Chrome | p95 texture | p95 geometria | Memoria texture | Memoria geometria |
|---|---:|---:|---:|---:|
| Mobile emulato, 390 × 844 | 18,3 ms | 18,3 ms | 46,81 MiB | 46,97 MiB |
| Desktop, 1024 × 720 | 18,2 ms | 18,3 ms | 59,81 MiB | 59,98 MiB |

Entrambi i profili rispettano la soglia di +10% sul p95 a caldo. Durante il singolo avvio a freddo, il massimo intervallo osservato con una richiesta pendente è stato 1.614 ms / 960 ms su mobile e 1.516 ms / 1.295 ms su desktop (texture / geometria). Questi valori includono il caricamento iniziale e dipendono dalla macchina di test. Verificati anche costruzione sul thread principale con OffscreenCanvas disabilitato, recupero del contesto WebGL e tre giri del circuito cittadino con espulsione dei settori dal budget mobile di 48 MiB.

## Carreggiate da 5 e 9 metri

La verifica sui file distribuiti conta 45.088 triangoli in 80 settori, 124 confini stradali coerenti entro 1 cm e 10 eccezioni per ponti e livelli. Il controllo della fascia aggiunta usa 1 mm di tolleranza per gli arrotondamenti. Le tre sezioni centrali del laboratorio misurano 5 m in Calle Rafael Mesa y López, 9 m in Avenida Marítima e 4,75 m in Calle Párroco Villar Reina. In quest'ultima i bordi distano rispettivamente 2,50 e 2,25 m dall'asse. [Confronto alla stessa posizione](screenshots/larghezza-carreggiata.png)

| Profilo | p95 precedente | p95 nuovo | Dettaglio residente precedente / nuovo |
|---|---:|---:|---:|
| Mobile emulato | 18,3 ms | 18,2 ms | 46,97 / 46,99 MiB |
| Desktop | 18,2 ms | 18,3 ms | 59,98 / 60,01 MiB |

Mediane di cinque passaggi a caldo sul percorso di Calle San Nicolás, confronto con la geometria di `85b05aa`. Il budget del dettaglio mobile è 48 MiB. Il contorno usato per la panoramica aggiunge 469 kB all'indice JSON (circa 173 kB con gzip locale). L'emulazione Chrome verifica i due profili sulla stessa macchina.

Il test di Conducir attraversa il confine in entrambi i sensi con pattuglia attiva. Il primo giro di QA sui settori ha segnalato una crescita dei contatori WebGL a Santa Ana. La ripetizione dell'intero circuito ha superato la stessa soglia, con 48.584.527 byte residenti a Santa Ana in entrambi gli ultimi due giri. Il test del laboratorio copre il selettore delle tre sezioni, il cambio di larghezza e la posizione dell'auto conservata.

## Transizioni LOD nel gioco principale

Mappa cittadina e Conducir condividono il fade di 250 ms del laboratorio. La mappa entra nel dettaglio a 520 m e lo mantiene fino a 580 m. La diagnostica dello streamer espone `near` e `fading` (settori in transizione). Il renderer richiede altri frame fino al completamento e conserva il ridisegno ambientale della mappa ferma.

La prova `node scripts/qa-main-lod.mjs` ritarda un settore, forza la perdita del contesto al primo fade a camera ferma e verifica il ripristino. Con camera ortografica a zoom unitario verifica le due direzioni attorno a 550 m, il completamento dei fade, il budget e la modalità neutra. Il benchmark sul percorso Santa Ana–San Telmo in Chrome mobile emulato misura un p95 di 18,3 ms sulla build di riferimento `5d75c91` e 18,4 ms sulla nuova build (+0,55%). I risultati riguardano il computer di prova.

## Transizioni LOD nel laboratorio

Aprire `lab.html?test=lod`. Le tre varianti confrontano il comportamento attuale, l'isteresi (ingresso a 520 m e uscita oltre 580 m) con una preferenza temporanea in guida per i settori visibili recenti, e la stessa politica con transizione visiva. La durata iniziale è 250 ms. La carreggiata campiona la texture panoramica nelle coordinate del mondo durante il passaggio al materiale locale. Le sagome di edifici e alberi usano maschere complementari su una matrice di 4 × 4 pixel. Le espulsioni necessarie a rispettare il budget avvengono subito.

`node scripts/qa-lod-lab.mjs` dopo la build ripete tre scenari su due settori di Calle San Nicolás. Il primo ritarda artificialmente di 1,8 s il settore est con la camera ferma. Il secondo oscilla attorno a 550 m dopo essere entrato in dettaglio. Il terzo percorre la curva nei due sensi con la camera di prova. Il browser controlla errori, budget e variazioni dell'immagine abilitando separatamente i due effetti con la transizione ferma al 50%. [Retino a metà transizione e dettaglio completo](screenshots/lod-laboratorio.png)

| Profilo Chrome | Cambi durante lo zoom, attuale / stabile / visivo | p95 durante il percorso, attuale / stabile / visivo |
|---|---|---|
| Mobile emulato (390 × 844) | 14 / 0 / 0 | 18,2 / 18,2 / 18,3 ms |
| Desktop (1024 × 720) | 14 / 0 / 0 | 18,2 / 18,3 / 18,3 ms |

Un cambio conta la richiesta di mostrare o nascondere il dettaglio di un singolo settore. I tempi misurano gli intervalli di requestAnimationFrame sul computer di prova. Sul profilo mobile le catture finali della variante attuale e della transizione completata coincidono. Il retino è distinguibile sulle finestre e lungo i bordi delle chiome nella cattura al 50%. Il telefono fisico serve per giudicarne la visibilità in movimento.

Con `node scripts/qa-lod-lab.mjs --citta` lo stesso percorso usa l'indice completo sul profilo mobile emulato. Il p95 è stato 18,3 ms per la variante attuale, 18,2 ms con le soglie stabili e 18,2 ms con gli effetti visivi. Tutte e tre hanno registrato 11 cambi durante il percorso e 2 espulsioni cumulative. La priorità sperimentale non ha ridotto i cambi in questa prova. La memoria del dettaglio al termine è stata 49.412.515 byte su 48 MiB disponibili (47,12 MiB residenti). La posa finale ha richiesto 28 draw call, salite a 34 forzando la transizione al 50% dei dettagli presenti. Questa sovrapposizione simultanea è una prova di carico. I primi intervalli di caricamento sono sensibili al riscaldamento del browser e non dimostrano un vantaggio tra le varianti.

## Altezze comunali contro LiDAR (22 novembre 2026)

Tile PNOA-LiDAR 459-3109 (2023, 6,7 punti/m²): 577 edifici, 554 misurati, 8 senza punti sufficienti. Differenza LiDAR p95 meno comunale: mediana +0,8 m, errore medio assoluto 1,82 m, 74 % entro 2 m, 93 % entro 5 m. Edifici ≥ 20 m (73): differenza media −0,26 m. Luoghi di controllo, comunale / LiDAR p95: Teatro 30,6 / 30,7, Mercado 13,5 / 12,4, Gabinete 25,3 / 24,7, Casa de Colón 13,4 / 12,9. Cattedrale (41,5 m comunali): 38,4 m al p95 e 47,5 m al p99 sul corpo principale, le altre quattro parti da 10 a 20 m. Edificio 41667, senza dato comunale: 9 m di stima contro 16,2 m misurati. Restano scarti di 10 m e più su singoli edifici (ad esempio 40750 e 41183) non verificati. Controllati solo il tile citato: Arenales e Ciudad Jardín mancano. La mesh pubblicata non è stata rigenerata.

## Tinte dei tetti: ortofoto 20 cm 2024 contro PNOA (22 novembre 2026)

Finestra di `roof-tones.json` letta da remoto dall'ortofoto SITCAN (CC BY 3.0), ridotta a 1 m e trattata con lo stesso algoritmo di `roof-colours.py`. Su 4.820 edifici: ΔE mediano 2,9, 75° percentile 4,3, 95° percentile 7,0; 82,7 % sotto 5 e 99,5 % sotto 10; luminosità mediana −0,4. Navata 41119: `#e5e3e0` contro `#e6e4e1`. I casi peggiori (ΔE 12-14, ad esempio 38573 e 40126) non sono stati ispezionati. Il confronto è a 1 m: il vantaggio dei 20 cm non è misurato. Nessun dato pubblicato è stato modificato. Riproduzione: `python -I scripts/roof-compare-20cm.py`.

## Base di misura prima dell'espansione costiera (22 novembre 2026)

Branch `espansione-costa`, perimetro invariato (3,04 km², 80 settori, 4.698 parti di edificio). `data.py city`, `roof-colours.py` e `sectors.py` rigenerati: rispetto ai dati precedenti cambia un solo edificio (41667, da 9 m di stima a 16,2 m dal LiDAR) e un solo file di settore (`0_-2`). Strade, superfici, alberi, terreno e confine sono identici.

- `typecheck` e `build`: verdi. `npm.cmd test`: verde in 3 min 2 s (apertura 2.617 ms desktop, 2.076 ms mobile emulato).
- `node scripts/benchmark.mjs`: apertura 3.162 ms, picco heap campionato 80,9 MB, p95 18,4 ms, 115 draw call e 263.657 triangoli per frame, 701 buffer e 18 texture alla base, 736 e 18 alla fine, 17.290 draw a riposo.
- `node scripts/qa-sectors.mjs`: 4 esecuzioni verdi su 5. Una è fallita con «WebGL resources grew on the repeated circuit» (buffer 1004 → 1052, texture 24 → 25 a Santa Ana, byte stimati invariati). Sui dati committati in `main` un'esecuzione è passata. Il fallimento è intermittente e non è stato diagnosticato: va chiarito prima di allargare l'area, perché la soglia serve a rilevare perdite di risorse.

## Prova dei settori: misura a contatori fermi (22 novembre 2026)

Il fallimento intermittente di `qa-sectors.mjs` non era una perdita di risorse. Su otto giri del circuito i buffer WebGL si fermano dal quarto giro (1054, 1160 e 1257 a Plaza de la Feria, Parque Doramas e Metropole) e le espulsioni crescono regolarmente. Oscillava solo Santa Ana, di circa 40 buffer e 1 texture: un settore residente carica i propri buffer al primo fotogramma disegnato, e la prova leggeva i contatori prima di quel fotogramma o durante la dissolvenza LOD. Ora la prova attende `pending` e `fading` a zero e due letture uguali dei contatori a 150 ms. Dopo la correzione: scarto massimo 14 buffer fra giri (soglia 24) e sei esecuzioni verdi su sei. Il viewer non è stato modificato.

## Viewer a tre livelli e prova a scala 6× (22 novembre 2026)

Branch `espansione-costa`. Il viewer carica un nucleo (0,67 MB più 0,62 MB di terreno binario) al posto di `city.json` (4,6 MB), 10 zone a richiesta e gli 80 settori. Chrome con emulazione mobile 390×844, stessa procedura della base.

| Misura | Base (Fase 0) | Città, tre livelli | Replica 6× |
|---|---|---|---|
| Apertura | 3.162 ms | 3.649 ms | 4.669 ms |
| Picco heap campionato all'apertura | 80,9 MB | 21,5 MB | 77,6 MB |
| p95 fotogramma, vista ravvicinata | 18,4 ms | 18,7 ms | 18,3 ms |
| Draw call e triangoli per fotogramma | 115 / 263.657 | 116 / 266.280 | 107 / 265.653 |
| p95 fotogramma, vista lontana | non misurato | 18,2 ms | 18,3 ms |
| Draw call e triangoli, vista lontana | non misurato | 120 / 25.963 | 267 / 155.132 |
| Heap dopo la raccolta, vista lontana | non misurato | 21,9 MB | 49,1 MB |

`npm.cmd test` verde (apertura 2.649 ms desktop, 1.255 ms mobile emulato, contro 2.617 e 2.076 della base). `qa-sectors.mjs` verde 8 volte su 8 con il nuovo controllo e 3 su 3 dopo l'ultima modifica alla visibilità delle zone; ora include la vista lontana (nessuna zona richiesta, al massimo due in memoria) e il ritorno. `qa-recovery.mjs` e `qa-drive-route.mjs` verdi. `qa-main-lod.mjs` verde 4 volte su 5: un'esecuzione non ha visto la dissolvenza entro il tempo limite; non diagnosticato.

Limiti delle misure: il p95 di circa 18 ms coincide in tutti i casi, quindi è il limite del banco di prova e non distingue i carichi. La replica 6× ha coordinate non arrotondate e file più pesanti del reale (zone 36 MB contro 3,3 × 6), e non ha costa. In guida, la replica non è stata percorsa: l'attraversamento di confine è provato solo sulla città reale. Nessuna prova su telefono fisico. Su desktop la panoramica della città attuale resta edificio per edificio; nel profilo compatto la vista intera passa agli isolati fusi.

La prova dei settori confronta ora il massimo dei buffer WebGL degli ultimi due giri con quello dei due precedenti, dopo due giri di assestamento (sei giri in tutto): su nove giri i contatori restano fermi, con oscillazioni di circa 20 buffer legate alla panoramica disegnata.

## Vegueta, Vega de San José e San Cristóbal (22 novembre 2026)

Primo quartiere dell'espansione, branch `espansione-costa`. Le tre zone nuove usano i confini dei barrios in OpenStreetMap (relazioni 16905756, 16905755 e 16905754). Terraferma da 3,04 a 4,53 km²; parti di edificio da 4.698 a 6.073 (12.361 record comunali nel rettangolo di acquisizione); tratti stradali da 1.433 a 2.350; alberi da 10.376 a 15.367; 16 zone e 126 settori. Le coordinate dei dieci luoghi precedenti non cambiano. Luoghi nuovi: Iglesia de Santo Domingo (way 38062759) e Parroquia de San Cristóbal (way 842431973).

Gli estratti OSM usano ora un reticolo fisso di 0,01° nella finestra [-15.44, 28.07, -15.40, 28.14]. Con la finestra allargata e i dati riscaricati, la città precedente è risultata identica salvo l'ordine degli elementi.

- `typecheck`, `build`, `npm.cmd test`: verdi (apertura 2.996 ms desktop, 1.225 ms mobile emulato). `qa-sectors.mjs`: 2 esecuzioni verdi su 2.
- Benchmark, Chrome con emulazione mobile, quattro esecuzioni: p95 del fotogramma nella vista ravvicinata 52,8, 70,5, 70,9 e 35,8 ms, contro 18,7 ms prima del quartiere; 142 draw call e circa 371.000 triangoli per fotogramma contro 116 e 266.000. A Santa Ana ora sono visibili 13 settori invece di 11 e 58,9 MB di dettaglio invece di 43,0: la vista è piena dove prima a sud c'era il vuoto. Vista lontana: p95 18,2 ms in tre esecuzioni su quattro, 201 draw call, 35.634 triangoli. Picco heap all'apertura 36-40 MB. Il banco usa la GPU integrata Intel UHD di questa macchina (non il rendering software, come scritto in una prima stesura): il peggioramento era reale e la causa è descritta nella sezione seguente.
- Altezze con il LiDAR (tile 458-3108, 459-3106, 459-3107, 459-3108, 459-3109): nell'area nuova 679 parti misurate, scarto mediano +0,44 m, errore medio assoluto 3,88 m, 66 % entro 2 m, 87 % entro 5 m. Santo Domingo 15,6 m comunali contro 13,4 m; Parroquia de San Cristóbal 16,2 contro 12,5 m. 70 parti di 13 OBJECTID superano 10 m di scarto, tutte con il comunale più alto e tutte in complessi con più parti: l'«altura máxima» del complesso è applicata anche ai corpi bassi (ad esempio 40994: 51,7 m comunali, 3,3 m misurati su due parti; 39616: 30 parti). Elenco in `.cache/lidar-control/scarti-vegueta-sur-san-cristobal.csv`. Non corretti: decisione di Luca. Nessuna altezza nuova esportata: l'edificio 39623, senza altezza comunale, non ha punti classificati come edificio nel LiDAR (81 m², resta a 9 m e va controllato sull'ortofoto); il 36746 cade fuori dai tile scaricati. I tile 458-3106 e 458-3107 (50 parti) non sono stati scaricati.

Limiti: il Torreón de San Pedro Mártir sta sugli scogli fuori dalla terraferma del plastico e non è tra i luoghi. Il confine di Vegueta include una lingua stretta lungo il Guiniguada. Su desktop la città intera supera 6 km e la vista completa passa agli isolati fusi. La prova di trascinamento e zoom in `qa.mjs` è stata resa indipendente dalla scala. Nessuna prova su telefono fisico; la guida nel quartiere nuovo non è stata provata a mano.

## Streaming stabile e geometria più leggera (22 novembre 2026)

Il peggioramento misurato dopo il primo quartiere non dipendeva dal carico di disegno. Con il budget pieno, un settore sul bordo dello schermo veniva scaricato e costruito, poi scartato perché nel frattempo la camera si era spostata di un passo, e subito richiesto di nuovo: 160 fotogrammi su 160 con un caricamento in corso, p95 oltre 100 ms. Tre correzioni in `sector-stream.ts`:

- una richiesta di zona o settore resta valida 600 ms dopo l'uscita dalla vista, e lo stesso vale per lo stato «in vista»;
- un settore in vista può far posto solo espellendo settori non richiesti o precaricati attorno alla vista; settori dello stesso tipo non si espellono a vicenda;
- un settore di cui è nota la dimensione viene scaricato solo se c'è posto.

In `scene.ts` gli edifici non costruiscono più il fondo e il coperchio dell'estrusione (uno è interrato, l'altro sta sotto il tetto) e, nel profilo compatto, i parapetti hanno tre facce invece di una scatola chiusa.

Chrome con emulazione mobile 390×844 su GPU Intel UHD, `node scripts/frame-profile.mjs <luogo>` (160 fotogrammi di piccoli spostamenti alternati):

| Luogo | Prima: p95, triangoli | Dopo: mediana / p90 / p95, triangoli |
|---|---|---|
| Santa Ana | 107-123 ms, 359.000 | 16,7 / 33,3 / 33,4 ms, 264.000 |
| Santo Domingo | 89-124 ms, 384.000 | 16,9 / 33,4 / 33,5 ms, 277.000 |
| San Telmo | 18,3 ms, 304.000 | 16,7 / 16,8 / 16,9 ms, 229.000 |

`benchmark.mjs`: p95 da vicino 16,8 ms (era 36-71), 93 draw call e 190.000 triangoli per fotogramma, apertura 1,9 s. Thread principale 4,5 ms per fotogramma a Santa Ana.

Limiti: a Santa Ana e Santo Domingo circa un fotogramma su dieci dura ancora il doppio. Togliere altri triangoli (prova senza davanzali, −11 %) non lo cambia e il thread principale è scarico: il costo residuo è lato GPU e non è diagnosticato. La misura della vista lontana in `benchmark.mjs` ora parte mentre le richieste precedenti sono ancora valide (429 draw call, 483.000 triangoli): va letta con questa riserva. `qa-sectors.mjs` attende 800 ms prima di leggere i contatori e tollera 64 buffer (un settore ne vale circa 45): 5 esecuzioni verdi su 5. `qa-main-lod.mjs` registra nella pagina la comparsa dell'avviso di recupero, che ora dura meno dell'intervallo di campionamento: 6 verdi su 6. `npm.cmd test` verde. Nessuna prova su telefono fisico.

## Corpi bassi dei complessi corretti con il LiDAR (22 novembre 2026)

Il dato comunale assegna a ogni parte di un complesso l'altezza massima del complesso. `scripts/lidar-check.py --export` scrive ora in `content/lidar-heights.json` anche le singole parti (`parts`) dove l'altezza comunale supera di oltre 10 m il p95 misurato, solo per OBJECTID con più poligoni, impronta di almeno 30 m² e almeno 50 punti di tetto. `data.py` le applica con `source: lidar-pnoa`. Nei cinque tile scaricati: 72 parti di 15 OBJECTID, altezze da 2,1 a 23,8 m (ad esempio 40994 da 51,7 a 3,3 m, 40032 da 50,6 a 2,7 m). Strade, superfici, alberi, terreno e confine sono identici a prima. Una delle parti appartiene alla cattedrale (41119), che conserva l'altezza del catalogo.

`typecheck`, `build`, `npm.cmd test` e `qa-sectors.mjs` verdi. Limiti: le parti corrette non sono state confrontate una a una con l'ortofoto; un corpo demolito o coperto da vegetazione darebbe un valore basso sbagliato. La regola vale solo dove esiste un tile: Arenales, Ciudad Jardín e i margini ovest non sono coperti. Gli scarti in cui il LiDAR è più alto del comunale non vengono toccati.

## Vista più ampia limitata a un quartiere (22 novembre 2026)

Su richiesta di Luca la mappa non si allontana più fino a mostrare tutta la città. Il lato lungo della vista più ampia copre 3.000 m su desktop e 2.400 m nel profilo compatto (`farthest` in `src/main.ts`); il pulsante di ripristino e le rotazioni usano lo stesso limite. Il limite sta dentro la soglia delle zone (6.000 e 3.200 m), quindi ogni vista mostra un edificio per impronta e gli isolati fusi compaiono solo mentre una zona si carica. `npm.cmd test`, `qa-sectors.mjs` (2 su 2) e `qa-main-lod.mjs` verdi. Le prove non pretendono più tutti i segnaposto visibili nella vista più ampia, e `qa-sectors.mjs` verifica che quella vista conservi le zone senza dettaglio. La vista di ripristino resta centrata sul centro geometrico della città, che ora inquadra in parte terreno fuori dal perimetro.

## Triana, Arenales, Ciudad Jardín e Alcaravaneras (22 novembre 2026)

Sette zone nuove dai confini dei barrios in OpenStreetMap: Triana (16904602), Canalejas (16904534), Fincas Unidas (16904535), Lugo (16904536), Ciudad del Mar (16904537), Ciudad Jardín (16904538) e Alcaravaneras (16904432). Le prime sei aggiungono solo 125 parti di edificio, perché il corridoio precedente le copriva quasi per intero; Alcaravaneras ne aggiunge 680. Terraferma da 4,53 a 5,05 km²; parti di edificio da 6.073 a 6.878; tratti stradali 2.576; alberi 16.506; 19 zone e 142 settori. I dodici luoghi non si spostano. Nessun luogo nuovo.

- `typecheck`, `build`, `npm.cmd test` verdi (apertura 1.991 ms desktop, 917 ms mobile emulato). `qa-sectors.mjs` 2 su 2.
- Benchmark: p95 da vicino 18,2 ms, 86 draw call e 178.000 triangoli per fotogramma, apertura 1,9 s, picco heap 43 MB. Profilo dei fotogrammi (mediana / p95): Santa Ana 17,5 / 35,8 ms, Plaza de la Feria 17,5 / 18,2 ms, Metropole 17,7 / 18,3 ms, con 270-282.000 triangoli.
- LiDAR: tredici tile (aggiunti 457-3110, 457-3111, 457-3112, 458-3109, 458-3110, 458-3111, 458-3112, 459-3110). Su 6.194 parti misurate lo scarto mediano LiDAR meno comunale è +0,55 m, l'errore medio assoluto 1,98 m, 72 % entro 2 m e 91 % entro 5 m. Esportate 16 altezze per edifici senza dato comunale e 114 corpi bassi di complessi: in tutto 137 parti con `source: lidar-pnoa`. Restano 31 parti a 9 m di stima: 29 senza punti sufficienti e alcune dove il LiDAR non trova un tetto (ad esempio 30904, misurato a 0 m). `lidar-check.py` scarta ora le altezze sotto 2,5 m per gli edifici senza dato e sotto 2 m per i corpi bassi, ed è passato da 12 minuti a circa un minuto con tredici tile (punti ordinati per fascia, indice spaziale dei vicini) con risultati identici sui cinque tile precedenti.

Limiti: il tile 457-3113 (112 parti, nessuna senza altezza) non è uscito dal filtro del Centro de Descargas e non è stato scaricato. Le correzioni non sono state confrontate una a una con l'ortofoto. Nessuna prova su telefono fisico; la guida nei quartieri nuovi non è stata provata a mano.

## Editor locale del pilota

Aprire `editor.html` su GitHub Pages. In locale, avviare `npm.cmd run dev -- --host 127.0.0.1 --port 5197` e aprire `http://127.0.0.1:5197/editor.html`. Selezionare un edificio nella scena per muoverlo o correggere un vertice del contorno o di un cortile. Il catalogo include panchina, paletto e fioriera. `Download JSON` esporta le correzioni. `Open edits` le riapre nell’editor e `Test Drive` apre il selettore di file del pilota. [Editor del pilota su GitHub Pages](https://tatosgames.github.io/isometric-cities/editor.html)

`node scripts/qa-editor.mjs` avvia Vite e Chrome. La prova copre selezione, trascinamento sul gizmo, modifica di un vertice del cortile, posa e rotazione di props, rimozione, annulla/ripristina e download con riapertura in una sessione nuova. Controlla il rifiuto atomico di JSON non valido, versione della mappa diversa e impronta invalida. Verifica l’avvio di Conducir con il file ricaricato e interroga la stessa griglia di collisione della guida per confrontare la posizione vecchia e quella nuova del muro.

Passati `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd test` e `node scripts/qa-editor.mjs`. In Chrome mobile emulato a 390 × 844, verificati posa di una panchina con tap e download del JSON.

In **Move**, trascinare direttamente un edificio o un prop oppure usare le frecce. Durante il gesto si vede muovere il modello 3D. **Vertices** consente di trascinare i punti delle impronte e dei cortili. **Frame** inquadra la selezione e **Overview** ripristina la vista iniziale. Il test controlla anche il trascinamento senza gizmo, l’annullamento con Esc e la variazione di inquadratura.

Il test dell’editor è passato anche sulla build di produzione servita sotto `/isometric-cities/`, il percorso usato da GitHub Pages. Apre **Test Drive** dal link dell’editor e verifica il caricamento del JSON nella pagina aperta.

L’editor e il caricamento delle correzioni sono disponibili per il solo pilota. La lettura del JSON avviene nel browser. Il file è legato ai byte di `pilot.json` dalla sua impronta SHA-256. Santa Ana e Gabinete Literario sono in sola lettura. Il catalogo contiene arredo decorativo senza collisioni.

## Appoggio dei veicoli sul terreno

Auto, pattuglie e rottami seguono la quota del triangolo sotto il loro centro. Ombre, sgommate e polvere usano la stessa superficie. L'indice in celle da 15 m viene costruito al primo uso del terreno di ciascun settore e viene rilasciato quando esce la zona. Usa i buffer esistenti e non aggiunge draw call.

`ShapeGeometry` e la funzione condivisa producono le stesse facce nello stesso ordine per tutte le 23.378 celle del suolo di dettaglio. Le zone e i 142 settori contengono gli stessi anelli. La triangolazione resta compatibile con le carreggiate già generate.

`scripts/qa-ground.mjs`, incluso in `npm.cmd test`, confronta la quota con un raycast verticale sulla mesh effettiva. A `(-1270, 1055)` il terreno visibile è 6,89 m sopra la quota della griglia nei geodati attuali. La misura resta entro 1 cm dal raycast prima e dopo l'arrivo ritardato del dettaglio. La prova copre anche panoramica, bordo di settore, diagonale di una cella del pilota e fallback fuori dal terreno.

In Chrome desktop e mobile emulato (390 × 844), percorsi entrambi i sensi di un tratto con 3,06 m di dislivello su 35,27 m. L'auto era visibile durante il rettilineo e la sterzata, con una pattuglia attiva.

`npm.cmd run typecheck`, `npm.cmd run build` e `npm.cmd test` completati. `node scripts/qa-sectors.mjs` è passato in esecuzione isolata, con attraversamento nei due sensi e una pattuglia attiva. Il tentativo precedente aveva superato di un buffer la tolleranza del circuito.

Sui dossi più netti può ancora compenetrare una singola ruota, perché l'appoggio si calcola al centro. Resta da riprodurre il punto preciso degli screenshot originali.

## Santa Catalina-Canteras e Guanarteme (22 novembre 2026)

Terzo quartiere dell'espansione. Due zone nuove dai confini dei barrios in OpenStreetMap (relazioni 16904433 e 16904431). Terraferma da 5,05 a 8,06 km²; parti di edificio da 6.878 a 10.137; tratti stradali da 2.576 a 3.574; alberi da 16.506 a 18.983; zone da 19 a 27; settori da 142 a 218. Gli edifici precedenti sono invariati, salvo uno sul vecchio bordo. Luoghi nuovi: Parque Santa Catalina (way 265760472) e Auditorio Alfredo Kraus (way 585709389), 14 in tutto. Dati pubblicati: nucleo 1,6 MB, zone 8,3 MB, settori 16,5 MB.

La finestra OSM passa a [-15.47, 28.07, -15.40, 28.16] (63 celle, 35 nuove). Il record comunale 16913 non ha geometria: `data.py` lo segnala e lo salta. Il confine di Santa Catalina-Canteras include i moli mappati in OSM; quello di Guanarteme include il versante spoglio verso El Rincón.

Il pulsante di ripristino ora torna alla Plaza de Santa Ana alla distanza massima, perché la città non entra più nella vista più ampia e il suo centro geometrico cade lontano da ogni luogo.

- `typecheck`, `build`, `npm.cmd test`: verdi (apertura 3.289 ms desktop, 3.107 ms mobile emulato). `qa-sectors.mjs`: 2 esecuzioni verdi su 2.
- Benchmark, Chrome con emulazione mobile su GPU integrata Intel UHD: apertura 2.304 ms, picco heap 60,5 MB. Vista ravvicinata: p95 18,3 ms, 85 draw call e 176.654 triangoli per fotogramma. Vista più ampia sopra Vegueta: p95 35,9 ms, 219 draw call e 383.282 triangoli. Prima il ripristino inquadrava in parte terreno vuoto; ora inquadra il centro storico, che è il punto più denso.
- Profilo dei fotogrammi (`frame-profile.mjs`): Parque Santa Catalina mediana 17,8 e p95 18,5 ms; Auditorio Alfredo Kraus 17,8 e 18,4 ms; Santa Ana 17,5 e 35,8 ms, come prima.
- LiDAR: venti tile (aggiunti 455-3112, 456-3111, 456-3112, 456-3113, 457-3113, 457-3114, 458-3113). Su 9.471 parti misurate lo scarto mediano LiDAR meno comunale è +0,6 m, errore medio assoluto 2,02 m, 72 % entro 2 m, 90 % entro 5 m. Nell'area nuova: 3.108 parti, mediana +0,75 m, errore medio assoluto 2,23 m, 70 % entro 2 m, 89 % entro 5 m. Altezze misurate esportate: da 16 a 43 edifici senza dato comunale e da 114 a 131 corpi bassi. 189 parti usano ora `lidar-pnoa`; 40 restano a 9 m di stima.
- Schermate di controllo a occhio dei due luoghi nuovi, da vicino e alla distanza massima: edifici, moli, spiaggia e versante coerenti; nessun errore in console.

Limiti. Nell'area nuova 97 edifici hanno un tetto misurato oltre 10 m più alto del dato comunale (ad esempio 25810: 41,7 m comunali, 78,2 m misurati; 22817: 3,6 contro 29,1 m) e 16 lo hanno più basso. Non corretti: decisione di Luca. Elenco in `.cache/lidar-control/scarti-santa-catalina-guanarteme.csv`. Mancano i tile 454-3112, 455-3111, 458-3106 e 458-3107 (61 parti in tutto). La vista più ampia sul centro storico supera il fotogramma a 60 Hz sulla GPU integrata. Nessuna prova su telefono fisico; la guida nei quartieri nuovi non è stata provata a mano. I due luoghi nuovi non hanno un modello dedicato. La Isleta e il porto non sono ancora inclusi.

## Isolati densi più leggeri (22 novembre 2026)

Passaggio di ottimizzazione dopo Triana–Alcaravaneras e Santa Catalina–Guanarteme. Il conteggio di un settore denso (-8_14, 217 edifici) ha mostrato che pesano i parapetti (36 % dei triangoli) e i muri, non le finestre: le impronte comunali hanno in media 16 lati per edificio, con un vertice ovunque un vicino tocca il muro. Due interventi, entrambi senza cambiare la sagoma:

- `sectors.py` toglie dalle impronte di settori e zone i vertici entro 0,1 m da un muro dritto (`lighter()`); `city.json` resta intatto. In città i vertici d'impronta scendono da 237.142 a 185.654 (−22 %); i settori da 16,5 a 15,6 MB, le zone da 8,3 a 7,5 MB.
- `scene.ts` non costruisce finestre, cornici e parapetti sepolti in un edificio adiacente più alto (`buriedTo()`). Nell'editor del pilota resta tutto, perché lì gli edifici si spostano.

`frame-profile.mjs` accetta ora una vista per coordinate (`x,y,zoom`). Telefono emulato 390×844 su GPU Intel UHD, triangoli per fotogramma:

| Vista | Prima | Dopo |
|---|---|---|
| Santa Catalina (-1800, 3480), da vicino | 320.468 | 268.625 |
| Santa Catalina (-2040, 3480), da vicino | 372.062 | 297.209 |
| Alcaravaneras (-1560, 2760), da vicino | 324.423 | 297.319 |
| Arenales (-840, 1080), da vicino | 342.061 | 296.681 |
| Santa Ana, da vicino | 270.743 | 220.331 |
| Santa Catalina, vista più ampia | 335.264 | 264.493 |
| Santa Ana, vista più ampia | 169.321 | 138.222 |

Da vicino il calo a schermo è minore di quello per settore, perché il budget di memoria si riempie con più settori (da 14 a 15, da 16 a 17). `benchmark.mjs`: apertura 2.087 ms (era 2.304), picco heap 51,6 MB (era 60,5), vista ravvicinata p95 18,2 ms con 159.124 triangoli (erano 176.654), vista più ampia 323.183 triangoli (erano 383.282).

`typecheck`, `build`, `npm.cmd test` e due esecuzioni di `qa-sectors.mjs`: verdi su una copia pulita del commit. Confronto a camera identica su Parque Santa Catalina e controllo a occhio di un isolato denso a zoom 3,2: nessuna differenza di sagoma; un edificio a gradoni ha ora un volume tecnico sul tetto, perché la triangolazione del tetto è cambiata.

Limiti. Le viste più ampie sono stabili a 18 ms in `frame-profile.mjs`, ma `benchmark.mjs` misura ancora 35,4 ms di p95 nella vista lontana: la sua misura parte con le richieste precedenti ancora valide. Da vicino, in tre dei cinque isolati densi misurati un fotogramma su dieci dura ancora 35 ms, come a Santa Ana prima: il costo è lato GPU e non dipende dal solo numero di triangoli. Le misure dei tempi sono state prese con un altro processo attivo sulla macchina e vanno ripetute a macchina libera. Nessuna prova su telefono fisico. Il catalogo dei trucchi applicati è in [PERFORMANCE.md](PERFORMANCE.md).

## Edifici più alti del dato comunale corretti con il LiDAR (22 novembre 2026)

In 157 parti di edificio il tetto misurato (p95) supera di oltre 10 m l'altezza comunale. `scripts/lidar-check.py --export` ne corregge 54: solo quelle in cui anche la mediana dei punti del tetto sale (oltre 5 m sopra il comunale e almeno il 75 % del p95). Nelle altre 103 la mediana resta vicina al dato comunale: il p95 legge un albero, una sporgenza del vicino o un corpo alto su una piccola parte dell'impronta, e l'altezza non cambia. Delle 54 corrette, 34 stanno tra Santa Catalina e Guanarteme e 20 nei quartieri precedenti.

Esempi: 25810 (torre accanto al Parque Santa Catalina) da 41,7 a 78,2 m; 22817 da 3,6 a 29,1 m; 16466 da 7,8 a 32,6 m. Le impronte non cambiano. In città 243 parti usano ora `lidar-pnoa`, 9.854 il dato comunale e 40 la stima di 9 m.

`typecheck`, `build`, `npm.cmd test` e `qa-sectors.mjs`: verdi su una copia pulita del commit. Controllo a occhio della torre 25810 nella mappa.

Limiti. Le 54 correzioni non sono state confrontate una a una con l'ortofoto; solo la torre 25810 è stata guardata nella mappa. Un corpo alto che copre meno di metà dell'impronta resta al dato comunale. Il valore applicato è il p95, che su tetti con volumi tecnici può superare di qualche metro la gronda.

## La Isleta e Puerto de la Luz (23 novembre 2026)

Quarto quartiere dell'espansione: tutto il barrio di La Isleta dal confine in OpenStreetMap (relazione 16904434), con abitato, zona industriale, moli del porto, versante vulcanico ed El Confital. Terraferma da 8,06 a 19,30 km²; parti di edificio da 10.137 a 14.973; tratti stradali da 3.574 a 4.703; alberi da 18.983 a 21.981; zone da 27 a 50; settori da 218 a 487. Gli edifici precedenti sono invariati. Luoghi nuovi: Castillo de la Luz (way 126808548) e Mercado del Puerto (way 119110526), 16 in tutto. Dati pubblicati: nucleo 2,3 MB, terreno 5,8 MB, zone 13 MB, settori 28 MB.

La finestra OSM passa a [-15.47, 28.07, -15.39, 28.19] (96 celle). Tre correzioni emerse dalla scala:

- Il servizio delle quote risponde -32768 oltre la propria copertura senza dichiararlo come dato mancante (quattro righe a nord della penisola, in mare): `data.py` lo legge come livello del mare.
- Il mare era disegnato solo entro 260 m dalla terra e lasciava un buco nel bacino del porto: ora i bacini chiusi da terra e moli sono pieni.
- Il mondo della guida chiedeva a ogni nodo stradale se sta dentro il confine scorrendo tutti i suoi lati: 2,7 s all'apertura con la costa nuova. Il confine è ora indicizzato per fasce (`ringIndex()` in `drive-world.ts`) e il controllo non compare più nel profilo.

Verifiche su una copia pulita del commit:

- `typecheck` e `build`: verdi. `qa-sectors.mjs`: 2 esecuzioni verdi su 2. In `npm.cmd test` passano le prove di posa, pedoni e appoggio al terreno; `qa.mjs` si ferma alla riga 75 (piè di pagina visibile sulla mappa). Lo stesso arresto avviene sul commit precedente `1a37dba`, senza queste modifiche: non dipende da La Isleta e il resto di `qa.mjs` non è stato eseguito.
- `benchmark.mjs`, Chrome con emulazione mobile su GPU Intel UHD, confrontato con `1a37dba` nelle stesse condizioni di macchina: apertura 5,3-5,9 s (era 6,3), vista ravvicinata p95 18,2 ms con 156.139 triangoli (era 18,1 ms, 158.928), picco heap 112,6 MB (era 88,7).
- `frame-profile.mjs`: Santa Ana da vicino 17,4 / 18,4 ms (mediana / p95), vista più ampia su Santa Ana 17,4 / 18,2 ms, vista più ampia su Santa Catalina 17,5 / 18,3 ms.
- LiDAR: trenta tile (aggiunti 457-3115, 457-3116, 458-3114, 458-3115, 459-3113, 459-3114, 459-3115, 459-3116, 460-3115, 460-3116). Su 14.160 parti misurate lo scarto mediano LiDAR meno comunale è +0,66 m, errore medio assoluto 1,90 m, 72 % entro 2 m, 91 % entro 5 m. Nell'area nuova: 4.647 parti, mediana +0,86 m, errore medio assoluto 1,96 m, 72 % entro 2 m, 92 % entro 5 m. Esportate 40 altezze per edifici senza dato comunale, 40 corpi bassi e 32 tetti più alti del dato comunale. In città 361 parti usano `lidar-pnoa`, 14.563 il dato comunale, 49 la stima di 9 m. Castillo de la Luz 9,0 m comunali contro 12,0 m misurati; Mercado del Puerto 13,0 contro 9,5 m; Auditorio Alfredo Kraus 29,0 contro 29,0 m, con il p99 a 40,9 m per la torre.
- Schermate viste a occhio: abitato di La Isleta, zona industriale, moli e bacino del porto, penisola con il rilievo vulcanico e i serbatoi del porto, già presenti come edifici comunali.

Limiti. Il picco heap cresce con la superficie (112,6 MB): il livello sempre residente va alleggerito prima di aggiungere Ciudad Alta. Subito dopo il ripristino della vista `benchmark.mjs` misura uno o due fotogrammi da circa 170 ms (p95 su 40 fotogrammi; 35 ms sul commit precedente), mentre a vista ferma la cadenza è regolare: causa non diagnosticata. Nella vista più ampia su Santa Catalina le zone residenti stimano 93 MB. Mancano ancora i tile 454-3112, 455-3111, 458-3106 e 458-3107. La penisola a nord non ha edifici comunali: è terreno con sentieri. Nessuna prova su telefono fisico; guida non provata a mano nell'area nuova. Gru, silos e modelli dedicati non sono in questo passo.

## Oggetti del porto e tre modelli dedicati (23 novembre 2026)

**Oggetti del porto.** Inventario di OpenStreetMap dentro l'area: 21 gru (`man_made=crane`: 18 a portale, 1 travel lift, 2 senza tipo), 2 ciminiere, 97 serbatoi (68 mappati come punto, 29 con impronta) e 22 silos. Gru e ciminiere viaggiano in una lista nuova, `props` (tipo, posizione, orientamento, dimensione), scritta da `data.py` e distribuita da `sectors.py` in settori e zone. `src/render/port-props.ts` le disegna: la gru è un portale procedurale con il braccio alzato, in dettaglio da vicino (13 parallelepipedi) e come sagoma nella vista intermedia (6). Colori dall'ortofoto SITCAN del 2024: struttura azzurra, sala macchine bianca. Serbatoi e silos sono già edifici comunali: i 34 che contengono un serbatoio o un silo mappato perdono finestre e volumi tecnici e prendono un guscio chiaro. Nessun container e nessuna nave: OSM non li mappa.

**Modelli dedicati** in `src/render/landmarks.ts`, con volumi dalle impronte comunali, altezze dal LiDAR, pianta dall'ortofoto a 20 cm e facciate da fotografie di riferimento (Wikimedia Commons e due foto del Mercado fornite da Luca, usate solo come riferimento visivo):

- **Castillo de la Luz** (OBJECTID 32072): mura in pietra a 10 m, merli lungo il cammino di ronda, torretta con copertura conica a 13 m. I bastioni tondi e il cortile sono già nell'impronta.
- **Mercado del Puerto** (26966): pareti avorio a 7,4 m con aperture scure, fascia di lamelle, tetto a padiglione fino a 9,2 m, pensilina su colonne in ferro verde, portali a timpano e lucernario ottagonale fino a 14 m.
- **Auditorio Alfredo Kraus** (14627, solo il corpo della sala): pietra ocra a 29 m, lanterna vetrata con cuspide chiara fino a 48 m, torre ottagonale e vetrata sul lato dell'impronta rivolto all'oceano.

Il record comunale dell'Auditorio ha sei corpi separati: il catalogo può ora dare uno stile a un solo corpo con la chiave `OBJECTID:floor(x minimo):floor(y minimo)`, la stessa delle correzioni LiDAR.

Verifiche su una copia pulita del commit: `typecheck` e `build` verdi; `qa-sectors.mjs` 2 verdi su 2; prove di posa, pedoni e appoggio al terreno verdi. `qa.mjs` resta fermo alla riga 75 come sul commit `1a37dba`. Schermate dei tre modelli da due orientamenti e delle gru da vicino e da lontano, viste a occhio.

`frame-profile.mjs`, telefono emulato su GPU Intel UHD (mediana / p95, triangoli): Castillo de la Luz 18,0 / 18,3 ms, 172.065; Mercado del Puerto 17,9 / 36,0 ms, 212.236; Auditorio Alfredo Kraus 17,9 / 18,1 ms, 49.842; gru del terminal da vicino 17,4 ms, 5.876; vista più ampia su La Isleta 17,9 / 18,2 ms, 330.338. `benchmark.mjs`: apertura 5,7 s, vista ravvicinata p95 18,2 ms, picco heap 110,7 MB.

**Passaggio di ottimizzazione, esito.** Il nucleo abitato di La Isleta è il punto più pesante della città: a (-1200, 5000) da vicino 325.393 triangoli con mediana 35,9 ms e p95 53,8 ms, cioè metà cadenza costante sul telefono emulato. Il settore -5_22 ha 385 edifici; dopo le ottimizzazioni già attive i parapetti restano la voce maggiore (27.768 triangoli prima dello scarto di quelli sepolti), poi muri 12.712, finestre e davanzali 12.120, volumi tecnici 7.752, tetti 5.512. Non corretto in questo passo.

Limiti. Le posizioni delle gru in OSM sono approssimate (nota `FIXME`): nell'ortofoto una gru reale sta a circa 50 m dal punto mappato. L'orientamento è verso il bordo di banchina più vicino. Le gru non sono ostacoli nella guida. I 68 serbatoi mappati solo come punto e senza edificio comunale non sono disegnati: OSM non ne dà la dimensione. I modelli sono interpretazioni semplificate nello stile del plastico; la posizione della torretta del Castillo e della lanterna dell'Auditorio è misurata sull'ortofoto. Il tetto dell'Auditorio ha la tinta scura del PNOA, più scura del vero. Dall'alto il Mercado mostra soprattutto il tetto. Nessuna prova su telefono fisico; guida non provata a mano.

## Quartieri densi, memoria residente e scatto dopo il ripristino (23 novembre 2026)

Correzioni dei problemi lasciati aperti dopo La Isleta.

- **Geometria nel profilo compatto** (`scene.ts`): il parapetto è la faccia superiore più quella esterna (4 triangoli invece di 6); le cabine sul tetto perdono il coperchio e il serbatoio accanto; dei davanzali restano solo i balconi. Su desktop non cambia nulla.
- **Copertura stradale per zona**: ogni zona porta la propria (`coverage` nel file di zona). Prima ogni texture di suolo ridisegnava la copertura di tutta la città, tenuta nell'indice: era l'origine dello scatto dopo il ripristino. L'indice ne conserva una copia semplificata a 1,5 m per la mappa lontana e scende da 1,74 a 0,48 MB; le zone salgono da 13 a 15 MB.
- **Terreno in Int16**: la griglia resta in decimetri a 16 bit sul thread principale e nel worker (`Terrain.scale`), 6 MB invece di 12 per copia.
- **Gru e ciminiere nella guida**: le quattro gambe di ogni gru e il fusto delle ciminiere entrano tra gli ostacoli puntuali della zona, come i tronchi (`propObstacles()`).

Telefono emulato 390×844 su GPU Intel UHD, `frame-profile.mjs` (mediana / p90, triangoli):

| Vista da vicino | Prima | Dopo |
|---|---|---|
| Nucleo di La Isleta (-1200, 5000) | 35,9 / 52,6 ms, 325.393 | 18,2 / 36,3 ms, 257.828 |
| Santa Catalina (-2040, 3480) | 17,5 / 18,8 ms, 297.209 | 18,1 / 18,3 ms, 232.517 |
| Santa Ana | 17,5 / 35,6 ms, 220.331 | 17,3 / 18,3 ms, 178.001 |
| Mercado del Puerto | 17,9 / 18,9 ms, 212.236 | 18,1 / 18,2 ms, 171.914 |

`benchmark.mjs`: fotogramma peggiore dopo il ripristino da 175,7 a 36,2 ms (p95 su 40 fotogrammi); picco heap da 110,7 a 101,5 MB; a vista ferma heap più buffer da 98,4 a 86,3 MB. Vista ravvicinata p95 18,2 ms.

`typecheck`, `build`, `npm.cmd test` per intero e due esecuzioni di `qa-sectors.mjs`: verdi su una copia pulita del commit. Confronto a camera identica sul nucleo di La Isleta nel profilo telefono a zoom 4 e 1,59: sagome e colori invariati; il bordo chiaro dei tetti sul lato lontano è più sottile e le cabine sul tetto non hanno più il coperchio chiaro.

Limiti. Nel nucleo di La Isleta un fotogramma su dieci dura ancora 36 ms. La collisione con le gru è verificata solo nel calcolo delle posizioni delle gambe, non guidandoci contro. Il picco heap resta sopra 100 MB: 13 MB vengono dai JSON residenti e 7 MB dall'indice dei muri della guida. Tempi misurati con un altro processo attivo sulla macchina. Nessuna prova su telefono fisico.

## Planata di ritorno alla mappa

Verifica Chrome da Seguimiento, Aérea e Isométrica a 1100×700, 390×844 e 844×390. Uscendo con il pulsante o con Esc, la camera passa per pose intermedie e torna al centro, allo zoom e all’angolo salvati prima di Play. La suite di guida verifica l’avvio del volo e il ripristino in uscita da una partita e dopo la cattura.

## Quartiere 5: Ciudad Alta e San Francisco - San Nicolás (23 novembre 2026)

Tutto il distrito 4 (16 barrios) più il risco di San Francisco - San Nicolás, che chiude il vuoto tra Triana e Schamann. OpenStreetMap non mappa questi barrios come confini: i perimetri vengono dal servizio «Barrios» del Comune (`ENTS_CO_ID` 24, campo `NUCL_CO_ID`), nuova zona di tipo `municipal` in `content/las-palmas.json`. Dieci metri di margine chiudono la giunzione con i confini OSM; i buchi sotto 2.000 m² tra le due fonti vengono riempiti.

Barrios aggiunti: Schamann, Las Rehoyas, Rehoyas Altas, San Antonio, Altavista, Don Zoilo, Escaleritas, Las Chumberas, La Minilla, La Feria, Cuevas Torres, San Lázaro, Las Torres, Las Torres Industriales, El Cardón, Díaz Casanova e San Francisco - San Nicolás.

| | Prima | Dopo |
|---|---|---|
| Area | 19,30 km² | 27,83 km² |
| Parti di edificio | 14.973 | 21.326 |
| Strade | 4.703 | 7.201 |
| Alberi | 21.981 | 42.782 |
| Zone / settori | 50 / 487 | 61 / 639 |

Dei 14.973 edifici precedenti, 14.881 sono identici; i 92 cambiati stavano sul vecchio confine ed erano tagliati.

**LiDAR.** Undici tessere nuove scaricate dal CNIG (40 in cache). Misurati 20.174 edifici su 21.326: scarto mediano +0,58 m, 70,9 % entro 2 m, 90,6 % entro 5 m. L'esportazione ha aggiunto 32 altezze dove manca il dato comunale, 144 parti basse e 7 parti alte. In città ora 551 parti hanno altezza dal LiDAR e 68 restano stimate a 9 m.

**Verifiche** su una copia pulita: `typecheck`, `build`, `npm.cmd test` per intero, `qa-sectors.mjs` (2 verdi su 2 prima delle correzioni LiDAR, 1 su 1 dopo), `check-data.mjs`. Schermate di Schamann, Las Torres, San Lázaro e della vista d'insieme guardate a occhio.

Telefono emulato 390×844 su GPU Intel UHD, `frame-profile.mjs` (mediana / p90, triangoli): Schamann (-2250, 300) da vicino 16,7 / 16,7 ms, 323.314; Schamann (-1800, 600) da vicino 17,4 / 18,2 ms, 313.902 e alla distanza massima 17,3 / 18,2 ms, 379.234; Las Torres (-3300, 1300) 17,3 / 18,2 ms, 97.523; San Lázaro (-3800, -500) 17,3 / 18,2 ms, 205.755; nucleo di La Isleta 16,7 / 16,8 ms, 208.273; Santa Ana 16,7 / 16,8 ms, 159.018. `benchmark.mjs`: apertura 5,1 s, vista ravvicinata p95 16,8 ms, fotogramma peggiore dopo il ripristino 33,2 ms.

**Passaggio di ottimizzazione, esito.** Schamann è ora il punto con più triangoli della città (323.000 da vicino sul telefono, contro 208.000 del nucleo di La Isleta), ma tiene la cadenza piena. Tre settori nuovi superano i 240 edifici e hanno la lista fusa (-10_1, -9_1, -8_2), più -2_-2 con San Nicolás. Nessuna modifica al codice di resa in questo passo.

Limiti. La memoria è salita: heap dopo la raccolta 128,7 MB nel benchmark (era 95,7), con 65,6 MB di zone residenti nella vista ampia del centro (erano 48,7). È sopra la soglia che ci eravamo dati per i telefoni e non è corretto. La tessera LiDAR 454-3109 è arrivata troncata ed è stata scartata (20 edifici); mancano anche 454-3112 e 458-3106 (2 edifici ciascuna). Il bordo sud di San Lázaro ha una punta sottile che viene dal perimetro comunale. Nessun luogo nuovo nel menu e nessun modello dedicato a Ciudad Alta. Una prima esecuzione di `npm.cmd test` si è fermata sul controllo a tempo della schermata di fine guida con la macchina occupata; ripetuta a macchina libera è verde. Nessuna prova su telefono fisico; guida nei quartieri nuovi non provata a mano.

## Memoria residente dopo Ciudad Alta (23 novembre 2026)

Con Ciudad Alta l'heap dopo la raccolta era salito a 128 MB. Un'istantanea dell'heap sul telefono emulato, alla vista più ampia sopra Schamann (14 zone caricate), dava 144,8 MB: 66 MB di buffer di geometria e 61 MB di array e numeri JavaScript. Tre correzioni in `sector-stream.ts` e `overview.ts`:

- **Zone senza piastrelle e copertura.** Ogni zona caricata teneva vive le proprie piastrelle di suolo da 15 m (636.706 coppie di coordinate in tutta la città) e la copertura stradale, perché la funzione che la rilascia condivideva l'ambito con i dati scaricati. Ora restano solo impronte, alberi e oggetti, che servono alla guida.
- **Niente normali per vertice nella vista intermedia e lontana del profilo compatto.** I materiali sono a ombreggiatura piatta e il profilo compatto non ha shadow map: la normale per vertice non veniva letta. Erano 12 byte su 27 per vertice.
- **Contorni del livello lontano rilasciati** dopo averne fatto la geometria.

| Misura (telefono emulato) | Prima | Dopo |
|---|---|---|
| Heap, vista più ampia su Schamann (-2250, 300) | 144,8 MB | 103,5 MB |
| Heap, vista da vicino in Vegueta (-80, -560) | 88,5 MB | 74,2 MB |
| `benchmark.mjs`, heap dopo la raccolta | 128,0 MB | 101,4 MB |
| `benchmark.mjs`, zone residenti | 65,6 MB | 52,1 MB |

Confronto a camera identica alla vista più ampia: differenza massima 2 su 255 per canale, media 0,03. `typecheck`, `build`, `npm.cmd test` per intero e due esecuzioni di `qa-sectors.mjs`: verdi su una copia pulita.

Limiti. Il picco campionato all'apertura resta a 105-107 MB: non l'ho analizzato. Restano residenti le impronte delle zone caricate (per la guida) e strade, superfici e copertura dell'intera città. I buffer di geometria (41 MB alla vista più ampia) hanno ancora una copia su CPU: liberarla dopo il caricamento sulla GPU richiede di ricostruire le zone al ripristino del contesto WebGL, e non l'ho fatto. Fotogramma peggiore dopo il ripristino nel benchmark 33-50 ms su tre misure a macchina occupata (17-34 prima). `qa-main-lod.mjs`, che non fa parte di `npm.cmd test`, fallisce alla riga 45 allo stesso modo sul commit precedente. Nessuna prova su telefono fisico.

## Geometrie solo sulla GPU (23 novembre 2026)

Le geometrie di zone e settori tenevano una copia in memoria dopo il caricamento sulla GPU. Ora la copia si libera all'upload (`gpuOnly()` in `sector-stream.ts`); restano in memoria solo il livello lontano e le superfici di suolo, che il campionatore delle quote legge ancora. Alla perdita del contesto WebGL zone e settori vengono rilasciati (`forget()`) e ricaricati dai loro file al ripristino; la guida conserva le impronte nel frattempo. Il contatore dei byte di un settore teneva vivo l'insieme dei suoi array: corretto.

| Misura (telefono emulato) | Prima | Dopo |
|---|---|---|
| Heap, vista più ampia su Schamann (-2250, 300) | 103,5 MB | 88,5 MB |
| Heap, vista da vicino in Vegueta (-80, -560) | 74,2 MB | 65,6 MB |
| Heap, vista da vicino su Schamann | non misurato | 76,9 MB |
| `benchmark.mjs`, heap dopo la raccolta | 101,4 MB | 79,4 MB |

Prova di perdita e ripristino del contesto (`WEBGL_lose_context`) a vista ravvicinata con 19 settori: tutti rilasciati e ricaricati, nessun errore in console, immagine dopo il ripristino uguale a quella di prima salvo lo 0,66 % dei pixel (chiome mosse dal vento). `qa-boot.mjs` (tre scenari di perdita del contesto), `qa-sectors.mjs`, `typecheck` e `build` verdi. `npm.cmd test`: una esecuzione fermata sul controllo a tempo della schermata di fine guida, poi due verdi di fila.

Limiti. Il picco campionato all'apertura resta a 108 MB. Dopo una perdita di contesto la città torna prima come livello lontano e poi si ricarica: un secondo o due senza dettaglio, non misurato su telefono. Perdita di contesto durante una partita di guida non provata. Nessuna prova su telefono fisico.

## Vuoto centrale riempito: riscos e barrancos (23 novembre 2026)

La città coperta era oblunga, con una grande insenatura tra Ciudad Alta, Triana-Vegueta e San Cristóbal: a sud di La Isleta riempiva il 51 % del proprio inviluppo convesso. Aggiunti i 12 barrios comunali dentro quell'insenatura: Miller, Miller Industrial, Lomo Apolinario, San Roque, El Batán, San Juan - San José, Zárate, El Lasso, La Paterna, Los Tarahales, Casablanca III e il «Diseminado Las Palmas de GC» (barranco, 1,4 km² quasi senza case, coperto ma senza etichetta). Ora la parte a sud di La Isleta riempie circa il 67 % dell'inviluppo.

| | Prima | Dopo |
|---|---|---|
| Area | 27,83 km² | 33,86 km² |
| Parti di edificio | 21.326 | 27.086 |
| Strade | 7.201 | 8.391 |
| Alberi | 42.782 | 45.420 |
| Zone / settori | 61 / 639 | 66 / 747 |

Dei 21.326 edifici precedenti, 21.266 sono identici; i 60 cambiati stavano sul vecchio confine. Gru e ciminiere invariate.

**LiDAR.** Quattro tessere nuove (44 in cache, compresa la 454-3109 riscaricata e letta fino in fondo). Misurati 25.545 edifici su 27.086: scarto mediano +0,54 m, 66,7 % entro 2 m, 90,4 % entro 5 m. Esportate 151 altezze dove manca il dato comunale, 37 parti basse e 5 alte. In città 820 parti hanno altezza dal LiDAR e 132 restano stimate a 9 m.

**Correzione.** Dopo il commit del lavoro sul mare `data.py` non girava più: l'orientamento delle gru usava una variabile rimossa (`coast`). Ora usa la linea di costa dentro la finestra; le 23 posizioni e direzioni sono identiche a prima.

**Verifiche** su una copia pulita: `typecheck`, `build`, `check-data.mjs`, `npm.cmd test` per intero e due esecuzioni di `qa-sectors.mjs`, tutte verdi. Schermate della vista d'insieme, di San Juan - San José e della vista più ampia sul telefono guardate a occhio.

Telefono emulato, `frame-profile.mjs` (mediana / p90, triangoli): San Juan - San José (-650, -1300) da vicino 17,4 / 18,1 ms, 110.603; centro (-1500, -900) alla distanza massima 17,5 / 18,1 ms, 320.814; San Roque (-1250, -850) da vicino 17,4 / 18,1 ms, 85.166. `benchmark.mjs`: apertura 5,6 s, vista ravvicinata p95 18,2 ms, fotogramma peggiore dopo il ripristino 36,1 ms.

Limiti. **La memoria è risalita**: heap dopo la raccolta 102,6 MB nel benchmark (79,4 prima di questo passo), 106,7 MB alla vista più ampia su Schamann (88,5), 98,2 MB alla vista più ampia sul centro, 78,5 MB da vicino a San Juan. Il guadagno del passo precedente è quasi tutto speso: le viste ampie sul centro ora caricano zone piene dove prima erano vuote. El Secadero e Lomo Verdejo (0,21 km²) restano fuori perché non toccano l'area coperta. Il bordo sud segue i perimetri comunali ed è frastagliato, con alcune punte sottili. Mancano le tessere LiDAR 454-3112, 455-3107 e 457-3106 (24 edifici in tutto). Nessun luogo nel menu e nessun modello dedicato nei barrios nuovi. Nessuna prova su telefono fisico; guida nei barrios nuovi non provata a mano.

## Anello sud ed El Secadero (23 novembre 2026)

Aggiunti Casablanca I, Pedro Hidalgo, Tres Palmas e Hoya de La Plata a sud di Zárate e San Cristóbal, più El Secadero, che ora tocca l'area coperta. El Secadero appartiene a un'altra entità del servizio comunale (Tafira, `ENTS_CO_ID` 50): una zona `municipal` può indicare `entity`. Lomo Verdejo (0,03 km²) resta fuori perché dista 80 m dall'area coperta. La finestra di acquisizione scende a 28,02° N per avere la linea di costa oltre il nuovo bordo sud; il mare si ferma dove finisce la costa acquisita.

| | Prima | Dopo |
|---|---|---|
| Area | 33,86 km² | 36,22 km² |
| Parti di edificio | 27.086 | 28.748 |
| Strade | 8.391 | 8.702 |
| Alberi | 45.420 | 45.511 |
| Zone / settori | 66 / 747 | 75 / 805 |
| Griglia del terreno | 1.259 × 2.478 | 1.259 × 2.868 |

Dei 27.086 edifici precedenti, 27.078 sono identici. Gru e ciminiere invariate.

**LiDAR.** Cinque tessere nuove (49 in cache, tutte lette fino in fondo). Misurati 27.118 edifici su 28.748: scarto mediano +0,53 m, 65,7 % entro 2 m, 90,2 % entro 5 m. Esportate 37 altezze dove manca il dato comunale, 5 parti basse e 3 alte. In città 887 parti hanno altezza dal LiDAR e 143 restano stimate a 9 m.

**Forma.** L'anello sud non rende la città più quadrata: la allunga. A sud di La Isleta l'area riempie circa il 63 % del proprio inviluppo convesso (67 % dopo il solo vuoto centrale, 51 % prima). Tra El Secadero e Pedro Hidalgo resta un'insenatura: lì c'è il «Diseminado de Tafira» (6,6 km², campagna).

**Verifiche** su una copia pulita: `typecheck`, `build`, `check-data.mjs` e `npm.cmd test` per intero verdi. `qa-sectors.mjs`: quattro esecuzioni verdi su cinque; quella fallita è avvenuta a macchina molto occupata e non ne ho conservato il registro, le tre successive sono verdi.

Telefono emulato (mediana / p90, triangoli): Pedro Hidalgo (-1250, -4150) da vicino 18,0 / 18,1 ms, 56.019 e alla distanza massima 18,0 / 18,1 ms, 89.598. Heap: 62,5 MB da vicino a Pedro Hidalgo, 110,4 MB alla vista più ampia su Schamann (106,7 prima). `benchmark.mjs` a macchina occupata, in alternanza con il commit precedente: heap dopo la raccolta 106,5 MB contro 102,5; apertura 8,7-10,3 s contro 11,0-12,4; fotogramma peggiore dopo il ripristino 107 ms contro 106-125. I tempi non distinguono i due commit e non valgono come misura assoluta.

Limiti. La memoria continua a salire con l'area: 106,5 MB dopo la raccolta nel benchmark. I tempi di questo passo sono stati presi con la macchina molto occupata (anche la build ha impiegato il triplo): vanno rimisurati. Mancano le tessere LiDAR 454-3112, 455-3107 e 459-3104 (11 edifici). Bordo sud frastagliato, con la striscia costiera di Hoya de La Plata che sporge. Nessun luogo nel menu nei barrios nuovi. Nessuna prova su telefono fisico; guida nei barrios nuovi non provata a mano.

## Apertura fallita su telefono: limite di tempo e fase a schermo (23 novembre 2026)

Segnalazione di Luca: sul telefono la pagina pubblicata carica lenta, non risponde e poi mostra «No se pudo abrir el mapa». Causa trovata: la pagina interrompeva l'apertura dopo 25 secondi in tutto. Con la città a 36 km² un telefono emulato con CPU sei volte più lenta impiega da 15 a 25 secondi, secondo il carico della macchina di misura: un telefono vero può superare il limite senza che niente sia rotto.

- **Limite sullo stallo, non sul totale** (`index.html`): l'apertura fallisce solo dopo 45 secondi senza alcun progresso. Ogni passo riarma il limite (`atlas:boot-progress`).
- **Fase a schermo** (`main.ts`): davanti alle attribuzioni, che restano visibili, una nota dice quale passo è in corso e da quanti secondi: i file ancora in scaricamento («Descargando: ciudad y terreno, city-index…»), «Preparando la ciudad», «Preparando la vista», «Cargando el barrio», «Cargando los edificios». In caso di errore la nota resta: «Error en: <fase> · <messaggio>» oppure «Sin avance en: <fase>». Sparisce a mappa aperta.

Tempi delle fasi con CPU 6× più lenta (telefono emulato, rete locale): dati 2,4 s; preparazione della città 3,3 s; preparazione della vista 5,4 s; barrio 1,4 s; edifici 1,8 s; totale 14,3 s. La pagina pubblicata serve i dati iniziali compressi: 2,8 MB in tutto (terreno 1,0 MB, città 1,2 MB, indice 0,4 MB).

`typecheck`, `build`, `npm.cmd test` e `qa-boot.mjs` (tre esecuzioni) verdi su una copia pulita. `qa-boot.mjs` aggiornato in due punti: il limite atteso è 45 s e, a scheda visibile, i timer armati sono almeno uno.

Limiti. Non ho riprodotto l'errore su un telefono vero: la causa è dedotta dal limite di 25 s e dai tempi con CPU rallentata. Se sul telefono compare «Error en: …», la causa è un'altra e la nota dice in quale fase. L'apertura non è più veloce di prima: durante «Preparando la ciudad» e «Preparando la vista» la pagina resta occupata e non risponde. Il lavoro da spostare fuori dall'avvio è elencato in PERFORMANCE.md.

## Avvio più rapido (23 novembre 2026)

Due cambi in `main.ts`, misurati su telefono emulato con CPU 6× più lenta, tre aperture per versione in alternanza:

- **Guida e pedoni dopo l'apertura.** Il mondo di guida e i pedoni non si costruiscono più prima della prima immagine ma nel primo momento libero dopo l'apertura (`requestIdleCallback`, al più tardi dopo 4 s). Se si preme Play prima, li costruisce Play.
- **La mappa si apre con il quartiere pronto.** Prima aspettava anche il dettaglio del primo settore; ora quel dettaglio entra in dissolvenza subito dopo, come nel resto della città.

| | Prima | Dopo |
|---|---|---|
| Mappa aperta e utilizzabile | 13,2 - 13,9 s | 9,8 - 11,2 s |
| Dettaglio completo a schermo | 22,5 - 22,8 s | 21,7 - 23,3 s |

`typecheck`, `build`, `npm.cmd test`, `qa-sectors.mjs` e `qa-boot.mjs` (tre esecuzioni) verdi su una copia pulita. `qa-boot.mjs` aggiornato: la mappa può aprirsi mentre il dettaglio del primo settore è ancora in arrivo.

Limiti. Il tempo fino al dettaglio completo non cambia. La costruzione di guida e pedoni dopo l'apertura occupa la pagina per circa un secondo con CPU 6× più lenta: un gesto in quel momento può scattare. Restano prima dell'apertura la texture di suolo dell'intera città (1,3 s), l'attesa della GPU (circa 2 s) e la lettura dei JSON. Tempi da CPU rallentata su desktop, non da un telefono vero.

## Toponimi in Conducir

Il nome del quartiere di partenza compare all’inizio di ogni partita, se il punto di partenza è coperto dai dati. Usa la stessa dissolvenza dei cambi di quartiere.

L’audit della HUD ha verificato l’occupazione del margine alto da parte di statistiche e controlli e l’attribuzione OSM nascosta durante la partita. La via usa il centro su desktop e una riga sotto i controlli su schermi stretti. Il nome del barrio compare in una regione di stato per 5 s, dissolvenze incluse. L’attribuzione resta visibile in guida.

Il controllo gira ogni 140 ms. Il nome della via richiede 400 ms di conferma, il quartiere 700 ms. Agli incroci contano distanza e allineamento con la marcia. I test verificano l’incrocio fra una via con nome e una senza nome, una corrispondenza ambigua, i POI reali di Vegueta e Triana e un attraversamento del confine annullato prima della conferma. Il dataset locale copre i 12 confini OSM presenti nel catalogo.

Replay con coordinate stradali reali in Chrome a 1440×900, 390×844 e 844×390. Da Calle Mayor de Triana a Calle Pelota compare una sola volta «Vegueta». Il titolo termina, la via si svuota fuori copertura e la HUD sparisce tornando alla mappa. I due nomi usano testo avorio con un contorno verde scuro e restano distinti dai comandi in tutti e tre i formati.

`typecheck`, build e suite Playwright desktop/mobile passati. La suite completa è stata ripetuta su una build isolata dopo un errore di servizio dei settori nella build condivisa.

## Cattura in Conducir

`npm.cmd test` copre la cattura durante una partita reale, il blocco di monete, tempo e record, il focus sul pulsante di riprova e il recupero WebGL a sequenza iniziata. Un campione della scena a fine cattura verifica che i canali RGB coincidano e che il colore torni al riavvio. La prova mobile ruota lo schermo con l'esito aperto, controlla lo spazio sopra le attribuzioni e usa il pulsante della mappa dopo una seconda cattura. Impostare `QA_SCREENSHOT_DIR` per salvare fuori dal checkout le schermate desktop, mobile verticale e orizzontale.

`typecheck`, `build` e `npm.cmd test` passati. Schermate controllate in Chrome a 1440×900, 390×844 e 844×390. Titolo, statistiche e pulsanti lasciano libera l'area centrale attorno all'auto. In una cattura campionata sul lungomare, l'auto si è assestata di circa 45 cm dopo il contatto e il punteggio è rimasto fisso per tutti i 117 fotogrammi osservati. La verifica mobile è in emulazione.

### Desaturazione CSS e titolo

Sul pilota in Chrome con emulazione mobile a 390×844, tre prime catture dopo caricamenti nuovi hanno registrato 17,8, 18,1 e 18,2 ms al primo fotogramma filtrato. Il valore precedente era circa 897 ms. Durante la transizione le mediane erano tra 17,6 e 18,0 ms. La desaturazione ha creato zero programmi WebGL in tutte e tre le prove, rispetto ai 14 del passaggio precedente. In una prova titolo e pulsanti sono comparsi insieme a circa 844 ms dalla cattura, dopo un ritardo successivo all'avvio del filtro. Nelle altre due sono comparsi separatamente, nei primi fotogrammi utili dopo le rispettive soglie.

`typecheck`, `build` e `npm.cmd test` passati. La suite controlla la pausa della desaturazione a scheda nascosta e con WebGL interrotto, la rimozione del contorno del titolo e il ripristino del filtro al retry e all'uscita. Schermate controllate su desktop e in emulazione mobile, in verticale e orizzontale. L'emulazione desktop non riproduce il font di sistema Android. La verifica sul dispositivo resta aperta.

## Preloader della mappa

La città scarica core, indice e terreno in parallelo. Fino all’apertura lo streamer dà priorità alla zona centrale e, a zoom ravvicinato, al settore visibile più vicino al bersaglio. La dissolvenza dura 260 ms e parte dopo il frame con il dettaglio assestato. Il livello di riserva può entrare dopo quattro secondi dal primo frame di base. In quel caso Play attende le collisioni della zona. Il retry per un errore essenziale ricarica lo stesso URL.

`node scripts/qa-boot.mjs` verifica l’ordine delle richieste, la schermata ancora visibile a zona o settore sospesi, le attribuzioni e il focus da tastiera, l’apertura di riserva con Play in attesa, il retry dopo un errore del modulo, i dati essenziali mancanti, WebGL indisponibile e il ripristino del contesto. Passati anche `typecheck`, `build`, `npm.cmd test`, `qa-sectors.mjs`, `qa-recovery.mjs` e `qa-editor.mjs`.

Nel test locale a cache fredda che sospende e rilascia le richieste, la mappa è interattiva dopo 6,46 s a 1440×900 e 3,64 s a 390×844 emulato. Il primo frame dopo Play arriva rispettivamente in 547 ms e 461 ms. I traguardi `atlas:startup-*` e la misura `atlas:play-first-frame` sono leggibili nella User Timing API del browser. Il confronto a cache fredda in Vite dev, con due prove per variante e per viewport, non mostra un guadagno ripetibile per il warm-up della scena con `compileAsync()`. Il pre-bake di costa e panoramica resta una prova separata.

### Fluidità e recupero

Il test trattiene il modulo d’ingresso e verifica che core e terreno inizino a scaricarsi durante l’attesa e che ciascun file sia richiesto una sola volta. La suite è passata anche dalla build servita sotto `/atlas/`. Con il core ancora in attesa, il completamento dell’indice ha fatto passare l’anello dal 30 al 36 per cento, con un valore visivo intermedio campionato dopo 80 ms. Il dettaglio iniziale viene disegnato direttamente al livello finale finché il preloader copre la scena. Le transizioni visibili dello streaming usano la dissolvenza esistente.

Un HTTP 503 isolato viene recuperato con un secondo tentativo dopo 200 ms. Due fallimenti portano a `Reintentar`. Il test verifica anche che il limite di avvio sia sospeso con la scheda in background. Se il contesto WebGL si perde durante la dissolvenza, il preloader torna subito opaco e l’anello diventa indeterminato fino al recupero. Il confronto dei tempi tra singole esecuzioni in Chrome headless varia da un profilo all’altro. La prova su telefono fisico resta aperta.

### Revisione anti-slop del preloader

Un solo anello. Ruota mentre il progresso è ignoto e interpola i traguardi reali quando iniziano ad arrivare. Le attribuzioni restano visibili durante il caricamento e sulla prima vista. Il test verifica che il primo comando sposti i crediti in «Licencias de datos» e che la barra resti assente in guida e al ritorno sulla mappa.

Con touch emulato in Chrome, il test verifica che gli eventi di selezione e menu contestuale siano annullati, che un gesto in guida lasci fermo lo scroll della pagina e che il menu dei luoghi continui a scorrere. Trascinamento e pinch muovono la mappa con la pagina ferma alla scala iniziale.

## Mare aperto

`python scripts/data.py sea` rigenera `sea.json` dagli estratti OpenStreetMap. Due generazioni hanno prodotto lo stesso file. La superficie di mare aperto copre 128,12 km². Il confronto geometrico con il file precedente ritrova gli 11 bacini e tutta la superficie già disegnata entro 0,04 m² di arrotondamento. La generazione verifica che l’oceano non invada la terra classificata nella finestra di acquisizione.

Con Chrome a 1440×900 e in emulazione mobile a 390×844 e 844×390, confronto a parità di posa a La Isleta, Las Canteras e San Cristóbal allo zoom minimo. Il taglio in mare aperto scompare in tutte e quattro le rotazioni provate per ciascuna inquadratura. Nei quattro campioni al largo di La Isleta e Las Canteras, i pixel beige del fondo scendono a zero. Schiuma e fondali restano visibili lungo la costa cartografata. La prova mobile è in emulazione.

Nella finestra quadrata da 1000×1000 con il bersaglio al limite ovest e allo zoom minimo, il margine di 2.800 m elimina anche il triangolo residuo nell’angolo in basso a sinistra. Il campione di quell’angolo passa da 146 pixel beige con il margine di 2.350 m a zero, anche dopo la rotazione.

`npm.cmd run typecheck`, `npm.cmd run build` e `npm.cmd test` passati sulla versione finale. Il primo giro della suite si era fermato dopo 120 secondi in attesa della seconda cattura nella guida mobile. I due giri successivi sono passati.

## Refactor senza cambi di resa (23 novembre 2026)

Tre commit (`bb68754`, `1345f97`, `52e544b`) riorganizzano il codice senza toccare comportamento, dati o taratura.

- **`drive.ts` da 735 a 602 righe.** Estratti `drive-tune.ts` (`TUNE`, `CAPTURE`, costanti dei pool), `drive-types.ts`, `drive-effects.ts` (sgommate, polvere, fumo, sbuffi, scintille) e `drive-crowd.ts` (disegno dei pedoni). `drive.ts` riesporta `TUNE`.
- **`main.ts` da 498 a 427 righe.** Estratti `boot.ts` (fase, progresso, errore e nota di avvio) e `map/framing.ts` (orientamento, adattamento al contorno, zoom minimo e di apertura).
- **Funzioni condivise.** `src/geometry.ts` sostituisce quattro copie del calcolo dell'angolo in ±π e due del punto dentro un poligono. La versione di `pilot-edits` non chiudeva l'anello; gli anelli dell'editor sono già verificati chiusi, quindi l'esito non cambia. `scripts/geo.py` porta l'origine della mappa e i convertitori EPSG:32628/4083 dei cinque script Python. `scripts/qa-browser.mjs` raccoglie avvio del browser e server della build dei 12 script browser; `CHROME_PATH` permette di usare un Chromium diverso da Chrome.
- **`src/editor/main.ts` non toccato.** Selezione, trascinamento e annulla condividono stato in un'unica funzione: estrarre l'input richiede prima un oggetto di stato.

**Verifiche (Linux, Chromium di Playwright, WebGL software).**

- Typecheck e build superati.
- `qa-drive-pose`, `qa-drive-camera`, `qa-drive-route`, `qa-pedestrians`: valori identici a prima (60 km/h a 1,442 s, 90 a 5,442 s / 96,5 m, frenata 0,933 s / 11,5 m, pedone più vicino 5,14 m). `qa-drive-location` non stampa nulla, come prima.
- Origine calcolata con `geo.py` identica a quella precedente in EPSG:32628 e 4083. Gli script Python compilano ma non sono stati rieseguiti sui dati: qui mancano `.cache` e le dipendenze geografiche.
- Prova manuale nel browser, prima e dopo: rotazione (0° → 90°), zoom (3,11 → 4,00) e reset (0,33) danno gli stessi valori; Conducir parte con 40 pedoni e nessun errore in console.
- Con `CHROME_PATH`: `qa-boot` e `qa-recovery` superati.
- `qa-main-lod` fallisce qui sia con lo script nuovo sia con quello precedente, in punti diversi da un giro all'altro: dipende dai tempi del WebGL software, non dal refactor. Da ripetere con Chrome su Windows.
- `npm test` completo non eseguito.

## Conducir senza polizia (23 novembre 2026)

`?nopolice` nella querystring avvia Conducir senza pattuglie: nessuna cattura, la corsa continua finché si esce. Monete, destinazioni e pedoni restano attivi. In Chromium (WebGL software), dopo 4 s di guida: 1 pattuglia senza parametro, 0 con `?nopolice`, nessun errore in pagina. Typecheck e build superati.

## Rotazione delle monete (23 novembre 2026)

Segnalato da Luca su telefono: le monete sembravano ruotare male. Ogni moneta era un disco verticale che girava attorno all'asse verticale del mondo; viste dall'alto non mostravano mai la faccia intera (circa due terzi dell'altezza in vista isometrica, meno della metà in vista aerea) e a ogni mezzo giro diventavano una lineetta. Ora girano attorno all'asse verticale dello schermo e a inizio giro guardano la camera: la faccia arriva intera in tutte e tre le viste. Fase sfalsata fra monete e saltello invariati. Catture in Chromium (390 × 700, touch) prima e dopo nelle tre viste; typecheck e build superati.

## Hit-stop raddoppiati (23 novembre 2026)

Su richiesta di Luca, che sul telefono non li notava, tutti i fermi durano il doppio: urto forte 110 ms (`stopWall`), arrivo a destinazione 100 ms (`stopArrive`), cattura 220 ms (`stopCaught`). Le monete singole restano senza fermo, come da `docs/JUICE.md`. Intervallo minimo fra due fermi da urto invariato a 0,6 s. In Chromium con frenata tenuta la cattura arriva dopo 19 s e registra il fermo, senza errori in pagina. Typecheck, build, `qa-drive-pose` e `qa-drive-camera` superati.

## Goccia della destinazione con la distanza (23 novembre 2026)

Segnalato da Luca su telefono: la ficha gialla «01» con la freccetta non si capiva. Ora è una goccia turchese (`#3cc9b8`, condiviso solo con il fascio di luce) la cui punta indica il luogo, verso il basso quando è inquadrato. Dentro c'è la distanza in linea d'aria: «4.3km», sotto i 995 m «850m» a passi di 10 m. A ogni nuova meta durante la corsa la goccia vola dall'auto al suo posto in 0,45 s; all'ingresso in guida no, perché la camera sta ancora planando dalla mappa e il volo partiva da fuori schermo. Margini allargati: la goccia, più grande, toccava la zona tattile destra e la punta sfiorava il pulsante di uscita.

In Chromium (390 × 780, touch, `?nopolice`): distanza che scende in modo regolare (90 → 70 → 50 → 30 m) e passaggio a km sopra i 995 m; volo registrato fotogramma per fotogramma (scala 0,5 → 1) e assente all'ingresso; nessuna sovrapposizione con statistiche, uscita e zone tattili; nessun errore in pagina. Una distanza lungo le strade è stata provata e scartata: saltava da 1,1 a 2,7 km in un secondo e mezzo. Il volo all'arrivo non è stato catturato a schermo: guidando a caso non si raggiunge una meta. Typecheck e build superati.

## Luoghi nei quartieri nuovi (23 novembre 2026)

Ciudad Alta, riscos e barrancos, anello sud e Alcaravaneras non avevano luoghi: la scia di Conducir non ci portava mai. Uno scan dei poligoni OSM con nome (parchi, chiese, mercati, impianti, piazze, monumenti) sui barrios scoperti ha dato i candidati; scelti luoghi riconoscibili, scuole escluse. Ogni way è stata riletta per intero dall'API OSM: poligono valido, nome OSM identico a quello del catalogo, punto interno nel barrio atteso e dentro `city-aoi.geojson`.

| # | Luogo | OSM | Barrio |
|---|---|---|---|
| 17 | Parque de La Ballena | way/583818223 | Escaleritas |
| 18 | Parque de Las Rehoyas | way/787583937 | Las Rehoyas |
| 19 | Mercado de Altavista | way/204791336 | Altavista |
| 20 | Castillo de San Francisco | way/251520472 | San Francisco - San Nicolás |
| 21 | Cementerio Inglés | way/251568732 | San Juan - San José |
| 22 | Parque Gloria Fuertes | way/582922523 | Casablanca III |
| 23 | Iglesia San Francisco Javier | way/845103711 | Pedro Hidalgo |
| 24 | Parque Antiguo Estadio Insular | way/583766587 | Alcaravaneras |
| 25 | Real Club Náutico | way/265775327 | Alcaravaneras |

Scartati dopo la cattura: Estadio de Gran Canaria (San Lázaro) e Castillo de Mata, perché lì la mappa mostra solo terreno; servirebbe un modello dedicato. Tres Palmas, Hoya de La Plata ed El Secadero non hanno poligoni con nome utili in OSM.

`poi.geojson` è stato aggiornato qui riproducendo il calcolo di `data.py` (punto interno del poligono, stessa origine e proiezione) sui dati OSM correnti, perché la sessione non ha la cache della pipeline: i primi 16 luoghi sono identici byte per byte. Al prossimo `python scripts/data.py city` i punti verranno dall'estratto in cache e possono spostarsi di poco. In Chromium: menu e segnaposto contano 25 voci, la mappa vola su ogni luogo nuovo e la scheda mostra il nome, nessun errore in pagina. `check:data`, typecheck, build e `qa-drive-route` superati.

## Modelli dedicati: Estadio de Gran Canaria e Castillo de Mata (23 novembre 2026)

Nessuno dei due è nello strato edifici del Comune: per questo lì la mappa mostrava terreno vuoto. Nuova voce di catalogo `osmBuildings` (impronta da OpenStreetMap, altezza dichiarata) letta da `scripts/osm_buildings.py` in `data.py`; id negativi per non incontrare gli OBJECTID comunali. `scene.ts` e `overview.ts` scelgono colori e dettagli dal valore assoluto dell'id: con un id negativo l'indice della palette non esisteva e muri e tetti uscivano bianchi.

- **Estadio de Gran Canaria** (way/838329801, `building=stadium`, 38.084 m², il campo è già fuori dall'impronta): base estrusa a 4 m, gradinate che salgono dal bordo del campo a 20 m sul muro esterno, campo verde al centro. La base parte dalla quota del primo vertice come l'estrusione: con la quota del centro lo stadio, in pendio, copriva le gradinate. Le coperture parziali delle tribune non sono disegnate: la loro estensione non è mappata.
- **Castillo de Mata** (way/182801321, recinto `historic=castle`, 7 m, merli come il Castillo de la Luz con la stessa funzione) e il corpo interno (way/251520474, 10 m).

Altezze stimate, da misurare con `lidar-check.py`. Anteprima in Chromium su una copia locale: `city.json` con i tre edifici aggiunti dalla stessa funzione di `data.py`, `sectors.py` con un atlante dei tetti neutro al posto dell'ortofoto (2 min 10 s, 28.751 parti), catture da due distanze e due orientamenti, nessun errore. Copia e atlante scartati: i dati pubblicati non sono rigenerati. I due luoghi restano nel catalogo ma fuori da `poi.geojson` finché non si rigenera, per non puntare a terreno vuoto. Typecheck, build, `check:data`, `qa-drive-route`, `qa-drive-pose` e `qa-pedestrians` superati.

## Schede dei luoghi (24 novembre 2026)

Scheda con foto, quartiere, nome, testo e link per i luoghi con un blocco `card` nel catalogo; proposta approvata da Luca con queste scelte: pannello a sinistra, testi di 400–600 caratteri, link al sito ufficiale quando esiste e altrimenti a Wikipedia in spagnolo, prima quattro luoghi completi. Animazioni con `element.animate`, senza GSAP né altre dipendenze.

- **Contenuto.** Plaza de Santa Ana (498 caratteri), Casa de Colón (556), Teatro Pérez Galdós (531), Mercado de Vegueta (478). Fatti riletti sulle voci di Wikipedia in spagnolo: la bozza della proposta diceva che i perri della plaza sono di bronzo, sono di ghisa dipinta di verde, collocati nel 1895. Per il mercato resta la sola data di inaugurazione (1858): l'anno di costruzione differisce tra le fonti. Foto da Wikimedia Commons, da 57 a 111 KB, crediti in `DATA_SOURCES.md`.
- **Build.** `check:data` rifiuta testi fuori da 400–600 caratteri e foto mancanti.
- **Disposizione**, in Chromium con WebGL software. 1280 × 800: pannello di 376 px a sinistra, marker a x = 835, cioè al centro della parte libera. 390 × 844: foglio fino al 70 % dell'altezza, testo che scorre con il link sempre in vista, marker sopra il foglio. 844 × 390: foto accanto al testo. In tutti e tre il quartiere («Vegueta», «Triana») arriva da `barrios.json`.
- **Movimento.** Animazioni fermate a 120, 380 e 700 ms: la foto si scopre dall'alto, il nome sale parola per parola, testo e link seguono.
- **Comportamento.** Muovere la mappa sul telefono piega il foglio nella pillola; un tocco lo riapre. Chiusura con × ed Esc. Un luogo senza `card` (Parque de San Telmo) mostra la pillola di prima. `article h3` contiene ancora il nome intero. Nessun errore in pagina.

Typecheck, build, `qa-drive-pose`, `qa-drive-route` e `qa-pedestrians` superati. Non provato su telefono fisico; trascinamento della foto verso il basso non provato con un dito vero.

`npm test` con `CHROME_PATH` qui non arriva alle schede: dopo le prove di guida, pedoni e suolo (superate) si ferma alla riga 49 di `qa.mjs`, in attesa che i settori iniziali finiscano di caricarsi entro 30 s, prima di toccare un luogo. Due giri, stesso punto. È il caricamento sotto WebGL software; non è stato confrontato con il commit precedente. Da ripetere con Chrome su Windows.

## Camera della mappa condivisa, zoom verso il cursore, scivolata e offset della scheda (24 novembre 2026)

`MapControls` al posto di `OrbitControls` configurato a mano; camera ortografica, bordi in pixel, distanza e angolo comuni a mappa, guida, editor e laboratori (`src/render/map-camera.ts`); la scheda del luogo sposta l'immagine con `setViewOffset` invece di spostare il bersaglio; smorzamenti della camera di guida esponenziali al secondo. Contratto aggiornato in [CAMERA_FRAMING.md](CAMERA_FRAMING.md).

- **`qa-map-camera.mjs` (nuova, inclusa in `npm test`).** Geometria dell'offset: il bersaglio cade esattamente allo spostamento chiesto e il punto ricalcolato al centro dello schermo cade al centro (errore < 1e-6 px). Smorzamento identico dopo 1 s a 30, 60 e 144 fps. Nel browser, 1440 × 900: la rotellina tiene fermo il punto sotto il puntatore (scarto < 3 px), la mappa scivola dopo il rilascio e poi si ferma, Plaza de Santa Ana finisce al centro della parte lasciata libera dal pannello (< 3 px) e ci resta dopo una rotazione e dopo `+`, la chiusura della scheda non muove l'immagine (< 1,5 px) e `data-view` resta uguale. Superata.
- **`qa-drive-camera`, `qa-editor`, `qa-drive-pose`, `qa-drive-location`, `qa-pedestrians`, `qa-ground`:** superate.
- **`qa.mjs`, desktop**, in Chromium con WebGL software e attese allungate: superata tutta la parte mappa (vento a mappa ferma, quattro scatti con centro e zoom invariati, panoramica, trascinamento, rotellina, scheda di San Telmo con rotazione e cambio di orientamento senza cambiare `data-view`, tre perdite di contesto, ricarica con Santa Ana). Nella guida si ferma a due attese legate al tempo reale: la cattura entro 120 s e il riepilogo `#over` non ancora visibile subito dopo la perdita del contesto. Tempo di cattura misurato due volte per build: 224 e 71 s sul commit precedente, 53 e 183 s su questo; il limite si supera su entrambe.
- **`qa.mjs`, telefono 390 × 844**: superata fino in fondo (mappa, scheda, pizzico, perdita del contesto, ricarica, guida, cattura, ritorno) dopo due interventi. Il primo è nel codice: `#status` sta sopra la scheda (`z-index: 5`), perché il foglio copriva «Recargar». Il secondo solo nella copia locale della prova: chiudere la scheda ripristinata prima di Play, che il foglio copre. Il secondo punto resta aperto, vedi `PROGRESS.md`.
- **Catture**: marker del Teatro Pérez Galdós centrato sopra il foglio sul telefono; inquadratura di guida invariata.

Non provati su telefono fisico: scivolata dopo il trascinamento e pizzico verso il punto indicato.

**Correzione: la mappa inseguiva il dito.** Lo smorzamento di three.js (`enableDamping`) applica solo `dampingFactor` di ogni spostamento per aggiornamento, circa il 10% con il valore usato: durante il trascinamento la mappa restava indietro e recuperava dopo. Ora lo smorzamento è spento e la scivolata parte al rilascio dalla velocità misurata (`coast` in `src/main.ts`). In più, col dito il pan di three.js spostava il terreno del 73% in verticale (seno dell'inclinazione); `GroundControls` lo compensa. `qa-map-camera` controlla ora che il marker si muova quanto il mouse (60, 80 px) e quanto il dito consegnato dal browser, con 96 px in verticale, e la scivolata dopo un colpo di dito a 60 Hz con tempi espliciti. Tre giri su tre superati; `qa-editor` e `qa-drive-camera` superati. Le tracce dei controlli mostrano gli otto passi del dito applicati tutti e uguali: gli scarti visti in un primo momento venivano dalla prova, che leggeva il marker prima del fotogramma successivo.

**Seguito: pedoni.** Rotazione verso la direzione di marcia o di fuga (`pedestrians.ts`), comparsa e salto nella vista (`drive-crowd.ts`) usano `approach` al posto di `min(1, dt·k)`: erano gli unici smorzamenti legati al `dt` del fotogramma. Sterzo, beccheggio in frenata e presa di auto e pattuglie restano come sono, perché `drive-physics.ts` gira già a passo fisso di 1/120 s. `qa-pedestrians` (più vicino a terra 5,14 m, margine 2,3 m), `qa-drive-pose` (stesse misure: 60 km/h a 1,442 s, frenata 0,933 s / 11,5 m), `qa-drive-camera`, `qa-drive-location`, typecheck e build superati.

## Spiagge e Paseo de Las Canteras (24 novembre 2026)

Segnalato da Luca con due fotografie: a Las Canteras non si capiva che c'è una spiaggia né il lungomare. La mappa colorava il suolo solo per parchi, piazze e strade; la sabbia aveva il beige del terreno e il paseo era una linea pedonale di 2,2 m quasi dello stesso colore.

- **Dati.** Quattro aree OSM `natural=beach`: Playa de Las Canteras (way/30598416, 172.087 m² sulla terraferma), Playa de Las Alcaravaneras (way/30663319, 34.707 m²) e due minori presso El Rincón (way/585702774 e 585702820). `data.py` ora le scrive come superfici `beach`. Qui, senza cache della pipeline, sono state aggiunte a `city.json` con la stessa regola a partire dall'OSM di oggi, e `sectors.py` è stato rieseguito con le piastrelle dei tetti pubblicate: cambiano `city-core.json`, `city-index.json` e 56 settori su 805, nessun file dei tetti né delle zone.
- **Resa.** Sabbia `#e4cf9d` con increspature; Paseo Las Canteras (2 km in OSM, già nei dati con il suo nome) largo 9 m in terracotta `#b9755c` con fascia chiara, dalle fotografie di riferimento. La Barra era già disegnata dal mare.
- **Luogo.** «Playa de Las Canteras» nel catalogo e in `poi.geojson` (26 luoghi), senza scheda per ora: le fotografie inviate non hanno una licenza nota.
- **Catture** in Chromium: vista ampia a 1280 × 800, dettaglio a 390 × 844 sul paseo, Alcaravaneras. Nessun errore in pagina. `check:data`, typecheck, build, `qa-drive-route`, `qa-pedestrians` e `qa-drive-pose` superati.

Limiti: ombrelloni, palme del paseo e lampioni delle fotografie non ci sono, perché OSM non li mappa come oggetti; i pedoni d'atmosfera possono camminare sulla sabbia, come nelle piazze. Non provato su telefono fisico.

## Las Arenas, ospedali e balconi di legno (24 novembre 2026)

Richiesti da Luca dopo la spiaggia. I tre complessi sono nel dato comunale, ciascuno come un blocco unico con l'altezza massima su tutta l'impronta e le finestre e i balconi di una palazzina: Las Arenas 38.925 m² a 25,9 m (OBJECTID 15839 e 15840), Hospital Doctor Negrín 37.328 m² a 28,7 m (16440), Hospital Insular 13.778 m² a 45,9 m (39612).

- **Luoghi.** Centro Comercial Las Arenas (way/33127705), Hospital Universitario de Gran Canaria Doctor Negrín (way/237094321), Hospital Universitario Insular de Gran Canaria (relation/11551897): 29 luoghi nel menu, senza scheda per ora.
- **Aspetto.** Las Arenas senza finestre; ospedali con muri bianchi e finestre senza balconi (nuovo `balconies: false`). Gli stili sono nel catalogo e, come farebbe `data.py`, in `city.json`; `sectors.py` rieseguito senza atlante dei tetti.
- **Balconi di legno.** Case fino a 15 m di Vegueta e Triana: balcone chiuso marrone con tettuccio su una casa su due, al posto del balcone chiaro su una su quattro. È un dettaglio illustrativo, non un rilievo delle facciate reali.
- **Catture** in Chromium prima e dopo sui tre complessi, su Vegueta e Triana, e un dettaglio ravvicinato dei balconi. Nessun errore in pagina. `check:data`, typecheck, build, `qa-drive-route`, `qa-pedestrians` e `qa-ground` superati.

Limiti: le volumetrie restano quelle del dato comunale. Corpi bassi e torri si possono distinguere solo con `lidar-check.py` e l'ortofoto, che richiedono la cache. Triangoli e cadenza su telefono nei settori di Vegueta non rimisurati dopo i balconi nuovi.

## Schede di tutti i luoghi (24 novembre 2026)

Aggiunte 26 schede: 30 luoghi su 31 del catalogo hanno ora testo e link, 21 anche la foto. Ricerca divisa fra tre agenti, con una regola: ogni fatto del testo accompagnato dalla frase letterale della fonte e dal suo indirizzo, autore e licenza di ogni foto letti dalla pagina del file su Wikimedia Commons. Testi fra 487 e 578 caratteri.

- **Corretto in rilettura.** Mercado del Puerto: tolta l'attribuzione ai tecnici della compagnia Eiffel, sostenuta solo da Wikipedia senza citazione. Castillo de San Francisco: tolto «hoy está en estado de abandono», senza data. Parque de Las Rehoyas: tolta la superficie, ricavata in automatico da un PDF. Date in conflitto tra le fonti lasciate fuori (apertura del Parque del Estadio Insular, ricostruzione del Castillo de Mata, inizio dei lavori del Castillo de San Francisco).
- **Foto scartate a vista.** Real Club Náutico (scattata da un'auto, mostra un cartellone) e Parque de La Ballena (mostra il viadotto e un campo di calcio, non il parco).
- **Senza foto libera adatta:** El Obelisco, Club de Natación Metropole, Parroquia de San Cristóbal, Parque de La Ballena, Parque de Las Rehoyas, Mercado de Altavista, Parque Gloria Fuertes, Real Club Náutico, Centro Comercial Las Arenas. La scheda si apre senza riquadro.
- **Senza scheda:** Iglesia San Francisco Javier. Solo dati da elenchi diocesani, e tutte le fonti collocano la parrocchia a Hoya de la Plata, non a Pedro Hidalgo: da controllare a quale edificio punta il marker.
- **Fonte unica, da rileggere:** El Obelisco (Mapping Canarias), Parroquia de San Cristóbal (un articolo di La Provincia; il tempio risulta dedicato a Nuestra Señora del Buen Viaje), Parque de La Ballena (scheda del progetto al Colegio de Arquitectos, stato al 2019). I numeri di letti e posti degli ospedali e dei mercati vengono da fonti senza data.

`check:data` e build superati. In Chromium, a 1280 × 800, tutte le 29 voci del menu aperte una per una: 28 schede con testo, foto dove prevista e dominio del link corretto, una pillola (Iglesia San Francisco Javier), nessun errore in pagina né richiesta fallita. A 390 × 844 controllate una scheda senza foto e una con foto. Nessuna prova su telefono fisico. I testi non sono stati riletti da una persona del posto.

## Passaggio sui luoghi senza modello (25 novembre 2026)

Richiesto da Luca: verificare tutti i luoghi del catalogo che non avevano un modello e dare a ciascuno una sagoma a pochi poligoni più fedele. Fonti: ortofoto SITCAN 20 cm letta a finestra (un ritaglio per luogo, con le impronte comunali sovrapposte), tag e geometrie di OpenStreetMap dagli estratti in cache, altezze comunali. Nessuna tessera LiDAR su questa macchina: ogni altezza che non viene dal Comune o da OSM è una stima dichiarata. Nessuna fotografia riprodotta.

**Nuovi modelli** (`src/render/landmarks.ts`, con gli helper condivisi `roof`, `block`, `bounds`, `eaves`, `pitched`):

- **Teatro Pérez Galdós (41435).** `split.polygon` separa la torre scenica (27 m, tetto a padiglione fino ai 30,6 m comunali, come nell'ortofoto) dalla sala, abbassata a 19 m (stima). Fronte d'ingresso sul lato opposto alla scena: tre porte ad arco e due cornici (stima da conoscenza generale, non da foto).
- **Mercado de Vegueta (41434).** Anello dei banchi a 8 m (stima) e tre navate rialzate dove le mostra l'ortofoto: due con tetto bianco a falde fino ai 13,5 m comunali, una grigia più bassa.
- **Casa de Colón (41117).** Fasce di tegole lungo tutti i muri, patii compresi. Il portale in pietra non è disegnato: la sua posizione non è verificata.
- **Iglesia de Santo Domingo (40140), Parroquia de San Cristóbal (40525), Iglesia San Francisco Javier (corpo 37217:-340:-3736), Ermita de San Telmo (40444).** Navata sotto il tetto a falde dell'ortofoto (tegole, lamiera grigia a San Cristóbal); muri abbassati (stime: 12, 12,5, 8,5 e 8 m), colmo all'altezza comunale. Campanili e facciate non disegnati: non verificabili dall'alto.
- **Parque de San Telmo.** Chiosco della musica (way 259777939, `building=roof`: colonne e tetto ottagonale verde) e chiosco modernista (way 259777937, `building=kiosk`, 1923: corpo e cupola rossa) come `osmBuildings`. Altezze stimate (6,5 e 6,4 m).
- **El Obelisco.** Way 582805814 (`man_made=obelisk`): basamento estruso e fusto rastremato fino ai 25 m del tag `height`, colore dal tag `colour`.
- **Parque Antiguo Estadio Insular.** Le due tende bianche (way 511090031 e 511090032, `amenity=shelter`) con lo stesso modello a membrana della stazione di Santa Catalina; punte a 9 m (stima).
- **Las Arenas (15839).** Le cinque piramidi di vetro quadrate sopra gli atri, sulle impronte OSM (way 1307312257-60 e 62; lato 16,2 m), alte 6 m e 9 m la maggiore (stima). Altezza del corpo: comunale.
- **Hospital Insular (corpo 39612:-315:-2492).** Eliporto sul tetto dove lo mettono OSM (way 808027654) e l'ortofoto. Il record comunale estrude tutto il corpo a 45,9 m: l'eliporto sta quindi più in alto del vero.
- **Club Metropole (30075).** `split.polygon` abbassa a 0,4 m i campi da tennis e padel scoperti, che il record comunale estrudeva a 8,5 m insieme ai padiglioni. Padiglioni chiari senza finestre.
- **Castillo de San Francisco (33451).** Solo aspetto: pietra, senza finestre né arredi di copertura.

**Acqua.** `data.py` scrive come superficie `water` ogni area OSM `leisure=swimming_pool` o `natural=water` tra 4 e 20.000 m² (308 in città); `ground-map.ts` la dipinge con `color.water` di `road-style.json`, dopo parchi e piazze. Servono Metropole, Real Club Náutico, gli stagni e le vasche del Parque Doramas. I pedoni della guida non ci camminano sopra.

**Luoghi lasciati senza modello, e perché.** Plaza de la Feria (la scultura di Galdós è un nodo OSM: nessuna dimensione mappata), Cementerio Inglés (un recinto, nessun edificio da modellare), Hospital Doctor Negrín e Mercado de Altavista (corpi di altezza diversa distinguibili solo con il LiDAR), parchi di La Ballena, Las Rehoyas e Gloria Fuertes e Playa de Las Canteras (nessuna struttura mappata). Parque Doramas riceve solo l'acqua; Pueblo Canario e Hotel Santa Catalina restano estrusioni comunali.

**Limiti.** Le fasce di tegole di Casa de Colón seguono anche i muri in comune con i vicini e fanno una punta negli angoli acuti. Il tetto dell'Ermita de San Telmo copre il rettangolo che contiene l'impronta a L. Stime da misurare con il LiDAR: tutte le altezze dei muri abbassati, le punte delle tende, le piramidi, i chioschi.

**Misure** (`node scripts/frame-profile.mjs`, telefono emulato, prima → dopo):

```
Teatro (97,-159) zoom 1.59: draw 91,1 -> 90,5; mediana 18,0 -> 17,4 ms; p90 18,1 -> 18,0 ms
Teatro zoom 0.352:           draw 155,5 -> 156,5; mediana 18,0 -> 17,7 ms; p90 18,1 -> 18,3 ms
Las Arenas (-3286,2600) 1.59: draw 79,5 -> 80,5; mediana 18,0 -> 17,4 ms; p90 18,1 -> 18,2 ms
San Telmo (-200,385) 1.59:    draw 117,2 -> 117,2; mediana 18,0 -> 17,3 ms; p90 18,1 -> 18,2 ms
```

**Prove.** `npm.cmd run typecheck` e `npm.cmd run build` passano. `npm.cmd test` si ferma a `qa.mjs` riga 181 (attesa del pinch, 30 s): è lo stesso errore già registrato su main prima di questo lavoro (allora riga 180); i controlli precedenti della suite passano. Schermate a camera identica prima e dopo per 15 luoghi (`node scripts/shot.mjs`), controllate una per una.

## Porto di Santa Catalina (24 novembre 2026)

Richiesto da Luca da una cattura sul telefono: El Muelle come blocco unico a 38 m con finestre da palazzina, Elder e Miller come condomini, barre d'asfalto radiali sul piazzale della stazione, strade che finivano in un tappo tondo. Riferimenti: ortofoto PNOA 1 m e SITCAN 20 cm (letta a finestra da remoto) sovrapposte a impronte e strade del modello; foto di Wikimedia Commons («Buildings of Elder ^ Miller - panoramio», «Museo Elder de la Ciencia y la Tecnología», «ELDER - panoramio») usate solo come riferimento, non riprodotte.

- **Strade sotto terra.** Le 20 corsie della Estación de Guaguas Santa Catalina hanno in OSM `level=-1` ma non `tunnel`: `data.py` scarta ora ogni `highway` con tutti i `level` negativi (21 way in città, 20 corsie e un marciapiede). Le strade di superficie che proseguono in un tratto sotterraneo hanno `portal: true` (177 in città) e finiscono con un taglio netto in `carriageways.py` e nel suolo raster: Avenida Marítima all'imbocco sotto il piazzale, rampe degli autobus. La rampa in trincea dentro l'isola della rotatoria è reale (way 1263512785, `cutting=yes`) e resta.
- **El Muelle (29223).** `split.polygon` (nuovo: anello in metri locali) separa dalla stecca l'atrio semicircolare e il piazzale. Stecca all'altezza comunale (38,1 m), muri chiari senza finestre. Atrio e piazzale estrusi a 6 m; `landmarks.ts` disegna la volta di vetro sul semianello (raggi 29 e 48,5 m, da 22 a 30 m), la facciata vetrata sul lato dritto e la pergola bianca a reticolo a 13 m. La torretta cilindrica resta un corpo a parte all'altezza comunale.
- **Edificio Elder (26981).** Cubo di vetro scuro a nord all'altezza comunale (19,7 m); corpo storico verde acqua con finestre e senza balconi a 11 m.
- **Edificio Miller (26979).** Muri bianchi a 9 m senza finestre; due falde rosse parallele fino al colmo comunale (13,5 m), dalla pianta dell'ortofoto.
- **Tenda della stazione.** `osmBuildings` con la way 1261817818 (`building=roof`): membrana bianca con le punte alte sugli angoli, alberi alle punte.

Stime dichiarate, da misurare con il LiDAR (su questa macchina `.cache/lidar` è vuota): piano di atrio e piazzale, volta e pergola di El Muelle, corpo storico dell'Elder, muri del Miller, punte della tenda (13 m).

**Verifiche.** `typecheck`, `build` con `check:data` verdi. Confronto di `city.json` prima e dopo: cambiano solo le 21 way sotterranee, le 177 con `portal` e i tre edifici; `roof-tones.json` cambia solo per 29223, 29223-atrio, 26981, 26981-vidrio e la tenda. Catture a camera identica (1440 × 900 a zoom 0,9 e 3,2, telefono a 1,59) prima e dopo, viste a occhio. `frame-profile.mjs` a (-1250, 4000) sul telefono emulato, commit di partenza contro questo:

| Vista | Draw call | Triangoli | Mediana / p90 |
|---|---|---|---|
| Da vicino (1,59) | 88 → 94,5 | 83.848 → 81.219 | 16,7 / 16,8 ms, invariata |
| Più ampia (0,352) | 306,5 → 308,4 | 277.592 → 279.536 | 16,7 / 16,8 ms, invariata |

`npm.cmd test`: guida, pedoni, suolo e camera della mappa superati; `qa.mjs` si ferma alla riga 180 (pinch sul telefono, `data-view` invariato entro 30 s). `qa-sectors.mjs`: il circuito dei settori passa, poi il clic su Play è intercettato dal link della scheda di Santa Ana. Entrambi gli arresti avvengono identici su una copia pulita del commit di partenza `4de5a3e`: non dipendono da questo passo.

## Ripristino della scheda e dei settori · 25 novembre 2026

Su Chrome a 390 × 844, ricaricare la mappa con Santa Ana selezionata ripristina il nome compatto. La suite verifica due percorsi con il touch: toccare il nome riapre la scheda, toccare Play dopo un nuovo ripristino entra in guida. Sul desktop si riapre il pannello laterale. Centro, zoom e orientamento salvati superano i controlli al ripristino.

Su una build di produzione isolata sono passati tre avvii consecutivi di `qa-main-lod.mjs`. Il test confronta le coordinate osservate durante la dissolvenza e dopo il recupero WebGL con quelle impostate all'inizio. Passati anche TypeScript, build con verifica dei dati, suite completa desktop e mobile e `qa-sectors.mjs` (sei giri e attraversamento del confine nei due versi con pattuglia attiva). Gli screenshot della suite sono in cache locale.

## Prestazioni in Chrome a 390 × 844 · 25 novembre 2026

Windows, Chrome headless 155, WebGL su NVIDIA RTX 4060 via ANGLE/D3D11. Tre processi browser nuovi, cache HTTP disabilitata, CPU rallentata 6×, build locale di produzione isolata. I primi due tempi decorrono dall'inizio della navigazione. L'ultima colonna misura il tempo dal primo tocco inviato dal test al cambiamento della vista.

| Apertura | Mappa interattiva | Primo trascinamento visibile | Tocco → vista |
|---|---:|---:|---:|
| 1 | 14,205 s | 15,668 s | 126 ms |
| 2 | 12,972 s | 14,437 s | 101 ms |
| 3 | 12,567 s | 14,091 s | 119 ms |
| Mediana | 12,972 s | 14,437 s | 119 ms |

Un quarto avvio con campionamento CPU attribuisce 2,77 s su 14,12 s al disegno del suolo sul thread principale, incluse le funzioni chiamate. Per la cadenza abbiamo usato `frame-profile.mjs` a velocità CPU normale, zoom 1,59 e orientamento iniziale, alternando i due luoghi. Ogni prova misura 160 fotogrammi con piccoli spostamenti di camera.

| Luogo | Mediane delle tre prove (ms) | 90º percentile delle tre prove (ms) |
|---|---|---|
| Plaza de Santa Ana | 18,1 · 17,7 · 18,1 | 18,2 · 18,2 · 18,2 |
| Iglesia de Santo Domingo | 18,1 · 18,1 · 17,3 | 18,2 · 18,2 · 18,2 |

**Guida di cinque minuti sulla build di riferimento.** Partenza a (−642,9, −820,9), destinazione Parque Antiguo Estadio Insular. In modalità `?nopolice` il percorso automatico ha coperto 3.873 m e 10 settori in 300,06 s. Su 16.871 fotogrammi la mediana è 17,9 ms e il p90 è 18,2 ms. Quattro fotogrammi superano 50 ms, il peggiore arriva a 128 ms. La traccia registrata tra il secondo 120 e il 130 cade fuori dai picchi osservati ai secondi 20, 49 e 64. Da questa corsa si ricava la frequenza degli scatti, ma la loro causa resta aperta.

**Esperimento sul suolo all'avvio.** Due copie isolate della stessa build, A con disegno sul thread principale e B con trasferimento dell'immagine da un worker. In ordine A/B/B/A/A/B, ciascuna con un nuovo browser e CPU 6×, la mappa diventa interattiva in 15,312 / 11,145 / 11,354 / 12,822 / 14,220 / 15,106 s. Mediane A e B: 14,220 e 11,354 s. Il primo trascinamento visibile passa da 15,852 a 12,754 s di mediana. Il miglioramento mediano di 2,866 s all'apertura supera la variazione di 2,490 s fra le prove di riferimento. Il campione B più lento è 15,106 s. A Santa Ana con centro e zoom identici, i limiti della texture coincidono e tutti gli 895 × 2.048 pixel hanno valori RGBA identici.

**Verifica del codice integrato e decisione.** Nel confronto alternato A/B/B/A/A/B la mappa è interattiva in 16,159 · 16,055 · 14,839 s con il riferimento e 14,678 · 15,173 · 14,444 s con il worker compilato dai sorgenti. Mediane 16,055 e 14,678 s. Per il primo trascinamento visibile i campioni sono 17,748 · 17,550 · 16,360 s e 16,314 · 16,551 · 16,047 s, con mediane 17,550 e 16,314 s. Trasferimento dell'immagine osservato in tutte e tre le aperture del candidato. Il rallentamento 6× è applicato alla pagina emulata, senza configurazione separata per il worker.

Il guadagno mediano all'apertura (1,377 s) è inferiore alla variabilità iniziale (1,638 s). Il guadagno al primo trascinamento (1,236 s) è inferiore alla variabilità del riferimento alternato (1,388 s). Il candidato è stato ritirato. Le misure P1 riguardano la build isolata basata su bed2273, precedente ai nuovi modelli dei luoghi. Consumo, calore e fluidità su telefono fisico restano da misurare.

Dopo l’arrivo dei nuovi modelli dei luoghi (f9b9da9), sulla seconda build isolata sono passati anche avvio e recupero, tre ripetizioni del test dei livelli, entrambi gli attraversamenti stradali e la suite desktop/mobile. La prima esecuzione della suite si era interrotta nella prova della fisica durante modifiche concorrenti alla guida. La stessa prova e la suite sono passate alla ripetizione.

## Guagua in Conducir · 25 novembre 2026

La linea 13 verso Tres Palmas percorre 230,8 m in Vegueta. L’importatore ha verificato il rettangolo del veicolo (7,2 × 2,2 m) lungo ogni segmento, compresi muso e coda, contro carreggiate, edifici, alberi e limite del pilota e della città. Due estrazioni dello stesso ZIP producono file identici. Un archivio invalido lascia intatto l’ultimo estratto valido.

La prova a 120 Hz usa entrambe le fermate reali. Verifica frenata, tre secondi di sosta, ripartenza e attesa al termine finché entrambi gli estremi escono dalla vista. A La Portadilla la prova ripete l’inseguimento con gli ostacoli del pilota, la fisica dell’auto e lo sterzo delle pattuglie. Il giocatore che segue la guagua resta dietro. Spostando la traiettoria di avvicinamento di 2,45 m verso sinistra, il giocatore supera il bus mentre la pattuglia entra in contatto e rallenta. Il controllo copre anche gli urti laterali e la separazione dei corpi sovrapposti.

Per ripetere i controlli dalla radice del progetto usare questi comandi.

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
node scripts/qa-guagua-browser.mjs
```

La prova browser dedicata parte vicino alla prima fermata, con le richieste esterne bloccate, su desktop e telefono emulato. Osserva entrambe le soste e ripartenze e riporta la partita all'inizio. Le catture della prima sosta sono in `.cache/qa-guaguas/`. Per una prova manuale aprire `index.html?lab=guida&area=pilot&start=-60,-818` e scegliere la vista aerea con il pulsante della camera.

[Guagua e auto alla prima fermata, vista aerea del pilota](screenshots/guagua-vegueta.png).

**Modello compatto della linea 13.** La lunghezza di collisione passa da 9 a 7,2 m. Il controllo geometrico copre i 230,8 m del percorso e il test di inseguimento verifica che il giocatore possa ancora superare il bus a La Portadilla. [Vista del modello dal lato porte](screenshots/guagua-modello.png).
