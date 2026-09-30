import { z } from "zod";
import { isValidEmail, isValidIban, isValidKuwaitPhone, isValidPaci, normalizePhone, digitsOnly } from "@/domain/validation";

/** Error messages are i18n keys under `errors.field.*`. */
export const req = (s: z.ZodString = z.string()) => s.trim().min(1, "required");
export const optText = (max = 500) => z.string().trim().max(max, "tooLong").optional().nullable().transform((v) => (v ? v : null));
export const fils = z.number().int().nonnegative("invalidAmount");
export const positiveFils = z.number().int().positive("positive");
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate");
export const optIsoDate = isoDate.optional().nullable();
export const uuid = z.string().uuid();
export const paci = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? digitsOnly(v) : null))
  .refine((v) => v === null || isValidPaci(v), "invalidPaci");
export const civilId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? digitsOnly(v) : null))
  .refine((v) => v === null || /^\d{12}$/.test(v), "invalidCivilId");
export const phones = z
  .array(z.string())
  .transform((arr) => arr.map((p) => normalizePhone(p)).filter(Boolean))
  .refine((arr) => arr.every(isValidKuwaitPhone), "invalidPhone");
export const email = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || isValidEmail(v), "invalidEmail");
export const iban = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v.replace(/\s/g, "").toUpperCase() : null))
  .refine((v) => v === null || isValidIban(v), "invalidIban");
