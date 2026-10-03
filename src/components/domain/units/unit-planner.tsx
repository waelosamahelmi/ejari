"use client";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { UNIT_TYPES, type UnitType } from "@/domain/types";
import {
  FLOOR_MAX,
  FLOOR_MIN,
  MAX_PLANNED_UNITS,
  duplicateLabels,
  generatePlannedUnits,
  planIssues,
  planTotal,
  type PlannedUnit,
  type UnitPlanRow,
} from "@/domain/unit-plan";

export interface UnitPlannerValue {
  rows: UnitPlanRow[];
  units: PlannedUnit[];
}

export function defaultRow(floor: number): UnitPlanRow {
  return {
    floor,
    count: 1,
    type: "apartment",
    prefix: "",
    startNumber: floor > 0 ? floor * 100 + 1 : 1,
    askingRentFils: 0,
    bedrooms: null,
    areaM2: null,
  };
}

export function isUnitPlanValid(
  rows: UnitPlanRow[],
  units: PlannedUnit[],
  existingLabels: string[] = [],
): boolean {
  return (
    units.length > 0 &&
    planIssues(rows).length === 0 &&
    duplicateLabels(units, existingLabels).length === 0
  );
}

/** Explicit floor-by-floor planner: rows -> deterministic generated units (no redistribution). */
export function UnitPlanner({
  rows,
  units,
  onChange,
}: {
  rows: UnitPlanRow[];
  units: PlannedUnit[];
  onChange: (v: UnitPlannerValue) => void;
}) {
  const t = useTranslations("properties.planner");
  const tStack = useTranslations("properties.stack");
  const tu = useTranslations("units.fields");
  const tType = useTranslations("enums.unitType");
  const floors: { value: number; label: string }[] = [
    { value: -1, label: tStack("basement") },
    { value: 0, label: tStack("ground") },
    ...Array.from({ length: 50 }, (_, i) => ({
      value: i + 1,
      label: tStack("floor", { n: i + 1 }),
    })),
  ];

  const regenerate = (next: UnitPlanRow[]) =>
    onChange({ rows: next, units: generatePlannedUnits(next) });
  const updateRow = (i: number, patch: Partial<UnitPlanRow>) =>
    regenerate(rows.map((r, x) => (x === i ? { ...r, ...patch } : r)));
  const addFloor = () => {
    const next = rows.length ? Math.max(...rows.map((r) => r.floor)) + 1 : 0;
    regenerate([...rows, defaultRow(Math.min(FLOOR_MAX, next))]);
  };
  const removeRow = (i: number) => regenerate(rows.filter((_, x) => x !== i));
  const updateUnit = (i: number, patch: Partial<PlannedUnit>) =>
    onChange({ rows, units: units.map((u, x) => (x === i ? { ...u, ...patch } : u)) });
  const setAll = (patch: Partial<UnitPlanRow>) => regenerate(rows.map((r) => ({ ...r, ...patch })));
  const first = rows[0];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[16px] font-semibold">{t("floorsTitle")}</h3>
          <span className="text-label-2 text-[13px]">{t("total", { count: planTotal(rows) })}</span>
        </div>
        {rows.map((row, i) => (
          <div key={i} data-testid={`plan-row-${i}`} className="bg-paper space-y-3 rounded-[20px] p-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label={t("floor")} htmlFor={`plan-floor-${i}`}>
                <Select
                  id={`plan-floor-${i}`}
                  value={String(row.floor)}
                  onChange={(e) => updateRow(i, { floor: Number(e.target.value) })}
                >
                  {floors.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("count")} htmlFor={`plan-count-${i}`}>
                <Input
                  id={`plan-count-${i}`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_PLANNED_UNITS}
                  value={row.count}
                  onChange={(e) =>
                    updateRow(i, {
                      count: Math.max(1, Math.min(MAX_PLANNED_UNITS, Number(e.target.value) || 1)),
                    })
                  }
                />
              </Field>
              <Field label={t("type")} htmlFor={`plan-type-${i}`}>
                <Select
                  id={`plan-type-${i}`}
                  value={row.type}
                  onChange={(e) => updateRow(i, { type: e.target.value as UnitType })}
                >
                  {UNIT_TYPES.map((u) => (
                    <option key={u} value={u}>
                      {tType(u)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("prefix")} htmlFor={`plan-prefix-${i}`}>
                <Input
                  id={`plan-prefix-${i}`}
                  value={row.prefix}
                  onChange={(e) => updateRow(i, { prefix: e.target.value })}
                />
              </Field>
              <Field label={t("startNumber")} htmlFor={`plan-start-${i}`}>
                <Input
                  id={`plan-start-${i}`}
                  type="number"
                  inputMode="numeric"
                  value={row.startNumber}
                  onChange={(e) => updateRow(i, { startNumber: Number(e.target.value) || 0 })}
                />
              </Field>
              <div className="flex items-end pb-0.5 sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => removeRow(i)}
                  disabled={rows.length === 1}
                  aria-label={t("removeFloor")}
                >
                  <Trash2 />
                  {t("removeFloor")}
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={addFloor}>
          <Plus />
          {t("addFloor")}
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="text-[16px] font-semibold">{t("defaults")}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label={t("askingRent")}>
            <MoneyInput
              value={first?.askingRentFils ?? 0}
              onChange={(v) => setAll({ askingRentFils: v ?? 0 })}
              showWords={false}
            />
          </Field>
          <Field label={t("bedrooms")} htmlFor="plan-bedrooms">
            <Input
              id="plan-bedrooms"
              type="number"
              inputMode="numeric"
              min={0}
              value={first?.bedrooms ?? ""}
              onChange={(e) =>
                setAll({ bedrooms: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </Field>
          <Field label={t("area")} htmlFor="plan-area">
            <Input
              id="plan-area"
              inputMode="decimal"
              value={first?.areaM2 ?? ""}
              onChange={(e) =>
                setAll({ areaM2: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </Field>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[16px] font-semibold">{t("previewTitle")}</h3>
          <span className="text-label-2 text-[12px]">{t("regenerateHint")}</span>
        </div>
        <ul className="max-h-80 space-y-2 overflow-y-auto pe-1">
          {units.map((u, i) => (
            <li key={i} className="bg-paper-2 space-y-2 rounded-[14px] p-2.5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Input
                  aria-label={`${t("unitLabel")} ${i + 1}`}
                  value={u.label}
                  onChange={(e) => updateUnit(i, { label: e.target.value })}
                />
                <Select
                  aria-label={tu("floor")}
                  value={String(u.floor)}
                  onChange={(e) => updateUnit(i, { floor: Number(e.target.value) })}
                >
                  {floors.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label={tu("type")}
                  value={u.type}
                  onChange={(e) => updateUnit(i, { type: e.target.value as UnitType })}
                >
                  {UNIT_TYPES.map((x) => (
                    <option key={x} value={x}>
                      {tType(x)}
                    </option>
                  ))}
                </Select>
                <MoneyInput
                  value={u.askingRentFils}
                  onChange={(v) => updateUnit(i, { askingRentFils: v ?? 0 })}
                  showWords={false}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  aria-label={tu("area")}
                  inputMode="decimal"
                  value={u.areaM2 ?? ""}
                  onChange={(e) =>
                    updateUnit(i, { areaM2: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
                <Input
                  aria-label={tu("bedrooms")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={u.bedrooms ?? ""}
                  onChange={(e) =>
                    updateUnit(i, {
                      bedrooms: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
                <Input
                  aria-label={tu("bathrooms")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={u.bathrooms ?? ""}
                  onChange={(e) =>
                    updateUnit(i, {
                      bathrooms: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Inline validation messages for the planner (duplicate labels, bounds, max count). */
export function UnitPlanValidation({
  rows,
  units,
  existingLabels = [],
}: {
  rows: UnitPlanRow[];
  units: PlannedUnit[];
  existingLabels?: string[];
}) {
  const t = useTranslations("properties.planner.errors");
  const issues = planIssues(rows);
  const dupes = duplicateLabels(units, existingLabels);
  const errors: string[] = [];
  if (issues.some((i) => i.code === "empty" || i.code === "count")) errors.push(t("noUnits"));
  if (issues.some((i) => i.code === "total"))
    errors.push(t("tooMany", { max: String(MAX_PLANNED_UNITS) }));
  if (issues.some((i) => i.code === "floor"))
    errors.push(t("floor", { min: String(FLOOR_MIN), max: String(FLOOR_MAX) }));
  if (dupes.length > 0) errors.push(t("duplicate", { label: dupes[0]! }));
  if (errors.length === 0) return null;
  return (
    <ul className="space-y-1">
      {errors.map((e) => (
        <li key={e} role="alert" className="text-red-text px-1 text-[13px] leading-5">
          {e}
        </li>
      ))}
    </ul>
  );
}
