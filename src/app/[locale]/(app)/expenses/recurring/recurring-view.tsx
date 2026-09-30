"use client";
import { useState } from "react";
import { Plus, Repeat, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile } from "@/components/ui/icon-tile";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Stepper } from "@/components/ui/stepper";
import { Toggle } from "@/components/ui/toggle";
import { Chip, ChipScroller } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { NoExpensesIllustration } from "@/components/illustrations";
import { useMoney } from "@/components/shell/prefs-context";
import { useAction } from "@/hooks/use-action";
import { generateRecurring, saveRecurring } from "@/server/actions/expenses";
import { formatPeriod } from "@/domain/dates";
import type { AllocationMode } from "@/domain/expenses";

interface Row {
  id: string;
  categoryId: string;
  category: string;
  beneficiaryId: string | null;
  beneficiary: string;
  amountFils: number;
  description: string;
  mode: string;
  propertyIds: string[];
  dayOfMonth: number;
  lastPeriod: string | null;
  active: boolean;
}
interface Opts {
  categories: { id: string; nameAr: string; nameEn: string }[];
  beneficiaries: { id: string; name: string }[];
  properties: { id: string; name: string }[];
}

export function RecurringView({
  rows,
  options,
  period,
}: {
  rows: Row[];
  options: Opts;
  period: string;
}) {
  const t = useTranslations("expenses.recurringPage");
  const tf = useTranslations("expenses.form");
  const te = useTranslations("expenses");
  const tu = useTranslations("ui");
  const tc = useTranslations("common");
  const locale = useLocale() as "ar" | "en";
  const money = useMoney();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [edit, setEdit] = useState<
    (Omit<Row, "category" | "beneficiary" | "lastPeriod"> & { id: string }) | null
  >(null);
  const blank = {
    id: "",
    categoryId: options.categories[0]?.id ?? "",
    beneficiaryId: null,
    amountFils: 0,
    description: "",
    mode: "single",
    propertyIds: options.properties[0] ? [options.properties[0].id] : [],
    dayOfMonth: 25,
    active: true,
  };
  const save = () =>
    edit &&
    exec(
      () =>
        saveRecurring(edit.id || null, {
          categoryId: edit.categoryId,
          beneficiaryId: edit.beneficiaryId,
          amountFils: edit.amountFils,
          description: edit.description,
          mode: (edit.propertyIds.length > 1 ? "split_even" : "single") as AllocationMode,
          targets: edit.propertyIds.map((propertyId) => ({ propertyId })),
          dayOfMonth: edit.dayOfMonth,
          active: edit.active,
        }),
      {
        onSuccess: () => {
          setEdit(null);
          router.refresh();
        },
      },
    );
  return (
    <>
      <LargeTitleHeader
        title={t("title")}
        back={{ href: "/expenses", label: te("title") }}
        actions={
          <>
            <Button
              variant="secondary"
              loading={pending}
              onClick={() =>
                exec(() => generateRecurring(period), {
                  onSuccess: (n) => {
                    router.refresh();
                    toast.success(t("generated", { count: n }));
                  },
                })
              }
            >
              <Sparkles />
              {t("generate", { month: formatPeriod(period, locale) })}
            </Button>
            <Button size="icon" aria-label={t("new")} onClick={() => setEdit(blank)}>
              <Plus />
            </Button>
          </>
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          illustration={<NoExpensesIllustration />}
          title={t("empty")}
          description={t("emptyText")}
          action={
            <Button onClick={() => setEdit(blank)}>
              <Plus />
              {t("new")}
            </Button>
          }
        />
      ) : (
        <GroupedSection>
          {rows.map((r) => (
            <ListRow
              key={r.id}
              leading={
                <IconTile tone={r.active ? "orange" : "gray"}>
                  <Repeat />
                </IconTile>
              }
              title={`${r.category}${r.beneficiary ? ` · ${r.beneficiary}` : ""}`}
              subtitle={`${r.description} · ${r.lastPeriod ? t("last", { month: formatPeriod(r.lastPeriod, locale) }) : t("never")}`}
              trailing={<span className="num">{money(r.amountFils)}</span>}
              onClick={() => setEdit({ ...r })}
              chevron
            />
          ))}
        </GroupedSection>
      )}
      <Sheet
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={edit?.id ? edit.description || t("title") : t("new")}
        footer={
          <Button
            block
            size="lg"
            onClick={save}
            loading={pending}
            disabled={!edit?.amountFils || !edit.propertyIds.length}
          >
            {tc("actions.save")}
          </Button>
        }
      >
        {edit && (
          <div className="space-y-4">
            <Field label={tf("amount")} htmlFor="r-amt">
              <MoneyInput
                id="r-amt"
                value={edit.amountFils || null}
                onChange={(f) => setEdit({ ...edit, amountFils: f ?? 0 })}
              />
            </Field>
            <Field label={tf("category")} htmlFor="r-cat">
              <Select
                id="r-cat"
                value={edit.categoryId}
                onChange={(e) => setEdit({ ...edit, categoryId: e.target.value })}
              >
                {options.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {locale === "ar" ? c.nameAr : c.nameEn}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tf("beneficiary")} htmlFor="r-ben">
              <Select
                id="r-ben"
                value={edit.beneficiaryId ?? ""}
                onChange={(e) => setEdit({ ...edit, beneficiaryId: e.target.value || null })}
              >
                <option value="">—</option>
                {options.beneficiaries.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tf("description")} htmlFor="r-desc">
              <Input
                id="r-desc"
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
              />
            </Field>
            <Field label={tf("properties")}>
              <ChipScroller>
                {options.properties.map((p) => (
                  <Chip
                    key={p.id}
                    active={edit.propertyIds.includes(p.id)}
                    onClick={() =>
                      setEdit({
                        ...edit,
                        propertyIds: edit.propertyIds.includes(p.id)
                          ? edit.propertyIds.filter((x) => x !== p.id)
                          : [...edit.propertyIds, p.id],
                      })
                    }
                  >
                    {p.name}
                  </Chip>
                ))}
              </ChipScroller>
            </Field>
            <div className="bg-paper flex items-center justify-between rounded-[14px] px-4 py-2.5">
              <span>{t("day")}</span>
              <Stepper
                value={edit.dayOfMonth}
                onChange={(n) => setEdit({ ...edit, dayOfMonth: n })}
                min={1}
                max={28}
                labels={{ decrement: tu("decrement"), increment: tu("increment") }}
              />
            </div>
            <label className="bg-paper flex items-center justify-between rounded-[14px] px-4 py-3">
              <span>{t("active")}</span>
              <Toggle
                checked={edit.active}
                onCheckedChange={(a) => setEdit({ ...edit, active: a })}
                ariaLabel={t("active")}
              />
            </label>
          </div>
        )}
      </Sheet>
    </>
  );
}
