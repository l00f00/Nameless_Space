# Nameless Space (PlayCanvas)

Web app 3D modulare costruita con PlayCanvas.

## Requisiti

- Browser moderno (Chrome, Edge, Firefox, Safari)
- Connessione internet (per caricare PlayCanvas CDN + asset GLB/HDR remoti)

## Come avviare il progetto

Apri una shell nella root del progetto e lancia un server statico locale.

### Opzione 1 (Python)

```bash
python3 -m http.server 8080
```

Poi apri:

- http://localhost:8080

### Opzione 2 (Node, se hai `npx`)

```bash
npx serve . -l 8080
```

Poi apri:

- http://localhost:8080

> Nota: non aprire `index.html` direttamente con `file://` perché alcuni browser bloccano/modificano il comportamento di moduli ES e asset remoti.


## Provarlo online con GitHub Pages

Sì, puoi pubblicarlo online direttamente dal repo GitHub.

1. Pusha il progetto su un repository GitHub.
2. Assicurati che il branch principale sia `main` (il workflow ascolta i push su `main`).
3. Vai in **Settings → Pages** e imposta **Source: GitHub Actions**.
4. Fai push: partirà il workflow `.github/workflows/deploy-pages.yml`.
5. A deploy finito, troverai l’URL pubblico tipo:
   - `https://<tuo-user>.github.io/<nome-repo>/`

### Posso interagirci io direttamente?

Posso aiutarti a preparare tutto, debuggare codice e guidarti passo-passo, ma non posso cliccare/interagire direttamente con il tuo browser o il tuo account GitHub.
Se mi incolli URL, errori della Action o console log, ti guido subito nella risoluzione.

## Controlli

- **Desktop**
  - Click nel canvas per attivare pointer-lock
  - `W A S D` per movimento
  - Mouse per guardare intorno
  - `Shift` per sprint
- **Mobile**
  - Area touch sinistra: movimento
  - Area touch destra: look
- **WebXR (VR)**
  - Pulsante `Enter WebXR (VR)`
  - Thumbstick controller (se disponibile) per locomotion

## Struttura file

- `index.html`: entrypoint UI + canvas
- `scripts/main.js`: bootstrap scena, luci, stanze, porte e trigger
- `scripts/player-controller.js`: first-person controller desktop/mobile/WebXR
- `scripts/door-logic.js`: logica porta + animazione apertura/chiusura
- `scripts/trigger-system.js`: trigger invisibili AABB
- `scripts/experience-manager.js`: coordinamento sequenza stanze/esperienze

## Note tecniche

- Porte basate su modello **GLB** (glTF binary)
- Materiali **PBR** applicati via `pc.StandardMaterial`
- Environment atlas per riflessioni
- Shadow mapping con fallback qualità su mobile


## Troubleshooting rapido

- `favicon.ico 404`: risolto usando un favicon testuale `favicon.svg` (niente binari) e link esplicito in `index.html`.
- `helipad-env-atlas.png 404`: il codice usa URL aggiornati su branch `main` + fallback CDN (`jsdelivr`) e **non blocca** più il bootstrap se l’HDR env non è disponibile.
- Schermata nera all'avvio: se il GLB remoto non è raggiungibile, la scena ora usa automaticamente una porta fallback (box locale), quindi l'app parte comunque.


## Auto-merge PR

Puoi abilitare l'auto-merge su GitHub:

1. `Settings → General → Pull Requests` e attiva **Allow auto-merge**.
2. Crea branch protection su `main` (opzionale ma consigliato) con check richiesti.
3. Nella PR clicca **Enable auto-merge** scegliendo `Squash`, `Merge` o `Rebase`.

Se vuoi auto-merge completamente automatico da bot/workflow, puoi usare `gh pr merge --auto --squash <numero-pr>` in una GitHub Action con token adeguato.
