# Regole UI contro i pattern generici

Catalogo dei pattern di interfaccia da non usare in questo progetto e di cosa fare al loro posto. Va letto prima di toccare HUD, pannelli, guida ai comandi, schede dei luoghi o schermate di avvio e di errore. Ogni volta che Luca scarta un pattern, si aggiunge una voce: così non torna.

Adattato da `UI_ANTI_SLOP.md` di Soso Mart (`C:\Projects\GitHub\3dcombinisimulator\docs\`), tenendo solo ciò che vale per una mappa isometrica con una modalità di guida. Le regole di `AGENTS.md` hanno la precedenza.

La causa comune dei pattern scartati è sempre la stessa: abitudini da dashboard (schede, titoli, sottotitoli che spiegano, indicatori doppi) applicate a un gioco. Lo schermo di gioco deve sembrare parte del plastico, mostrare solo ciò che serve in quel momento e dire ogni cosa una volta sola.

## Principi

1. **Un fatto, un indicatore.** Se un valore è già a schermo (monete, tempo, direzione dell'auto) non si ripete come testo, seconda barra o etichetta.
2. **Insegnare con gli oggetti, non con le frasi.** Il gioco normale e la prima partita funzionano con icone, numeri, movimento e risposta al tocco. Niente frasi di istruzioni. Restano validi i nomi accessibili (`aria-label`, regione `role="status"`), gli errori brevi di recupero e i nomi dei luoghi, che sono contenuto.
3. **Niente narrazione degli interni.** Quale dato si sta caricando o quale settore è in arrivo va in console, non a schermo. A schermo va solo ciò che il giocatore può usare.
4. **Niente schede attorno a stati a tutto schermo.** Avvio, errore e perdita del contesto occupano lo schermo; non sono pannelli arrotondati con ombra sopra un gradiente.
5. **Niente titoli ridondanti.** Uno schermo la cui identità è già data dalla scena, dall'icona o dal contesto non ha un titolo di testo.
6. **Perdere il focus non è una pausa.** Cambiare scheda o finestra non mette un pannello "In pausa" sopra il gioco. Si annullano i tocchi in corso e basta. Una pausa chiesta dal giocatore con un comando è un'altra cosa.
7. **Icone disegnate, un solo tratto.** SVG propri nello sprite di `index.html`, tratto 2, estremità arrotondate, `currentColor`. Niente emoji o glifi Unicode al posto delle icone.
8. **La scena resta visibile.** Nessun elemento dell'interfaccia copre l'auto, le prossime monete o la pattuglia più vicina. Vedi il [contratto di camera](CAMERA_FRAMING.md).
9. **Il feedback risponde a una domanda.** Ogni effetto dice una cosa precisa: ho preso la moneta, ho urtato, sono in pericolo, sono arrivato. Due segnali per la stessa cosa sono rumore: se ne toglie uno.

## Catalogo

### Mappa: scheda del luogo (Luca, 24 novembre 2026)

La pillola con il solo nome diventa una scheda per i luoghi che hanno un blocco `card` nel catalogo: foto, numero e quartiere, nome, testo in spagnolo di 400–600 caratteri, un link esterno con il dominio scritto accanto. Pannello a sinistra su schermi larghi e sul telefono in orizzontale (dove apre già il menu), foglio dal basso sul telefono in verticale. I luoghi senza `card` tengono la pillola.

Regole fissate con Luca: curata e animata, ma senza elementi superflui. Per questo niente icone decorative, etichette, pulsanti pieni o ombre multiple: una superficie avorio, una foto, un titolo in Georgia come i nomi dei quartieri, un filo sopra il link. Il lavoro è nel movimento, in un solo gesto coordinato: il pannello entra, la foto si scopre dall'alto mentre rientra dallo zoom, il nome sale parola per parola da dietro una maschera, testo e link seguono. Una sola curva per tutto. Niente GSAP: bastano le animazioni native del browser (`element.animate`), senza dipendenze.

Sul telefono il foglio si piega nella pillola quando si trascina la foto verso il basso o si muove la mappa, e si riapre con un tocco. La scheda non compare in Conducir. Il credito della foto (autore e licenza, con link alla pagina di origine) è sempre sulla foto.

### Guida: cambio di vista

Il pulsante usa un occhio per indicare il cambio di punto di vista. La fotocamera faceva pensare a uno scatto.

### Guida: via e quartiere

Il nome della via e il titolo del quartiere stanno direttamente sul plastico. Il contorno scuro segue le lettere e le rende leggibili sui tetti chiari.

### Guida: testi nell'HUD (Luca, 21 novembre 2026)

La prima versione mostrava «12 monedas · 23.4 s · Récord 30», «→ Teatro Pérez Galdós», un suggerimento di una riga («Toca izquierda o derecha…») e un pannello «¡Atrapado!» con due pulsanti di testo. Scartato: troppo da leggere mentre si guida.

Al loro posto: pillole con icona e numero; due zone tattili che pulsano e si accendono al tocco; il numero del luogo su una ficha che punta al traguardo; i punti che saltano fuori dove si guadagnano. I nomi vanno alla regione per i lettori di schermo.

### Guida: numero del luogo sulla ficha (Luca, 23 novembre 2026)

La ficha della destinazione era un cerchio giallo con il numero del luogo nel menu («01») e una freccetta staccata. Non si capiva: il numero richiede di ricordare il menu, il cerchio sembrava un pulsante e il giallo era quello delle monete. Ora è una goccia turchese, colore usato solo da lei e dal fascio di luce, la cui punta indica il luogo (verso il basso, sul fascio, quando è inquadrato). Dentro c'è la distanza in linea d'aria, «4.3km» e sotto i 995 m «850m» a passi di 10 m. Una distanza lungo le strade è stata provata e scartata: saltava di oltre un chilometro quando l'auto si avvicinava a un'altra strada. A ogni nuova meta la goccia parte dall'auto e vola al suo posto.

### Guida: schermata di cattura

«ATRAPADO» è l'unica scritta dell'esito. Le tre icone con i valori di monete, tempo e record stanno in una riga sotto il titolo, mentre l'HUD di guida sparisce. I pulsanti a icona per riprovare e tornare alla mappa stanno sotto l'auto. Titolo e comandi sono appoggiati direttamente sulla scena, che resta visibile al rallentatore e in bianco e nero.

### Guida: indicatore tattile del freno (Luca, 22 novembre 2026)

Rimosso il pulsante centrale col simbolo del freno e la relativa animazione didattica. La frenata resta attiva tenendo premuti entrambi i lati, oppure con Spazio/Freccia giù.

### Guida: icona emoji sul pulsante (21 novembre 2026)

Il pulsante per entrare in guida usava 🚗. Le emoji cambiano aspetto da un sistema all'altro e non seguono il tratto delle altre icone. Sostituita da un'icona SVG propria.

### Guida: bordo rosso di allarme e sirena nel pannello finale (Luca, 21 novembre 2026)

Il bordo dello schermo pulsava di rosso con una pattuglia vicina e il pannello di cattura mostrava una sirena lampeggiante. Rimossi entrambi: la pattuglia si vede già in scena con i suoi lampeggianti, e la sirena ripeteva ciò che il pannello dice con la sua sola comparsa (principio 1).

### Guida: record sempre a schermo (Luca, 21 novembre 2026)

La coppa con il record stava accanto a monete e tempo durante la partita. Ora compare solo a fine partita: mentre si guida non serve a nessuna decisione.

### Guida: alone senza direzione (Luca, 21 novembre 2026)

La parte dell’auto coperta da un edificio appare in giallo sulla sua superficie. Quando sparisce anche il centro della cabina, la freccia segue il muso durante la derapata.

## Prima di consegnare un'interfaccia

- Si capisce senza leggere? Coprire i testi e provare.
- Ogni valore compare una volta sola?
- A 390×844 e in orizzontale compatto, auto, prossime monete e pattuglia più vicina restano scoperte?
- I comandi a sola icona hanno un nome accessibile, e l'esito (destinazione, cattura) arriva alla regione `role="status"`?
- Aree di tocco di almeno 40 px, contrasto di testo e numeri di almeno 4,5:1 sullo sfondo reale.
- Le attribuzioni compaiono durante il caricamento e sulla prima vista fino al primo comando. Dopo, sono consultabili in «Licencias de datos» nel menu dei luoghi. La barra di avvio non ricompare durante la navigazione, la guida o il recupero WebGL.
- I tocchi sulla mappa e sulla guida non selezionano testo, non aprono menu contestuali e non trascinano la pagina. Il menu dei luoghi resta scorrevole.

## Non deciso

- Nessuna voce aperta.
