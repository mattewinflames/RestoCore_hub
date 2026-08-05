import { describe, it, expect } from "vitest";
import { roleFromClaims, actorFromClaims } from "./identity";

describe("identity · roleFromClaims (fail-safe verso owner)", () => {
  it("admin solo con il booleano true", () => {
    expect(roleFromClaims({ admin: true })).toBe("admin");
  });

  it("claim assenti o vuoti → owner", () => {
    expect(roleFromClaims(null)).toBe("owner");
    expect(roleFromClaims(undefined)).toBe("owner");
    expect(roleFromClaims({})).toBe("owner");
  });

  it("valori 'truthy' ma non booleani NON promuovono (no escalation)", () => {
    expect(roleFromClaims({ admin: "true" })).toBe("owner");
    expect(roleFromClaims({ admin: 1 })).toBe("owner");
    expect(roleFromClaims({ admin: false })).toBe("owner");
  });

  it("claim estranei non influenzano il ruolo", () => {
    expect(roleFromClaims({ role: "admin", isAdmin: true })).toBe("owner");
  });
});

describe("identity · actorFromClaims", () => {
  it("compone uid + ruolo derivato", () => {
    expect(actorFromClaims("u-matteo", { admin: true })).toEqual({ uid: "u-matteo", role: "admin" });
    expect(actorFromClaims("u-mario", {})).toEqual({ uid: "u-mario", role: "owner" });
  });
});
