import { useState } from "react";
import type { User } from "firebase/auth";
import { signOutHub } from "../lib/auth";

export default function Home({ user }: { user: User }) {
  const [busy, setBusy] = useState(false);
  const who = user.displayName?.trim() || user.email || "ristoratore";

  async function onLogout() {
    setBusy(true);
    try {
      await signOutHub();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rc-home">
      <div className="rc-home-card">
        <span className="rc-badge">Account attivo</span>
        <h2>Ciao, <span className="rc-home-who">{who}</span></h2>
        <p>
          Sei dentro. Il tuo cruscotto è in costruzione: da qui, a breve, potrai creare il
          primo locale e seguirne l'approvazione. Torna presto.
        </p>
        <button className="rc-btn rc-btn-ghost rc-btn-inline" onClick={onLogout} disabled={busy}>
          {busy ? "Esco…" : "Esci"}
        </button>
      </div>
    </div>
  );
}
