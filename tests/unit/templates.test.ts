import { describe, expect, it } from "vitest";
import {
  buildTemplateVars, evaluateCondition, includedClauses, isValidCondition, isValidTemplateText, propertyDescription, referencedVariables,
  renderContract, renderText, TemplateError, truthy, unitTypeLabel, type TemplateVarsInput,
} from "@/domain/templates";
import { INVESTMENT_TEMPLATE, RESIDENTIAL_TEMPLATE } from "@/domain/template-seeds";

describe("condition language", () => {
  const vars = { utilities_party: "owner", free_months: 2, unit_paci: "", flag: true, zero: 0, name: "x" };
  it.each([
    ["utilities_party == 'owner'", true],
    ["utilities_party != 'owner'", false],
    ["free_months > 0", true],
    ["free_months >= 3", false],
    ["free_months < 3", true],
    ["free_months <= 1", false],
    ["unit_paci != ''", false],
    ["!flag", false],
    ["!(free_months > 5) && flag", true],
    ["zero || name == \"x\"", true],
    ["zero && flag", false],
    ["true", true],
    ["false || missing", false],
    ["", true],
  ])("%s → %s", (expr, expected) => expect(evaluateCondition(expr, vars)).toBe(expected));
  it("errors", () => {
    expect(() => evaluateCondition("a ==", {})).toThrow(TemplateError);
    expect(() => evaluateCondition("(a", {})).toThrow(/Missing/);
    expect(() => evaluateCondition("a b", {})).toThrow(/trailing/);
    expect(() => evaluateCondition("'abc", {})).toThrow(/Unterminated/);
    expect(() => evaluateCondition("a # b", {})).toThrow(/Unexpected character/);
    expect(() => evaluateCondition(")", {})).toThrow(/Unexpected/);
    expect(isValidCondition("free_months > 0")).toBe(true);
    expect(isValidCondition("free_months >")).toBe(false);
  });
  it("truthy", () => {
    expect(truthy("0")).toBe(false);
    expect(truthy(" ")).toBe(false);
    expect(truthy(Number.NaN)).toBe(false);
    expect(truthy(null)).toBe(false);
    expect(truthy(1)).toBe(true);
  });
});

describe("text rendering", () => {
  it("placeholders, sections, inverted sections, refs", () => {
    expect(renderText("a {{x}} b", { x: 1 })).toBe("a 1 b");
    expect(renderText("{{#x}}yes{{/x}}{{^x}}no{{/x}}", { x: 0 })).toBe("no");
    expect(renderText("{{#x}}{{#y}}both{{/y}}{{/x}}", { x: 1, y: "z" })).toBe("both");
    expect(renderText("see ({{clause_ref:term}}) ({{clause_ref:nope}})", {}, { term: 4 })).toBe("see (4) (—)");
    expect(renderText("{{missing}}|{{f}}", { f: false })).toBe("|");
  });
  it("validation", () => {
    expect(() => renderText("{{#a}}x", {})).toThrow(/Unclosed/);
    expect(() => renderText("x{{/a}}", {})).toThrow(/Unbalanced/);
    expect(isValidTemplateText("{{#a}}{{/a}}")).toBe(true);
    expect(isValidTemplateText("{{#a}}")).toBe(false);
    expect(referencedVariables("{{a}} {{#b}}{{c}}{{/b}} {{clause_ref:x}}").sort()).toEqual(["a", "b", "c"]);
  });
});

describe("property description & labels", () => {
  it("residential omits empty parts", () => {
    expect(propertyDescription({ area: "صباح السالم", block: "12", street: "5", avenue: "", houseOrPlot: "43" }, "residential")).toBe("صباح السالم قطعة 12 شارع 5 منزل 43");
  });
  it("investment", () => {
    expect(propertyDescription({ area: "الري", block: "1", street: "22", houseOrPlot: "1674" }, "investment")).toBe("القسيمة رقم 1674 في الري قطعة 1 شارع 22");
  });
  it("unit type labels", () => {
    expect(unitTypeLabel(["apartment"])).toBe("شقة");
    expect(unitTypeLabel(["apartment", "apartment", "apartment"])).toBe("الشقق");
    expect(unitTypeLabel(["apartment", "shop"])).toBe("الوحدات");
    expect(unitTypeLabel([])).toBe("الوحدة");
  });
});

