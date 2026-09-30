import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth";
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
    results.push({ clientId: it.clientId ?? "", ok: r.ok, error: r.ok ? undefined : r.error, duplicate: r.ok ? r.data.duplicate : undefined });
  }
  const synced = results.filter((r) => r.ok && !r.duplicate).length;
  const review = results.filter((r) => !r.ok && r.error !== "network" && r.error !== "generic");
  if (synced > 0) await notifyEvent(ctx, "offline_synced", { url: "/payments", count: synced, dedupeKey: `sync:${Date.now()}` }).catch(() => {});
  for (const r of review) {
    const it = items.find((i) => i.clientId === r.clientId);
    await notifyEvent(ctx, "offline_review", { url: "/collections?review=1", amountFils: it?.amountFils ?? 0, tenant: "", reason: r.error ?? "" }).catch(() => {});
  }
  return NextResponse.json({ results });
}
