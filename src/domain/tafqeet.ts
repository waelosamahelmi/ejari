/**
 * Tafqeet: Arabic (and English) amount-in-words for KWD, matching the style of
 * the office's paper forms ("فقط مائة وخمسة وتسعون دينار لا غير").
 */
import type { Fils } from "./money";

const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة"];
const TEENS: Record<number, string> = {
  11: "أحد عشر",
  12: "اثنا عشر",
  13: "ثلاثة عشر",
  14: "أربعة عشر",
  15: "خمسة عشر",
  16: "ستة عشر",
  17: "سبعة عشر",
  18: "ثمانية عشر",
  19: "تسعة عشر",
};
const TENS = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

const MAX_DINARS = 999_999_999;

/** Words for 1..999 (masculine counting form). */
function below1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h > 0) parts.push(HUNDREDS[h]!);
  if (r > 0) {
    if (r <= 10) parts.push(ONES[r]!);
    else if (r < 20) parts.push(TEENS[r]!);
    else {
      const o = r % 10;
      const t = Math.floor(r / 10);
      parts.push(o > 0 ? `${ONES[o]} و${TENS[t]}` : TENS[t]!);
    }
  }
  return parts.join(" و");
}

interface Scale {
  value: number;
  one: string;
  two: string;
  plural: string; // 3–10
  singular: string; // 11+
}

const SCALES: Scale[] = [
  { value: 1_000_000, one: "مليون", two: "مليونان", plural: "ملايين", singular: "مليون" },
  { value: 1_000, one: "ألف", two: "ألفان", plural: "آلاف", singular: "ألف" },
];

function scaleWords(count: number, s: Scale): string {
  if (count === 1) return s.one;
  if (count === 2) return s.two;
  const r = count % 100;
  const noun = r >= 3 && r <= 10 ? s.plural : s.singular;
  return `${below1000(count)} ${noun}`;
}

/** Plain number in Arabic words (0 → "صفر"). Supports 0..999,999,999. */
export function tafqeetNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_DINARS) throw new RangeError(`Unsupported number: ${n}`);
  if (n === 0) return "صفر";
  const parts: string[] = [];
  let rest = n;
  for (const s of SCALES) {
    const count = Math.floor(rest / s.value);
    rest %= s.value;
    if (count > 0) parts.push(scaleWords(count, s));
  }
  if (rest > 0) parts.push(below1000(rest));
  return parts.join(" و");
}

interface NounForms {
  one: string; // دينار واحد
  two: string; // ديناران
  plural: string; // دنانير (3–10)
  singular: string; // دينار (11+, 0)
}

function countedNoun(n: number, forms: NounForms): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const r = n % 100;
  const noun = r >= 3 && r <= 10 ? forms.plural : forms.singular;
  return `${tafqeetNumber(n)} ${noun}`;
}

const DINAR: NounForms = { one: "دينار واحد", two: "ديناران", plural: "دنانير", singular: "دينار" };
const DINAR_KW: NounForms = {
  one: "دينار كويتي واحد",
  two: "ديناران كويتيان",
  plural: "دنانير كويتية",
  singular: "دينار كويتي",
};
const FILS: NounForms = { one: "فلس واحد", two: "فلسان", plural: "فلوس", singular: "فلس" };

export interface TafqeetOptions {
  /** Append "كويتي" to the currency noun. */
  withKuwaiti?: boolean;
  /** Wrap with "فقط … لا غير" (default true). */
  wrap?: boolean;
}

function assertAmount(fils: Fils): void {
  if (!Number.isSafeInteger(fils) || fils < 0) throw new RangeError(`Unsupported amount: ${fils}`);
  if (Math.floor(fils / 1000) > MAX_DINARS) throw new RangeError(`Amount too large: ${fils}`);
}

/**
 * KWD amount in Arabic words.
 * tafqeetKWD(195000) → "فقط مائة وخمسة وتسعون دينار لا غير"
 */
export function tafqeetKWD(fils: Fils, opts: TafqeetOptions = {}): string {
  assertAmount(fils);
  const { withKuwaiti = false, wrap = true } = opts;
  const dinars = Math.floor(fils / 1000);
  const f = fils % 1000;
  const forms = withKuwaiti ? DINAR_KW : DINAR;
  const parts: string[] = [];
  if (dinars > 0) parts.push(countedNoun(dinars, forms));
  if (f > 0) parts.push(countedNoun(f, FILS));
  const body = parts.length > 0 ? parts.join(" و") : `صفر ${forms.singular}`;
  return wrap ? `فقط ${body} لا غير` : body;
}

