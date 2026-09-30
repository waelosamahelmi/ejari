/**
 * Business dates are ISO strings "YYYY-MM-DD" (no time, no zone) and billing
 * periods are "YYYY-MM". All arithmetic is done in UTC to stay zone-agnostic;
 * "today" is resolved in Asia/Kuwait.
 */

export type ISODate = string; // YYYY-MM-DD
export type Period = string; // YYYY-MM

export const KUWAIT_TZ = "Asia/Kuwait";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const PERIOD_RE = /^(\d{4})-(\d{2})$/;

export const DAY_NAMES_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;
export const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const MONTH_NAMES_AR = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
] as const;
export const MONTH_NAMES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function parseDate(d: ISODate): { y: number; m: number; day: number } {
  const match = DATE_RE.exec(d);
  if (!match) throw new TypeError(`Invalid date: ${d}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const day = Number(match[3]);
  if (m < 1 || m > 12 || day < 1 || day > daysInMonth(y, m)) throw new RangeError(`Invalid date: ${d}`);
  return { y, m, day };
}

export function isValidDate(d: string): boolean {
  try {
    parseDate(d);
    return true;
  } catch {
    return false;
  }
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function pad(n: number, w = 2): string {
  return String(n).padStart(w, "0");
}

export function makeDate(y: number, m: number, day: number): ISODate {
  return `${pad(y, 4)}-${pad(m)}-${pad(day)}`;
}

function toUTC(d: ISODate): number {
  const { y, m, day } = parseDate(d);
  return Date.UTC(y, m - 1, day);
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  return makeDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * 86_400_000);
}

/** Adds calendar months, clamping to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonths(d: ISODate, n: number): ISODate {
  const { y, m, day } = parseDate(d);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return makeDate(ny, nm, Math.min(day, daysInMonth(ny, nm)));
}

/** Whole days from a to b (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

/** Contract end date = start + term months − 1 day. */
export function contractEndDate(start: ISODate, termMonths: number): ISODate {
  return addDays(addMonths(start, termMonths), -1);
}

// ---------------------------------------------------------------- periods

export function periodOf(d: ISODate): Period {
  return d.slice(0, 7);
}

export function parsePeriod(p: Period): { y: number; m: number } {
  const match = PERIOD_RE.exec(p);
  if (!match) throw new TypeError(`Invalid period: ${p}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  if (m < 1 || m > 12) throw new RangeError(`Invalid period: ${p}`);
  return { y, m };
}

export function isValidPeriod(p: string): boolean {
  try {
    parsePeriod(p);
    return true;
  } catch {
    return false;
  }
}

export function makePeriod(y: number, m: number): Period {
  return `${pad(y, 4)}-${pad(m)}`;
}

export function addPeriods(p: Period, n: number): Period {
  const { y, m } = parsePeriod(p);
  const total = y * 12 + (m - 1) + n;
  return makePeriod(Math.floor(total / 12), (total % 12) + 1);
}

/** Number of months from a to b (b − a). */
export function diffPeriods(a: Period, b: Period): number {
  const pa = parsePeriod(a);
  const pb = parsePeriod(b);
  return pb.y * 12 + pb.m - (pa.y * 12 + pa.m);
}

export function periodStart(p: Period): ISODate {
  const { y, m } = parsePeriod(p);
  return makeDate(y, m, 1);
}

export function periodEnd(p: Period): ISODate {
  const { y, m } = parsePeriod(p);
  return makeDate(y, m, daysInMonth(y, m));
}

export function periodDays(p: Period): number {
  const { y, m } = parsePeriod(p);
  return daysInMonth(y, m);
}

/** Inclusive list of periods from a to b. */
export function periodRange(from: Period, to: Period): Period[] {
  const n = diffPeriods(from, to);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addPeriods(from, i));
}

/** Whole calendar months between two dates, counting by month boundaries (grace months). */
export function monthsBetween(a: ISODate, b: ISODate): number {
  const pa = parseDate(a);
  const pb = parseDate(b);
  let months = (pb.y - pa.y) * 12 + (pb.m - pa.m);
  if (pb.day < pa.day) months -= 1;
  return months;
}

// ---------------------------------------------------------------- display

export function dayOfWeek(d: ISODate): number {
  return new Date(toUTC(d)).getUTCDay();
}

export function dayNameAr(d: ISODate): string {
  return DAY_NAMES_AR[dayOfWeek(d)]!;
}

export function dayNameEn(d: ISODate): string {
  return DAY_NAMES_EN[dayOfWeek(d)]!;
}

export function monthNameAr(m: number): string {
  const name = MONTH_NAMES_AR[m - 1];
  if (!name) throw new RangeError(`Invalid month: ${m}`);
  return name;
}

export function monthNameEn(m: number): string {
  const name = MONTH_NAMES_EN[m - 1];
  if (!name) throw new RangeError(`Invalid month: ${m}`);
  return name;
}

/** "2026-08" → "أغسطس 2026" / "August 2026" */
export function formatPeriod(p: Period, locale: "ar" | "en" = "ar"): string {
  const { y, m } = parsePeriod(p);
  return `${locale === "ar" ? monthNameAr(m) : monthNameEn(m)} ${y}`;
}

/** "2026-02-01" → "01/02/2026" */
export function formatDate(d: ISODate | null | undefined): string {
  if (!d) return "";
  const { y, m, day } = parseDate(d.slice(0, 10));
  return `${pad(day)}/${pad(m)}/${pad(y, 4)}`;
}

/** Parses "dd/MM/yyyy" (Arabic digits accepted) into ISO. Returns null if invalid. */
export function parseDisplayDate(s: string): ISODate | null {
  const normalized = s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660)).trim();
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(normalized);
  if (!match) return null;
  const iso = makeDate(Number(match[3]), Number(match[2]), Number(match[1]));
  return isValidDate(iso) ? iso : null;
}

/** Today's date in Kuwait. */
export function todayKuwait(now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KUWAIT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Current hour (0–23) in Kuwait. */
export function hourKuwait(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: KUWAIT_TZ, hour: "2-digit", hour12: false }).format(now);
  return Number(h) % 24;
}

/** Quarter / half / year period ranges for report presets. */
export type RangePreset =
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "h1"
  | "h2"
  | "this_year"
  | "last_year";

export function presetRange(preset: RangePreset, today: ISODate): { from: Period; to: Period } {
  const { y, m } = parseDate(today);
  const q = Math.floor((m - 1) / 3);
  switch (preset) {
    case "this_month":
      return { from: makePeriod(y, m), to: makePeriod(y, m) };
    case "last_month": {
      const p = addPeriods(makePeriod(y, m), -1);
      return { from: p, to: p };
    }
    case "this_quarter":
      return { from: makePeriod(y, q * 3 + 1), to: makePeriod(y, q * 3 + 3) };
    case "last_quarter": {
      const start = addPeriods(makePeriod(y, q * 3 + 1), -3);
      return { from: start, to: addPeriods(start, 2) };
    }
    case "h1":
      return { from: makePeriod(y, 1), to: makePeriod(y, 6) };
    case "h2":
      return { from: makePeriod(y, 7), to: makePeriod(y, 12) };
    case "this_year":
      return { from: makePeriod(y, 1), to: makePeriod(y, 12) };
    case "last_year":
      return { from: makePeriod(y - 1, 1), to: makePeriod(y - 1, 12) };
  }
}

/** Same-length range immediately preceding [from, to]. */
export function previousRange(from: Period, to: Period): { from: Period; to: Period } {
  const len = diffPeriods(from, to) + 1;
  return { from: addPeriods(from, -len), to: addPeriods(from, -1) };
}
