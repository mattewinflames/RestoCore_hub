/* ============================================================================
   Auth dell'HUB — accesso dei ristoratori.
   ----------------------------------------------------------------------------
   Due provider abilitati (deciso con l'utente): email/password e Google. Da
   codice sono due strade verso lo stesso risultato — un utente Firebase con un
   `uid` — quindi il resto del sistema (identità, ruoli, regole) non distingue
   COME ci si è autenticati. Vanno però abilitati entrambi nella console del
   progetto HUB (Authentication → Sign-in method).

   Questo modulo è un wrapper sottile su firebase/auth: NON è testabile a runtime
   qui (serve un progetto vero). La logica pura (derivazione del ruolo) sta in
   `identity.ts` ed è quella testata.
   ========================================================================== */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "./firebase";

const google = new GoogleAuthProvider();

/** Registra un nuovo ristoratore con email/password. `displayName` opzionale
 *  (il nome della persona, non del locale: quello si sceglie nel wizard). */
export async function registerWithEmail(email: string, password: string, displayName?: string): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (displayName?.trim()) await updateProfile(cred.user, { displayName: displayName.trim() });
  return cred.user;
}

/** Accesso con email/password. */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

/** Accesso con Google (popup). Su ambienti dove il popup è bloccato si potrà
 *  ripiegare su redirect in un secondo momento; per ora popup è sufficiente. */
export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(auth, google);
  return cred.user;
}

/** Chiude la sessione corrente. */
export function signOutHub(): Promise<void> {
  return signOut(auth);
}

/** Osserva lo stato di autenticazione. Restituisce la funzione di unsubscribe.
 *  `user` è `null` quando non c'è nessuno loggato. */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

/** Traduce i codici d'errore di Firebase Auth in messaggi leggibili in italiano.
 *  Separata dai wrapper così la UI mostra un testo umano senza conoscere i codici. */
export function authErrorMessage(err: unknown): string {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  switch (code) {
    case "auth/email-already-in-use":
      return "Questa email è già registrata. Prova ad accedere.";
    case "auth/invalid-email":
      return "L'indirizzo email non è valido.";
    case "auth/weak-password":
      return "La password è troppo debole (almeno 6 caratteri).";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email o password non corretti.";
    case "auth/too-many-requests":
      return "Troppi tentativi. Riprova tra qualche minuto.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Accesso con Google annullato.";
    case "auth/account-exists-with-different-credential":
      return "Esiste già un account con questa email ma con un altro metodo di accesso.";
    case "auth/network-request-failed":
      return "Problema di rete. Controlla la connessione (o il proxy aziendale).";
    default:
      return "Si è verificato un errore durante l'accesso. Riprova.";
  }
}
