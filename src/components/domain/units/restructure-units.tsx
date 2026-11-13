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
import { SegmentedControl } from "@/components/ui/segmented";
import { splitEven } from "@/domain/money";
import { unitSchema } from "@/lib/schemas/master";
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
  units: {
    id: string;
    label: string;
    status: string;
    type: string;
    askingRentFils: number;
    floor: number | null;
  }[];
}) {
  const t = useTranslations("units.restructure");
  const te = useTranslations("enums.unitType");
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"merge" | "split">("merge");
  const [sources, setSources] = useState<string[]>([]);
  const [results, setResults] = useState<ResultUnit[]>([blank()]);
  const [paci, setPaci] = useState("");
  const [reason, setReason] = useState("");
  const edit = (i: number, patch: Partial<ResultUnit>) =>
    setResults((rows) => rows.map((r, index) => (index === i ? { ...r, ...patch } : r)));
  const chooseSources = (ids: string[]) => {
    setSources(ids);
    const selected = units.filter((u) => ids.includes(u.id));
    const first = selected[0];
    if (mode === "merge") {
      setResults([
        {
          ...blank(),
          label: selected.map((u) => u.label).join("+"),
          type:
            first && selected.every((u) => u.type === first.type)
              ? (first.type as UnitType)
              : "other",
          floor: first && selected.every((u) => u.floor === first.floor) ? (first.floor ?? 0) : 0,
          askingRentFils: selected.reduce((total, u) => total + u.askingRentFils, 0),
        },
      ]);
    } else {
      const rents = splitEven(first?.askingRentFils ?? 0, 2);
      setResults(
        [0, 1].map((i) => ({
          ...blank(),
          label: first ? `${first.label}-${i + 1}` : "",
          type: first ? (first.type as UnitType) : "apartment",
          floor: first?.floor ?? 0,
          askingRentFils: rents[i]!,
        })),
      );
    }
  };
  const issues: string[] = [];
  if ((mode === "merge" && sources.length < 2) || (mode === "split" && sources.length !== 1))
    issues.push(t(mode === "merge" ? "chooseMergeSources" : "chooseSplitSource"));
  if (!reason.trim()) issues.push(t("reasonRequired"));
  if (results.some((r) => !r.label.trim())) issues.push(t("labelsRequired"));
  const labels = results
    .map((r) => (r.label.trim() ? `${r.type}:${r.label.trim().toLocaleLowerCase()}` : ""))
    .filter(Boolean);
  if (
    new Set(labels).size !== labels.length ||
    units.some(
      (u) =>
        !sources.includes(u.id) &&
        labels.includes(`${u.type}:${u.label.trim().toLocaleLowerCase()}`),
    )
  )
    issues.push(t("duplicateLabel"));
  if (
    results.every((r) => r.label.trim()) &&
    results.some((r) => !unitSchema.safeParse({ ...r, propertyId }).success)
  )
    issues.push(t("invalidResult"));
  if (paci !== "" && !/^\d{8}$/.test(paci)) issues.push(t("invalidPaci"));
  const ready = issues.length === 0;
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
          <div className="space-y-3">
            <p className="text-label-2 text-sm">
              {t("summary", { sources: sources.length, results: results.length })}
            </p>
            {!ready && (
              <ul
                role="status"
                aria-live="polite"
                className="text-orange-text list-disc space-y-1 ps-5 text-sm"
              >
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            )}
            <Button
              block
              loading={pending}
              disabled={!ready}
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
                      setMode("merge");
                      setResults([blank()]);
                      setPaci("");
                      setReason("");
                      router.refresh();
                    },
                  },
                )
              }
            >
              {t("confirm")}
            </Button>
          </div>
        }
      >
        <p className="text-label-2 mb-4 text-sm">{t("help")}</p>
        <SegmentedControl
          options={[
            { value: "merge", label: t("merge") },
            { value: "split", label: t("split") },
          ]}
          value={mode}
          ariaLabel={t("operation")}
          onChange={(value) => {
            setMode(value);
            setSources([]);
            setResults(value === "merge" ? [blank()] : [blank(), blank()]);
            setReason("");
          }}
        />
        <p className="text-label-2 my-3 text-sm">
          {t(mode === "merge" ? "mergeHelp" : "splitHelp")}
        </p>
        <Field label={t("reason")} htmlFor="restructure-reason" hint={t("reasonRequired")}>
          <Input
            id="restructure-reason"
            required
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <fieldset className="mt-5 max-h-56 space-y-2 overflow-y-auto">
          <legend className="font-semibold">{t("sources")}</legend>
          {units.map((u) => (
            <label key={u.id} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                disabled={u.status !== "vacant"}
                checked={sources.includes(u.id)}
                onChange={(e) =>
                  chooseSources(
                    e.target.checked
                      ? mode === "merge"
                        ? [...sources, u.id]
                        : [u.id]
                      : sources.filter((id) => id !== u.id),
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
              {mode === "split" && (
                <Button
                  variant="plain"
                  size="sm"
                  disabled={results.length <= 2}
                  onClick={() => setResults((rows) => rows.filter((_, n) => n !== i))}
                >
                  {t("remove")}
                </Button>
              )}
            </div>
          ))}
          {mode === "split" && (
            <Button
              variant="secondary"
              disabled={results.length >= 200}
              onClick={() => setResults((rows) => [...rows, blank()])}
            >
              {t("add")}
            </Button>
          )}
        </div>
      </Sheet>
    </>
  );
}
