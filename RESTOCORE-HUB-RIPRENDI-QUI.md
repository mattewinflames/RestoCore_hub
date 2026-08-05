# RestoCore Hub — RIPRENDI QUI

> Fotografia del presente (05/08/2026). Per la cronologia vedi `docs/REGISTRO-SVILUPPO.md`
> (ultima voce **#0**). Questo file si sovrascrive; non è un changelog.

## Cos'è
Il **control plane** di RestoCore (architettura C, decisa il 05/08). Progetto **separato**
dal motore operativo: qui i ristoratori si **registrano**, compilano un **wizard** di
configurazione del locale, **caricano le foto** del menu per la generazione, e Matteo li
vede e li **approva** da un **cruscotto**. All'OK, il locale viene **materializzato** nel suo
progetto operativo dedicato (provisioning **manuale** all'inizio; il motore RestoCore resta
il template per-locale). Gli ORDINI vivono nel motore, non qui.

## Perché separato dal motore
Il motore è pensato per essere **clonato per-locale** e non deve trascinarsi dietro l'hub;
hub e locali hanno Firebase, Auth e deploy Vercel **distinti**; i tipi di config si
condividono con una dipendenza controllata, non fondendo i due progetti.

## Convenzioni di lavoro (come nel motore)
- **Sempre in italiano**, inclusi i passaggi intermedi.
- Per ogni file consegnato: **percorso esatto + stato** (nuovo / da sostituire / da rinominare).
- **Registro** dopo ogni modifica coerente e verificata (`docs/REGISTRO-SVILUPPO.md`).
- **Verifica reale**: `npx tsc --noEmit`, `npx vitest run`. La UI (quando arriverà) sarà
  solo `tsc`+build, dichiarato; le regole Firestore non girano senza emulatore, dichiarate.

## Stato attuale — cosa funziona
- **Dominio dell'approval gate** completo e testato (#0): stati
  `bozza → in_revisione → approvato → attivo → sospeso`, ruoli `owner`/`admin`, transizioni
  come fonte di verità unica, `can`/`apply`/`availableActions` puri e immutabili.
- **18 test verdi**, `tsc` pulito. Nessuna persistenza né UI ancora (per scelta).

## Prossimi passi (in ordine)
1. **Dato + regole Firestore**: doc `locali/{id}` con `status`, store read/write, regole che
   **rispecchiano `TRANSITIONS`** (un owner scrive solo il proprio, solo l'admin approva).
2. **Auth ristoratori + custom claim `admin`** per Matteo (il super-admin che vede tutti).
3. **Shell del cruscotto**: lista dei locali in `in_revisione` + azioni approve/reject
   (faccia di `apply`), con lo storico `reviewNotes`.
4. **Wizard**: la faccia guidata della config del locale (i cinque assi del tenant). Qui si
   tipizza `LocaleRecord.config` e si decide come condividere i tipi col motore.
5. **Upload foto → generazione menu**: **riusa l'importatore del motore** (RestoCore #4–#6,
   Gemini dietro `RowExtractor`) → bozza rivedibile.
6. **Materializzazione**: dall'`approvato` al progetto operativo (seed della config + menu;
   `seed-from-draft` del motore è il seam). Manuale finché il volume non giustifica
   l'automazione.

## ⚠️ Trappole note (ereditate dal motore)
- **Rete aziendale**: proxy blocca spesso `vercel dev` ("fetch failed"); Google/Gemini è
  raggiungibile.
- **Modelli Gemini a scadenza**: il modello sta dietro `GEMINI_MODEL`, si cambia senza
  toccare codice.
- **Windows**: file che iniziano con punto perdono il punto se scaricati dal browser (via
  `git pull` no).

## Rapporto col motore RestoCore
Il motore è a valle: primo giro reale prenotazione→pagamento→cassa auditato e pronto (suo
registro #22), resta da provare in staging quando servirà un locale operativo vero — che è
esattamente ciò che l'hub produrrà al passo 6.

## Comandi utili
```
npm install
npx tsc --noEmit && npx vitest run
```
