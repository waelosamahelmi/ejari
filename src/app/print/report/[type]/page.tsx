import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requirePrintContext } from "@/server/print";
import { can } from "@/lib/permissions";
import {
  buildReport,
  parseParams,
  REPORT_TYPES,
  type Cell,
  type RCol,
  type ReportType,
} from "@/server/reports/build";
import { Letterhead, PoweredBy } from "@/components/print/letterhead";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { formatDate, todayKuwait } from "@/domain/dates";
import { fromFils } from "@/domain/money";

function fmt(c: RCol, v: Cell, yes: string, no: string): string {
  if (v === null || v === undefined || v === "") return "";
  if (c.type === "money") return fromFils(Number(v));
  if (c.type === "date") return formatDate(String(v));
  if (c.type === "pct") return `${Math.round(Number(v) * 1000) / 10}%`;
  if (c.type === "bool") return v ? yes : no;
  return String(v);
}

export default async function PrintReport({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { type } = await params;
  const sp = await searchParams;
  if (!(REPORT_TYPES as readonly string[]).includes(type)) notFound();
  const { ctx, logoUrl, lang } = await requirePrintContext(sp.lang);
  if (
    !(ctx.role === "owner" && type === "accounting") &&
    (!can(ctx.role, "view_late_units") || (type !== "late" && !can(ctx.role, "view_reports")))
  )
    notFound();
  const spec = await buildReport(ctx, type as ReportType, parseParams(sp), lang);
  const t = await getTranslations({ locale: lang, namespace: "reports" });
  const tc = await getTranslations({ locale: lang, namespace: "common.actions" });
  const wide = spec.sections.some((s) => s.columns.length > 7);
  return (
    <>
      <PrintToolbar
        auto={sp.auto === "1"}
        lang={lang}
        labels={{ print: tc("print"), close: tc("close") }}
      />
      <div className={`print-page ${wide ? "landscape" : ""}`} dir={lang === "ar" ? "rtl" : "ltr"}>
        {wide && <style>{`@page { size: A4 landscape; margin: 12mm; }`}</style>}
        <Letterhead
          show={ctx.settings.letterhead}
          orgName={ctx.orgName}
          orgNameEn={ctx.orgNameEn}
          logoUrl={logoUrl}
        />
        <h1 className="text-[16pt] font-bold">{spec.title}</h1>
        <p className="text-[10pt] text-neutral-600">
          {spec.subtitle} · {t("generatedAt", { date: formatDate(todayKuwait()) })}
        </p>
        {spec.kpis.length > 0 && (
          <table className="print-table mt-4">
            <tbody>
              {Array.from({ length: Math.ceil(spec.kpis.length / 3) }, (_, i) => (
                <tr key={i}>
                  {spec.kpis.slice(i * 3, i * 3 + 3).map((k) => (
                    <td key={k.label} className="w-1/3">
                      <div className="text-[8.5pt] text-neutral-600">{k.label}</div>
                      <div className="num text-[11pt] font-bold">
                        {k.type === "money"
                          ? fromFils(k.value)
                          : k.type === "pct"
                            ? `${Math.round(k.value * 1000) / 10}%`
                            : k.value}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {spec.sections.map((s, si) => (
          <section key={si} className="mt-5">
            {s.title && <h2 className="mb-1 text-[11pt] font-bold">{s.title}</h2>}
            <table className="print-table">
              <thead>
                <tr>
                  {s.columns.map((c) => (
                    <th key={c.key}>{c.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r, ri) => (
                  <tr key={ri}>
                    {s.columns.map((c) => (
                      <td
                        key={c.key}
                        className={c.type && c.type !== "text" ? "num text-center" : ""}
                      >
                        {fmt(c, r[c.key] ?? null, t("yes"), t("no"))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {s.totals && (
                <tfoot>
                  <tr>
                    {s.columns.map((c) => (
                      <td
                        key={c.key}
                        className={c.type && c.type !== "text" ? "num text-center" : ""}
                      >
                        {fmt(c, s.totals![c.key] ?? null, t("yes"), t("no"))}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </section>
        ))}
        <PoweredBy show={ctx.settings.poweredBy} />
      </div>
    </>
  );
}
