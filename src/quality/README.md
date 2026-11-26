# Qualità grafica adattiva a flag

Copia questa cartella nel progetto. Con Node 24 puoi eseguire `node --test adaptive-quality.test.mjs` dalla cartella copiata.

## Configurare i livelli

Dichiara una riga completa per livello, dal più leggero al più costoso. Ogni campo può essere un flag, un valore numerico o una modalità. Collega ciascun campo al suo effetto in un unico callback. Nell’esempio, il livello intermedio abilita le ombre e quello superiore aggiunge FXAA. Per anticipare FXAA al livello intermedio basta cambiare il secondo valore di `fxaa` in `true`.

```ts
import {createAdaptiveQuality} from './adaptive-quality.ts';

const quality = createAdaptiveQuality({
  levels: [
    {shadows: false, fxaa: false},
    {shadows: true,  fxaa: false},
    {shadows: true,  fxaa: true}
  ],
  initialIndex: 0,
  baseIndex: 0,
  detect30Fps: true,
  applyLevel({shadows, fxaa}) {
    groundShadows.setEnabled(shadows);
    fxaaPass.enabled = fxaa;
  }
});

// Nel ciclo di rendering esistente, una volta per frame disegnato:
quality.sample(time, {mode: moving ? 'moving' : 'resting', ready: !loading});
```

Il callback viene chiamato subito alla creazione, a ogni passaggio di livello (anche il ritorno dopo una prova fallita) e al reset. Crea gli effetti prima del controller. Omettendo il callback puoi applicare i livelli restituiti manualmente.

Gli indici partono da zero. `initialIndex` sceglie il primo livello visibile. `baseIndex` indica il profilo leggero di riferimento per la calibrazione e il riconoscimento dei 30 FPS. Puoi inserire livelli più economici prima della base, ad esempio con una risoluzione ridotta. Per aggiungere un effetto, assegna il suo valore in ogni riga e collegalo una volta in `applyLevel`.

## Collegare il ciclo di rendering

Usa `moving` per il gioco attivo e `resting` per il ciclo ambientale. Passa `ready: false` durante il caricamento e `preparing: true` mentre un effetto in prova prepara le sue risorse. Nei periodi di riposo il cooldown conserva il tempo residuo.

Per la prova iniziale, configura `calibrate: true` e avvia il gioco al livello base. Quando la scena è pronta e ferma, chiama `beginCalibration(time)` se `calibrationPending` è vero. Finché `calibrating` è vero, disegna a cadenza libera e passa `mode: 'calibration'`. Un input o la sospensione della pagina può interrompere la prova con `interrupt()`. Per ricominciare usa `reset()`. Con applicazione manuale, applica il livello restituito se diverso da `null`.

Con `detect30Fps` il controller può riconoscere 30 FPS regolari sul profilo base o su uno più leggero. Durante il movimento una promozione richiede 8 secondi fluidi e una prova di 2 secondi. Una prova fallita avvia 30 secondi di attesa attiva. Per la diagnostica, `state` espone indice, livello, target FPS, ultimi FPS e p95 in millisecondi, prova in corso e cooldown residuo.

## Come viene scelto il livello

| Obiettivo | Condizioni per provare il livello superiore | Condizioni per scendere di un livello |
|---|---|---|
| 60 FPS | Almeno 57 FPS e p95 ≤ 22 ms | Meno di 54 FPS oppure p95 > 25 ms |
| 30 FPS | Almeno 29 FPS e p95 ≤ 38 ms | Meno di 27 FPS oppure p95 > 42 ms |

Il p95 è il tempo entro cui si completa il 95% dei frame misurati. In movimento servono due secondi consecutivi sotto soglia per scendere. Nella fascia intermedia il livello resta stabile.

## Riferimenti

La sequenza a priorità segue l’idea di [Babylon SceneOptimizer](https://github.com/BabylonJS/Babylon.js/blob/master/packages/dev/core/src/Misc/sceneOptimizer.ts). I passi discreti con nuova misura dopo ogni cambio riprendono [model-viewer](https://github.com/google/model-viewer/blob/5cc277a497f6e13fc75ff4821da73164a12570c9/packages/model-viewer/src/three-components/Renderer.ts). La fascia neutra e la distinzione tra misura e applicazione seguono [Drei PerformanceMonitor](https://github.com/pmndrs/drei/blob/master/src/core/PerformanceMonitor.tsx).
