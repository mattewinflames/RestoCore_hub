/* ============================================================================
   Store Firestore dell'HUB · collezione `locali/{id}`
   ----------------------------------------------------------------------------
   La persistenza del control plane. Ogni documento è un locale in onboarding;
   la sua evoluzione di stato passa SEMPRE per `performAction`, che usa `apply`
   del dominio (#0) come autorità applicativa — così lo store non tenta nemmeno
   una transizione illecita. La verità di sicurezza resta però nelle REGOLE
   Firestore (firestore.rules): questo store gira nel client e non ci si fida.

   I timestamp qui sono `number` (epoch ms, coerenti col dominio) presi dal
   client. Va bene per l'onboarding (bassa concorrenza); passare a
   `serverTimestamp` è una miglioria futura, ma cambierebbe il tipo del dominio.
   ========================================================================== */
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import { apply, type LocaleAction, type ActionContext, type Denial } from "../domain/approval";
import type { Actor, LocaleRecord } from "../domain/locale";

export const LOCALI = "locali";

/** La forma PERSISTITA: il `LocaleRecord` senza `id` (che è l'id del documento). */
export type LocaleDoc = Omit<LocaleRecord, "id">;

/** Errore applicativo di una transizione rifiutata dal dominio, con il motivo
 *  (gli stessi `Denial` di `can`), così la UI può mostrare un messaggio mirato. */
export class LocaleActionError extends Error {
  constructor(public reason: Denial) {
    super(`Azione non consentita: ${reason}`);
    this.name = "LocaleActionError";
  }
}

function toRecord(id: string, data: LocaleDoc): LocaleRecord {
  return { id, ...data };
}

/** Crea un nuovo locale in stato `bozza` di proprietà di `ownerUid`.
 *  Restituisce l'id del documento creato. La `config` (bozza wizard) arriva
 *  dopo, con `updateDraft`. */
export async function createLocale(ownerUid: string, name: string): Promise<string> {
  const now = Date.now();
  const data: LocaleDoc = {
    name: name.trim(),
    ownerUid,
    status: "bozza",
    reviewNotes: [],
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, LOCALI), data);
  return ref.id;
}

/** Aggiorna nome e/o config di una BOZZA (le regole consentono la modifica dei
 *  dati solo mentre lo stato è `bozza`). Non cambia lo stato. */
export async function updateDraft(id: string, patch: { name?: string; config?: unknown }): Promise<void> {
  const data: Record<string, unknown> = { updatedAt: Date.now() };
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.config !== undefined) data.config = patch.config;
  await updateDoc(doc(db, LOCALI, id), data);
}

/** Applica un'azione del gate (submit/approve/reject/...) in transazione:
 *  legge il documento, lascia decidere al dominio, poi persiste solo i campi
 *  che cambiano. Lancia `LocaleActionError` se il dominio rifiuta (ma la parola
 *  finale è comunque delle regole lato server). */
export async function performAction(
  id: string,
  action: LocaleAction,
  actor: Actor,
  ctx: ActionContext = {},
): Promise<LocaleRecord> {
  const ref = doc(db, LOCALI, id);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("locale inesistente");
    const rec = toRecord(snap.id, snap.data() as LocaleDoc);
    const out = apply(action, rec, actor, { ...ctx, now: Date.now() });
    if (!out.ok) throw new LocaleActionError(out.reason);
    tx.update(ref, {
      status: out.record.status,
      reviewNotes: out.record.reviewNotes,
      updatedAt: out.record.updatedAt,
    });
    return out.record;
  });
}

/** Sottoscrive i locali di un ristoratore (per la sua area), più recenti prima. */
export function subscribeMine(uid: string, cb: (locali: LocaleRecord[]) => void): Unsubscribe {
  const q = query(collection(db, LOCALI), where("ownerUid", "==", uid), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toRecord(d.id, d.data() as LocaleDoc))));
}

/** Sottoscrive i locali in attesa di approvazione (per il cruscotto admin),
 *  più recenti prima. Richiede il claim `admin` (le regole filtrano la lettura). */
export function subscribePending(cb: (locali: LocaleRecord[]) => void): Unsubscribe {
  const q = query(collection(db, LOCALI), where("status", "==", "in_revisione"), orderBy("updatedAt", "desc"));
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => toRecord(d.id, d.data() as LocaleDoc))));
}

/** Sottoscrive un singolo locale (per la pagina di dettaglio / wizard). */
export function subscribeLocale(id: string, cb: (locale: LocaleRecord | null) => void): Unsubscribe {
  return onSnapshot(doc(db, LOCALI, id), (snap) =>
    cb(snap.exists() ? toRecord(snap.id, snap.data() as LocaleDoc) : null),
  );
}
