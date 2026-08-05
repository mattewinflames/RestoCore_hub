# RestoCore Hub — RIPRENDI QUI

> Fotografia del presente (05/08/2026). Per la cronologia vedi `docs/REGISTRO-SVILUPPO.md`
> (ultima voce **#3**). Questo file si sovrascrive; non è un changelog.

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
- **Windows/PowerShell**: nei comandi usare SEMPRE `npm.cmd` e `npx.cmd` (non `npm`/`npx`
  nudi, che in PowerShell possono non risolvere).
- Per ogni file consegnato: **percorso esatto + stato** (nuovo / da sostituire / da rinominare).
- **Registro** dopo ogni modifica coerente e verificata (`docs/REGISTRO-SVILUPPO.md`).
- **Verifica reale**: `npx.cmd tsc --noEmit`, `npx.cmd vitest run`. La UI (quando arriverà)
  sarà solo `tsc`+build, dichiarato; le regole Firestore non girano senza emulatore, dichiarate.

## Stato attuale — cosa funziona
- **Dominio dell'approval gate** completo e testato (#0): stati
  `bozza → in_revisione → approvato → attivo → sospeso`, ruoli `owner`/`admin`, transizioni
  come fonte di verità unica, `can`/`apply`/`availableActions` puri e immutabili.
- **Fondazione auth + identità** (#1): due provider (email/password + Google), init Firebase
  del progetto HUB, wrapper auth con errori in italiano, derivazione del ruolo dai custom
  claim (`admin` = claim server-side, fail-safe verso `owner`), script `set-admin` per
  nominarti super-admin. Headless (nessuna UI ancora).
- **Persistenza Firestore** (#2): collezione `locali/{id}`, store `localeStore.ts`
  (create/updateDraft/performAction/subscribeMine/subscribePending/subscribeLocale), regole
  che rispecchiano `TRANSITIONS` (owner scrive il proprio, admin approva), indici compositi,
  `firebase.json`. Regole NON ancora provate (serve emulatore/staging).
- **UI di accesso/registrazione** (#3): app Vite+React con accesso e registrazione, due
  provider (email/password + Google), errori in italiano, design carta+oliva+ambra (font di
  sistema). Avviabile con `npm.cmd run dev`. Post-login: landing con "cruscotto in arrivo".
- **23 test verdi**, `tsc` pulito, `vite build` ok. Cruscotto non ancora presente.

## Da fare in console (una volta)
- Creare il progetto Firebase **HUB** (fatto), riempire `.env` da `.env.example`.
- Authentication → Sign-in method: **Email/Password** e **Google** (fatto).
- **Pubblicare `firestore.rules`** e creare i **due indici compositi** (`ownerUid+updatedAt`,
  `status+updatedAt`): via `firebase deploy --only firestore` oppure a mano dalla console
  (il primo caricamento delle query offre il link di creazione dell'indice).
- Dopo esserti registrato la prima volta: `npm.cmd run set-admin -- tua@email` per nominarti admin.

## Prossimi passi (in ordine)
1. **Shell del cruscotto**: area ristoratore (`subscribeMine` + `createLocale`) e vista admin
   delle approvazioni (`subscribePending` + `performAction`), con lo storico `reviewNotes`.
2. **Wizard**: la faccia guidata della config del locale (i cinque assi del tenant). Qui si
   tipizza `LocaleRecord.config` e si decide come condividere i tipi col motore.
3. **Upload foto → generazione menu**: **riusa l'importatore del motore** (RestoCore #4–#6,
   Gemini dietro `RowExtractor`) → bozza rivedibile.
4. **Materializzazione**: dall'`approvato` al progetto operativo (seed della config + menu;
   `seed-from-draft` del motore è il seam). Manuale finché il volume non giustifica
   l'automazione.
5. **Test regole** (emulatore) + **App Check** (reCAPTCHA v3) prima del go-live pubblico.

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
npm.cmd install
npm.cmd run dev                                  # avvia l'app in locale (http://localhost:5173)
npx.cmd tsc --noEmit ; npx.cmd vitest run        # verifica (PowerShell: ';' non '&&')
npx.cmd vite build                               # build di produzione
```
