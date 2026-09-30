"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActionContext } from "@/lib/auth";
import { run } from "@/server/action";
import { isoDate } from "@/lib/schemas/common";
import { LEGAL_STATUSES } from "@/domain/types";

const reval = () => revalidatePath("/[locale]", "layout");

const caseSchema = z.object({
  tenantId: z.string().uuid({ message: "required" }),
  contractId: z.string().uuid().nullable().optional(),
  caseNo: z.string().trim().max(80).optional().nullable(),
  court: z.string().trim().max(160).optional().nullable(),
  type: z.enum(["eviction", "rent_claim", "other"]),
  status: z.enum(LEGAL_STATUSES),
  amountClaimedFils: z.number().int().min(0),
  nextHearingDate: isoDate.optional().nullable(),
  lawyer: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
export type LegalCaseInput = z.input<typeof caseSchema>;

export async function saveLegalCase(id: string | null, input: LegalCaseInput) {
  return run(async () => {
    const ctx = await requireActionContext("manage_legal");
    const d = caseSchema.parse(input);
    const db = await supabaseServer();
    const row = {
      org_id: ctx.orgId,
      tenant_id: d.tenantId,
      contract_id: d.contractId ?? null,
      case_no: d.caseNo || null,
      court: d.court || null,
      type: d.type,
      status: d.status,
      amount_claimed_fils: d.amountClaimedFils,
      next_hearing_date: d.nextHearingDate || null,
      lawyer: d.lawyer || null,
      notes: d.notes || null,
    };
    const res = id
      ? await db.from("legal_cases").update(row).eq("id", id).select("id").single()
      : await db.from("legal_cases").insert(row).select("id").single();
    if (res.error) throw res.error;
    reval();
    return res.data.id;
  });
}

export async function setLegalStatus(id: string, status: (typeof LEGAL_STATUSES)[number]) {
  return run(async () => {
    const ctx = await requireActionContext("manage_legal");
    const db = await supabaseServer();
    const { error } = await db.from("legal_cases").update({ status }).eq("id", id);
    if (error) throw error;
    await db
      .from("legal_case_events")
      .insert({
        org_id: ctx.orgId,
        case_id: id,
        event_date: new Date().toISOString().slice(0, 10),
        title: status,
      });
    reval();
  });
}

export async function addLegalEvent(
  caseId: string,
  input: { date: string; title: string; notes?: string | null },
) {
  return run(async () => {
    const ctx = await requireActionContext("manage_legal");
    const d = z
      .object({
        date: isoDate,
        title: z.string().trim().min(1).max(200),
        notes: z.string().trim().max(2000).optional().nullable(),
      })
      .parse(input);
    const db = await supabaseServer();
    const { error } = await db
      .from("legal_case_events")
      .insert({
        org_id: ctx.orgId,
        case_id: caseId,
        event_date: d.date,
        title: d.title,
        notes: d.notes || null,
      });
    if (error) throw error;
    reval();
  });
}
