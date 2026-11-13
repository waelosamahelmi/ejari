import { z } from "zod";
import { UNIT_TYPES } from "./types";
/** Frozen identity/date facts. Utility settlement and owner approval require signatures. */
export const clearanceSnapshotSchema = z.object({
  version: z.literal(1),
  contractNo: z.string(),
  propertyName: z.string(),
  address: z.record(z.string(), z.string().nullable()),
  ownerNames: z.array(z.string()),
  tenantNames: z.array(z.string()),
  units: z.array(z.object({ label: z.string(), type: z.enum(UNIT_TYPES) })),
  moveOutDate: z.string().nullable(),
  lastPaymentDate: z.string().nullable(),
  reason: z.string().nullable(),
});