const residentialInput: TemplateVarsInput = {
  contractNo: "R-2026-0001",
  type: "residential",
  contractDate: "2026-02-01",
  startDate: "2026-02-01",
  firstCollectionDate: "2026-02-01",
  endDate: "2031-01-31",
  termMonths: 60,
  autoRenew: false,
  monthlyRentFils: 400000,
  purpose: "سكن عائلي",
  utilitiesParty: "owner",
  electricityFixedFils: 0,
  freeMonths: 0,
  noticePeriodMonths: 2,
  securityDepositFils: 0,
  owner: { name: "منيرة سعد العتيبي", civilId: "285010112358", phones: ["55123456"] },
  tenant: { name: "خالد فهد الحربي", civilId: "290020212345", phones: ["99112233", "66554433"] },
  property: { area: "صباح السالم", block: "12", street: "5", avenue: "3", houseOrPlot: "43", paciNo: "18834506", propertyType: "residential" },
  units: [{ label: "3", type: "apartment" }],
};

const investmentInput: TemplateVarsInput = {
  ...residentialInput,
  contractNo: "I-2026-0001",
  type: "investment",
  contractDate: "2026-10-01",
  startDate: "2026-10-01",
  firstCollectionDate: "2026-12-01",
  endDate: "2031-09-30",
  autoRenew: true,
  monthlyRentFils: 650000,
  purpose: "مكتب عقاري",
  electricityFixedFils: 3750,
  freeMonths: 2,
  noticePeriodMonths: 1,
  property: { area: "الري", block: "1", street: "22", houseOrPlot: "1674", paciNo: "30498812", propertyType: "industrial" },
  units: [{ label: "8", type: "shop", paciNo: "30498840" }],
};

