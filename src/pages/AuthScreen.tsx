import { useState } from "react";
import { registerWithEmail, signInWithEmail, signInWithGoogle, authErrorMessage } from "../lib/auth";

type Mode = "login" | "register";

/* Le quattro tappe del percorso di onboarding: rispecchiano gli stati del
   dominio (bozza → in_revisione → approvato → attivo). È contenuto vero del
   prodotto, non decorazione. */
const PERCORSO = [
  { t: "Crea l'account", d: "Email o Google, in un minuto." },
  { t: "Configura il locale", d: "Orari, menu e cassa dal wizard guidato." },
  { t: "Approvazione", d: "Diamo un'occhiata e sblocchiamo il locale." },
  { t: "Vai online", d: "Ordini e cassa attivi per i tuoi clienti." },
];

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isRegister = mode === "register";

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      if (isRegister) await registerWithEmail(email, password, name);
      else await signInWithEmail(email, password);
      // Al successo, l'observer in App cambia schermata da solo.
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  async function onGoogle() {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(isRegister ? "login" : "register");
    setError("");
  }

  return (
    <div className="rc-app rc-split">
      <aside className="rc-brand">
        <div className="rc-wordmark">
          RestoCore <small>HUB</small>
        </div>

        <div>
          <h1 className="rc-thesis">
            Il tuo locale, <em>dal menu alla cassa</em>.
          </h1>
          <p className="rc-sub">
            Prepara ordini e cassa del tuo ristorante senza scrivere una riga di codice.
            Tu configuri, noi mettiamo online.
          </p>
        </div>

        <ol className="rc-path">
          {PERCORSO.map((s, i) => (
            <li className="rc-step" key={s.t}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <span className="t">
                {s.t}
                <span className="d">{s.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </aside>

      <main className="rc-auth">
        <div className="rc-card">
          <h2 className="rc-h1">{isRegister ? "Crea il tuo account" : "Bentornato"}</h2>
          <p className="rc-lede">
            {isRegister
              ? "Bastano email e password. Il locale lo configuri dopo."
              : "Accedi per riprendere da dove avevi lasciato."}
          </p>

          {error && (
            <div className="rc-error" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={onSubmitEmail} noValidate>
            {isRegister && (
              <div className="rc-field">
                <label className="rc-label" htmlFor="name">
                  Nome
                </label>
                <input
                  id="name"
                  className="rc-input"
                  type="text"
                  autoComplete="name"
                  placeholder="Come ti chiami"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="rc-field">
              <label className="rc-label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="rc-input"
                type="email"
                autoComplete="email"
                required
                placeholder="tu@iltuolocale.it"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="rc-field">
              <label className="rc-label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="rc-input"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
                placeholder={isRegister ? "Almeno 6 caratteri" : "La tua password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button className="rc-btn rc-btn-primary" type="submit" disabled={busy}>
              {busy ? "Un attimo…" : isRegister ? "Crea account" : "Accedi"}
            </button>
          </form>

          <div className="rc-or">oppure</div>

          <button className="rc-btn rc-btn-ghost" type="button" onClick={onGoogle} disabled={busy}>
            <GoogleMark />
            Continua con Google
          </button>

          <p className="rc-switch">
            {isRegister ? "Hai già un account? " : "Non hai ancora un account? "}
            <button className="rc-link" type="button" onClick={switchMode}>
              {isRegister ? "Accedi" : "Registrati"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="rc-g" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
