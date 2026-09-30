/** Kuwait-specific validators: civil ID, PACI address number, phone numbers. */
import { normalizeDigits } from "./money";

const CIVIL_ID_WEIGHTS = [2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2] as const;

export function digitsOnly(input: string): string {
  return normalizeDigits(input).replace(/\D/g, "");
}

/** Computes the Kuwaiti civil ID check digit for the first 11 digits, or null if none exists. */
export function civilIdCheckDigit(first11: string): number | null {
  if (!/^\d{11}$/.test(first11)) throw new TypeError("Expected 11 digits");
  let total = 0;
  for (let i = 0; i < 11; i++) total += Number(first11[i]) * CIVIL_ID_WEIGHTS[i]!;
  const check = 11 - (total % 11);
  // check = 11 (remainder 0) and check = 10 (remainder 1) cannot be represented by one digit.
  if (check >= 10) return null;
  return check;
}

export interface CivilIdResult {
  /** 12 digits present. */
  formatValid: boolean;
  /** Checksum and embedded birth date are consistent. */
  checksumValid: boolean;
  normalized: string;
  /** Birth date encoded in digits 1–7 (century + YYMMDD), when plausible. */
  birthDate: string | null;
}

export function validateCivilId(input: string): CivilIdResult {
  const normalized = digitsOnly(input);
  if (!/^\d{12}$/.test(normalized)) {
    return { formatValid: false, checksumValid: false, normalized, birthDate: null };
  }
  const check = civilIdCheckDigit(normalized.slice(0, 11));
  const checksumValid = check !== null && check === Number(normalized[11]);
  const century = normalized[0] === "2" ? 1900 : normalized[0] === "3" ? 2000 : null;
  let birthDate: string | null = null;
  if (century !== null) {
    const y = century + Number(normalized.slice(1, 3));
    const m = Number(normalized.slice(3, 5));
    const d = Number(normalized.slice(5, 7));
    const dim = m >= 1 && m <= 12 ? new Date(Date.UTC(y, m, 0)).getUTCDate() : 0;
    if (d >= 1 && d <= dim) {
      birthDate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return { formatValid: true, checksumValid, normalized, birthDate };
}

/** Builds a checksum-valid civil ID from 11 digits (used for fictional demo data). */
export function completeCivilId(first11: string): string | null {
  const check = civilIdCheckDigit(first11);
  return check === null ? null : `${first11}${check}`;
}

/** "253012345678" → "2530••••5678" */
export function maskCivilId(id: string | null | undefined): string {
  const d = digitsOnly(id ?? "");
  if (d.length < 8) return d ? "••••" : "";
  return `${d.slice(0, 4)}${"•".repeat(d.length - 8)}${d.slice(-4)}`;
}

export function isValidPaci(input: string): boolean {
  return /^\d{8}$/.test(digitsOnly(input));
}

/** Normalizes a Kuwaiti phone: strips +965/00965 and separators. */
export function normalizePhone(input: string): string {
  let d = digitsOnly(input);
  if (d.length === 11 && d.startsWith("965")) d = d.slice(3);
  else if (d.length === 13 && d.startsWith("00965")) d = d.slice(5);
  return d;
}

export function isValidKuwaitPhone(input: string): boolean {
  return /^[24569]\d{7}$/.test(normalizePhone(input));
}

/** "55123456" → "5512 3456" */
export function formatPhone(input: string): string {
  const d = normalizePhone(input);
  return d.length === 8 ? `${d.slice(0, 4)} ${d.slice(4)}` : input;
}

/** WhatsApp deep link for a Kuwaiti number. */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/965${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.trim());
}

export function isValidIban(input: string): boolean {
  const s = input.replace(/\s/g, "").toUpperCase();
  if (!/^KW\d{2}[A-Z]{4}[A-Z0-9]{22}$/.test(s)) return false;
  const rearranged = s.slice(4) + s.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  return rem === 1;
}
