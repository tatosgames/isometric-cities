# Storico delle prove visive di Las Palmas

Il 22 novembre 2026 il laboratorio A/B è stato ritirato dopo la valutazione visiva. Il gioco usa la sua resa ordinaria. La scelta per le strade resta aperta.

| Esperimento archiviato | Cosa si confrontava |
|---|---|
| Suolo | Materiali OSM e segni dei gradini su una texture di terreno |
| Facciate | Ritmo delle campate sul fronte strada e aperture coperte da edifici adiacenti |
| Tetti | Campiture PNOA sulle grandi coperture e arredi procedurali |
| Pendio | Base degli edifici aderente al terreno e profilo di contatto |
| Verde | Variazione illustrativa delle chiome in filari e gruppi |

## Prova stradale al Mercado de Vegueta

Le tre rese condividevano il percorso dell’auto da Calle Pelota a Calle de Mendizábal e Lugar Mercadillos Municipales. Texture pulita e geometria usavano la stessa larghezza illustrativa e lo stesso colore di asfalto.

| Resa | p95 desktop | p95 mobile emulato | Memoria del suolo attivo stimata |
|---|---:|---:|---:|
| Attuale | 18,2 ms | 18,2 ms | 0,90 MiB |
| Texture pulita a 4 px/m | 18,3 ms | 18,3 ms | 4,49 MiB |
| Carreggiata geometrica | 18,3 ms | 18,2 ms | 0,97 MiB |

Mediane di tre passaggi per configurazione su Chrome con GPU Intel UHD. Il profilo mobile era emulato sullo stesso computer. Nel campione la geometria aggiungeva 1.045 triangoli e una draw call. Sul rettilineo il bordo geometrico appariva più netto e le diagonali mostravano piccoli scalini. Entrambe le alternative cambiavano anche la continuità dell’asfalto agli incroci. Restavano da valutare la resa su telefono fisico e il passaggio tra settori.

Il codice, le ricette e i campioni originali sono consultabili nella [revisione archiviata](https://github.com/tatosgames/isometric-cities/tree/4d6dc949023b60befe00f26b7d2b4c1245552ba3).
