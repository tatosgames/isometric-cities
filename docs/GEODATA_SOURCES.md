# Geodati aggiuntivi: dove sono, come si ottengono, a cosa servono

Catalogo di lavoro per migliorare edifici, oggetti 3D, strade e colori. Le fonti già in produzione sono in [DATA_SOURCES.md](DATA_SOURCES.md). Qui stanno quelle valutate il 22 novembre 2026, con link, accesso riproducibile, licenza ed esito. Le attribuzioni vanno aggiunte a `DATA_SOURCES.md` quando un dato entra nella mappa pubblicata.

## Riepilogo

| Fonte | Esito | Licenza | Uso |
|---|---|---|---|
| LiDAR PNOA 3ª copertura, Canarie (CNIG) | Validato su 554 edifici | CC BY 4.0 compatibile, attribuzione obbligatoria | Controllo e correzione delle altezze; quote di chiome e tetti |
| Ortofoto 20 cm 2024 (SITCAN) | Tinte coincidenti con il PNOA (ΔE mediano 2,9) | CC BY 3.0, uso commerciale ammesso | Seconda fonte per colori e controllo visivo di edifici e strade; copertura di tutta l'isola |
| SITCAN Open Data, altri dataset | Valutati, scarso interesse | CC BY 3.0 o Aviso Legal SITCAN | Vedi tabella sotto |
| WMS e negozio GRAFCAN | Non usare nella pipeline | Solo consultazione, vietati uso commerciale e scarico massivo | Riferimento visivo |
| Microsoft Building Footprints, Overture | Non necessari | ODbL | Solo controllo incrociato dei poligoni |
| Wikimedia Commons | Foto di riferimento per i monumenti | Per file (CC BY, CC BY-SA, pubblico dominio) | Sagome e palette dei landmark |

## LiDAR PNOA, terza copertura (CNIG)

- **Prodotto:** nuvole di punti classificate NPC02, volo Canarie novembre 2023 – gennaio 2024, almeno 5 punti/m², precisione verticale dichiarata 10 cm, tile da 1×1 km in LAZ. Pagina: <https://centrodedescargas.cnig.es/CentroDescargas/lidar-tercera-cobertura>.
- **Licenza:** compatibile con CC BY 4.0, attribuzione obbligatoria: «© Instituto Geográfico Nacional» (vedi la sezione «Licencia» della pagina). Il file resta in `.cache/lidar/` e non va in Git.
- **Nome dei file:** `PNOA-2023-CANAR-<E km>-<N km>-H28-NPC02.laz`. Il numero è l'angolo nord-ovest del tile. Il tile di Vegueta è `PNOA-2023-CANAR-459-3109-H28-NPC02.laz` (E 459–460 km, N 3108–3109 km, 50,9 MB, 6,7 punti/m², REGCAN95 / UTM 28N).
- **Classi presenti nel tile:** 1, 2 (suolo), 3, 4, 5 (vegetazione bassa, media, alta), 6 (edifici), 7, 9 (acqua), 12. Il significato segue lo standard ASPRS; l'edizione NPC02 aggiunge anche ponti, veicoli, cavi e pannelli. Le classi 7, 9 e 12 non sono state analizzate.
- **Come scaricare (non è automatizzabile):** il server risponde 403 a qualsiasi richiesta da script, anche dal browser integrato con `fetch`, e il modulo di download usa reCAPTCHA. Dal browser, come una persona:
  1. Apri la pagina, imposta «Ámbito» su **Coordenadas**, scegli UTM, huso 28, inserisci E e N di un punto interno al tile (esempio: 459500, 3108500). Non serve il pulsante di ricerca.
  2. Premi «Aplicar filtros»: l'elenco si riduce al tile che copre il punto.
  3. Premi il pulsante di download accanto al file e accetta la licenza.
  Il filtro di default, senza coordinate, elenca la Catalogna (`CAT`, UTM 31N): controlla che il nome contenga `CANAR` e `H28`.
