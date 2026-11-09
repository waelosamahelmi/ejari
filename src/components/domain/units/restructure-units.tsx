"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { useAction } from "@/hooks/use-action";
import { useRouter } from "@/i18n/navigation";
import { restructureUnits } from "@/server/actions/master";
import { UNIT_TYPES, type UnitType } from "@/domain/types";

interface ResultUnit {
  label: string;
  type: UnitType;
  floor: number;
  askingRentFils: number;
  areaM2: number | null;
}
const blank = (): ResultUnit => ({
  label: "",
  type: "apartment",
  floor: 0,
  askingRentFils: 0,
  areaM2: null,
});
export function RestructureUnits({
  propertyId,
  units,
}: {
  propertyId: string;
  units: { id: string; label: string; status: string; type: string; askingRentFils: number }[];
}) {
  const t = useTranslations("units.restructure");
  const te = useTranslations("enums.unitType");
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const [results, setResults] = useState<ResultUnit[]>([blank(), blank()]);
  const [paci, setPaci] = useState("");
  const [reason, setReason] = useState("");
  const edit = (i: number, patch: Partial<ResultUnit>) =>
    setResults((rows) => rows.map((r, index) => (index === i ? { ...r, ...patch } : r)));
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
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
              !sources.length ||
              !reason.trim() ||
              results.some((r) => !r.label.trim()) ||
              (sources.length === 1 && results.length === 1) ||
              (paci !== "" && !/^\d{8}$/.test(paci))
            }
            onClick={() =>
              exec(
                () =>
                  restructureUnits({
                    propertyId,
                    sourceIds: sources,
                    reason,
                    units: results.map((r) => ({
                      ...r,
                      propertyId,
                      paciNo: paci,
                      active: true,
                      sortOrder: 0,
                    })),
                  }),
                {
                  success: t("done"),
                  onSuccess: () => {
                    setOpen(false);
                    setSources([]);
                    setResults([blank(), blank()]);
                    setReason("");
                    router.refresh();
                  },
                },
              )
            }
          >
            {t("confirm")}
          </Button>
        }
      >
        <p className="text-label-2 mb-4 text-sm">{t("help")}</p>
        <fieldset className="space-y-2">
          <legend className="font-semibold">{t("sources")}</legend>
          {units.map((u) => (
            <label key={u.id} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                disabled={u.status !== "vacant"}
                checked={sources.includes(u.id)}
                onChange={(e) =>
                  setSources(
                    e.target.checked ? [...sources, u.id] : sources.filter((id) => id !== u.id),
                  )
                }
              />
              {te(u.type as UnitType)} {u.label}
              {u.status !== "vacant" && <span className="text-label-2 text-xs">{t("leased")}</span>}
            </label>
          ))}
        </fieldset>
        <div className="mt-5 space-y-4">
          <Field label={t("sharedPaci")} htmlFor="restructure-paci">
            <Input
              id="restructure-paci"
              inputMode="numeric"
              maxLength={8}
              value={paci}
              onChange={(e) => setPaci(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <h3 className="font-semibold">{t("results")}</h3>
          {results.map((r, i) => (
            <div key={i} className="bg-inset space-y-3 rounded-2xl p-4">
              <Field label={t("label")} htmlFor={`result-label-${i}`}>
                <Input
                  id={`result-label-${i}`}
                  value={r.label}
                  onChange={(e) => edit(i, { label: e.target.value })}
                />
              </Field>
              <Field label={t("type")} htmlFor={`result-type-${i}`}>
                <Select
                  id={`result-type-${i}`}
                  value={r.type}
                  onChange={(e) => edit(i, { type: e.target.value as UnitType })}
                >
                  {UNIT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {te(type)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("rent")} htmlFor={`result-rent-${i}`}>
                <MoneyInput
                  id={`result-rent-${i}`}
                  value={r.askingRentFils}
                  onChange={(v) => edit(i, { askingRentFils: v ?? 0 })}
                />
              </Field>
              <Field label={t("floor")} htmlFor={`result-floor-${i}`}>
                <Input
                  type="number"
                  id={`result-floor-${i}`}
                  min={-5}
                  max={200}
                  value={r.floor}
                  onChange={(e) => edit(i, { floor: Number(e.target.value) })}
                />
              </Field>
              <Button
                variant="plain"
                size="sm"
                disabled={results.length <= 1}
                onClick={() => setResults((rows) => rows.filter((_, n) => n !== i))}
              >
                {t("remove")}
              </Button>
            </div>
          ))}
          <Button variant="secondary" onClick={() => setResults((rows) => [...rows, blank()])}>
            {t("add")}
          </Button>
          <Field label={t("reason")} htmlFor="restructure-reason">
            <Input
              id="restructure-reason"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
