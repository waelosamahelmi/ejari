import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { AuditView, type AuditEntry } from "./audit-view";

const PAGE = 100;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "audit" });
  return { title: t("title") };
}

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { locale } = await pageLocale(params);
  await requireContext(locale, { capability: "view_audit" });
  const sp = await searchParams;
  const limit = Math.min(1000, Math.max(PAGE, Number(sp.limit) || PAGE));
  const db = await supabaseServer();
  let q = db
    .from("audit_log")
    .select("id, action, entity_type, entity_id, before, after, at, user_id")
    .order("at", { ascending: false })
    .limit(limit + 1);
  if (sp.entity) q = q.eq("entity_type", sp.entity);
  if (sp.action) q = q.eq("action", sp.action);
  if (sp.user) q = q.eq("user_id", sp.user);
  if (sp.id && /^[0-9a-f-]{36}$/i.test(sp.id)) q = q.eq("entity_id", sp.id);
  const [{ data }, { data: members }] = await Promise.all([
    q,
    db.from("org_members").select("user_id, display_name"),
  ]);
  const names = Object.fromEntries((members ?? []).map((m) => [m.user_id, m.display_name ?? ""]));
  const rows = (data ?? []).slice(0, limit);
  const entries: AuditEntry[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    before: (r.before as Record<string, unknown> | null) ?? null,
    after: (r.after as Record<string, unknown> | null) ?? null,
    at: r.at,
    user: r.user_id ? (names[r.user_id] ?? null) : null,
  }));
  return (
    <AuditView
      entries={entries}
      hasMore={(data ?? []).length > limit}
      limit={limit}
      filters={{
        entity: sp.entity ?? "",
        action: sp.action ?? "",
        user: sp.user ?? "",
        id: sp.id ?? "",
      }}
      users={(members ?? []).map((m) => ({ id: m.user_id, name: m.display_name ?? "" }))}
    />
  );
}
