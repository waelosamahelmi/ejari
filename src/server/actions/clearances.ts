"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireActionContext } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { run } from "@/server/action";
export async function findClearance(contractId: string) {
  return run(async () => {
    await requireActionContext();
    const db = await supabaseServer();
    const { data, error } = await db
      .from("contract_clearances")
      .select("id")
      .eq("contract_id", z.string().uuid().parse(contractId))
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  });
}
export async function issueClearance(contractId: string) {
  return run(async () => {
    await requireActionContext("manage_contracts");
    const db = await supabaseServer();
    const { data, error } = await db.rpc("issue_contract_clearance", {
      p_contract: z.string().uuid().parse(contractId),
    });
    if (error) throw error;
    revalidatePath("/[locale]", "layout");
    return data;
  });
}
