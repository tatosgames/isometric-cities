# Vegueta + Triana in isometria
Brief operativo per Codex o Claude Code · 21 novembre 2026

## Avvio in 2 minuti

1. Crea una cartella di progetto dedicata, ad esempio `tiny-las-palmas`. Salva qui questo file come `PLAN.md`. Apri **Codex CLI o Desktop** con quella cartella come workspace, non nella home e non dentro un repo di produzione. Usa una macchina persistente con Node 24+ e Chromium/Chrome; fai lavorare l'agente in un checkout locale. Se Git non è inizializzato, può crearlo nel workspace.
2. Incolla il comando qui sotto nella sessione **interattiva**. Se `/goal` non compare, verifica la [guida ufficiale](https://learn.chatgpt.com/docs/cli/slash-commands#set-or-view-a-task-goal-with-goal) e la versione; puoi anche inviare la frase senza `/goal` come incarico normale e riprendere dal file di checkpoint. Non mettere l'intero brief nel campo Goal.
3. Mantieni permessi di scrittura limitati al workspace. Autonomia sulle scelte di implementazione, non su spese, credenziali o pubblicazione. Se la rete è bloccata, autorizza o precarica solo le dipendenze e i dati pubblici necessari, senza disattivare il sandbox.

### Goal da incollare

```text
/goal Leggi PLAN.md e realizza in questo workspace una mappa isometrica locale e navigabile del centro storico di Las Palmas de Gran Canaria, con Vegueta e Triana. Valida prima Santa Ana–Casa de Colón, poi completa l'area pilota definita nel brief. Consegna una demo procedurale basata su geodati reali, con pan/zoom mobile e desktop, sei POI verificati, attribuzioni visibili e nessuna dipendenza da tile di altre città. Verifica con test locali, screenshot e docs/QA.md; lascia comandi riproducibili e PROGRESS.md aggiornato. Correggi i problemi con iterazioni mirate. Non spendere, pubblicare, fare push o usare credenziali non autorizzate. La pittura AI non è necessaria: prepara il piano e fermati prima di chiamarla. Se un blocco impedisce il traguardo e i fallback del brief non bastano, conserva la parte utilizzabile e documenta prova, limite e prossimo passo; non dichiarare il Goal completato.
```

### Perché Codex; alternativa Claude Code

Entrambi supportano un Goal persistente nella sessione. Sceglierei **Codex** per questo repo, non perché ci sia un benchmark comparativo sul progetto: IsometricWorld istruisce direttamente gli agenti via `AGENTS.md` e il suo painter opzionale prevede già il Codex CLI. Con Claude Code puoi usare lo stesso `PLAN.md` e lo stesso `/goal`, in una sessione interattiva aggiornata; Claude può completare tutto il percorso procedurale senza lanciare Codex. Se disponibile, usa GPT‑6.2 Astra con ragionamento High; Sol High è il fallback. La scelta riguarda l'agente di sviluppo, non il modello d'immagine. Non far scrivere due agenti nello stesso checkout. Se hai già un ambiente Claude stabile su una macchina persistente, è un'alternativa valida.
[Goals in Codex](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex) · [Goal in Claude Code](https://code.claude.com/docs/en/goal).

---

## Brief per l'agente

### Risultato e stile

Costruisci una **mappa illustrata interattiva, non un poster e non un navigatore GIS**. Estetica da plastico urbano: volumi leggibili, tetti in terracotta dove appropriato, facciate color crema e pastello, vegetazione sobria, ombre morbide coerenti. Rendi riconoscibili la piazza e la Cattedrale di Santa Ana e il passaggio verso Triana. Non inventare strade, ponti, edifici, spiagge o acqua: il Guiniguada va mostrato com'è nella cartografia attuale, senza trasformarlo in un canale storico. Usa dettagli illustrativi per estetica, non per modificare la geometria. I nomi dei luoghi sono in spagnolo. Niente traffico animato, meteo, day/night, account, analytics, database o gameplay in v1.

### Perimetro e checkpoint

- **Checkpoint A**: un riquadro di circa 500–800 m su Santa Ana e Casa de Colón. Deve avere un render grezzo di riferimento e un render procedurale stilizzato con la stessa camera. Verifica i punti sulla mappa prima di estendere, senza chiedere approvazione per questa normale iterazione.
- **Consegna B**: centro storico Vegueta–Triana, da Santa Ana/Museo Canario verso Calle Mayor de Triana e Parque de San Telmo, passando per Mercado e Teatro. Ricava il perimetro dai punti verificati con un piccolo margine; non estenderlo a tutta Las Palmas. La bbox esplorativa, in ordine ovest/sud/est/nord, è `[-15.424,28.093,-15.409,28.113]` (EPSG:4326). È un limite di ricerca, non il rettangolo finale da renderizzare. Registra AOI e punti in GeoJSON WGS84 [lon, lat]; se l'adapter lavora in metri usa UTM 28N (EPSG:32628) o il riferimento metrico locale dell'upstream, non Web Mercator come metro di misura. L'array AREAS upstream ha ordine [sud, ovest, nord, est], diverso dalla bbox ArcGIS. Fissa origine, heading e scala prima dei tasselli finali.
- **Minimo sei POI**: Plaza/Catedral de Santa Ana, Casa de Colón, Mercado de Vegueta, Teatro Pérez Galdós, Gabinete Literario/Plaza de Cairasco, Parque de San Telmo. Verifica coordinate/contorno su geodati e nomi con le [fonti ufficiali per Vegueta](https://www.grancanaria.com/turismo/serviciosmultimedia/audioguias/las-palmas-de-gran-canaria/ruta-vegueta/) e [Triana](https://www.grancanaria.com/turismo/es/isla-de-gran-canaria/municipios-de-gran-canaria/las-palmas-de-gran-canaria/triana/). Opzionali: Museo Canario, Calle Mayor de Triana. Non collocare POI tramite immagini generate.
- **Fase C opzionale, non da eseguire**: piano di ridipintura per 4–9 finestre contigue attorno a Santa Ana. Non includerla nella definizione di fatto della v1; nessun acquisto o utilizzo di un servizio di generazione. Spiega come confrontare il campione con il baseline e cosa bloccherebbe l'estensione.

### Fonti, ordine e controlli

| Dato | Prima scelta | Fallback / verifica |
| --- | --- | --- |
| Edifici e altezze | [Catalogo comunale](https://datosabiertos.laspalmasgc.es/dataset/?id=ubicaciones-edificios-geoespaciales) e [layer ArcGIS](https://services-eu1.arcgis.com/eV9RayDSwR2BokOl/ArcGIS/rest/services/Building/FeatureServer/0). Poligoni, GeoJSON supportato, campo numerico nullable `MAX_BLDGHEIGHT_1`. | Nella bbox esplorativa, query pubbliche del 21 novembre: 5.216 poligoni, 5.201 con altezza positiva (99,7%). È copertura del campo, **non** validazione delle unità o delle misure. Verifica unità, range e 3–5 landmark. [Catastro INSPIRE BU](https://www.catastro.hacienda.gob.es/webinspire/) o OSM per geometria alternativa; se mancano misure usa livelli OSM o stima di classe dichiarata, mai come altezza verificata. |
| Strade, costa, aree verdi e POI | [OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL. Query stretta e cache, oppure estratto locale. | Se Overpass non risponde, usa un estratto OSM con i medesimi limiti; non interrogare ripetutamente endpoint in errore e non usare screenshot Google Maps/Earth come dati. |
| Altimetria | [IGN PNOA LiDAR/MDT](https://pnoa.ign.es/web/portal/pnoa-lidar/productos-a-descarga), preferisci un MDT nudo e ritagliato se accessibile e licenziato. | [GRAFCAN MDT25](https://datos.canarias.es/catalogos/general/dataset/modelo-digital-de-terreno-mdt-de-25x25-metros) o il Copernicus DEM già supportato dall'upstream. Documenta risoluzione e approssimazioni: non trattare un modello di superficie come terreno nudo senza controllo. |

Per ArcGIS usa `/query` con `geometryType=esriGeometryEnvelope`, `inSR=4326`, `spatialRel=esriSpatialRelIntersects`, `outSR=4326`, `f=geojson` e soli campi necessari (ID tecnico, altezza). Prima confronta il conteggio con il download, usa paginazione ordinata o query per ID se il servizio tronca, massimo 2.000 record per risposta. Non esportare in viewer riferimenti catastali o altri attributi non necessari. Conserva input e output separati, verifica coordinate invertite, CRS, geometrie invalide, duplicati e sovrapposizioni tra fonti. Non mescolare due footprint per lo stesso edificio: scegli una fonte primaria, usa l'altra per lacune documentate. Mantieni un inventario di fonti, data, licenza, geometria, unità, query/cache e fallback. Licenze e attribuzioni vanno controllate prima di qualsiasi condivisione; le condizioni sui dati e sugli asset sono distinte dalla licenza del codice. Attribuisci OSM anche nell'interfaccia.

### Stack e percorso minimo

1. Usa come base [krasun/isometricworld](https://github.com/krasun/isometricworld) e leggi il suo [AGENTS.md](https://github.com/krasun/isometricworld/blob/main/AGENTS.md). Registra la revisione Git di partenza; ispeziona scripts/config prima di eseguire strumenti di terzi. [Roma / Mondo Isometrico](https://github.com/dg996/mondoisometrico) è il riferimento estetico; [il test Pantheon](https://raw.githubusercontent.com/dg996/mondoisometrico/main/docs/sviluppo.md) non è un sostituto dei comandi upstream. [Pixel Chennai](https://github.com/rcdexta/pixelchennai/blob/main/STARTER_AGENTS.md) è utile per capire ritagli, bordi e costi, non serve aggiungere la sua pipeline Python.
2. Definisci regione/città in `pipeline/src/places.ts` e i due stadi AOI in `pipeline/src/areas.ts`. Aggiungi il tema a `pipeline/src/styles.ts` con `look: "styled"`. Ottieni prima il riferimento OSM/terreno con il percorso già esistente; innesta poi solo i dati comunali verificati. Evita di riscrivere renderer o frontend se lo stack Three.js e Astro/OpenSeadragon funziona. Se usi una pipeline locale equivalente perché l'upstream è davvero bloccato, mantieni identici i criteri di verifica.
3. Sequenza upstream da verificare sullo SHA scelto: `boundaries <region>` se serve, poi `fetch <area>` → `ground <area>` → `scene <area>` → `render <area> -j 2` → `export <area>` → viewer. Preferisci gli script workspace, per esempio `npm -w pipeline run render -- <area> -j 2`, dopo aver verificato il forwarding dal package.json. `npm run dev` apre il viewer; `npm run typecheck` è disponibile nell'upstream consultato. Configura e dimostra la rotta Las Palmas con asset locali, senza fallback silenzioso a R2 o città demo. I comandi finali esatti vanno provati e riportati nel README di progetto.
4. Esporta la piramide di tile web e aggiungi POI e attribuzioni. UI minima: trascinamento e zoom, reset vista, scheda POI al tap/click, controlli usabili da tastiera. Se puoi, toggle tra render neutro e stilizzato; altrimenti allega uno screenshot comparabile di ciascuno. Non ripubblicare le tile di Roma. Lascia cache e segreti fuori da Git; niente deploy/publish/archive, push o chiamate a servizi di immagini.
5. Progetta la possibile ridipintura senza eseguirla: render colore + height pass + riferimento stilistico riutilizzabile, finestre sovrapposte, stessa camera e palette, maschere e correzione delle giunzioni. Tieni titoli e marker nel viewer, non nel modello. Verifica i flag della revisione: l'upstream documenta `--plan` e `--window` (singolare); Roma usa flag diversi. Non far dipendere la v1 da painter o credenziali.

### Test e definizione di fatto

- La demo apre in locale nel punto giusto con asset Vegueta–Triana e funziona a viewport desktop 1440×900 e mobile 390×844. Prova drag, zoom, reset e apertura di tutti i sei POI. Nessuna eccezione JavaScript non gestita, richieste fallite per tile attese o richieste a tile di altre città nelle interazioni di test. Controlla nome, accesso da tastiera e attribuzione leggibile.
- Verifica visivamente almeno l'asse Santa Ana e Cattedrale, la posizione del Mercado rispetto al Teatro, la continuità del quartiere presso il Guiniguada e l'arrivo a San Telmo. Confronta almeno una giunzione per lato e due livelli di zoom. I sei POI devono corrispondere a dati verificati, non alle sole immagini. Riporta zone approssimate; non dichiarare fedeltà catastale.
- Esegui typecheck e smoke test automatico con il runner browser disponibile; salva almeno tre screenshot: panoramica, Santa Ana e mobile a Triana. File minimi: `README.md`, `PROGRESS.md`, `docs/DATA_SOURCES.md`, `docs/QA.md`, confini e POI in formato dati, test e prove visive. `docs/QA.md` elenca comandi, risultato vero, difetti noti e link relativi agli screenshot.
- Mantieni un percorso riproducibile da input in cache, logga numero di tile, dimensione e tempi reali. Preflight disco e dipendenze; rendering concorrente massimo 2 e obiettivo operativo iniziale massimo 5 GB di cache locale. Se una fase rischia di superarlo, riduci prima margine, risoluzione o livello di zoom, senza escludere i POI; se non basta fermati. Niente download massivi oltre il perimetro se c'è un ritaglio disponibile.
- Procedi autonomamente per sviluppo, test, fallback e correzioni interne. Ad ogni checkpoint salva cosa funziona, cosa non funziona, dati impiegati e prossima azione. Se una fonte non si può usare, fai un tentativo mirato e passa al fallback; non girare in loop. Se non puoi verificare un risultato, dillo. L'ultimo messaggio deve dare comando di avvio, cosa è verificato, cosa è rimasto fuori e dove trovare le prove. Non chiedere a Luca di approvare i dettagli tecnici di routine.


### Bozza per il painter, soltanto per una fase futura autorizzata

Usa come riferimento il [painter upstream](https://github.com/krasun/isometricworld/blob/main/pipeline/src/paint.ts). Conserva il render neutro separato. Con la revisione fissata, verifica il piano senza generazione e seleziona esplicitamente 4–9 finestre; nel sorgente consultato la forma singolare usa coppie separate da punto e virgola, ad esempio `--window='i,j;k,l'`. Una sola elaborazione alla volta, con un solo retry e un limite di tempo esplicito. Non usare `PAINT_BUDGET_USD=0` come blocco: in quella revisione zero equivale a nessun tetto e il limite non copre tutti i backend. Il gate della v1 è **non avviare il painter**.

```text
Ridipingi soltanto la finestra mascherata della scena isometrica data.
Il render colore e la height map definiscono camera, scala e posizione:
mantieni perimetri degli edifici, allineamento delle strade, piazze e
livelli del terreno. Usa i bordi già dipinti come vincoli, non come nuovi
oggetti. Look: plastico contemporaneo di Vegueta e Triana, sole canario
morbido, intonaci crema e pastello, tetti coerenti con il riferimento.
Non aggiungere edifici, ponti, corsi d'acqua, testo, etichette o cornici.
Non cambiare dimensioni, prospettiva, punti di fuga o ritaglio.
```

Il prompt non garantisce correttezza: confronta output e render in sovrapposizione, scarta i tasselli che spostano un riferimento e conserva i punti cliccabili come dati separati. Non passare al quartiere intero finché il piccolo campione non è ripetibile.
