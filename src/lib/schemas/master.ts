import { z } from "zod";
import { UNIT_TYPES } from "@/domain/types";
import { EXPENSE_CATEGORY_TYPES } from "@/domain/expenses";
import { FLOOR_MAX, FLOOR_MIN, MAX_PLANNED_UNITS } from "@/domain/unit-plan";
import { civilId, email, fils, iban, optText, paci, phones, req, requiredPaci } from "./common";

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
    governorate: req(z.string().max(80, "tooLong")),
    area: req(z.string().max(120, "tooLong")),
    block: req(z.string().max(40, "tooLong")),
    street: req(z.string().max(120, "tooLong")),
    avenue: optText(40),
    houseOrPlot: req(z.string().max(40, "tooLong")),
    paciNo: requiredPaci,
    propertyType: z.enum(["residential", "investment", "mixed", "industrial"]),
    floors: z.number().int().min(0).max(200).nullable().optional(),
    notes: optText(2000),
    owners: z
      .array(z.object({ ownerId: z.string().uuid(), sharePct: z.number().positive().max(100) }))
      .min(1, "required"),
    commission: z
      .object({ kind: z.enum(["percent", "fixed"]), value: z.number().nonnegative() })
      .nullable()
      .optional(),
  })
  .refine((p) => Math.abs(p.owners.reduce((a, o) => a + o.sharePct, 0) - 100) < 0.001, {
    message: "shares100",
    path: ["owners"],
  });
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

export const plannedUnitSchema = z.object({
  label: req(z.string().max(60, "tooLong")),
  type: z.enum(UNIT_TYPES),
  floor: z
    .number()
    .int()
    .min(FLOOR_MIN)
    .max(FLOOR_MAX)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  areaM2: z
    .number()
    .nonnegative()
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  bedrooms: z
    .number()
    .int()
    .min(0)
    .max(50)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  bathrooms: z
    .number()
    .int()
    .min(0)
    .max(50)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  askingRentFils: fils,
});
export type PlannedUnitInput = z.input<typeof plannedUnitSchema>;

export const createPlannedUnitsSchema = z
  .object({
    propertyId: z.string().uuid(),
    units: z.array(plannedUnitSchema).min(1, "required").max(MAX_PLANNED_UNITS),
  })
  .refine(
    (v) => new Set(v.units.map((u) => u.label.trim().toLowerCase())).size === v.units.length,
    { message: "duplicate", path: ["units"] },
  );
export type CreatePlannedUnitsInput = z.input<typeof createPlannedUnitsSchema>;

export const createPropertyWithPlanSchema = z.object({
  property: propertySchema,
  units: z.array(plannedUnitSchema).max(MAX_PLANNED_UNITS),
});
export type CreatePropertyWithPlanInput = z.input<typeof createPropertyWithPlanSchema>;

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
