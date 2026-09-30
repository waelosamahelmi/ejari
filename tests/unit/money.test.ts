import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  add,
  formatKWD,
  fromFils,
  max,
  min,
  mulRound,
  normalizeDigits,
  splitByWeights,
  splitDinarFils,
  splitEven,
  sub,
  sum,
  toArabicIndic,
  toFils,
} from "@/domain/money";

describe("toFils", () => {
  it.each([
    [300, 300000],
    [3.75, 3750],
    [0.001, 1],
    [-2.5, -2500],
    [0, 0],
    ["8,890.000", 8890000],
    ["300", 300000],
    ["3.75", 3750],
    [".5", 500],
    ["٨٬٨٩٠٫٠٠٠", 8890000],
    ["۱۲۳", 123000],
    ["1.2345", 1235],
    ["1.2344", 1234],
    ["-10", -10000],
    ["", 0],
    ["300.000 د.ك", 300000],
    ["12 KWD", 12000],
  ])("%s → %i", (input, fils) => expect(toFils(input)).toBe(fils));
  it("rejects garbage", () => {
    expect(() => toFils("abc")).toThrow();
    expect(() => toFils(Number.NaN)).toThrow();
    expect(() => toFils(1e20)).toThrow();
  });
});

describe("format", () => {
  it("fromFils", () => {
    expect(fromFils(8890000)).toBe("8,890.000");
    expect(fromFils(3750)).toBe("3.750");
    expect(fromFils(-70000)).toBe("-70.000");
    expect(fromFils(0)).toBe("0.000");
  });
  it("formatKWD", () => {
    expect(formatKWD(300000)).toBe("300.000 د.ك");
    expect(formatKWD(300000, { locale: "en" })).toBe("300.000 KWD");
    expect(formatKWD(300000, { showCurrency: false })).toBe("300.000");
    expect(formatKWD(70000, { digits: "arab" })).toBe("٧٠٫٠٠٠ د.ك");
    expect(formatKWD(17475000, { compact: true, locale: "en" })).toBe("17.5K KWD");
    expect(formatKWD(2_500_000_000, { compact: true, locale: "ar" })).toBe("2.5 مليون د.ك");
    expect(formatKWD(250_000_000, { compact: true, locale: "en" })).toBe("250K KWD");
    expect(formatKWD(500, { compact: true })).toBe("0.500 د.ك");
    expect(formatKWD(5000, { signed: true, showCurrency: false })).toBe("+5.000");
  });
  it("digits", () => {
    expect(normalizeDigits("٠١٢،٣")).toBe("012,3");
    expect(toArabicIndic("1,234.500")).toBe("١٬٢٣٤٫٥٠٠");
  });
  it("splitDinarFils", () => expect(splitDinarFils(195750)).toEqual({ dinars: 195, fils: 750 }));
});

describe("arithmetic", () => {
  it("add/sub/sum/min/max", () => {
    expect(add(1, 2)).toBe(3);
    expect(sub(5, 7)).toBe(-2);
    expect(sum([1, 2, 3])).toBe(6);
    expect(sum([])).toBe(0);
    expect(min(1, 2)).toBe(1);
    expect(max(1, 2)).toBe(2);
    expect(() => add(Number.MAX_SAFE_INTEGER, 1)).toThrow();
  });
  it("mulRound", () => {
    expect(mulRound(1000, 1 / 3)).toBe(333);
    expect(mulRound(1000, 0.0005)).toBe(1);
    expect(mulRound(-1000, 0.0005)).toBe(-1);
    expect(mulRound(0, 5)).toBe(0);
  });
});

describe("splitEven", () => {
  it("remainder to first parts", () => {
    expect(splitEven(4750, 2)).toEqual([2375, 2375]);
    expect(splitEven(10, 3)).toEqual([4, 3, 3]);
    expect(splitEven(-10, 3)).toEqual([-4, -3, -3]);
    expect(splitEven(0, 2)).toEqual([0, 0]);
  });
  it("rejects bad n", () => {
    expect(() => splitEven(10, 0)).toThrow();
    expect(() => splitEven(10, 1.5)).toThrow();
  });
  it("always sums to total (property)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1e9, max: 1e9 }),
        fc.integer({ min: 1, max: 50 }),
        (total, n) => {
          const parts = splitEven(total, n);
          expect(parts).toHaveLength(n);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
          expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
        },
      ),
    );
  });
});

describe("splitByWeights", () => {
  it("largest remainder", () => {
    expect(splitByWeights(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(splitByWeights(1000, [3, 1])).toEqual([750, 250]);
    expect(splitByWeights(10, [0, 0])).toEqual([5, 5]);
    expect(splitByWeights(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });
  it("validates", () => {
    expect(() => splitByWeights(10, [])).toThrow();
    expect(() => splitByWeights(10, [-1, 2])).toThrow();
  });
  it("sums exactly and never negative (property)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e10 }),
        fc.array(fc.integer({ min: 0, max: 1e6 }), { minLength: 1, maxLength: 30 }),
        (total, weights) => {
          const parts = splitByWeights(total, weights);
          expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
          parts.forEach((p) => expect(p).toBeGreaterThanOrEqual(0));
          const wSum = weights.reduce((a, b) => a + b, 0);
          if (wSum > 0)
            weights.forEach((w, i) =>
              expect(Math.abs(parts[i]! - (total * w) / wSum)).toBeLessThan(1.0001),
            );
        },
      ),
    );
  });
});
