"use client";
import { useState } from "react";
import { Car, Plus, Store, User, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { IconTile } from "@/components/ui/icon-tile";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NoExpensesIllustration } from "@/components/illustrations";
import { BeneficiarySheet, type BeneficiaryRow } from "@/components/domain/beneficiary-sheet";
import { useMoney } from "@/components/shell/prefs-context";

const ICON = { staff: UserRound, vendor: Store, asset: Car, other: User } as const;

export function BeneficiariesView({ rows }: { rows: BeneficiaryRow[] }) {
  const t = useTranslations("catalog.beneficiaries");
  const tKind = useTranslations("enums.beneficiaryKind");
  const tc = useTranslations("common");
  const money = useMoney();
  const router = useRouter();
  const [edit, setEdit] = useState<BeneficiaryRow | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <LargeTitleHeader title={t("title")} back={{ href: "/settings", label: tc("labels.settings") }} actions={<Button onClick={() => { setEdit(null); setOpen(true); }}><Plus />{t("new")}</Button>} />
      {rows.length === 0 ? (
        <EmptyState illustration={<NoExpensesIllustration />} title={t("empty")} description={t("emptyText")} />
      ) : (
        <GroupedSection>
          {rows.map((r) => {
            const I = ICON[r.kind];
            return (
              <ListRow
                key={r.id}
                leading={<IconTile tone={r.active ? "sand" : "gray"}><I /></IconTile>}
                title={r.name}
                subtitle={tKind(r.kind)}
                trailing={r.monthlySalaryFils ? <span className="num">{money(r.monthlySalaryFils)}</span> : undefined}
                onClick={() => { setEdit(r); setOpen(true); }}
                chevron
              />
            );
          })}
        </GroupedSection>
      )}
      <BeneficiarySheet open={open} onOpenChange={setOpen} row={edit} onSaved={() => router.refresh()} />
    </>
  );
}
