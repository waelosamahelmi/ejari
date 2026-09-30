"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Stepper } from "@/components/ui/stepper";
import { bulkCreateUnits } from "@/server/actions/master";
import { useAction } from "@/hooks/use-action";
import { UNIT_TYPES, type UnitType } from "@/domain/types";

/** "Add 20 apartments numbered 1–20, floors 1–5, asking rent 300". */
export function BulkUnitsSheet({ open, onOpenChange, propertyId }: { open: boolean; onOpenChange: (o: boolean) => void; propertyId: string }) {
  const t = useTranslations("properties.bulk");
  const tu = useTranslations("units.fields");
  const tType = useTranslations("enums.unitType");
  const tui = useTranslations("ui");
  const router = useRouter();
  const { exec, pending } = useAction();
  const [type, setType] = useState<UnitType>("apartment");
  const [count, setCount] = useState(20);
  const [start, setStart] = useState(1);
  const [prefix, setPrefix] = useState("");
  const [floorFrom, setFloorFrom] = useState(1);
  const [floorTo, setFloorTo] = useState(5);
  const [rent, setRent] = useState<number | null>(300_000);
  const submit = () =>
    exec(() => bulkCreateUnits({ propertyId, type, count, startNumber: start, prefix, floorFrom, floorTo, askingRentFils: rent ?? 0 }), {
      success: t("created", { count }),
      onSuccess: () => {
        onOpenChange(false);
        router.refresh();
      },
    });
  const labels = { decrement: tui("decrement"), increment: tui("increment") };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("title")} footer={<Button block size="lg" onClick={submit} loading={pending}>{t("created", { count })}</Button>}>
      <div className="space-y-4">
        <Field label={tu("type")} htmlFor="b-type">
          <Select id="b-type" value={type} onChange={(e) => setType(e.target.value as UnitType)}>
            {UNIT_TYPES.map((u) => (
              <option key={u} value={u}>{tType(u)}</option>
            ))}
          </Select>
        </Field>
        <div className="bg-paper divide-separator divide-y-[0.5px] rounded-[20px]">
          {[
            [t("count"), count, setCount, 1, 300],
            [t("startNumber"), start, setStart, 0, 9999],
            [t("floorFrom"), floorFrom, setFloorFrom, -5, 100],
            [t("floorTo"), floorTo, setFloorTo, -5, 100],
          ].map(([label, value, set, min, max]) => (
            <div key={label as string} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[16px]">{label as string}</span>
              <Stepper value={value as number} onChange={set as (v: number) => void} min={min as number} max={max as number} labels={labels} />
            </div>
          ))}
        </div>
        <Field label={t("prefix")} htmlFor="b-prefix"><Input id="b-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} /></Field>
        <Field label={tu("askingRent")} htmlFor="b-rent"><MoneyInput id="b-rent" value={rent} onChange={setRent} /></Field>
        <p className="text-label-2 px-1 text-[14px]">{t("preview", { count, first: `${prefix}${start}`, last: `${prefix}${start + count - 1}` })}</p>
      </div>
    </Sheet>
  );
}
