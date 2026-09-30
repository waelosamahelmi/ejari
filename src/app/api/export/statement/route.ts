import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { getSessionContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { loadOrgData } from "@/server/queries/dataset";
import { buildWorkbook, xlsxResponse } from "@/lib/export/excel";
import { monthlyStatement } from "@/domain/reports";
import { formatPeriod, isValidPeriod } from "@/domain/dates";

export async function GET(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!can(ctx.role, "view_late_units") && ctx.role !== "owner")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const period = req.nextUrl.searchParams.get("period") ?? "";
  const property = req.nextUrl.searchParams.get("property") ?? "all";
  const lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "ar";
  if (!isValidPeriod(period)) return NextResponse.json({ error: "validation" }, { status: 400 });
  const data = await loadOrgData(ctx);
  const t = await getTranslations({ locale: lang, namespace: "collections" });
  const props = data.ds.properties.filter(
    (p) => (property === "all" || p.id === property) && data.properties.get(p.id)?.active,
  );
  const columns = [
    { header: t("columns.unit"), key: "unit", width: 14 },
    { header: t("columns.tenant"), key: "tenant", width: 28 },
    { header: t("columns.legal"), key: "legal", width: 12 },
    { header: t("columns.rent"), key: "rent", type: "money" as const },
    { header: t("columns.receipts"), key: "receipts", width: 18 },
    { header: t("columns.collected"), key: "collected", type: "money" as const },
    { header: `${t("columns.prevNext")} (${t("prev")})`, key: "prev", type: "money" as const },
    { header: `${t("columns.prevNext")} (${t("next")})`, key: "next", type: "money" as const },
    { header: t("columns.lastPayment"), key: "last", type: "date" as const },
    { header: t("columns.arrears"), key: "arrears", type: "money" as const },
    { header: t("columns.notes"), key: "notes", width: 26 },
  ];
  const sheets = props.map((p) => {
    const s = monthlyStatement(data.idx, p.id, period);
    return {
      name: p.name,
      title: `${t("statementTitle")} — ${p.name}`,
      subtitle: formatPeriod(period, lang),
      rtl: lang === "ar",
      columns,
      rows: s.rows.map((r) => ({
        unit: r.unitLabels,
        tenant: r.vacant ? t("vacant") : r.tenantName,
        legal: r.vacant ? "" : r.legalLabel,
        rent: r.vacant ? null : r.rentFils,
        receipts: r.receiptNos.join(", "),
        collected: r.vacant ? null : r.collectedFils,
        prev: r.previousFils || null,
        next: r.nextFils || null,
        last: r.lastPaymentDate,
        arrears: r.vacant ? null : r.arrearsFils,
        notes: r.notes
          .map((n) => (n === "free" ? t("free") : n === "notice" ? t("notice") : n))
          .join(" · "),
      })),
      totals: {
        unit: t("totals.total"),
        rent: s.totals.rentFils,
        collected: s.totals.collectedFils,
        prev: s.totals.previousFils,
        next: s.totals.nextFils,
        arrears: s.totals.arrearsFils,
      },
    };
  });
  const buf = await buildWorkbook(sheets, { creator: "Ejari" });
  return xlsxResponse(buf, `statement-${period}.xlsx`);
}
