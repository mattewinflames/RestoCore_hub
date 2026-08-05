import { describe, it, expect } from "vitest";
import type { Actor, LocaleRecord } from "./locale";
import { apply, can, availableActions, type LocaleAction } from "./approval";

const OWNER: Actor = { uid: "u-owner", role: "owner" };
const OTHER_OWNER: Actor = { uid: "u-altro", role: "owner" };
const ADMIN: Actor = { uid: "u-matteo", role: "admin" };

function loc(status: LocaleRecord["status"], over: Partial<LocaleRecord> = {}): LocaleRecord {
  return {
    id: "l1",
    name: "Da Mario",
    ownerUid: OWNER.uid,
    status,
    reviewNotes: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...over,
  };
}

describe("approval · stato di partenza (from)", () => {
  it("submit parte solo da bozza", () => {
    expect(can("submit", loc("bozza"), OWNER).ok).toBe(true);
    const r = can("submit", loc("approvato"), OWNER);
    expect(r).toEqual({ ok: false, reason: "stato_incompatibile" });
  });

  it("approve parte solo da in_revisione", () => {
    expect(can("approve", loc("in_revisione"), ADMIN).ok).toBe(true);
    expect(can("approve", loc("bozza"), ADMIN)).toEqual({ ok: false, reason: "stato_incompatibile" });
  });

  it("suspend/resume vivono solo tra attivo e sospeso", () => {
    expect(can("suspend", loc("attivo"), ADMIN).ok).toBe(true);
    expect(can("resume", loc("sospeso"), ADMIN).ok).toBe(true);
    expect(can("suspend", loc("sospeso"), ADMIN)).toEqual({ ok: false, reason: "stato_incompatibile" });
  });
});

describe("approval · ruolo e proprietà", () => {
  it("un owner non può approvare (è prerogativa admin)", () => {
    expect(can("approve", loc("in_revisione"), OWNER)).toEqual({ ok: false, reason: "ruolo_non_autorizzato" });
  });

  it("un admin non compie le azioni riservate all'owner (submit)", () => {
    expect(can("submit", loc("bozza"), ADMIN)).toEqual({ ok: false, reason: "ruolo_non_autorizzato" });
  });

  it("un owner NON può agire sul locale di un altro owner", () => {
    expect(can("submit", loc("bozza"), OTHER_OWNER)).toEqual({ ok: false, reason: "non_proprietario" });
  });

  it("l'admin agisce su qualsiasi locale, non solo sul proprio", () => {
    const altrui = loc("in_revisione", { ownerUid: "chiunque" });
    expect(can("approve", altrui, ADMIN).ok).toBe(true);
  });
});

describe("approval · precondizione nota sul reject", () => {
  it("reject senza nota è rifiutato", () => {
    expect(can("reject", loc("in_revisione"), ADMIN)).toEqual({ ok: false, reason: "nota_mancante" });
    expect(can("reject", loc("in_revisione"), ADMIN, { note: "   " })).toEqual({ ok: false, reason: "nota_mancante" });
  });

  it("reject con nota è ammesso e la nota viene registrata", () => {
    const out = apply("reject", loc("in_revisione"), ADMIN, { note: "  Manca l'orario del pranzo  ", now: 2000 });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.record.status).toBe("bozza");
      expect(out.record.reviewNotes).toHaveLength(1);
      expect(out.record.reviewNotes[0]).toEqual({ by: ADMIN.uid, text: "Manca l'orario del pranzo", at: 2000 });
    }
  });
});

describe("approval · apply è immutabile e fa avanzare updatedAt", () => {
  it("non muta il record in ingresso", () => {
    const before = loc("in_revisione");
    const snapshot = structuredClone(before);
    apply("approve", before, ADMIN, { now: 5000 });
    expect(before).toEqual(snapshot); // invariato
  });

  it("il nuovo record ha stato e updatedAt aggiornati", () => {
    const out = apply("approve", loc("in_revisione", { updatedAt: 1000 }), ADMIN, { now: 7000 });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.record.status).toBe("approvato");
      expect(out.record.updatedAt).toBe(7000);
    }
  });

  it("apply su azione illecita riporta il motivo, non un record", () => {
    const out = apply("approve", loc("bozza"), ADMIN);
    expect(out).toEqual({ ok: false, reason: "stato_incompatibile" });
  });
});

describe("approval · availableActions (per abilitare i pulsanti)", () => {
  it("in bozza, l'owner vede solo submit", () => {
    expect(availableActions(loc("bozza"), OWNER)).toEqual(["submit"]);
  });

  it("in bozza, l'admin non vede azioni (attende la sottomissione)", () => {
    expect(availableActions(loc("bozza"), ADMIN)).toEqual([]);
  });

  it("in revisione, l'admin vede approve e reject; l'owner vede withdraw", () => {
    const adminActions = availableActions(loc("in_revisione"), ADMIN);
    expect(new Set(adminActions)).toEqual(new Set<LocaleAction>(["approve", "reject"]));
    expect(availableActions(loc("in_revisione"), OWNER)).toEqual(["withdraw"]);
  });

  it("reject compare tra le azioni pur richiedendo una nota (chiesta al click)", () => {
    expect(availableActions(loc("in_revisione"), ADMIN)).toContain("reject");
  });
});

describe("approval · percorso completo di onboarding", () => {
  it("bozza → in_revisione → approvato → attivo → sospeso → attivo", () => {
    let rec = loc("bozza");
    const step = (action: LocaleAction, actor: Actor, now: number) => {
      const out = apply(action, rec, actor, { now });
      expect(out.ok).toBe(true);
      if (out.ok) rec = out.record;
    };

    step("submit", OWNER, 10);
    expect(rec.status).toBe("in_revisione");
    step("approve", ADMIN, 20);
    expect(rec.status).toBe("approvato");
    step("activate", ADMIN, 30);
    expect(rec.status).toBe("attivo");
    step("suspend", ADMIN, 40);
    expect(rec.status).toBe("sospeso");
    step("resume", ADMIN, 50);
    expect(rec.status).toBe("attivo");
  });

  it("percorso di rifiuto: submit → reject (con nota) → torna in bozza → re-submit", () => {
    let rec = loc("bozza");
    let out = apply("submit", rec, OWNER, { now: 10 });
    expect(out.ok && out.record.status).toBe("in_revisione");
    if (out.ok) rec = out.record;

    out = apply("reject", rec, ADMIN, { note: "Correggi i prezzi", now: 20 });
    expect(out.ok && out.record.status).toBe("bozza");
    if (out.ok) rec = out.record;
    expect(rec.reviewNotes).toHaveLength(1);

    out = apply("submit", rec, OWNER, { now: 30 });
    expect(out.ok && out.record.status).toBe("in_revisione");
  });
});
