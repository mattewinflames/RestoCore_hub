/* ============================================================================
   Dominio HUB · macchina a stati dell'APPROVAL GATE
   ----------------------------------------------------------------------------
   Il perno dell'architettura C: un locale non diventa operativo finché Matteo
   non dà l'OK. Qui vive, come LOGICA PURA e testabile, la verità su:
     · quali transizioni di stato sono lecite (da → a);
     · chi può compierle (owner del locale vs super-admin);
     · quali precondizioni hanno (es. un rifiuto DEVE avere una nota).

   Nessun accesso a Firestore, nessun React: solo funzioni pure. Le regole
   Firestore (blocco successivo) rispecchieranno queste stesse transizioni lato
   server; la UI del cruscotto (blocco ancora dopo) sarà la faccia di `apply`.
   Tenere la verità qui, una volta sola e testata, evita che regole e UI
   divergano nel tempo.
   ========================================================================== */
import type { Actor, LocaleRecord, LocaleStatus, ReviewNote, Role } from "./locale";
import { isOwnerOf } from "./locale";

/** Le azioni che muovono un locale nel suo ciclo di onboarding. */
export type LocaleAction =
  | "submit" // il ristoratore manda la bozza in revisione
  | "withdraw" // il ristoratore ritira la propria sottomissione
  | "approve" // Matteo dà l'OK
  | "reject" // Matteo rimanda in bozza con una nota
  | "activate" // Matteo segna "attivo" dopo il provisioning del progetto operativo
  | "suspend" // Matteo sospende un locale attivo
  | "resume"; // Matteo riattiva un locale sospeso

/** Definizione di una transizione: da quale stato, a quale stato, e per quali
 *  ruoli è ammessa. `requiresNote` marca le azioni che esigono un testo (reject). */
interface Transition {
  from: LocaleStatus;
  to: LocaleStatus;
  roles: Role[];
  requiresNote?: boolean;
}

/** Tabella unica delle transizioni lecite. È la FONTE DI VERITÀ del gate.
 *  Nota: `owner` è ulteriormente ristretto alla PROPRIETÀ del locale in `can()`;
 *  qui `roles` dice solo quale categoria di attore è in gioco. */
export const TRANSITIONS: Record<LocaleAction, Transition> = {
  submit: { from: "bozza", to: "in_revisione", roles: ["owner"] },
  withdraw: { from: "in_revisione", to: "bozza", roles: ["owner"] },
  approve: { from: "in_revisione", to: "approvato", roles: ["admin"] },
  reject: { from: "in_revisione", to: "bozza", roles: ["admin"], requiresNote: true },
  activate: { from: "approvato", to: "attivo", roles: ["admin"] },
  suspend: { from: "attivo", to: "sospeso", roles: ["admin"] },
  resume: { from: "sospeso", to: "attivo", roles: ["admin"] },
};

/** Contesto opzionale di un'azione (oggi: la nota per il rifiuto; l'orario
 *  iniettabile per testabilità deterministica). */
export interface ActionContext {
  note?: string;
  now?: number; // default: Date.now() — iniettabile nei test
}

export type Denial =
  | "stato_incompatibile" // l'azione non parte da questo stato
  | "ruolo_non_autorizzato" // il ruolo non può compiere questa azione
  | "non_proprietario" // owner che agisce su un locale non suo
  | "nota_mancante"; // reject senza testo

export type CanResult = { ok: true } | { ok: false; reason: Denial };

/** Può `actor` compiere `action` su `rec`, dato `ctx`? Pura, nessun effetto.
 *  Ordine dei controlli scelto per dare il motivo più specifico e utile:
 *  prima lo stato, poi il ruolo, poi la proprietà, infine la nota. */
export function can(
  action: LocaleAction,
  rec: LocaleRecord,
  actor: Actor,
  ctx: ActionContext = {},
): CanResult {
  const t = TRANSITIONS[action];
  if (rec.status !== t.from) return { ok: false, reason: "stato_incompatibile" };
  if (!t.roles.includes(actor.role)) return { ok: false, reason: "ruolo_non_autorizzato" };
  if (actor.role === "owner" && !isOwnerOf(rec, actor)) {
    return { ok: false, reason: "non_proprietario" };
  }
  if (t.requiresNote && !ctx.note?.trim()) return { ok: false, reason: "nota_mancante" };
  return { ok: true };
}

export type ApplyResult =
  | { ok: true; record: LocaleRecord }
  | { ok: false; reason: Denial };

/** Applica l'azione restituendo un NUOVO record (immutabile: non muta l'input).
 *  Se l'azione non è lecita, riporta lo stesso motivo di `can`. Il `reject`
 *  appende la nota allo storico; `updatedAt` avanza sempre a `now`. */
export function apply(
  action: LocaleAction,
  rec: LocaleRecord,
  actor: Actor,
  ctx: ActionContext = {},
): ApplyResult {
  const verdict = can(action, rec, actor, ctx);
  if (!verdict.ok) return verdict;

  const now = ctx.now ?? Date.now();
  const t = TRANSITIONS[action];

  const reviewNotes: ReviewNote[] =
    action === "reject"
      ? [...rec.reviewNotes, { by: actor.uid, text: ctx.note!.trim(), at: now }]
      : rec.reviewNotes;

  return {
    ok: true,
    record: { ...rec, status: t.to, reviewNotes, updatedAt: now },
  };
}

/** Elenco delle azioni che `actor` può compiere ORA su `rec` (per abilitare i
 *  pulsanti nel cruscotto senza duplicare la logica di `can`). */
export function availableActions(rec: LocaleRecord, actor: Actor): LocaleAction[] {
  return (Object.keys(TRANSITIONS) as LocaleAction[]).filter((a) => {
    // per `reject` la nota manca a UI-time: valutiamo l'idoneità ignorando la
    // precondizione-nota (il pulsante appare; la nota si chiede al click).
    const probe: ActionContext = TRANSITIONS[a].requiresNote ? { note: "x" } : {};
    return can(a, rec, actor, probe).ok;
  });
}
