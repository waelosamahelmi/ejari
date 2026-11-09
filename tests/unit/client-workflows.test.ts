import { describe, expect, it } from "vitest";
import { tenantSchema, unitSchema } from "@/lib/schemas/master";
import { discountSchema } from "@/lib/schemas/contract";
import { can } from "@/lib/permissions";
import { fullPropertyAddress } from "@/domain/property-address";
import { nationalityOptions } from "@/data/nationalities";
import { renderContract } from "@/domain/templates";
import { restoreContractPresentation } from "@/domain/contract-presentation";

it("requires nationality and company licence/signatory details", () => {
  const base = { fullName: "شركة", phones: [], nationality: "كويتي" };
  expect(tenantSchema.safeParse({ ...base, nationality: " " }).success).toBe(false);
  expect(tenantSchema.safeParse({ ...base, partyType: "company" }).success).toBe(false);
  expect(
    tenantSchema.safeParse({
      ...base,
      partyType: "company",
      licenceNo: "2026/12",
      signatoryName: "المفوض",
      signatoryCivilId: "285010112358",
    }).success,
  ).toBe(true);
  expect(
    tenantSchema.safeParse({
      ...base,
      partyType: "company",
      licenceNo: "2026/12",
      signatoryName: "المفوض",
      signatoryCivilId: "123",
    }).success,
  ).toBe(false);
});
it("collectors can enter collections/expenses but never change master data, contracts or old receipts", () => {
  for (const permission of ["record_payment", "record_expense", "view_expenses"] as const)
    expect(can("collector", permission)).toBe(true);
  for (const permission of [
    "manage_contracts",
    "manage_master_data",
    "manage_users",
    "void_payment",
    "manage_expenses",
    "view_deposits",
  ] as const)
    expect(can("collector", permission)).toBe(false);
});
it("accepts the same PACI for several unit records", () => {
  const unit = {
    propertyId: "00000000-0000-4000-8000-000000000001",
    label: "1",
    type: "shop",
    paciNo: "21643734",
    askingRentFils: 100000,
  };
  expect(unitSchema.parse(unit).paciNo).toBe(unitSchema.parse({ ...unit, label: "2" }).paciNo);
});
it("validates temporary discount date range and positive integer fils", () => {
  const d = {
    fromPeriod: "2026-11",
    toPeriod: "2027-01",
    amountFils: 200000,
    reason: "موافقة المالك",
  };
  expect(discountSchema.parse(d)).toEqual(d);
  expect(discountSchema.safeParse({ ...d, toPeriod: "2026-10" }).success).toBe(false);
  expect(discountSchema.safeParse({ ...d, amountFils: 0 }).success).toBe(false);
  expect(discountSchema.safeParse({ ...d, amountFils: 0.5 }).success).toBe(false);
  expect(discountSchema.safeParse({ ...d, reason: " " }).success).toBe(false);
});
it("includes the complete property address without undefined fields", () => {
  expect(
    fullPropertyAddress({
      governorate: "حولي",
      area: "الجابرية",
      block: "1",
      street: "7",
      house_or_plot: "157",
      paci_no: "12045781",
    }),
  ).toBe("حولي · الجابرية · قطعة 1 · شارع 7 · منزل/قسيمة 157 · الرقم الآلي 12045781");
  expect(fullPropertyAddress({ area: "Al-Rai" }, "en")).toBe("Al-Rai");
});
it("provides bilingual nationality options including common legacy demonyms", () => {
  expect(nationalityOptions("ar").find((x) => x.value === "هندي")?.label).toBe("هندي");
  expect(nationalityOptions("en").find((x) => x.value === "هندي")?.label).toBe("India");
  expect(nationalityOptions("ar")).toHaveLength(249);
});
describe("company details on old lease prints", () => {
  const template = {
    type: "investment" as const,
    name: "lease",
    preamble:
      "عقد إيجار\nالطرف الأول: {{owner_name}}\nالطرف الثاني: {{tenant_name}}\n{{#tenant_licence_no}}رقم الترخيص: {{tenant_licence_no}}{{/tenant_licence_no}}\n{{#tenant_signatory_name}}المفوض: {{tenant_signatory_name}}{{/tenant_signatory_name}}\n{{#co_tenants}}المستأجرون الإضافيون: {{co_tenants}}{{/co_tenants}}\nحيث إن الطرف الأول يستغل {{property_description}}",
    clauses: [{ position: 1, key: "rent", body: "الإيجار {{rent}}" }],
  };
  it("fills absent company details and joint tenants without replacing saved rent or names", () => {
    const saved = renderContract(template, {
      owner_name: "المالك",
      tenant_name: "الشركة",
      property_description: "العقار",
      rent: 650,
    });
    delete saved.preambleParts;
    const current = renderContract(template, {
      owner_name: "مالك مختلف",
      tenant_name: "اسم جديد",
      tenant_licence_no: "2026/123",
      tenant_signatory_name: "المفوض",
      co_tenants: "مستأجر إضافي",
      property_description: "العقار",
      rent: 900,
    });
    const restored = restoreContractPresentation(saved, current);
    expect(restored.preamble).toContain("الطرف الثاني: الشركة");
    expect(restored.preamble).toContain("رقم الترخيص: 2026/123");
    expect(restored.preamble).toContain("المستأجرون الإضافيون: مستأجر إضافي");
    expect(restored.clauses[0]?.text).toBe("الإيجار 650");
  });
});