- **Controllo e uso:** `python scripts/lidar-check.py [--export] [file_o_cartella]` (richiede `laspy[lazrs]` in `.cache/pylib`, installato fuori da `requirements.txt`). Per ogni edificio misura il p95 delle quote dei punti classe 6 nell'impronta meno la mediana dei punti classe 2 in un anello di 8 m. Scrive `.cache/lidar-control/report.json` e `buildings.csv`. Con `--export` aggiorna `content/lidar-heights.json`: `heights` per gli OBJECTID senza altezza comunale valida e `parts` per i corpi bassi di un complesso, dove il comunale supera di oltre 10 m il tetto misurato, e per gli edifici dove il tetto misurato supera di oltre 10 m il comunale e la mediana dei punti lo conferma (oltre 5 m sopra il comunale, almeno il 75 % del p95). `data.py` usa entrambi. Con venti tile il controllo dura circa due minuti.
- **Risultati su Vegueta** (577 edifici, 554 misurati): scarto mediano LiDAR meno comunale +0,8 m, errore medio assoluto 1,82 m, 74 % entro 2 m, 93 % entro 5 m. Teatro 30,6 / 30,7 m, Mercado 13,5 / 12,4 m, Gabinete 25,3 / 24,7 m, Casa de Colón 13,4 / 12,9 m. Dettagli in [QA.md](QA.md#altezze-comunali-contro-lidar-22-novembre-2026).
- **Limiti:** il campo comunale con più parti per OBJECTID (cattedrale 41119, cinque parti) va letto per parte. Restano scarti di 10 m o più su singoli edifici non verificati. Trenta tile scaricati al 23 novembre 2026, da San Cristóbal a La Isleta; mancano 454-3112, 455-3111, 458-3106 e 458-3107. La penisola a nord di La Isleta non ha edifici comunali e non richiede tile. Dopo ogni download il filtro si azzera: va reimpostato per il tile successivo. Con Ciudad Alta i tile in cache sono 40; il 454-3109 è arrivato troncato (scaricalo di nuovo e controlla che `laspy` lo legga fino in fondo prima di usarlo).

### Usi possibili non ancora implementati
- **Edifici:** altezze per parte, volumi dei tetti (colmi, torri, lucernari) dai punti classe 6, altezze di gronda contro colmo, edifici costruiti dopo il rilievo comunale.
- **Oggetti 3D:** altezze reali delle chiome dai punti 3-5, per tarare gli alberi procedurali; verifica di torri, cupole e coperture dei landmark.
- **Strade:** profilo del suolo (classe 2) lungo le carreggiate per controllare le quote del DEM nei dislivelli, ponti e rampe.

## Ortofoto 20 cm del 2024 (SITCAN)

- **Dataset:** <https://opendata.sitcan.es/dataset/ortofoto-20-cm-pixel-de-canarias-2024>. Un GeoTIFF per isola. Gran Canaria: <https://opendata.sitcan.es/upload/251/OTARM20/tif/251_OTARM20_GC.tif>, 10,3 GB, EPSG:32628, 0,2 m/pixel, 3 bande, estensione E 417–466 km, N 3067–3118 km. Esiste anche la versione infrarossa CIR (`ortofoto-cir-20-cm-pixel-de-canarias-2024`) e le serie 2018 e 2021 in JPEG 2000.
- **Licenza:** `gobcan-aviso-legal`: CC BY 3.0 del Gobierno de Canarias, uso commerciale ammesso. Obblighi: citare «Fuente: Gobierno de Canarias» con la data di aggiornamento (agosto 2025) e non alterare il senso dell'informazione. Testo: <https://opendata.sitcan.es/notice>.
- **Non scaricare il file intero.** Il TIFF è a tile con compressione JPEG e overview (4, 8, 16, 32, 64), e il server accetta richieste parziali. `rasterio` legge una finestra con `/vsicurl/`:

```python
with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif'):
    with rasterio.open('/vsicurl/https://opendata.sitcan.es/upload/251/OTARM20/tif/251_OTARM20_GC.tif') as r:
        data = r.read(window=Window(col0, row0, w, h))
```

  La finestra di Las Palmas (3,4 × 5,2 km a 20 cm) pesa circa 30-60 MB. Il passaggio da coordinate locali a pixel è in [roof-compare-20cm.py](../scripts/roof-compare-20cm.py).
- **Confronto con il PNOA:** `python -I scripts/roof-compare-20cm.py` riporta il file a 1 m e ricalcola le tinte con l'algoritmo di `roof-colours.py`. Su 4.820 edifici: ΔE mediano 2,9, 82,7 % sotto 5, 99,5 % sotto 10. I due voli concordano anche sulla posizione degli edifici. Il viewer usa una tinta uniforme per impronta, quindi i 20 cm non migliorano il risultato attuale.
- **Usi possibili:** colori per falda o dettagli di tetto (terrazze, pannelli, tegole) se la resa lo richiederà; verifica visiva di larghezze stradali, marciapiedi, piazze e passaggi pedonali; controllo di edifici nuovi o demoliti; copertura di nuovi quartieri con fonte e licenza chiare.
- **Attenzione:** ombre, aggetti e parallasse influiscono come nel PNOA. Fonte aerea e poligoni comunali possono avere date diverse.

## SITCAN Open Data: altri dataset

Portale CKAN: <https://opendata.sitcan.es/>, API <https://opendata.sitcan.es/api/3/action/package_search?rows=200> (174 dataset a novembre 2026; `package_show?id=<nome>` dà le risorse). Licenze: `gobcan-aviso-legal` (150 dataset, CC BY 3.0) e `sitcan-aviso-legal` (24, termini analoghi con citazione obbligatoria).

| Dataset | Esito |
|---|---|
| Planeamiento urbanístico de Las Palmas de Gran Canaria (SIPU, PDF, HTML) | Esiste, non letto. Può servire per quote, altezze consentite e tutele. |
| Base Topografica 1:5.000 (2004-2006), Gran Canaria, SHP 588 MB | Vecchia di 20 anni: scarso interesse; utile solo come confronto storico. |
| MDT 25 m | Inutile: la pipeline usa già MDT05 a 5 m. |
| Mappa de Palmeras de Canarias (SHP, 12,5 MB, scala 1:500) | **Rinviato su richiesta.** Non scaricato né valutato. |
| EIEL, Islas y municipios, Atlas Climático, tematici ambientali | Non pertinenti alla mappa urbana. |

## GRAFCAN (WMS e negozio)

- WMS <https://idecan1.grafcan.es/ServicioWMS/MTL> (Modelo de Terreno LIDAR, 2,5 m/pixel, immagine sintetica a colori, non quote numeriche) e <https://idecan1.grafcan.es/ServicioWMS/Ortofoto>. I metadati dichiarano «Acceso libre. Prohibido el uso comercial y la descarga masiva de información»: non usare nella pipeline, solo per consultazione.
- Dati pagati nel negozio <https://tiendavirtual.grafcan.es/>, con la licenza `CONTRATO_LICENCIA_USO.pdf`: non letta.
- Il LiDAR e l'ortofoto liberi di IGN e SITCAN coprono gli stessi bisogni senza questi vincoli.

## Altre fonti valutate
- **Microsoft Global ML Building Footprints** e **Overture Maps** (ODbL): le altezze coprono solo USA ed Europa occidentale; i poligoni comunali sono migliori. Utili solo per un controllo incrociato.
- **Wikimedia Commons**: categorie per monumento, ad esempio <https://commons.wikimedia.org/wiki/Category:Main_facade_of_the_Cathedral_of_Santa_Ana> (51 file). Controllare la licenza di ogni file e usare le foto come riferimento privato, salvo attribuzione.
- **Catasto spagnolo (INSPIRE)**: numero di piani per edificio, seconda stima indipendente delle altezze. Non verificato.
- Il Bing Maps e le immagini Microsoft non sono riutilizzabili come dato.

## Come aggiungere una fonte a questo catalogo
Registra link, licenza e obbligo di attribuzione, il modo di accedere in modo riproducibile (e cosa non si può automatizzare), una misura su un edificio o una zona di controllo e il limite noto. Poi aggiorna `DATA_SOURCES.md` solo quando il dato entra nella mappa.

## Guaguas Municipales · modalità guida

Il piano prevede una guagua su due fermate consecutive della stessa corsa, usando la geometria GTFS per identificare il corridoio e la carreggiata del plastico per percorrerlo. La simulazione usa tempi di gioco. L'estratto iniziale copre la linea 13 verso Tres Palmas, su Calle Hernán Pérez de Grado. Il primo candidato sulla linea 54 richiedeva una svolta da Reyes Católicos su Doctor Chil in cui la coda del modello usciva dal nastro stradale del pilota.

**Acquisizione del 25 novembre 2026.** Il feed dell'operatore contiene 46 linee, 845 fermate, 7.009 corse e 20.564 punti di tracciato. Conservare lo ZIP originale in cache. Fonte, impronta SHA-256, corsa, tracciato e via OSM accompagnano il piccolo estratto locale. Le schede comunali riportano come condizioni d'uso «Reutilización de la información del sector público para el ámbito del sector público estatal». [ZIP dell’operatore](https://www.guaguas.com/transit/google_transit.zip) · [Catalogo comunale GTFS](https://datosabiertos.laspalmasgc.es/data/?q=&tags=gtfs) · [Paradas](https://datosabiertos.laspalmasgc.es/dataset/?id=guaguas-municipales-paradas) · [Viajes](https://datosabiertos.laspalmasgc.es/dataset/?id=guaguas-municipales-viajes) · [Trazados](https://datos.gob.es/es/catalogo/l01350167-guaguas-municipales-trazados).

Per aggiornare, scaricare una nuova edizione in un file separato. Un download con identificativo browser ha restituito lo ZIP ufficiale. Dalla radice del progetto, usando l'ambiente Python dei geodati:

```powershell
New-Item -ItemType Directory -Force .cache/guaguas | Out-Null
curl.exe -fL --retry 2 -A "Mozilla/5.0" https://www.guaguas.com/transit/google_transit.zip -o .cache/guaguas/candidate.zip
py -3.14 scripts/guaguas.py .cache/guaguas/candidate.zip
```

L'importatore collega linea, corsa, geometria e sequenza di fermate della stessa edizione. Converte WGS84 in metri UTM 28N relativi all'origine del plastico, verifica la vicinanza al tracciato e l'intero ingombro 7,2 × 2,2 m su ciascun segmento in entrambe le mappe. Solo dopo la verifica sostituisce l'estratto. Se una nuova edizione sposta il percorso, riesaminare geometria, fermate e carreggiata prima di aggiornare gli identificativi. Ripetere le prove di sosta, sorpasso, collisioni e riapparizione fuori campo riportate in [QA](QA.md).

Per la rete cittadina eseguire `py -3 scripts/guaguas.py .cache/guaguas/candidate.zip --network` dalla radice del repository. Servono gli stessi XML OSM in cache usati per generare la città. Il risultato contiene directory per città e pilota, indici spaziali, geometrie condivise e rapporti per variante. [Dati e prove in guida](GUAGUAS.md).
