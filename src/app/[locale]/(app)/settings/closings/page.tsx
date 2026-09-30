import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { can } from "@/lib/permissions";
import { ClosingsView } from "./closings-view";

export default async function ClosingsPage({ params }: LocaleParams) {
  const { locale } = await pageLocale(params);
  const ctx = await requireContext(locale, { capability: "close_month" });
  const db = await supabaseServer();
  const { data } = await db
    .from("monthly_closings")
    .select("period, closed_at, notes")
    .order("period", { ascending: false });
  const t = await getTranslations("settings.items");
  return (
    <ClosingsView
      title={t("closings")}
      canReopen={can(ctx.role, "reopen_month")}
      rows={(data ?? []).map((r) => ({ period: r.period, closedAt: r.closed_at, notes: r.notes }))}
    />
  );
}
