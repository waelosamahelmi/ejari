"use client";
import { useMemo, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/ui/month-picker";
import { Select, Input, Field } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { PaymentSheet } from "@/components/domain/payments/payment-sheet";
import { prepareReceipts, voidPreparedReceipt } from "@/server/actions/collection-receipts";
import { useAction } from "@/hooks/use-action";
import { fromFils } from "@/domain/money";
import type { Database } from "@/lib/supabase/types";
type Receipt = Database["public"]["Tables"]["collection_receipts"]["Row"] & { printCount: number };
type Snap = {
  ownerName: string;
  tenantName: string;
  propertyName: string;
  unitLabels: string;
  periods: string[];
};
export function ReceiptPreparation({
  period,
  property,
  candidates,
  properties,
  receipts,
}: {
  period: string;
  property: string;
  candidates: {
    id: string;
    propertyId: string;
    propertyName: string;
    tenant: string;
    units: string;
    amountFils: number;
  }[];
  properties: { id: string; name: string }[];
  receipts: Receipt[];
}) {
  const locale = useLocale();
  const ar = locale === "ar";
  const txt = (a: string, e: string) => (ar ? a : e);
  const router = useRouter();
  const { exec, pending } = useAction();
  const [chosen, setChosen] = useState<string[]>([]);
  const [printed, setPrinted] = useState<string[]>([]);
  const [collect, setCollect] = useState<string | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const rows = receipts.filter((r) => property === "all" || r.property_id === property);
  const available = candidates.filter(
    (c) =>
      (property === "all" || c.propertyId === property) &&
      !receipts.some((r) => r.contract_id === c.id && r.status !== "void"),
  );
  const selected = receipts.find((r) => r.id === collect);
  const prepared = useMemo(
    () =>
      selected
        ? {
            id: selected.id,
            documentNo: selected.document_no,
            amountFils: selected.amount_fils,
            periods: (selected.snapshot as Snap).periods,
          }
        : null,
    [selected],
  );
  const nav = (p: string, v: string) => {
    const q = new URLSearchParams({ period, property, [p]: v });
    router.push(`/collections/receipts?${q}`);
    setChosen([]);
    setPrinted([]);
  };
  const href = (ids: string[]) => `/print/collection-receipts?ids=${ids.join(",")}&lang=${locale}`;
  return (
    <>
      <LargeTitleHeader
        title={txt("تجهيز وصولات التحصيل", "Prepare collection receipts")}
        back={{ href: "/collections", label: txt("التحصيل", "Collections") }}
        subtitle={txt(
          "التجهيز والطباعة لا يسجلان دفعة. المبلغ يشمل غير المسدد حتى الشهر المختار.",
          "Preparing/printing records no payment. Amounts include unpaid charges through the chosen month.",
        )}
      />
      <div className="mb-5 flex flex-wrap gap-3">
        <MonthPicker value={period} onChange={(v) => nav("period", v)} />
        <Select
          aria-label={txt("العقار", "Property")}
          value={property}
          onChange={(e) => nav("property", e.target.value)}
        >
          <option value="all">{txt("كل العقارات", "All properties")}</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <Card className="mb-6 p-4">
        <h2 className="mb-3 text-lg font-semibold">{txt("العقود المتاحة", "Available leases")}</h2>
        <Button variant="secondary" onClick={() => setChosen(available.map((c) => c.id))}>
          {txt("اختيار الكل", "Select all")}
        </Button>
        <div className="my-3 max-h-80 overflow-y-auto">
          {available.map((c) => (
            <label key={c.id} className="flex items-center gap-3 border-b py-3">
              <input
                type="checkbox"
                checked={chosen.includes(c.id)}
                onChange={(e) =>
                  setChosen((v) =>
                    e.target.checked ? [...v, c.id] : v.filter((id) => id !== c.id),
                  )
                }
              />
              <span>
                {c.propertyName} · {c.units} · {c.tenant} · {fromFils(c.amountFils)}
              </span>
            </label>
          ))}
        </div>
        <Button
          disabled={!chosen.length || chosen.length > 100}
          loading={pending}
          onClick={() =>
            exec(() => prepareReceipts(chosen, period), {
              onSuccess: () => {
                setChosen([]);
                router.refresh();
              },
            })
          }
        >
          {txt("تجهيز الوصلات المختارة", "Prepare selected receipts")}
        </Button>
        <p className="text-label-2 mt-2 text-sm">
          {txt(
            "حتى 100 وصل في كل دفعة تجهيز وطباعة.",
            "Up to 100 receipts per preparation/print batch.",
          )}
        </p>
      </Card>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          disabled={!printed.length || printed.length > 100}
          onClick={() => window.open(href(printed), "_blank", "noopener")}
        >
          {txt("طباعة المختار", "Print selected")}
        </Button>
        <Button
          variant="secondary"
          disabled={!rows.filter((r) => r.status !== "void").length}
          onClick={() =>
            window.open(
              href(
                rows
                  .filter((r) => r.status !== "void")
                  .slice(0, 100)
                  .map((r) => r.id),
              ),
              "_blank",
              "noopener",
            )
          }
        >
          {txt("طباعة الكل (حتى 100)", "Print all (up to 100)")}
        </Button>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const s = r.snapshot as Snap;
          return (
            <Card key={r.id} className="flex flex-wrap items-center gap-4 p-4">
              <input
                aria-label={txt("اختيار الوصل ", "Select receipt ") + r.document_no}
                type="checkbox"
                disabled={r.status === "void"}
                checked={printed.includes(r.id)}
                onChange={(e) =>
                  setPrinted((v) =>
                    e.target.checked ? [...v, r.id] : v.filter((id) => id !== r.id),
                  )
                }
              />
              <div className="min-w-0 flex-1">
                <strong>
                  <bdi>{r.document_no}</bdi> · {s.ownerName}
                </strong>
                <p>
                  {s.propertyName} · {s.unitLabels} · {s.tenantName}
                </p>
                <p className="text-sm">
                  {fromFils(r.amount_fils)} ·{" "}
                  {r.status === "prepared"
                    ? txt("بانتظار التحصيل", "Awaiting collection")
                    : r.status === "collected"
                      ? txt("تم التحصيل", "Collected")
                      : txt("ملغى", "Void")}{" "}
                  · {txt("طلبات الطباعة: ", "Print requests: ") + r.printCount}
                </p>
              </div>
              {r.status === "prepared" && (
                <>
                  <Button onClick={() => setCollect(r.id)}>
                    {txt("تم التحصيل — سجّل الدفعة", "Collect — record payment")}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setReason("");
                      setVoidId(r.id);
                    }}
                  >
                    {txt("إلغاء الوصل", "Void receipt")}
                  </Button>
                </>
              )}
              {r.payment_id && (
                <a className="text-link" href={`/${locale}/payments/${r.payment_id}`}>
                  {txt("الدفعة", "Payment")}
                </a>
              )}
            </Card>
          );
        })}
      </div>
      <PaymentSheet
        open={!!selected}
        onOpenChange={(o) => !o && setCollect(null)}
        contractId={selected?.contract_id ?? null}
        preparedReceipt={prepared}
      />
      <Sheet
        open={!!voidId}
        onOpenChange={(o) => !o && setVoidId(null)}
        title={txt("إلغاء وصل غير محصل", "Void uncollected receipt")}
        footer={
          <Button
            disabled={!reason.trim()}
            loading={pending}
            onClick={() =>
              voidId &&
              exec(() => voidPreparedReceipt(voidId, reason), {
                onSuccess: () => {
                  setVoidId(null);
                  router.refresh();
                },
              })
            }
          >
            {txt("تأكيد الإلغاء", "Confirm void")}
          </Button>
        }
      >
        <Field label={txt("السبب", "Reason")} htmlFor="void-receipt-reason">
          <Input
            id="void-receipt-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </Sheet>
    </>
  );
}
