"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActionContext } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { run } from "@/server/action";
import { getPaymentContext } from "./payments";
export async function prepareReceipts(contractIds: string[], period: string) {
  return run(async () => {
    await requireActionContext("record_payment");
    const ids = z.array(z.string().uuid()).min(1).max(100).parse(contractIds);
    z.string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .parse(period);
    const db = await supabaseServer();
    const prepared: string[] = [];
    // Materialise the selected period only after authorising this contract through RLS.
    const ctx = await requireActionContext("record_payment");
    for (const id of [...new Set(ids)]) {
      const access = await getPaymentContext(id);
      if (!access.ok) throw Error(access.error);
      const { ensureChargesUntil } = await import("@/server/billing/ensure-charges");
      await ensureChargesUntil(ctx.orgId, period, ctx.settings, [id]);
      const r = await db.rpc("prepare_collection_receipt", { p_contract: id, p_period: period });
      if (r.error) throw r.error;
      prepared.push(r.data);
    }
    revalidatePath("/[locale]", "layout");
    return prepared;
  });
}
export async function voidPreparedReceipt(id: string, reason: string) {
  return run(async () => {
    await requireActionContext("record_payment");
    const db = await supabaseServer();
    const r = await db.rpc("void_collection_receipt", {
      p_id: z.string().uuid().parse(id),
      p_reason: z.string().trim().min(1).parse(reason),
    });
    if (r.error) throw r.error;
    revalidatePath("/[locale]", "layout");
  });
}
export async function recordPrint(
  kind: "payment" | "collection" | "voucher",
  ids: string[],
  job: string,
) {
  return run(async () => {
    await requireActionContext();
    const db = await supabaseServer();
    const r = await db.rpc("record_document_print", {
      p_kind: z.enum(["payment", "collection", "voucher"]).parse(kind),
      p_ids: z.array(z.string().uuid()).min(1).max(100).parse(ids),
      p_job: z.string().uuid().parse(job),
    });
    if (r.error) throw r.error;
  });
}
