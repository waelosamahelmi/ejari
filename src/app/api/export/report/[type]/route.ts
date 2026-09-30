import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { buildReport, parseParams, REPORT_TYPES, type ReportType } from "@/server/reports/build";
import { buildWorkbook, xlsxResponse, type SheetSpec } from "@/lib/export/excel";

/** Excel export of any report: one sheet per section; multi-property reports get one sheet per property. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!(REPORT_TYPES as readonly string[]).includes(type))
    return NextResponse.json({ error: "notFound" }, { status: 404 });
  if (!can(ctx.role, "view_late_units") || (type !== "late" && !can(ctx.role, "view_reports")))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());
  const lang = sp.lang === "en" ? "en" : "ar";
  const spec = await buildReport(ctx, type as ReportType, parseParams(sp), lang);
  const sheets: SheetSpec[] = [];
  for (const [i, s] of spec.sections.entries()) {
    const columns = s.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width,
      type: c.type === "bool" ? ("text" as const) : c.type,
    }));
    const clean = (r: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(r)
          .filter(([k]) => !k.startsWith("_"))
          .map(([k, v]) => [k, typeof v === "boolean" ? (v ? "✓" : "") : v]),
      );
    if (s.groupKey) {
      const groups = [...new Set(s.rows.map((r) => String(r[s.groupKey!] ?? "")))];
      for (const g of groups) {
        sheets.push({
          name: g || spec.title,
          title: `${spec.title} — ${g}`,
          subtitle: spec.subtitle,
          rtl: lang === "ar",
          columns,
          rows: s.rows.filter((r) => String(r[s.groupKey!]) === g).map(clean),
        });
      }
      if (groups.length === 0)
        sheets.push({
          name: spec.title,
          title: spec.title,
          subtitle: spec.subtitle,
          rtl: lang === "ar",
          columns,
          rows: [],
        });
    } else {
      sheets.push({
        name: s.title ?? (i === 0 ? spec.title : `${spec.title} ${i + 1}`),
        title: spec.title,
        subtitle: spec.subtitle,
        rtl: lang === "ar",
        columns,
        rows: s.rows.map(clean),
        totals: s.totals,
      });
    }
  }
  if (spec.kpis.length) {
    sheets.unshift({
      name: "KPI",
      title: spec.title,
      subtitle: spec.subtitle,
      rtl: lang === "ar",
      columns: [
        { header: "", key: "label", width: 36 },
        { header: "", key: "value", width: 20 },
      ],
      rows: spec.kpis.map((k) => ({
        label: k.label,
        value:
          k.type === "money"
            ? k.value / 1000
            : k.type === "pct"
              ? `${Math.round(k.value * 1000) / 10}%`
              : k.value,
      })),
    });
  }
  const buf = await buildWorkbook(sheets, { creator: "Ejari" });
  return xlsxResponse(buf, `${type}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
