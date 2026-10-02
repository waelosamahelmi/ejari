import { describe, expect, it } from "vitest";
import {
  checklistComplete,
  checklistProgress,
  passwordProblem,
  setupChecklist,
  type SetupCounts,
} from "../../src/domain/account";

const counts = (over: Partial<SetupCounts> = {}): SetupCounts => ({
  orgNamed: true,
  hasLogo: true,
  properties: 1,
  units: 4,
  tenants: 1,
  contracts: 1,
  payments: 1,
  members: 2,
  ...over,
});

describe("passwordProblem", () => {
  it("rejects short passwords", () => {
    expect(passwordProblem("Ab1")).toBe("short");
    expect(passwordProblem("")).toBe("short");
  });
  it("rejects letters-only and digits-only", () => {
    expect(passwordProblem("password")).toBe("weak");
    expect(passwordProblem("12345678")).toBe("weak");
  });
  it("accepts a letter+digit password of 8+", () => {
    expect(passwordProblem("Demo12345!")).toBeNull();
    expect(passwordProblem("abcd1234")).toBeNull();
  });
});

describe("setupChecklist", () => {
  it("maps counts to the fixed order with hrefs", () => {
    const items = setupChecklist(counts());
    expect(items.map((i) => i.key)).toEqual([
      "profile",
      "property",
      "units",
      "tenant",
      "contract",
      "payment",
      "team",
      "tour",
    ]);
    expect(items.find((i) => i.key === "property")!.href).toBe("/properties?new=1");
    expect(items.find((i) => i.key === "tour")!.href).toBe("?tour=1");
  });

  it("marks each step from its own count", () => {
    const items = setupChecklist(
      counts({ orgNamed: false, hasLogo: false, properties: 0, units: 0, members: 1 }),
    );
    const by = Object.fromEntries(items.map((i) => [i.key, i.done]));
    expect(by.profile).toBe(false);
    expect(by.property).toBe(false);
    expect(by.units).toBe(false);
    expect(by.tenant).toBe(true);
    expect(by.team).toBe(false);
    expect(by.tour).toBe(false);
  });

  it("profile requires both the name and the logo", () => {
    expect(setupChecklist(counts({ hasLogo: false }))[0]!.done).toBe(false);
    expect(setupChecklist(counts({ orgNamed: false }))[0]!.done).toBe(false);
  });
});

describe("checklistComplete / progress", () => {
  it("ignores the tour row", () => {
    expect(checklistComplete(setupChecklist(counts()))).toBe(true);
    expect(checklistComplete(setupChecklist(counts({ payments: 0 })))).toBe(false);
  });
  it("computes a fraction without the tour row", () => {
    expect(checklistProgress(setupChecklist(counts()))).toBe(1);
    expect(checklistProgress(setupChecklist(counts({ payments: 0, members: 1 })))).toBeCloseTo(5 / 7);
  });
});