/**
 * Just the number words for a KWD amount, used inside contract sentences that
 * already say "دينار": 650000 → "ستمائة وخمسون"; 3750 → "ثلاثة دنانير وسبعمائة وخمسون فلس".
 */
export function amountWords(fils: Fils): string {
  assertAmount(fils);
  const dinars = Math.floor(fils / 1000);
  const f = fils % 1000;
  if (f === 0) return tafqeetNumber(dinars);
  return tafqeetKWD(fils, { wrap: false });
}

// Feminine counting forms for feminine nouns (سنة): 3–10 use masculine-looking numbers.
const FEM_COUNT = ["", "", "", "ثلاث", "أربع", "خمس", "ست", "سبع", "ثماني", "تسع", "عشر"];

function yearsWords(y: number, oblique: boolean): string {
  if (y === 1) return "سنة واحدة";
  if (y === 2) return oblique ? "سنتين" : "سنتان";
  if (y <= 10) return `${FEM_COUNT[y]} سنوات`;
  if (y === 11) return "إحدى عشرة سنة";
  if (y === 12) return "اثنتا عشرة سنة";
  return `${tafqeetNumber(y)} سنة`;
}

function monthsWords(m: number, oblique: boolean): string {
  if (m === 1) return "شهر واحد";
  if (m === 2) return oblique ? "شهرين" : "شهران";
  if (m <= 10) return `${ONES[m]} أشهر`;
  return `${tafqeetNumber(m)} شهرًا`;
}

/**
 * Duration in words: 60 → "خمس سنوات", 6 → "ستة أشهر", 18 → "سنة واحدة وستة أشهر".
 * `oblique` gives the genitive/accusative dual used after prepositions or as an
 * object ("قبلها بشهرين"، "منح الطرف الثاني شهرين").
 */
export function tafqeetDuration(months: number, opts: { oblique?: boolean } = {}): string {
  const oblique = opts.oblique ?? false;
  if (!Number.isInteger(months) || months < 0) throw new RangeError(`Invalid months: ${months}`);
  if (months === 0) return "صفر أشهر";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return monthsWords(m, oblique);
  if (m === 0) return yearsWords(y, oblique);
  return `${yearsWords(y, oblique)} و${monthsWords(m, oblique)}`;
}

// ---------------------------------------------------------------- English

const EN_ONES = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const EN_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function enBelow1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h > 0) parts.push(`${EN_ONES[h]} hundred`);
  if (r > 0) {
    if (r < 20) parts.push(EN_ONES[r]!);
    else parts.push(r % 10 ? `${EN_TENS[Math.floor(r / 10)]}-${EN_ONES[r % 10]}` : EN_TENS[r / 10]!);
  }
  return parts.join(" ");
}

export function numberWordsEN(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > MAX_DINARS) throw new RangeError(`Unsupported number: ${n}`);
  if (n === 0) return "zero";
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions) parts.push(`${enBelow1000(millions)} million`);
  if (thousands) parts.push(`${enBelow1000(thousands)} thousand`);
  if (rest) parts.push(enBelow1000(rest));
  return parts.join(" ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** wordsEN(195000) → "One hundred ninety-five Kuwaiti dinars only" */
export function wordsEN(fils: Fils): string {
  assertAmount(fils);
  const dinars = Math.floor(fils / 1000);
  const f = fils % 1000;
  const parts: string[] = [];
  if (dinars > 0) parts.push(`${numberWordsEN(dinars)} Kuwaiti ${dinars === 1 ? "dinar" : "dinars"}`);
  if (f > 0) parts.push(`${numberWordsEN(f)} fils`);
  if (parts.length === 0) parts.push("zero Kuwaiti dinars");
  return `${capitalize(parts.join(" and "))} only`;
}

/** English duration: 60 → "five years", 18 → "one year and six months". */
export function durationEN(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const ys = y ? `${numberWordsEN(y)} ${y === 1 ? "year" : "years"}` : "";
  const ms = m ? `${numberWordsEN(m)} ${m === 1 ? "month" : "months"}` : "";
  return [ys, ms].filter(Boolean).join(" and ") || "zero months";
}
