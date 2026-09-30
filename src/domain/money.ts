/**
 * Money in Ijari is always an integer number of fils (1 KWD = 1000 fils).
 * Never use floats for stored amounts.
 */

export type Fils = number;

export const FILS_PER_DINAR = 1000;

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** Converts Arabic-Indic / Persian digits and separators to ASCII. */
export function normalizeDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const a = ARABIC_INDIC.indexOf(ch);
    const e = EASTERN_ARABIC_INDIC.indexOf(ch);
    if (a >= 0) out += String(a);
    else if (e >= 0) out += String(e);
    else if (ch === "٫") out += ".";
    else if (ch === "٬" || ch === "،") out += ",";
    else out += ch;
  }
  return out;
}

function assertSafe(fils: number): void {
  if (!Number.isSafeInteger(fils)) throw new RangeError(`Amount out of range: ${fils}`);
}

/**
 * Parses an amount in dinars into fils.
 * Numbers are interpreted as dinars (300 → 300000). Strings accept thousands
 * separators and Arabic-Indic digits ("٨٬٨٩٠٫٠٠٠" → 8890000).
 * Values with more than 3 decimals are rounded half away from zero.
 */
export function toFils(input: string | number): Fils {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new RangeError("Amount must be finite");
    const fils = Math.sign(input) * Math.round(Math.abs(input) * FILS_PER_DINAR + 1e-7);
    assertSafe(fils);
    return fils === 0 ? 0 : fils;
  }
  const cleaned = normalizeDigits(input).replace(/[\s,]/g, "").replace(/(د\.ك|KWD)/gi, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return 0;
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) throw new TypeError(`Invalid amount: ${input}`);
  const [, neg, intPart = "", fracPart = ""] = match;
  let frac = fracPart.padEnd(3, "0");
  let extraRound = 0;
  if (frac.length > 3) {
    extraRound = Number(frac[3]) >= 5 ? 1 : 0;
    frac = frac.slice(0, 3);
  }
  const fils = Number(intPart || "0") * FILS_PER_DINAR + Number(frac) + extraRound;
  assertSafe(fils);
  return neg && fils !== 0 ? -fils : fils;
}

function groupThousands(intStr: string, sep: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** 8890000 → "8,890.000" */
export function fromFils(fils: Fils): string {
  assertSafe(fils);
  const neg = fils < 0;
  const abs = Math.abs(fils);
  const dinars = Math.floor(abs / FILS_PER_DINAR);
  const rest = abs % FILS_PER_DINAR;
  return `${neg ? "-" : ""}${groupThousands(String(dinars), ",")}.${String(rest).padStart(3, "0")}`;
}

/** Dinar part without fils, e.g. for voucher boxes. */
export function splitDinarFils(fils: Fils): { dinars: number; fils: number } {
  const abs = Math.abs(fils);
  return { dinars: Math.floor(abs / FILS_PER_DINAR), fils: abs % FILS_PER_DINAR };
}

export function toArabicIndic(s: string): string {
  return s
    .replace(/\d/g, (d) => ARABIC_INDIC[Number(d)]!)
    .replace(/\./g, "٫")
    .replace(/,/g, "٬");
}

export interface FormatOptions {
  locale?: "ar" | "en";
  showCurrency?: boolean;
  compact?: boolean;
  digits?: "latn" | "arab";
  signed?: boolean;
}

/** Formats fils as KWD with 3 decimals ("300.000 د.ك"). */
export function formatKWD(fils: Fils, opts: FormatOptions = {}): string {
  const { locale = "ar", showCurrency = true, compact = false, digits = "latn", signed = false } = opts;
  let body: string;
  if (compact && Math.abs(fils) >= 1_000_000) {
    const dinars = fils / FILS_PER_DINAR;
    const abs = Math.abs(dinars);
    const [div, suffix] =
      abs >= 1_000_000 ? [1_000_000, locale === "ar" ? " مليون" : "M"] : [1_000, locale === "ar" ? " ألف" : "K"];
    const v = dinars / div;
    body = `${v.toFixed(Math.abs(v) >= 100 ? 0 : 1).replace(/\.0$/, "")}${suffix}`;
  } else {
    body = fromFils(fils);
  }
  if (signed && fils > 0) body = `+${body}`;
  if (digits === "arab") body = toArabicIndic(body);
  if (!showCurrency) return body;
  return locale === "ar" ? `${body} د.ك` : `${body} KWD`;
}

export function add(a: Fils, b: Fils): Fils {
  const r = a + b;
  assertSafe(r);
  return r;
}

export function sub(a: Fils, b: Fils): Fils {
  const r = a - b;
  assertSafe(r);
  return r;
}

export function sum(values: readonly Fils[]): Fils {
  let t = 0;
  for (const v of values) t = add(t, v);
  return t;
}

export function min(a: Fils, b: Fils): Fils {
  return a < b ? a : b;
}

export function max(a: Fils, b: Fils): Fils {
  return a > b ? a : b;
}

/** Multiplies an amount by a ratio and rounds half away from zero to the nearest fils. */
export function mulRound(fils: Fils, ratio: number): Fils {
  const r = fils * ratio;
  const rounded = Math.sign(r) * Math.round(Math.abs(r) + 1e-9);
  return rounded === 0 ? 0 : rounded;
}

/**
 * Splits `total` into `n` parts that always sum to `total`.
 * Remainder fils go to the first parts (deterministic).
 */
export function splitEven(total: Fils, n: number): Fils[] {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError("n must be a positive integer");
  assertSafe(total);
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const base = Math.floor(abs / n);
  const rem = abs % n;
  return Array.from({ length: n }, (_, i) => sign * (base + (i < rem ? 1 : 0)) || 0);
}

/**
 * Splits `total` proportionally to `weights` using the largest-remainder method.
 * The result always sums exactly to `total`. Ties go to the earlier index.
 * If all weights are zero the split is even.
 */
export function splitByWeights(total: Fils, weights: readonly number[]): Fils[] {
  if (weights.length === 0) throw new RangeError("weights must not be empty");
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) throw new RangeError("weights must be >= 0");
  assertSafe(total);
  const wSum = weights.reduce((a, b) => a + b, 0);
  if (wSum === 0) return splitEven(total, weights.length);
  const sign = total < 0 ? -1 : 1;
  const abs = Math.abs(total);
  const exact = weights.map((w) => (abs * w) / wSum);
  const floors = exact.map((x) => Math.floor(x + 1e-9));
  let remaining = abs - floors.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x + 1e-9) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remaining <= 0) break;
    floors[i] = floors[i]! + 1;
    remaining--;
  }
  return floors.map((f) => sign * f || 0);
}
