"use client";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { PhoneInput } from "@/components/ui/phone-input";
import { Field } from "@/components/ui/input";

/** Multiple Kuwaiti phones (+965). */
export function PhonesField({ value, onChange, label, error, addLabel, idPrefix = "phone" }: { value: string[]; onChange: (v: string[]) => void; label: string; error?: string; addLabel: string; idPrefix?: string }) {
  const t = useTranslations("common.actions");
  const list = value.length ? value : [""];
  return (
    <Field label={label} htmlFor={`${idPrefix}-0`} error={error}>
      <div className="space-y-2">
        {list.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1">
              <PhoneInput id={`${idPrefix}-${i}`} value={p} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} placeholder="5XXX XXXX" />
            </div>
            {list.length > 1 && (
              <button type="button" aria-label={t("remove")} onClick={() => onChange(list.filter((_, j) => j !== i))} className="bg-inset text-label-2 flex size-11 items-center justify-center rounded-full">
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => onChange([...list, ""])} className="text-link flex items-center gap-1 px-1 text-[14px] font-medium">
          <Plus className="size-4" />
          {addLabel}
        </button>
      </div>
    </Field>
  );
}
