"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { createPlannedUnits } from "@/server/actions/master";
import { useAction } from "@/hooks/use-action";
import { generatePlannedUnits, type PlannedUnit, type UnitPlanRow } from "@/domain/unit-plan";
import {
  UnitPlanValidation,
  UnitPlanner,
  defaultRow,
  isUnitPlanValid,
} from "@/components/domain/units/unit-planner";

/** Adds units floor-by-floor using the shared UnitPlanner. */
export function BulkUnitsSheet({
  open,
  onOpenChange,
  propertyId,
  existingLabels = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  propertyId: string;
  existingLabels?: string[];
}) {
  const t = useTranslations("properties.bulk");
  const router = useRouter();
  const { exec, pending } = useAction();
  const [rows, setRows] = useState<UnitPlanRow[]>([]);
  const [units, setUnits] = useState<PlannedUnit[]>([]);
  useEffect(() => {
    if (!open) return;
    const init = [defaultRow(0)];
    setRows(init);
    setUnits(generatePlannedUnits(init));
  }, [open]);
  const valid = isUnitPlanValid(rows, units, existingLabels);
  const submit = () =>
    exec(() => createPlannedUnits({ propertyId, units }), {
      success: t("created", { count: units.length }),
      onSuccess: () => {
        onOpenChange(false);
        router.refresh();
      },
    });
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t("title")}
      footer={
        <Button block size="lg" onClick={submit} loading={pending} disabled={!valid}>
          {t("created", { count: units.length })}
        </Button>
      }
    >
      <div className="space-y-4">
        <UnitPlanner
          rows={rows}
          units={units}
          onChange={(v) => {
            setRows(v.rows);
            setUnits(v.units);
          }}
        />
        <UnitPlanValidation rows={rows} units={units} existingLabels={existingLabels} />
      </div>
    </Sheet>
  );
}
