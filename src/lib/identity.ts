/* ============================================================================
   Identità dell'HUB — dal token Firebase all'`Actor` del dominio.
   ----------------------------------------------------------------------------
   Il dominio dell'approval gate (#0) ragiona in termini di `Actor` (uid + role).
   Qui c'è il PONTE: come si ricava quel ruolo da un utente autenticato.

   Regola: `admin` è un CUSTOM CLAIM sul token, assegnato fuori banda con l'Admin
   SDK (vedi scripts/set-admin.mjs) — MAI dal client, altrimenti chiunque si
   promuoverebbe da solo. In assenza del claim, l'utente è un `owner`
   (ristoratore), che potrà agire solo sui propri locali.

   `actorFromClaims` è pura e testata; `currentActor` è il wrapper che legge i
   claim veri dal token (non testabile a runtime qui).
   ========================================================================== */
import type { User } from "firebase/auth";
import { getIdTokenResult } from "firebase/auth";
import type { Actor, Role } from "../domain/locale";

/** Deriva il ruolo dai custom claim. `admin` vale SOLO se è il booleano `true`:
 *  una stringa "true", un 1, o un claim assente non promuovono (fail-safe verso
 *  `owner`, il ruolo meno privilegiato). */
export function roleFromClaims(claims: Record<string, unknown> | null | undefined): Role {
  return claims?.admin === true ? "admin" : "owner";
}

/** Costruisce l'`Actor` del dominio da un uid e dai suoi claim. */
export function actorFromClaims(uid: string, claims: Record<string, unknown> | null | undefined): Actor {
  return { uid, role: roleFromClaims(claims) };
}

/** Legge i claim reali dal token dell'utente e ne ricava l'`Actor`.
 *  `forceRefresh` per rileggere i claim subito dopo che sono stati cambiati
 *  (di norma il token si aggiorna da solo entro un'ora). */
export async function currentActor(user: User, forceRefresh = false): Promise<Actor> {
  const token = await getIdTokenResult(user, forceRefresh);
  return actorFromClaims(user.uid, token.claims as Record<string, unknown>);
}
