# RestoCore Hub — Registro di sviluppo

Cronologia immutabile delle modifiche. Le voci si aggiungono in fondo, non si riscrivono.
Progetto **separato** dal motore RestoCore (che resta il template operativo per-locale).
L'hub è il **control plane**: registrazione ristoratori, wizard di configurazione,
generazione menu, cruscotto di approvazione (architettura C, decisa con l'utente il 05/08).

---

## #0 — Fondazione del dominio: macchina a stati dell'approval gate · 05/08/2026

Primo mattone dell'hub. Scelta metodologica coerente col motore (cfr. blocchi #1/#18 di
RestoCore): si parte dalla **logica pura testabile**, non dalla UI né da Firestore. Il
perno dell'architettura C è l'**approval gate** — un locale non diventa operativo finché
Matteo non dà l'OK — quindi è da lì che si costruisce.

**Fatto**
- Scaffold minimo del progetto: `package.json` (solo `typescript` + `vitest`, la UI/React/
  Firebase arrivano quando servono), `tsconfig.json` (strict, `noUncheckedIndexedAccess`,
  `types: []` per non dipendere da `@types/node`), `.gitignore` (con `!.env.example`).
- `src/domain/locale.ts` (nuovo): il LOCALE visto dal control plane. `LocaleStatus`
  (`bozza → in_revisione → approvato → attivo → sospeso`), `Role` (`owner` = ristoratore,
  `admin` = Matteo super-admin), `Actor`, `ReviewNote`, `LocaleRecord` (la `config` del
  wizard è per ora `unknown`: non accoppiamo il gate ai dettagli della configurazione),
  `isOwnerOf`. Il ciclo di vita qui è l'ONBOARDING; gli ordini vivono nel motore, non qui.
- `src/domain/approval.ts` (nuovo): la macchina a stati. `LocaleAction` (submit, withdraw,
  approve, reject, activate, suspend, resume); `TRANSITIONS` come **fonte di verità unica**
  (from/to/roles/requiresNote); `can()` (stato → ruolo → proprietà → nota, in quest'ordine
  per dare il diniego più utile); `apply()` **immutabile** (nuovo record, non muta l'input;
  reject appende la nota, `updatedAt` avanza a `now` iniettabile); `availableActions()` per
  abilitare i pulsanti del cruscotto senza duplicare `can`.
