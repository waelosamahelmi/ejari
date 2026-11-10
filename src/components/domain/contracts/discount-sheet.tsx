"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { useRouter } from "@/i18n/navigation";
import { addTemporaryDiscount, listContractDiscounts } from "@/server/actions/contracts";
import { useMoney } from "@/components/shell/prefs-context";
import { DiscountFields, type DiscountInput } from "./discount-fields";

export function DiscountSheet({
  contractId,
  period,
  minPeriod,
  maxPeriod,
  rentFils,
}: {
  contractId: string;
  period: string;
  minPeriod: string;
  maxPeriod: string;
  rentFils: number;
}) {
  const firstPeriod = period < minPeriod ? minPeriod : period > maxPeriod ? maxPeriod : period;
  const t = useTranslations("contracts.discount");
  const router = useRouter();
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const { exec, pending } = useAction();
  const [value, setValue] = useState<DiscountInput>({
    fromPeriod: firstPeriod,
    toPeriod: firstPeriod,
    amountFils: 0,
    reason: "",
  });
  const [rows, setRows] = useState<
    {
      id: string;
      from_period: string;
      to_period: string | null;
      amount_fils: number;
      reason: string;
    }[]
  >([]);
  useEffect(() => {
    if (open)
      void listContractDiscounts(contractId).then((r) => {
        if (r.ok) setRows(r.data ?? []);
      });
  }, [open, contractId]);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("title")}
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t("title")}
        footer={
          <Button
            block
            loading={pending}
            disabled={
              !value.reason.trim() ||
              value.amountFils <= 0 ||
              (value.toPeriod !== null && value.toPeriod < value.fromPeriod)
            }
            onClick={() =>
              exec(() => addTemporaryDiscount(contractId, value), {
                success: t("saved"),
                onSuccess: () => {
                  setOpen(false);
                  router.refresh();
                },
              })
            }
          >
            {t("apply")}
          </Button>
        }
      >
        <p className="text-label-2 mb-5 text-sm">{t("help")}</p>
        <DiscountFields
          value={value}
          onChange={setValue}
          minPeriod={minPeriod}
          maxPeriod={maxPeriod}
          rentFils={rentFils}
        />
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="bg-inset rounded-2xl p-4">
              <p className="num">
                {r.from_period} — {r.to_period ?? t("openEnded")} · {money(r.amount_fils)}
              </p>
              <p>{r.reason}</p>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
