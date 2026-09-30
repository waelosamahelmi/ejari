import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requirePrintContext } from "@/server/print";
import { Letterhead, PoweredBy } from "@/components/print/letterhead";
import { PrintToolbar } from "@/components/print/print-toolbar";
import { formatDate } from "@/domain/dates";
import { splitDinarFils } from "@/domain/money";
import { tafqeetKWD, wordsEN } from "@/domain/tafqeet";

export const metadata = { title: "سند صرف" };

function Money({ fils }: { fils: number }) {
  const { dinars, fils: f } = splitDinarFils(fils);
  return (
    <>
      <td className="num text-center font-bold">{dinars.toLocaleString("en")}</td>
      <td className="num text-center font-bold">{String(f).padStart(3, "0")}</td>
    </>
  );
}

/** Paper replica of the office's سند صرف (§10.8). */
export default async function PrintVoucher({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string; auto?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { ctx, logoUrl, lang } = await requirePrintContext(sp.lang);
  const db = await supabaseServer();
  const { data: v } = await db
    .from("expense_vouchers")
    .select("*, expense_lines(position, amount_fils, description, expense_categories(name_ar, name_en), beneficiaries(name), expense_allocations(amount_fils, properties(name, property_owners(owners(full_name))), units(label, floor)))")
    .eq("id", id)
    .maybeSingle();
  if (!v) notFound();
  const t = await getTranslations({ locale: lang, namespace: "expenses.print" });
  const tc = await getTranslations({ locale: lang, namespace: "common.actions" });
  const lines = [...(v.expense_lines ?? [])].sort((a, b) => a.position - b.position);
  const total = lines.reduce((a, l) => a + l.amount_fils, 0);
  const rtl = lang === "ar";
  const tick = (on: boolean) => <span className="inline-flex size-4 items-center justify-center border border-black align-middle text-[9pt] leading-none">{on ? "✓" : ""}</span>;
  return (
    <>
      <PrintToolbar auto={sp.auto === "1"} lang={lang} labels={{ print: tc("print"), close: tc("close") }} />
      <div className="print-page" dir={rtl ? "rtl" : "ltr"}>
        <Letterhead show={ctx.settings.letterhead} orgName={ctx.orgName} orgNameEn={ctx.orgNameEn} logoUrl={logoUrl} />
        <div className="flex items-start justify-between gap-4">
          <table className="print-table w-auto text-[11pt]">
            <thead><tr><th className="px-5">{t("dinar")}</th><th className="px-5">{t("fils")}</th></tr></thead>
            <tbody><tr><Money fils={total} /></tr></tbody>
          </table>
          <h1 className="border-2 border-black px-6 py-1 text-[20pt] font-bold">{t("title")}</h1>
          <div className="num shrink-0 text-[11pt] leading-7">
            <div className="whitespace-nowrap">{t("no")}: <strong dir="ltr">{v.voucher_no}</strong></div>
            <div>{t("date")}: {formatDate(v.voucher_date)}</div>
          </div>
        </div>
        <p className="mt-5 text-[12pt]">{t("amountWords")}: <strong>{rtl ? tafqeetKWD(total) : wordsEN(total)}</strong></p>
        {v.notes && <p className="mt-1 text-[11pt]">{t("notes")}: {v.notes}</p>}

        <div className="mt-5 space-y-4">
          {lines.map((l, i) => {
            const cat = l.expense_categories as unknown as { name_ar: string; name_en: string };
            const allocs = l.expense_allocations ?? [];
            return (
              <table key={i} className="print-table break-inside-avoid">
                <thead>
                  <tr>
                    <th className="w-16">{t("dinar")}</th>
                    <th className="w-14">{t("fils")}</th>
                    <th>{t("type")}</th>
                    <th>{t("beneficiary")}</th>
                    <th>{t("description")}</th>
                    <th>{t("owner")}</th>
                    <th>{t("property")}</th>
                    <th>{t("unit")}</th>
                    <th>{t("floor")}</th>
                  </tr>
                </thead>
                <tbody>
                  {allocs.map((a, k) => {
                    const p = a.properties as unknown as { name: string; property_owners: { owners: { full_name: string } }[] };
                    const u = a.units as unknown as { label: string; floor: number | null } | null;
                    return (
                      <tr key={k}>
                        <Money fils={a.amount_fils} />
                        {k === 0 && (
                          <>
                            <td rowSpan={allocs.length}>{rtl ? cat.name_ar : cat.name_en}</td>
                            <td rowSpan={allocs.length}>{(l.beneficiaries as unknown as { name: string } | null)?.name}</td>
                            <td rowSpan={allocs.length}>{l.description}</td>
                          </>
                        )}
                        <td>{p.property_owners.map((po) => po.owners.full_name).join("، ")}</td>
                        <td>{p.name}</td>
                        <td className="text-center">{u?.label ?? ""}</td>
                        <td className="num text-center">{u?.floor ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-8 text-[11pt]">
          <span>{t("paidFrom")}:</span>
          <span>{tick(v.paid_from === "cash_box")} {t("cashBox")}</span>
          <span>{tick(v.paid_from === "bank")} {t("bank")}</span>
          <span>{tick(v.paid_from === "cheque")} {t("cheque")}{v.reference ? ` — ${v.reference}` : ""}</span>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-10 text-[11pt]">
          <div>{t("recipient")}: <strong>{v.recipient_name}</strong></div>
          <div>{t("signature")}: <span className="inline-block w-48 border-b border-dotted border-black" /></div>
        </div>
        <PoweredBy show={ctx.settings.poweredBy} />
      </div>
    </>
  );
}