- `src/domain/approval.test.ts` (nuovo): 18 test — stati di partenza, ruolo+proprietà (un
  owner non tocca il locale altrui, l'admin agisce su tutti), precondizione-nota sul reject,
  immutabilità di apply, `availableActions`, e due percorsi end-to-end (onboarding completo
  e ciclo di rifiuto→ri-sottomissione).

**Verifica:** `npx tsc --noEmit` ✓ · `npx vitest run` → **18/18** ✓. (Eseguiti in questo
ambiente.)

**Perché:** C richiede self-service (i ristoratori si registrano e configurano da soli) +
un cruscotto centralizzato dove Matteo approva. L'approval gate è ciò che concilia le due
cose e protegge il provisioning (manuale all'inizio). Metterne la verità in logica pura,
una volta e testata, evita che regole Firestore e UI divergano quando le costruiremo sopra.

**Nota / debiti aperti:**
- La forma tipizzata di `LocaleRecord.config` (i cinque assi del tenant del motore:
  resources/product/schedule/branding/contact) è volutamente rimandata al **blocco wizard**.
  Lì si deciderà se condividere i tipi col motore via package pubblicato o copia controllata.
- Nessuna persistenza ancora: Firestore + regole (che rispecchieranno `TRANSITIONS`) sono il
  **prossimo blocco**. Poi Auth ristoratori + custom claim `admin`, poi la shell del
  cruscotto (lista locali in revisione + azioni approve/reject), poi il wizard, poi
  upload+generazione menu (riusa l'importatore del motore, #4–#6), infine la materializzazione
  nel progetto operativo.

---

## #1 — Fondazione auth + identità (email + Google), headless · 05/08/2026

Prerequisito delle regole Firestore: per scriverle serve stabilire COME si è
`owner` o `admin`. Scelta dell'utente: abilitare **entrambi** i provider
(email/password e Google). Punto chiave: la scelta del provider cambia la UI di
login e la config console, **non** il modello di identità — un `uid` è un `uid`,
e `admin` è un custom claim, indipendente dal come ci si è autenticati. Perciò il
blocco è **headless**: la UI di login/registrazione è il blocco successivo.

**Fatto**
- `package.json`: aggiunte `firebase` (client) e `firebase-admin` (dev, per lo
  script); nuovo script `set-admin`.
- `src/vite-env.d.ts` (nuovo): tipi `VITE_FB_*` dichiarati a mano (Vite non è
  ancora nel progetto; da sostituire con `vite/client` al blocco UI).
- `src/lib/firebase.ts` (nuovo): init del progetto HUB (app/auth/db), separato dai
  progetti operativi dei locali.
- `src/lib/auth.ts` (nuovo): `registerWithEmail`, `signInWithEmail`,
  `signInWithGoogle` (popup), `signOutHub`, `onAuthChange`, e `authErrorMessage`
  (codici Firebase → messaggi italiani, così la UI non conosce i codici).
- `src/lib/identity.ts` (nuovo): il PONTE al dominio #0. `roleFromClaims` /
  `actorFromClaims` (puri) + `currentActor` (wrapper su `getIdTokenResult`).
- `src/lib/identity.test.ts` (nuovo): 5 test — `admin` solo col booleano `true`;
  claim assenti/vuoti/estranei → `owner`; valori truthy non booleani NON
  promuovono (no privilege escalation).
- `scripts/set-admin.mjs` (nuovo): assegna/revoca (`--revoke`) il claim `admin`
  via Admin SDK + `revokeRefreshTokens` perché sia effettivo al prossimo accesso.
  Il claim NON è assegnabile dal client (sarebbe auto-promozione).
- `.env.example` (nuovo): env del progetto HUB (`VITE_FB_*` + `FIREBASE_SERVICE_ACCOUNT`).

**Verifica:** `npx tsc --noEmit` ✓ · `npx vitest run` → **23/23** ✓ (18 dominio + 5
identità) · `node --check scripts/set-admin.mjs` ✓. (Eseguiti qui.)
**NON verificato (runtime):** `firebase.ts`, i wrapper di `auth.ts` e `currentActor`
usano firebase/auth reale → solo `tsc`, non provati a runtime (serve il progetto HUB
con i due provider abilitati in console).

**Perché:** tenere `admin` come custom claim server-side (mai client) è ciò che
rende sicuro il gate: senza, chiunque si dichiarerebbe admin. `roleFromClaims`
fallisce verso `owner` (il ruolo meno privilegiato) su qualsiasi input ambiguo.

**Nota / debiti aperti:**
- **App Check** non ancora attivo: l'hub accetta registrazioni esterne → va aggiunto
  (reCAPTCHA v3, come nel motore) prima del go-live pubblico.
- I due provider vanno **abilitati in console** (Authentication → Sign-in method);
  il codice li presuppone entrambi.
- **Prossimo blocco: dato + regole Firestore** su `locali/{id}`, con le regole che
  rispecchiano `TRANSITIONS` (#0) e usano `request.auth.uid` (owner) e il claim
  `admin` (questo blocco). Poi la UI di login/registrazione (con Vite/React).

---

## #2 — Persistenza: dato + regole Firestore su `locali/{id}` · 05/08/2026

Aggancia l'approval gate a una persistenza reale. Ora ci sono entrambi i pezzi che
le regole richiedono: `request.auth.uid` per la proprietà (owner, #1) e il claim
`admin` (#1). Le regole **rispecchiano `TRANSITIONS`** del dominio (#0), così la
verità server e quella applicativa non divergono.

**Fatto**
- `src/lib/localeStore.ts` (nuovo): collezione `locali`. `createLocale` (bozza,
  di proprietà dell'utente), `updateDraft` (nome/config in bozza), `performAction`
  (transazione: legge il doc → `apply` del dominio decide → persiste solo i campi
  cambiati; lancia `LocaleActionError` col motivo se il dominio rifiuta),
  `subscribeMine` (area ristoratore), `subscribePending` (cruscotto admin),
  `subscribeLocale` (dettaglio). Tipo persistito `LocaleDoc = Omit<LocaleRecord,"id">`.
- `firestore.rules` (nuovo): `isAdmin()` = claim `admin`; per `locali/{id}`:
  **read** owner-del-doc o admin; **create** solo un proprio locale, in `bozza`,
  pulito; **update** in due casi — (a) edit dati in bozza dall'owner a stato
  invariato, (b) transizione lecita per il ruolo (`ownerTransition`/`adminTransition`
  che ricalcano `TRANSITIONS`), con `ownerUid`/`createdAt` immutabili; **delete**
  solo admin. Guardrail largo sulla forma (tipi + enum di stato). Resto: chiuso.
- `firestore.indexes.json` (nuovo): indici compositi `ownerUid+updatedAt` (subscribeMine)
  e `status+updatedAt` (subscribePending).
- `firebase.json` (nuovo): mappa rules+indexes per `firebase deploy --only firestore`.

**Verifica:** `npx.cmd tsc --noEmit` ✓ (ora copre lo store Firestore) · `npx.cmd vitest
run` → **23/23** ✓ (dominio+identità invariati). (Eseguiti qui.)
**NON verificato:** `firestore.rules` — sintassi e logica NON provate (né emulatore né
`firebase deploy` disponibili qui); lo store `localeStore.ts` usa firebase/firestore reale
→ solo `tsc`, runtime non provato.

**Perché:** tenere le transizioni lecite in un unico posto concettuale (`TRANSITIONS`) e
rispecchiarle nelle regole evita il bug classico dei sistemi a workflow: UI e server che
permettono cose diverse. Lo store usa `apply` per non tentare scritture che le regole
rifiuterebbero comunque.

**Nota / debiti aperti:**
- **Test regole** con `@firebase/rules-unit-testing` + emulatore: da aggiungere (come nel
  motore). Finché non ci sono, le regole vanno provate a mano in staging.
- **Da fare in console/CLI (tu):** pubblicare `firestore.rules` e creare i due indici
  compositi (Firestore offre il link di creazione al primo caricamento delle query).
- Guardrail largo: `reviewNotes` non è validato in dettaglio (solo `is list`); il contenuto
  fine e la `config` del wizard saranno governati quando la forma sarà definita.
- Timestamp `number` lato client (coerenti col dominio); `serverTimestamp` è una miglioria
  futura che cambierebbe il tipo del dominio.

**Prossimo blocco:** UI di login/registrazione (Vite/React) — la faccia dei wrapper auth
(#1) su questa persistenza. Qui entra Vite → sostituire `src/vite-env.d.ts` con `vite/client`.

---

## #3 — UI di accesso/registrazione (Vite + React, due provider) · 05/08/2026

Il primo pezzo avviabile e provabile nel browser. Entra Vite/React nel progetto (finora
headless). La UI è la faccia dei wrapper auth (#1) sulla persistenza (#2).

**Fatto**
- Scaffold Vite+React: `package.json` (+`react`/`react-dom`/`vite`/`@vitejs/plugin-react`/
  tipi; script `dev`/`build`/`preview`), `vite.config.ts`, `index.html`, `src/main.tsx`,
  `tsconfig.json` (+`jsx: react-jsx`), `src/vite-env.d.ts` (ora `/// <reference vite/client`).
- `src/styles.css` (nuovo): sistema visivo — carta calda, pannello brand verde oliva,
  accento ambra brace, font di SISTEMA (nessuna dipendenza da Google Fonts, coerente col
  vincolo proxy/GDPR del motore). Quality floor: focus visibile, responsive a colonna sotto
  900px, `prefers-reduced-motion`.
- `src/App.tsx` (nuovo): osserva `onAuthChange` (#1); loading → `AuthScreen` → `Home`.
- `src/pages/AuthScreen.tsx` (nuovo): accesso e registrazione con toggle, email/password +
  **Continua con Google**, errori tradotti (`authErrorMessage`). Signature del design: il
  **percorso di onboarding a 4 tappe** che rispecchia gli stati del dominio
  (bozza→in_revisione→approvato→attivo) — contenuto vero, non decorazione.
- `src/pages/Home.tsx` (nuovo): landing post-login onesta (saluto + "cruscotto in arrivo" +
  Esci). Segnaposto del prossimo blocco.

**Verifica:** `npx.cmd tsc --noEmit` ✓ · `npx.cmd vite build` ✓ · `npx.cmd vitest run` →
**23/23** ✓ (dominio+identità invariati). (Eseguiti qui.)
**NON verificato (runtime):** le pagine `.tsx` non sono provate a runtime in questo ambiente
(niente browser) — solo `tsc`+build. Il giro reale (registrazione/login coi due provider) va
provato con `npm.cmd run dev` sul progetto HUB con `.env` valorizzato e i provider abilitati.

**Perché:** dare presto qualcosa di tangibile e provabile (era la priorità dell'utente:
"interfaccia di logging dei nuovi utenti"), costruita sopra fondamenta già testate — la UI è
sottile, la logica sta sotto.

**Nota / debiti aperti:**
- **App Check** ancora spento: prima del go-live pubblico (registrazioni esterne).
- **Font display self-hostato**: ora si usano font di sistema; un display face caratteristico
  self-hostato (come Poppins nel motore) è una rifinitura.
- Reset password e verifica email: non ancora presenti (aggiungibili nei wrapper auth).
- **Prossimo blocco: shell del cruscotto** — `subscribeMine`+`createLocale` (area
  ristoratore) e `subscribePending`+`performAction` (approvazioni admin), con `reviewNotes`.
