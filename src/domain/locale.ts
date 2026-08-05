/* ============================================================================
   Dominio HUB · il LOCALE visto dal control plane
   ----------------------------------------------------------------------------
   Questo NON è il motore operativo (RestoCore per-locale): è la vista che l'hub
   ha di ogni locale mentre il ristoratore lo configura e Matteo lo approva.
   Il ciclo di vita qui è quello di ONBOARDING, non quello degli ordini.

   Confine deciso (architettura C):
     · l'hub è il piano di controllo (registrazione, wizard, cruscotto, approval);
     · alla "attivazione" il locale viene MATERIALIZZATO nel suo progetto
       operativo dedicato (provisioning manuale all'inizio). Da lì in poi gli
       ORDINI vivono nel motore, non qui.
   Perciò gli stati coprono l'onboarding fino ad "attivo"; la vita operativa
   (menu, ordini, cassa) è fuori da questo dominio.
   ========================================================================== */

/** Ciclo di vita di onboarding di un locale nel control plane. */
export type LocaleStatus =
  | "bozza" // il ristoratore sta configurando col wizard; non ancora sottomesso
  | "in_revisione" // sottomesso: in attesa dell'OK di Matteo (approval gate)
  | "approvato" // OK dato: pronto per il provisioning del progetto operativo
  | "attivo" // materializzato e operativo (progetto/deploy creati)
  | "sospeso"; // temporaneamente disattivato da Matteo

/** Ruolo dell'attore rispetto all'hub.
 *  - `owner`: un ristoratore. Può agire SOLO sul proprio locale.
 *  - `admin`: super-admin (Matteo). Può agire su qualsiasi locale. */
export type Role = "owner" | "admin";

/** Chi sta compiendo l'azione. `uid` serve a verificare la proprietà quando il
 *  ruolo è `owner` (un owner non può toccare il locale di un altro). */
export interface Actor {
  uid: string;
  role: Role;
}

/** Nota di revisione lasciata da Matteo quando rimanda una bozza al mittente. */
export interface ReviewNote {
  by: string; // uid del revisore
  text: string;
  at: number; // epoch ms
}

/** Il record del locale nell'hub. La `config` è la bozza prodotta dal wizard:
 *  qui è volutamente opaca (`unknown`) — la sua forma tipizzata (i cinque assi
 *  del tenant del motore) arriverà col blocco wizard, per non accoppiare il
 *  dominio dell'approvazione ai dettagli della configurazione. */
export interface LocaleRecord {
  id: string;
  name: string;
  ownerUid: string; // il ristoratore proprietario
  status: LocaleStatus;
  config?: unknown; // bozza del wizard (forma definita nel blocco wizard)
  reviewNotes: ReviewNote[]; // storico dei rimandi (l'ultimo è il più recente)
  createdAt: number;
  updatedAt: number;
}

/** True se l'attore è il proprietario di questo specifico locale. */
export function isOwnerOf(rec: LocaleRecord, actor: Actor): boolean {
  return actor.role === "owner" && actor.uid === rec.ownerUid;
}