describe("residential seed contract", () => {
  const vars = buildTemplateVars(residentialInput);
  const r = renderContract(RESIDENTIAL_TEMPLATE, vars);
  it("preamble day name & date", () => {
    expect(r.preamble[0]).toBe("عقد إيجار");
    expect(r.preamble[1]).toBe("انه في يوم الأحد الموافق 01/02/2026");
    expect(r.preamble).toContain("حيث إن الطرف الأول يستغل صباح السالم قطعة 12 شارع 5 جادة 3 منزل 43 الرقم الآلي للعنوان 18834506");
  });
  it("≤ 13 clauses with renumbering (grace & deposit skipped)", () => {
    expect(r.clauses).toHaveLength(11);
    expect(r.clauses.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(r.clauses[0]!.text).toBe("استأجر شقة رقم 3 لاستعماله سكن عائلي.");
    expect(r.clauses[1]!.text).toBe("الإيجار الشهري المتفق عليه هو 400.000 دينار فقط أربعمائة دينار كويتي لا غير، تدفع في بداية كل شهر ميلادي.");
    expect(r.clauses[2]!.text).toBe("مدة هذا العقد خمس سنوات تبدأ من 01/02/2026 ويحق للطرف الثاني إخلاء العين المؤجرة بخطاب خطي قبلها بشهرين.");
    expect(r.clauses[3]!.text).toContain("البند رقم (3)");
    expect(r.clauses.find((c) => c.key === "utilities")!.text).toContain("من حساب الطرف الأول وحده");
  });
  it("grace clause appears when first collection differs; references renumber", () => {
    const v = buildTemplateVars({ ...residentialInput, firstCollectionDate: "2026-03-01", securityDepositFils: 400000 });
    const rr = renderContract(RESIDENTIAL_TEMPLATE, v);
    expect(rr.clauses).toHaveLength(13);
    expect(rr.clauses[2]!.text).toBe("يبدأ استحقاق الإيجار اعتبارًا من 01/03/2026.");
    expect(rr.clauses.find((c) => c.key === "end")!.text).toContain("البند رقم (4)");
    expect(rr.clauses.find((c) => c.key === "deposit")!.text).toContain("فقط أربعمائة دينار لا غير");
    const off = renderContract(RESIDENTIAL_TEMPLATE, v, { enabled: { grace: false } });
    expect(off.clauses.find((c) => c.key === "end")!.text).toContain("البند رقم (3)");
  });
  it("text overrides and custom clauses", () => {
    const rr = renderContract(RESIDENTIAL_TEMPLATE, vars, { text: { copies: "حرر من ثلاث نسخ." } }, [{ key: "c1", text: "بند إضافي {{tenant_name}}" }, { key: "c2", text: "  " }]);
    expect(rr.clauses.at(-2)!.text).toBe("حرر من ثلاث نسخ.");
    expect(rr.clauses.at(-1)).toEqual({ number: 12, key: "c1", text: "بند إضافي خالد فهد الحربي", custom: true });
  });
});

describe("investment seed contract", () => {
  const vars = buildTemplateVars(investmentInput);
  const r = renderContract(INVESTMENT_TEMPLATE, vars);
  const text = (key: string) => r.clauses.find((c) => c.key === key)!.text;
  it("preamble Thursday", () => {
    expect(r.preamble[1]).toBe("انه في يوم الخميس الموافق 01/10/2026");
    expect(r.preamble).toContain("حيث إن الطرف الأول يستغل القسيمة رقم 1674 في الري قطعة 1 شارع 22 الرقم الآلي للعنوان 30498812");
  });
  it("25 clauses (fresh water merged, industry authority on for industrial)", () => {
    expect(r.clauses).toHaveLength(25);
    expect(r.clauses.filter((c) => c.key === "fresh_water")).toHaveLength(1);
    expect(r.clauses.some((c) => c.key === "industry_authority")).toBe(true);
    const nonIndustrial = renderContract(INVESTMENT_TEMPLATE, { ...vars, property_type: "investment" });
    expect(nonIndustrial.clauses).toHaveLength(24);
    expect(includedClauses(INVESTMENT_TEMPLATE, { ...vars, property_type: "investment" }, { enabled: { industry_authority: true } })).toHaveLength(25);
  });
  it("rent, unit PACI, free months, electricity words", () => {
    expect(text("unit")).toBe("استأجر الطرف الثاني محل رقم 8 الرقم الآلي للمحل: 30498840.");
    expect(text("rent")).toContain("قيمته 650.000 دينار كويتي فقط ستمائة وخمسون دينار كويتي لا غير");
    expect(text("term")).toContain("مدة هذا العقد خمس سنوات تبتدئ في: 01/10/2026، تجدد تلقائيًا.");
    expect(text("term")).toContain("وقد منح الطرف الثاني شهرين مجانًا ويبدأ استحقاق الإيجار في 01/12/2026");
    expect(text("utilities")).toBe(
      "دفع تأمين الكهرباء واستهلاك الكهرباء والماء من حساب الطرف الأول فقط وقيمة استهلاك الكهرباء 3.750 دينار شهريًا، فقط ثلاثة دنانير وسبعمائة وخمسون فلس لا غير.",
    );
    expect(text("termination_notice")).toContain("وقبل شهر واحد من فسخ العقد");
  });
  it("variants: no auto-renew, tenant utilities, no free months, no unit PACI", () => {
    const v = buildTemplateVars({ ...investmentInput, autoRenew: false, utilitiesParty: "tenant", freeMonths: 0, firstCollectionDate: "2026-10-01", units: [{ label: "8", type: "shop" }, { label: "9", type: "shop" }] });
    const rr = renderContract(INVESTMENT_TEMPLATE, v);
    const t = (k: string) => rr.clauses.find((c) => c.key === k)!.text;
    expect(t("term")).toBe("مدة هذا العقد خمس سنوات تبتدئ في: 01/10/2026 وتنتهي في 30/09/2031.");
    expect(t("utilities")).toBe("دفع تأمين الكهرباء واستهلاك الكهرباء والماء من حساب الطرف الثاني وحده.");
    expect(t("unit")).toBe("استأجر الطرف الثاني المحلات رقم 8، 9.");
    expect(rr.closing).toEqual([]);
  });
});
