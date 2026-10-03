import { describe, expect, it } from "vitest";
import {
  createPlannedUnitsSchema,
  ownerSchema,
  propertySchema,
  tenantSchema,
  unitSchema,
} from "@/lib/schemas/master";

describe("master data schemas", () => {
  it("tenant: normalizes phones and civil ID, rejects bad phones", () => {
    const ok = tenantSchema.parse({
      fullName: " خالد ",
      civilId: "٢٨٥٠١٠١١٢٣٥٨",
      phones: ["+965 5512 3456", ""],
      email: "",
    });
    expect(ok).toMatchObject({
      fullName: "خالد",
      civilId: "285010112358",
      phones: ["55123456"],
      email: null,
    });
    expect(() => tenantSchema.parse({ fullName: "x", phones: ["1234"] })).toThrow();
    expect(() => tenantSchema.parse({ fullName: "", phones: [] })).toThrow();
    expect(() => tenantSchema.parse({ fullName: "x", civilId: "123", phones: [] })).toThrow();
  });
  it("owner: IBAN and email validation", () => {
    expect(
      ownerSchema.parse({
        fullName: "م",
        phones: [],
        iban: "kw81 cbku 0000 0000 0000 1234 5601 01",
      }).iban,
    ).toBe("KW81CBKU0000000000001234560101");
    expect(() => ownerSchema.parse({ fullName: "م", phones: [], iban: "KW00" })).toThrow();
    expect(() => ownerSchema.parse({ fullName: "م", phones: [], email: "bad" })).toThrow();
  });
  it("property: owner shares must total 100, PACI is 8 digits, address is required", () => {
    const base = {
      name: "الجابرية 157",
      governorate: "حولي",
      area: "الجابرية",
      block: "1",
      street: "7",
      houseOrPlot: "157",
      paciNo: "12045781",
      propertyType: "mixed" as const,
      owners: [{ ownerId: "0c000000-0000-4000-8000-000000000001", sharePct: 100 }],
    };
    expect(propertySchema.parse(base).paciNo).toBe("12045781");
    // Avenue stays optional.
    expect(propertySchema.parse({ ...base, avenue: "" }).avenue).toBe(null);
    expect(() => propertySchema.parse({ ...base, paciNo: "123" })).toThrow();
    expect(() => propertySchema.parse({ ...base, paciNo: "" })).toThrow();
    expect(() => propertySchema.parse({ ...base, block: "" })).toThrow();
    expect(() => propertySchema.parse({ ...base, street: "" })).toThrow();
    expect(() => propertySchema.parse({ ...base, houseOrPlot: "" })).toThrow();
    expect(() => propertySchema.parse({ ...base, governorate: undefined })).toThrow();
    expect(() => propertySchema.parse({ ...base, area: "" })).toThrow();
    expect(() =>
      propertySchema.parse({
        ...base,
        owners: [{ ownerId: base.owners[0]!.ownerId, sharePct: 60 }],
      }),
    ).toThrow();
    expect(() => propertySchema.parse({ ...base, owners: [] })).toThrow();
  });
  it("planned units: bounds, duplicates and max count", () => {
    const pid = "0d000000-0000-4000-8000-000000000001";
    const unit = { label: "101", type: "apartment" as const, floor: 1, askingRentFils: 300000 };
    expect(createPlannedUnitsSchema.parse({ propertyId: pid, units: [unit] }).units).toHaveLength(1);
    expect(() => createPlannedUnitsSchema.parse({ propertyId: pid, units: [] })).toThrow();
    expect(() => createPlannedUnitsSchema.parse({ propertyId: pid, units: [unit, unit] })).toThrow();
    expect(() => createPlannedUnitsSchema.parse({ propertyId: "x", units: [unit] })).toThrow();
    expect(() =>
      createPlannedUnitsSchema.parse({
        propertyId: pid,
        units: Array.from({ length: 301 }, (_, i) => ({ ...unit, label: `u${i}` })),
      }),
    ).toThrow();
  });
  it("unit & planned units", () => {
    expect(
      unitSchema.parse({
        propertyId: "0d000000-0000-4000-8000-000000000001",
        label: "8",
        type: "shop",
        askingRentFils: 650000,
      }).active,
    ).toBe(true);
    expect(() =>
      unitSchema.parse({ propertyId: "x", label: "8", type: "shop", askingRentFils: 1 }),
    ).toThrow();
  });
});
