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

### Guida: testi nell'HUD (Luca, 21 novembre 2026)

La prima versione mostrava «12 monedas · 23.4 s · Récord 30», «→ Teatro Pérez Galdós», un suggerimento di una riga («Toca izquierda o derecha…») e un pannello «¡Atrapado!» con due pulsanti di testo. Scartato: troppo da leggere mentre si guida.

Al loro posto: pillole con icona e numero; due zone tattili che pulsano e si accendono al tocco; una lezione unica sul freno dopo alcuni secondi di guida; il numero del luogo su una ficha che punta al traguardo; i punti che saltano fuori dove si guadagnano; pulsanti con sola icona nel pannello finale. I nomi vanno alla regione per i lettori di schermo.

### Guida: icona emoji sul pulsante (21 novembre 2026)

Il pulsante per entrare in guida usava 🚗. Le emoji cambiano aspetto da un sistema all'altro e non seguono il tratto delle altre icone. Sostituita da un'icona SVG propria.

### Guida: bordo rosso di allarme e sirena nel pannello finale (Luca, 21 novembre 2026)

Il bordo dello schermo pulsava di rosso con una pattuglia vicina e il pannello di cattura mostrava una sirena lampeggiante. Rimossi entrambi: la pattuglia si vede già in scena con i suoi lampeggianti, e la sirena ripeteva ciò che il pannello dice con la sua sola comparsa (principio 1).

### Guida: record sempre a schermo (Luca, 21 novembre 2026)

La coppa con il record stava accanto a monete e tempo durante la partita. Ora compare solo a fine partita: mentre si guida non serve a nessuna decisione.

### Guida: alone senza direzione (Luca, 21 novembre 2026)

L'anello che tiene visibile l'auto dietro gli edifici non diceva da che parte fosse girata. Ora porta una freccia che segue l'orientamento visivo del veicolo, anche in derapata. Vale come esempio del principio 2: l'informazione sta sull'oggetto, non in un indicatore a parte.

## Prima di consegnare un'interfaccia

- Si capisce senza leggere? Coprire i testi e provare.
- Ogni valore compare una volta sola?
- A 390×844 e in orizzontale compatto, auto, prossime monete e pattuglia più vicina restano scoperte?
- I comandi a sola icona hanno un nome accessibile, e l'esito (destinazione, cattura) arriva alla regione `role="status"`?
- Aree di tocco di almeno 40 px, contrasto di testo e numeri di almeno 4,5:1 sullo sfondo reale.
- L'attribuzione OpenStreetMap resta visibile in ogni stato.

## Non deciso

- **Pannello di cattura.** È ancora una scheda al centro dello schermo. Il principio 4 suggerirebbe di portare esito e pulsanti nella scena o lungo il bordo. Da decidere con Luca.
- **Schede dei luoghi sulla mappa.** Oggi mostrano il solo nome. Un pannello ancorato al marker con icone e messa a fuoco di elementi reali, sul modello del Context Panel di Soso Mart, è una proposta, non una decisione.
