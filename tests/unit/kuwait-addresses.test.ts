import { describe, expect, it } from "vitest";
import {
  KUWAIT_GOVERNORATES,
  OTHER_AREA,
  areaAfterGovernorateChange,
  areaBelongsTo,
  areaLabel,
  findArea,
  findGovernorate,
  governorateLabel,
  locationLabel,
} from "@/data/kuwait-addresses";

describe("Kuwait address dataset", () => {
  it("has all six governorates with unique values and bilingual labels", () => {
    expect(KUWAIT_GOVERNORATES.map((g) => g.value)).toEqual([
      "العاصمة",
      "حولي",
      "الفروانية",
      "الأحمدي",
      "الجهراء",
      "مبارك الكبير",
    ]);
    for (const g of KUWAIT_GOVERNORATES) {
      expect(g.ar.trim()).not.toBe("");
      expect(g.en.trim()).not.toBe("");
      expect(g.value).toBe(g.ar);
      expect(g.areas.length).toBeGreaterThan(3);
      const values = g.areas.map((a) => a.value);
      expect(new Set(values).size).toBe(values.length);
      for (const a of g.areas) {
        expect(a.value.trim()).not.toBe("");
        expect(a.ar.trim()).not.toBe("");
        expect(a.en.trim()).not.toBe("");
        expect(a.value).toBe(a.ar);
      }
    }
  });

  it("resolves labels and falls back to raw legacy values", () => {
    expect(findGovernorate("حولي")?.en).toBe("Hawalli");
    expect(findArea("السالمية", "حولي")?.en).toBe("Salmiya");
    expect(governorateLabel("حولي", "en")).toBe("Hawalli");
    expect(areaLabel("السالمية", "en", "حولي")).toBe("Salmiya");
    expect(areaLabel("منطقة قديمة", "en")).toBe("منطقة قديمة");
    expect(areaLabel("منطقة قديمة", "ar")).toBe("منطقة قديمة");
    expect(areaLabel(null, "en")).toBe("");
    expect(governorateLabel(null, "ar")).toBe("");
    expect(areaLabel("أخرى", "en")).toBe(OTHER_AREA.en);
  });

  it("keeps ambiguous area names within their governorate", () => {
    expect(areaBelongsTo("النهضة", "الجهراء")).toBe(true);
    expect(areaBelongsTo("النهضة", "العاصمة")).toBe(true);
    expect(areaBelongsTo("النهضة", "حولي")).toBe(false);
    expect(areaLabel("النهضة", "en", "الجهراء")).toBe("Al-Nahda");
    expect(areaLabel("النهضة", "en", "العاصمة")).toBe("Nahdha");
  });

  it("clears the area on governorate change only when it cannot belong", () => {
    expect(areaAfterGovernorateChange("السالمية", "الفروانية")).toBe("");
    expect(areaAfterGovernorateChange("السالمية", "حولي")).toBe("السالمية");
    expect(areaAfterGovernorateChange("منطقة قديمة", "حولي")).toBe("منطقة قديمة");
    expect(areaAfterGovernorateChange("النهضة", "الجهراء")).toBe("النهضة");
    expect(areaAfterGovernorateChange("", "حولي")).toBe("");
  });

  it("formats a card location", () => {
    expect(locationLabel("حولي", "السالمية", "ar")).toBe("حولي · السالمية");
    expect(locationLabel("حولي", "السالمية", "en")).toBe("Hawalli · Salmiya");
    expect(locationLabel(null, "السالمية", "en")).toBe("Salmiya");
    expect(locationLabel(null, null, "en")).toBe("");
  });
});
