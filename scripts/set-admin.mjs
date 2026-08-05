/* ============================================================================
   scripts/set-admin.mjs — nomina (o revoca) un super-admin dell'hub.
   ----------------------------------------------------------------------------
   Il custom claim `admin` NON è assegnabile dal client (sarebbe un'auto-promozione
   banale): si mette qui, con l'Admin SDK e il service account del progetto HUB.
   Tipicamente lo lanci UNA volta sul tuo account.

   Uso:
     node --env-file=.env scripts/set-admin.mjs <email>            # promuove
     node --env-file=.env scripts/set-admin.mjs <email> --revoke   # revoca

   Richiede in .env: FIREBASE_SERVICE_ACCOUNT (JSON del service account, una riga).
   L'utente deve essersi già registrato almeno una volta (deve esistere in Auth).
   Dopo il cambio, il token dell'utente riflette il nuovo claim entro un'ora, o
   subito se rifà login / forza il refresh del token.
   ========================================================================== */
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const revoke = args.includes("--revoke");

if (!email) {
  console.error("Uso: node --env-file=.env scripts/set-admin.mjs <email> [--revoke]");
  process.exit(1);
}

const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!raw) {
  console.error("FIREBASE_SERVICE_ACCOUNT mancante in .env (JSON del service account del progetto HUB).");
  process.exit(1);
}

const svc = JSON.parse(raw);
// I \n della private_key arrivano come stringa in env: vanno ripristinati.
if (typeof svc.private_key === "string") svc.private_key = svc.private_key.replace(/\\n/g, "\n");

initializeApp({ credential: cert(svc) });
const auth = getAuth();

try {
  const user = await auth.getUserByEmail(email);
  const current = user.customClaims ?? {};
  const next = { ...current, admin: revoke ? false : true };
  await auth.setCustomUserClaims(user.uid, next);
  // Revoca i refresh token così il nuovo claim è effettivo al prossimo accesso.
  await auth.revokeRefreshTokens(user.uid);
  console.log(`${revoke ? "Revocato" : "Assegnato"} il ruolo admin a ${email} (uid ${user.uid}).`);
  console.log("L'utente deve rifare login (o forzare il refresh del token) perché abbia effetto.");
} catch (e) {
  if (e && typeof e === "object" && "code" in e && e.code === "auth/user-not-found") {
    console.error(`Nessun utente con email ${email}. Deve prima registrarsi nell'hub.`);
  } else {
    console.error("Errore:", e);
  }
  process.exit(1);
}
