import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { recordPayment, type RecordPaymentInput } from "@/server/actions/payments";
import { notifyEvent } from "@/server/notify/events";

/** syncPayments: idempotent on payments.client_id; per-item results for the outbox. */
export async function POST(req: Request) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { items?: RecordPaymentInput[] } | null;
  const items = (body?.items ?? []).slice(0, 100);
  const results: { clientId: string; ok: boolean; error?: string; duplicate?: boolean }[] = [];
  for (const it of items) {
    const r = await recordPayment(it);
    results.push({
      clientId: it.clientId ?? "",
      ok: r.ok,
      error: r.ok ? undefined : r.error,
      duplicate: r.ok ? r.data.duplicate : undefined,
    });
  }
  const synced = results.filter((r) => r.ok && !r.duplicate).length;
  const review = results.filter((r) => !r.ok && r.error !== "network" && r.error !== "generic");
  if (synced > 0)
    await notifyEvent(ctx, "offline_synced", {
      url: "/payments",
      count: synced,
      dedupeKey: `sync:${Date.now()}`,
    }).catch(() => {});
  if (review.length) {
    const db = await supabaseServer();
    const ids = review
      .map((r) => items.find((i) => i.clientId === r.clientId)?.contractId)
      .filter((x): x is string => !!x);
    const { data } = await db.from("contracts").select("id, tenants(full_name)").in("id", ids);
    const nameOf = new Map(
      (data ?? []).map((c) => [
        c.id,
        (c.tenants as unknown as { full_name: string } | null)?.full_name ?? "",
      ]),
    );
    for (const r of review) {
      const it = items.find((i) => i.clientId === r.clientId);
      await notifyEvent(ctx, "offline_review", {
        url: "/collections?review=1",
        contractId: it?.contractId,
        amountFils: it?.amountFils ?? 0,
        tenant: nameOf.get(it?.contractId ?? "") ?? "",
        dedupeKey: `review:${r.clientId}`,
      }).catch(() => {});
    }
  }
  return NextResponse.json({ results });
}
