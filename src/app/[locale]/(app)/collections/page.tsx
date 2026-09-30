import { getTranslations } from "next-intl/server";
import { requireContext } from "@/lib/auth";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { loadOrgData } from "@/server/queries/dataset";
import { isValidPeriod, periodOf, todayKuwait } from "@/domain/dates";
import { monthlyStatement } from "@/domain/reports";
import { can } from "@/lib/permissions";
import { paymentContexts } from "@/server/queries/payment-contexts";
import { CollectionsView } from "./collections-view";

export async function generateMetadata({ params }: LocaleParams) {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as "ar" | "en", namespace: "collections" });
  return { title: t("title") };
}

export default async function CollectionsPage({
  params,
  searchParams,
}: LocaleParams & { searchParams: Promise<{ period?: string; property?: string; pay?: string }> }) {
  const { locale } = await pageLocale(params);
  const sp = await searchParams;
  const ctx = await requireContext(locale);
  const data = await loadOrgData(ctx);
  const today = todayKuwait();
  const period = sp.period && isValidPeriod(sp.period) ? sp.period : periodOf(today);
  const props = data.ds.properties.filter((p) => data.properties.get(p.id)?.active);
  const selected = sp.property && props.some((p) => p.id === sp.property) ? sp.property : "all";
  const statements = (selected === "all" ? props : props.filter((p) => p.id === selected)).map(
    (p) => monthlyStatement(data.idx, p.id, period),
  );
  const db = await supabaseServer();
  const [{ data: closing }, { data: members }] = await Promise.all([
    db.from("monthly_closings").select("closed_at").eq("period", period).maybeSingle(),
    db
      .from("org_members")
      .select("user_id, display_name")
      .eq("active", true)
      .in("role", ["admin", "accountant", "collector"]),
  ]);
  // Current month: embed payment contexts so the cached page can record payments offline.
  const offline =
    period === periodOf(today) && can(ctx.role, "record_payment")
      ? paymentContexts(
          data,
          statements.flatMap((s) =>
            s.rows.map((r) => r.contractId).filter((x): x is string => !!x),
          ),
          (members ?? []).map((m) => ({ id: m.user_id, name: m.display_name ?? "" })),
          today,
        )
      : {};
  const contracts = data.ds.contracts
    .filter((c) => c.status === "active" || c.status === "notice_given")
    .map((c) => ({
      id: c.id,
      label: `${c.tenantName} · ${data.properties.get(c.propertyId)?.name ?? ""} · ${c.unitIds.map((u) => data.units.get(u)?.label).join(", ")}`,
    }));
  return (
    <CollectionsView
      period={period}
      today={today}
      selected={selected}
      properties={props.map((p) => ({ id: p.id, name: p.name }))}
      statements={statements}
      closedAt={closing?.closed_at ?? null}
      contracts={contracts}
      openPicker={sp.pay === "1"}
      offline={offline}
      caps={{
        pay: can(ctx.role, "record_payment"),
        close: can(ctx.role, "close_month"),
        reopen: can(ctx.role, "reopen_month"),
        remind: can(ctx.role, "send_reminder"),
        export: can(ctx.role, "view_reports"),
      }}
    />
  );
}
