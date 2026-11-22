# Las Palmas · Atlas insular

Plastico urbano interattivo di Las Palmas de Gran Canaria, in Three.js, TypeScript e Vite. I dati elaborati sono inclusi in `public/data`. Il browser legge tutti gli asset dall’origine locale.

## Avvio su Windows

Dalla cartella del progetto, con Node 24 e Chrome con WebGL2:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5197
```

Aprire http://127.0.0.1:5197/ . Trascinare per spostarsi, usare rotella o pinch per ingrandire. L’indice e i marker aprono la scheda del luogo. Con il focus sulla mappa, usare frecce, +, − e Home. Il mirino ripristina la panoramica.

La pagina iniziale apre un dettaglio di Triana a tutto schermo. Il menu in alto a sinistra raccoglie dieci luoghi da Vegueta al Parque Doramas e al Club de Natación Metropole. Il mirino in alto a destra mostra l’intera area. Usare `/?area=pilot` per il quadrato di Santa Ana e aggiungere `&neutral` per il confronto a camera identica.

## Editor del pilota

L’editor si apre su [GitHub Pages](https://tatosgames.github.io/isometric-cities/editor.html) o in locale su `http://127.0.0.1:5197/editor.html`. Scarica le correzioni in JSON e ricaricale nell’editor oppure in **Test Drive**. Il browser legge il file dal dispositivo.

## Riprodurre i dati

La visione richiede solo Node. Per ricostruire i dati, dalla radice con Python 3.13 e curl:

```powershell
python -m pip install --target .cache/pylib -r scripts/requirements.txt
python scripts/data.py pilot
python scripts/data.py city
python scripts/roof-colours.py
python scripts/sectors.py
```

La superficie terrestre giocabile è di 3,041 km². La pipeline genera un indice e 80 settori da 240 m. Il primo passaggio salva le risposte pubbliche in `.cache/sources` con una chiave derivata dalla richiesta completa. Le rigenerazioni leggono le copie locali. Per una nuova acquisizione conservare separatamente la vecchia cache e usare una directory di progetto pulita. La cache e le credenziali sono escluse da Git.

## Struttura del runtime

`src/main.ts` collega la mappa, il rendering e la guida. `src/data/` contiene i contratti dei geodati, `src/map/` i marker e i controlli dei luoghi, `src/render/` la scena e lo streaming, `src/drive/` la simulazione. Vite prepara la build e `npm.cmd run typecheck` controlla tutto `src/` in modalità rigorosa.

## Verifiche

```powershell
npm.cmd run typecheck
npm.cmd run build
node scripts/qa.mjs pilot
npm.cmd test
node scripts/qa-sectors.mjs
node scripts/qa-drive-route.mjs
node scripts/qa-recovery.mjs
```

I test avviano un server temporaneo della build e lo chiudono alla fine. Richiedono Chrome installato. `MAP_URL` permette di puntare a un server già avviato.

## Riutilizzo nel gioco

Le scene JSON contengono edifici identificati dal record comunale, strade con ID OSM, nome e classe, superfici pedonali, verde, alberi e griglia delle quote. Gli anelli comprendono i cortili. Più parti possono condividere l’ID dell’edificio originale. Unità in metri, coordinate locali est/nord rispetto a [-15.415, 28.105] in WGS84 proiettate in UTM 28N. Three.js usa (est, quota, −nord). Confini e dieci POI sono disponibili anche in GeoJSON WGS84. I marker sono elementi interattivi proiettati dalla camera.

Il modello mantiene la separazione geodati/scena e l’origine fissa del progetto [IsometricWorld alla revisione consultata](https://github.com/krasun/isometricworld/tree/8f9e3bb9f9533bcc5dfb3c6481ec0a1306e5ca3a). Acquisizione locale e renderer sono specifici della versione 3D live.

[Fonti](docs/DATA_SOURCES.md) · [Prove e screenshot](docs/QA.md) · [Checkpoint](PROGRESS.md)



## Aggiungere un luogo

Inserisci in `content/las-palmas.json` una voce in `places` con un ID stabile, nome, riferimento OSM, aree di appartenenza e altezza del marker in metri. Rigenera i dati con i comandi della sezione precedente. Menu, marker e scheda leggono lo stesso elenco. Mantieni gli ID quando riordini o rinomini i luoghi per conservare le selezioni salvate.

Il catalogo contiene anche il centro del pilota e le personalizzazioni degli edifici comunali. I modelli procedurali dedicati si trovano in `src/render/landmarks.ts`, i controlli dei luoghi in `src/map/places-ui.ts`.

Per estendere il perimetro, aggiornare le acquisizioni o preparare una nuova città, segui la [guida alla generazione e all’espansione](docs/EXPAND_CITY.md).

## Modo «Conducir»

El botón 🚗 de las herramientas abre una persecución arcade sobre la maqueta, inspirada en Pako. El coche acelera solo.

- Táctil: pulsar la mitad izquierda o derecha para girar, ambas a la vez para frenar. Un deslizamiento horizontal equivale al lado hacia el que se desliza.
- Teclado: flechas izquierda/derecha o A/D, ambas a la vez (o Espacio / flecha abajo) para frenar, Escape para salir.
- Las monedas marcan la ruta por las calles hasta uno de los lugares; al llegar hay un bono y aparece otra ruta.
- Las patrullas aumentan cada 18 s. Te atrapan si te alcanzan cuando vas despacio; a plena velocidad solo empujan. El récord se guarda en el navegador.

La interfaz del juego no usa texto: iconos para monedas y tiempo durante la partida, y el récord en el resumen final; dos zonas táctiles animadas enseñan a girar y, tras unos segundos, a frenar con ambas; una ficha amarilla con el número del lugar señala el destino desde el borde de la pantalla; un haz de luz lo marca en la maqueta. Una flecha dentro del círculo del coche señala el morro solo cuando un edificio tapa la cabina. Los nombres se anuncian solo a lectores de pantalla.

Toda la física y el ritmo se ajustan en el objeto `TUNE` al inicio de `src/drive/drive.ts`.

La mappa e la guida usano sempre le stesse animazioni, indipendentemente dalle preferenze di sistema. La camera accompagna la selezione dei luoghi e in guida reagisce a velocità, urti e vicinanza delle pattuglie.
