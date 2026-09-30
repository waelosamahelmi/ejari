import { describe, expect, it } from "vitest";
import {
  amountWords,
  durationEN,
  numberWordsEN,
  tafqeetDuration,
  tafqeetKWD,
  tafqeetNumber,
  wordsEN,
} from "@/domain/tafqeet";

describe("tafqeetKWD — spec examples", () => {
  it.each([
    [195000, "فقط مائة وخمسة وتسعون دينار لا غير"],
    [3750, "فقط ثلاثة دنانير وسبعمائة وخمسون فلس لا غير"],
    [8890000, "فقط ثمانية آلاف وثمانمائة وتسعون دينار لا غير"],
    [1000, "فقط دينار واحد لا غير"],
    [2000, "فقط ديناران لا غير"],
    [250, "فقط مائتان وخمسون فلس لا غير"],
  ])("%i → %s", (fils, words) => expect(tafqeetKWD(fils)).toBe(words));

  it("with Kuwaiti", () => {
    expect(tafqeetKWD(650000, { withKuwaiti: true })).toBe("فقط ستمائة وخمسون دينار كويتي لا غير");
  });
});

describe("tafqeetKWD — coverage", () => {
  it.each([
    [0, "فقط صفر دينار لا غير"],
    [1, "فقط فلس واحد لا غير"],
    [2, "فقط فلسان لا غير"],
    [5, "فقط خمسة فلوس لا غير"],
    [10, "فقط عشرة فلوس لا غير"],
    [11, "فقط أحد عشر فلس لا غير"],
    [500, "فقط خمسمائة فلس لا غير"],
    [3000, "فقط ثلاثة دنانير لا غير"],
    [10000, "فقط عشرة دنانير لا غير"],
    [11000, "فقط أحد عشر دينار لا غير"],
    [12000, "فقط اثنا عشر دينار لا غير"],
    [19000, "فقط تسعة عشر دينار لا غير"],
    [20000, "فقط عشرون دينار لا غير"],
    [21000, "فقط واحد وعشرون دينار لا غير"],
    [99000, "فقط تسعة وتسعون دينار لا غير"],
    [100000, "فقط مائة دينار لا غير"],
    [103000, "فقط مائة وثلاثة دنانير لا غير"],
    [200000, "فقط مائتان دينار لا غير"],
    [300000, "فقط ثلاثمائة دينار لا غير"],
    [320000, "فقط ثلاثمائة وعشرون دينار لا غير"],
    [400000, "فقط أربعمائة دينار لا غير"],
    [999000, "فقط تسعمائة وتسعة وتسعون دينار لا غير"],
    [1000000, "فقط ألف دينار لا غير"],
    [2000000, "فقط ألفان دينار لا غير"],
    [2150000, "فقط ألفان ومائة وخمسون دينار لا غير"],
    [3000000, "فقط ثلاثة آلاف دينار لا غير"],
    [10000000, "فقط عشرة آلاف دينار لا غير"],
    [11000000, "فقط أحد عشر ألف دينار لا غير"],
    [17475000, "فقط سبعة عشر ألف وأربعمائة وخمسة وسبعون دينار لا غير"],
    [17280000, "فقط سبعة عشر ألف ومائتان وثمانون دينار لا غير"],
    [100000000, "فقط مائة ألف دينار لا غير"],
    [1000000000, "فقط مليون دينار لا غير"],
    [2000000000, "فقط مليونان دينار لا غير"],
    [5000000000, "فقط خمسة ملايين دينار لا غير"],
    [170000, "فقط مائة وسبعون دينار لا غير"],
    [4750, "فقط أربعة دنانير وسبعمائة وخمسون فلس لا غير"],
    [20250, "فقط عشرون دينار ومائتان وخمسون فلس لا غير"],
    [1001, "فقط دينار واحد وفلس واحد لا غير"],
  ])("%i → %s", (fils, words) => expect(tafqeetKWD(fils)).toBe(words));

  it("max supported", () => {
    expect(tafqeetKWD(999_999_999_999)).toContain("تسعمائة وتسعة وتسعون مليون");
  });
  it("rejects negatives, fractions and overflow", () => {
    expect(() => tafqeetKWD(-1)).toThrow();
    expect(() => tafqeetKWD(1.5)).toThrow();
    expect(() => tafqeetKWD(1_000_000_000_000)).toThrow();
  });
  it("no wrap", () => expect(tafqeetKWD(195000, { wrap: false })).toBe("مائة وخمسة وتسعون دينار"));
  it("Kuwaiti forms", () => {
    expect(tafqeetKWD(1000, { withKuwaiti: true })).toBe("فقط دينار كويتي واحد لا غير");
    expect(tafqeetKWD(2000, { withKuwaiti: true })).toBe("فقط ديناران كويتيان لا غير");
    expect(tafqeetKWD(5000, { withKuwaiti: true })).toBe("فقط خمسة دنانير كويتية لا غير");
  });
});

