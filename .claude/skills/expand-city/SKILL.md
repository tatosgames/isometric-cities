---
name: expand-city
description: Genera o amplia il plastico Three.js di isometric-cities. Usare per aggiungere POI, quartieri o monumenti, rigenerare geodati e colori dei tetti o adattare la pipeline a un’altra città.
---

# Espandere il plastico

Parti dalla radice del repository. La procedura mantenuta insieme al codice è in [docs/EXPAND_CITY.md](../../../docs/EXPAND_CITY.md). Consulta le fonti già verificate in [DATA_SOURCES.md](../../../docs/DATA_SOURCES.md) e i confronti desktop/mobile in [QA.md](../../../docs/QA.md).

- **Luogo dentro l’area.** Modifica `content/las-palmas.json`. Conserva gli ID pubblicati anche quando cambia l’ordine del menu. Verifica il punto interno, i cortili e l’eventuale variazione del perimetro prima di riusare la cache.
- **Quartiere o spostamento del pilota.** Controlla insieme estratto OSM, inviluppo dei POI, edifici comunali, DEM e copertura dell’atlante di entrambe le scene. La cache distingue i parametri di ogni richiesta. Verifica la suddivisione OSM e il taglio della costa prima di misurare la superficie. Segui la procedura di riacquisizione della guida.
- **Monumento o palette.** Parti dall’OBJECTID comunale e dalle regole del catalogo. Aggiungi geometria dedicata in `landmarks.js` quando la sagoma la richiede. Usa Google Maps solo per consultazione visiva privata. Le tinte pubblicate derivano da PNOA.
- **Altra città.** Isola catalogo e output. Adatta fonti, proiezione, origine, vista iniziale e attribuzioni. Valida un pilota prima di ampliare la copertura.
- **Settori.** Rigenera scene, mosaico PNOA e poi `python scripts/sectors.py`. Mantieni origine e griglia comuni, ownership degli edifici, margini delle texture e grafo della guida indipendente dalla residenza visiva. Esegui `node scripts/qa-sectors.mjs` per attraversamenti, memoria e perdita WebGL durante una richiesta in corso.
- **Consegna.** Esegui i controlli della guida pertinenti alla modifica. Registra dati acquisiti, approssimazioni e risultati misurati nei documenti locali. Conserva il confronto a camera identica e verifica il recupero WebGL quando crescono geometria o texture.
