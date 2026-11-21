# Verifica locale · 21 novembre 2026

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
- [Panoramica fino a San Telmo](screenshots/overview.png) · perimetro continuo, marker e attribuzione.
- [Santa Ana neutra](screenshots/santa-ana-neutral.png) e [Santa Ana stilizzata](screenshots/santa-ana-styled.png) · stesse geometrie, vista e scala.
- [Mercado e Teatro](screenshots/mercado-teatro.png) · posizione reciproca e attraversamento urbano lungo l’antico Guiniguada.
- [Triana mobile](screenshots/triana-mobile.png) · nome del Gabinete, controlli e attribuzione.

Le prove coprono panoramica e dettaglio. La scena è continua, raggruppata in celle spaziali per il disegno. Ai margini del plastico si vedono i tagli dell’area. Il rilievo delle facciate, le altezze e la vegetazione hanno le approssimazioni descritte nelle [note sui dati](DATA_SOURCES.md).

