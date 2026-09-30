import { z } from "zod";
import { fils, isoDate, optText } from "./common";

export const customClauseSchema = z.object({
  key: z.string().min(1),
  text: z.string().max(4000, "tooLong"),
});

export const contractDraftSchema = z
  .object({
    type: z.enum(["residential", "investment"]),
    ownerId: z.string().uuid().nullable().optional(),
    tenantId: z.string().uuid({ message: "required" }),
    propertyId: z.string().uuid({ message: "required" }),
    unitIds: z.array(z.string().uuid()).min(1, "required"),
    unitShares: z.array(fils).optional().nullable(),
    contractDate: isoDate,
    startDate: isoDate,
    firstCollectionDate: isoDate,
    termMonths: z.number().int().min(1).max(600),
    autoRenew: z.boolean(),
    renewalTermMonths: z.number().int().min(1).max(600).nullable().optional(),
    monthlyRentFils: z.number().int().positive("positive"),
    purpose: z.string().trim().min(1, "required").max(200, "tooLong"),
    utilitiesParty: z.enum(["owner", "tenant"]),
    electricityFixedFils: fils,
    freeMonths: z.number().int().min(0).max(24),
    freeMonthsPenaltyWindowMonths: z.number().int().min(0).max(60),
    noticePeriodMonths: z.number().int().min(0).max(24),
    securityDepositFils: fils,
    annualIncrease: z
      .object({
        kind: z.enum(["percent", "fixed"]),
        value: z.number().positive(),
        everyMonths: z.number().int().min(1).max(120),
      })
      .nullable()
      .optional(),
    clauseOverrides: z
      .object({
        enabled: z.record(z.string(), z.boolean()).optional(),
        text: z.record(z.string(), z.string()).optional(),
      })
      .default({}),
    customClauses: z.array(customClauseSchema).default([]),
    templateId: z.string().uuid().nullable().optional(),
    notes: optText(2000),
  })
  .refine((c) => c.firstCollectionDate >= c.startDate, {
    message: "firstCollectionBeforeStart",
    path: ["firstCollectionDate"],
  });

export type ContractDraftInput = z.input<typeof contractDraftSchema>;
export type ContractDraft = z.output<typeof contractDraftSchema>;

export const noticeSchema = z.object({
  noticeDate: isoDate,
  expectedMoveOut: isoDate.optional().nullable(),
});
export const revisionSchema = z.object({
  effectiveFrom: isoDate,
  monthlyRentFils: z.number().int().positive(),
  reason: optText(300),
});
export const renewSchema = z.object({
  termMonths: z.number().int().min(1).max(600),
  monthlyRentFils: z.number().int().positive(),
  activate: z.boolean().default(true),
});
export const terminateSchema = z.object({
  moveOutDate: isoDate,
  reason: z.string().trim().min(1, "required").max(500),
  penaltyFils: fils,
  depositRefundFils: fils.optional(),
});