describe("tafqeetNumber", () => {
  it.each([
    [0, "صفر"],
    [1, "واحد"],
    [15, "خمسة عشر"],
    [45, "خمسة وأربعون"],
    [1674, "ألف وستمائة وأربعة وسبعون"],
    [2026, "ألفان وستة وعشرون"],
    [1_000_000, "مليون"],
    [12_345_678, "اثنا عشر مليون وثلاثمائة وخمسة وأربعون ألف وستمائة وثمانية وسبعون"],
  ])("%i → %s", (n, words) => expect(tafqeetNumber(n)).toBe(words));
  it("rejects invalid", () => {
    expect(() => tafqeetNumber(-3)).toThrow();
    expect(() => tafqeetNumber(1e10)).toThrow();
  });
});

describe("amountWords", () => {
  it("whole dinars → number only", () => expect(amountWords(650000)).toBe("ستمائة وخمسون"));
  it("with fils → full phrase", () =>
    expect(amountWords(3750)).toBe("ثلاثة دنانير وسبعمائة وخمسون فلس"));
});

describe("tafqeetDuration", () => {
  it.each([
    [60, "خمس سنوات"],
    [12, "سنة واحدة"],
    [24, "سنتان"],
    [36, "ثلاث سنوات"],
    [120, "عشر سنوات"],
    [132, "إحدى عشرة سنة"],
    [144, "اثنتا عشرة سنة"],
    [240, "عشرون سنة"],
    [6, "ستة أشهر"],
    [2, "شهران"],
    [1, "شهر واحد"],
    [3, "ثلاثة أشهر"],
    [11, "أحد عشر شهرًا"],
    [18, "سنة واحدة وستة أشهر"],
    [0, "صفر أشهر"],
  ])("%i → %s", (m, words) => expect(tafqeetDuration(m)).toBe(words));
  it("rejects negatives", () => expect(() => tafqeetDuration(-1)).toThrow());
  it("oblique case", () => {
    expect(tafqeetDuration(2, { oblique: true })).toBe("شهرين");
    expect(tafqeetDuration(24, { oblique: true })).toBe("سنتين");
    expect(tafqeetDuration(26, { oblique: true })).toBe("سنتين وشهرين");
  });
});

describe("English", () => {
  it.each([
    [195000, "One hundred ninety-five Kuwaiti dinars only"],
    [1000, "One Kuwaiti dinar only"],
    [3750, "Three Kuwaiti dinars and seven hundred fifty fils only"],
    [250, "Two hundred fifty fils only"],
    [0, "Zero Kuwaiti dinars only"],
    [17475000, "Seventeen thousand four hundred seventy-five Kuwaiti dinars only"],
    [2_000_000_000, "Two million Kuwaiti dinars only"],
  ])("%i → %s", (fils, words) => expect(wordsEN(fils)).toBe(words));
  it("numberWordsEN", () => {
    expect(numberWordsEN(0)).toBe("zero");
    expect(numberWordsEN(40)).toBe("forty");
    expect(() => numberWordsEN(-1)).toThrow();
  });
  it("durationEN", () => {
    expect(durationEN(60)).toBe("five years");
    expect(durationEN(13)).toBe("one year and one month");
    expect(durationEN(0)).toBe("zero months");
  });
});
