import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkMessages, icuArgs } from "../../scripts/check-i18n";

describe("i18n completeness", () => {
  it("ar and en have identical keys and ICU arguments", () => {
    expect(checkMessages()).toEqual([]);
  });

  it("detects missing keys, empty messages and mismatched arguments", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "i18n-"));
    mkdirSync(path.join(dir, "ar"));
    mkdirSync(path.join(dir, "en"));
    writeFileSync(path.join(dir, "ar", "x.json"), JSON.stringify({ a: "مرحبا {name}", b: "نص", c: "" }));
    writeFileSync(path.join(dir, "en", "x.json"), JSON.stringify({ a: "Hello", c: "x", d: "only en" }));
    expect(checkMessages(dir).sort()).toEqual(["ar: empty x.c", "ar: missing x.d", "en: missing x.b", "x.a: arguments differ (ar: {name} en: {})"].sort());
  });

  it("collects arguments inside plural branches", () => {
    expect(icuArgs("{count, plural, one {# دفعة من {tenant}} other {# دفعات}}")).toEqual(["count", "tenant"]);
  });
});
