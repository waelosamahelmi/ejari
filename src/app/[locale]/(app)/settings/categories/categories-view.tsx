"use client";
import { useState } from "react";
import { Plus, Tags } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile } from "@/components/ui/icon-tile";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { Toggle } from "@/components/ui/toggle";
import { Pill } from "@/components/ui/chip";
import { saveCategory } from "@/server/actions/master";
import { useAction } from "@/hooks/use-action";
import { EXPENSE_CATEGORY_TYPES, type ExpenseCategoryType } from "@/domain/expenses";

interface Row {
  id: string;
  nameAr: string;
  nameEn: string;
  type: ExpenseCategoryType;
  active: boolean;
}

export function CategoriesView({ rows }: { rows: Row[] }) {
  const t = useTranslations("catalog.categories");
  const tType = useTranslations("enums.categoryType");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [edit, setEdit] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const openRow = (r: Row | null) => {
    setEdit(r ?? { id: "", nameAr: "", nameEn: "", type: "operating", active: true });
    setOpen(true);
  };
  const save = () =>
    edit &&
    exec(() => saveCategory(edit.id || null, edit), {
      success: t("saved"),
      onSuccess: () => {
        setOpen(false);
        router.refresh();
      },
    });
  return (
    <>
      <LargeTitleHeader
        title={t("title")}
        back={{ href: "/settings", label: tc("labels.settings") }}
        actions={
          <Button onClick={() => openRow(null)}>
            <Plus />
            {t("new")}
          </Button>
        }
      />
      <GroupedSection>
        {rows.map((r) => (
          <ListRow
            key={r.id}
            leading={
              <IconTile tone={r.active ? "orange" : "gray"}>
                <Tags />
              </IconTile>
            }
            title={locale === "ar" ? r.nameAr : r.nameEn}
            subtitle={locale === "ar" ? r.nameEn : r.nameAr}
            trailing={<Pill className="bg-inset text-label-2">{tType(r.type)}</Pill>}
            onClick={() => openRow(r)}
            chevron
          />
        ))}
      </GroupedSection>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={edit?.id ? edit.nameAr : t("new")}
        footer={
          <Button
            block
            size="lg"
            onClick={save}
            loading={pending}
            disabled={!edit?.nameAr || !edit?.nameEn}
          >
            {tc("actions.save")}
          </Button>
        }
      >
        {edit && (
          <div className="space-y-4">
            <Field label={t("nameAr")} htmlFor="c-ar">
              <Input
                id="c-ar"
                value={edit.nameAr}
                onChange={(e) => setEdit({ ...edit, nameAr: e.target.value })}
              />
            </Field>
            <Field label={t("nameEn")} htmlFor="c-en">
              <Input
                id="c-en"
                dir="ltr"
                value={edit.nameEn}
                onChange={(e) => setEdit({ ...edit, nameEn: e.target.value })}
              />
            </Field>
            <Field label={t("type")}>
              <SegmentedControl
                size="sm"
                options={EXPENSE_CATEGORY_TYPES.map((v) => ({ value: v, label: tType(v) }))}
                value={edit.type}
                onChange={(v) => setEdit({ ...edit, type: v })}
              />
            </Field>
            <label className="bg-paper flex items-center justify-between rounded-[14px] px-4 py-3">
              <span>{t("active")}</span>
              <Toggle
                checked={edit.active}
                onCheckedChange={(v) => setEdit({ ...edit, active: v })}
                ariaLabel={t("active")}
              />
            </label>
          </div>
        )}
      </Sheet>
    </>
  );
}
