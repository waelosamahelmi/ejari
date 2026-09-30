import { z } from "zod";
import { UNIT_TYPES } from "@/domain/types";
import { EXPENSE_CATEGORY_TYPES } from "@/domain/expenses";
import { civilId, email, fils, iban, optText, paci, phones, req } from "./common";

export const ownerSchema = z.object({
  fullName: req(z.string().max(160, "tooLong")),
  civilId,
  phones,
  email,
  iban,
  bankName: optText(120),
  address: optText(300),
  notes: optText(2000),
});
export type OwnerInput = z.input<typeof ownerSchema>;

export const propertySchema = z
  .object({
    name: req(z.string().max(160, "tooLong")),
    nameEn: optText(160),
    area: optText(120),
    block: optText(40),
    street: optText(120),
    avenue: optText(40),
    houseOrPlot: optText(40),
    paciNo: paci,
    propertyType: z.enum(["residential", "investment", "mixed", "industrial"]),
    floors: z.number().int().min(0).max(200).nullable().optional(),
    notes: optText(2000),
    owners: z.array(z.object({ ownerId: z.string().uuid(), sharePct: z.number().positive().max(100) })).min(1, "required"),
    commission: z.object({ kind: z.enum(["percent", "fixed"]), value: z.number().nonnegative() }).nullable().optional(),
  })
  .refine((p) => Math.abs(p.owners.reduce((a, o) => a + o.sharePct, 0) - 100) < 0.001, { message: "shares100", path: ["owners"] });
export type PropertyInput = z.input<typeof propertySchema>;

export const unitSchema = z.object({
  propertyId: z.string().uuid(),
  label: req(z.string().max(60, "tooLong")),
  sortOrder: z.number().int().min(0).default(0),
  type: z.enum(UNIT_TYPES),
  floor: z.number().int().min(-5).max(200).nullable().optional(),
  areaM2: z.number().nonnegative().nullable().optional(),
  bedrooms: z.number().int().min(0).max(50).nullable().optional(),
  bathrooms: z.number().int().min(0).max(50).nullable().optional(),
  paciNo: paci,
  askingRentFils: fils,
  elecMeterNo: optText(40),
  waterMeterNo: optText(40),
  notes: optText(2000),
  active: z.boolean().default(true),
  availableSince: z.string().optional(),
});
export type UnitInput = z.input<typeof unitSchema>;

export const bulkUnitsSchema = z.object({
  propertyId: z.string().uuid(),
  type: z.enum(UNIT_TYPES),
  count: z.number().int().min(1).max(300),
  startNumber: z.number().int().min(0).max(100000),
  prefix: optText(20),
  floorFrom: z.number().int().min(-5).max(200),
  floorTo: z.number().int().min(-5).max(200),
  askingRentFils: fils,
  bedrooms: z.number().int().min(0).max(50).nullable().optional(),
});
export type BulkUnitsInput = z.input<typeof bulkUnitsSchema>;

export const tenantSchema = z.object({
  fullName: req(z.string().max(160, "tooLong")),
  civilId,
  nationality: optText(60),
  phones,
  email,
  employer: optText(160),
  emergencyContact: optText(200),
  notes: optText(2000),
});
export type TenantInput = z.input<typeof tenantSchema>;

export const categorySchema = z.object({
  nameAr: req(z.string().max(80, "tooLong")),
  nameEn: req(z.string().max(80, "tooLong")),
  type: z.enum(EXPENSE_CATEGORY_TYPES),
  active: z.boolean().default(true),
});

export const beneficiarySchema = z.object({
  name: req(z.string().max(120, "tooLong")),
  kind: z.enum(["staff", "vendor", "asset", "other"]),
  phone: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v.replace(/\D/g, "") : null)),
  monthlySalaryFils: fils.nullable().optional(),
  notes: optText(1000),
  active: z.boolean().default(true),
});
