"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Gavel, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { Pill } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { useMoney } from "@/components/shell/prefs-context";
import { formatDate, todayKuwait } from "@/domain/dates";
import type { LegalStatus } from "@/domain/types";

// Sheets are code-split: they load after hydration instead of with the page.
const LegalCaseSheet = dynamic(
  () => import("@/components/domain/legal/case-form").then((m) => m.LegalCaseSheet),
  { ssr: false },
);

interface CaseRow {
  id: string;
  caseNo: string | null;
  court: string | null;
  type: "eviction" | "rent_claim" | "other";
  status: LegalStatus;
  amountFils: number;
  nextHearing: string | null;
  tenant: string;
  contract: string | null;
}
const COLS: LegalStatus[] = ["filed", "in_progress", "judgment", "enforcement", "closed"];

export function LegalView({
  cases,
  canManage,
  tenants,
  contracts,
}: {
  cases: CaseRow[];
  canManage: boolean;
  tenants: { id: string; name: string }[];
  contracts: { id: string; tenantId: string; label: string }[];
}) {
  const t = useTranslations("legal");
  const tStatus = useTranslations("enums.legalStatus");
  const tType = useTranslations("enums.legalType");
  const money = useMoney();
  const [view, setView] = useState<"board" | "list">("board");
  const [creating, setCreating] = useState(false);
  const today = todayKuwait();
  const hearings = cases
    .filter((c) => c.nextHearing && c.nextHearing >= today && c.status !== "closed")
    .sort((a, b) => a.nextHearing!.localeCompare(b.nextHearing!));
  const card = (c: CaseRow) => (
    <Link
      key={c.id}
      href={`/legal/${c.id}`}
      className="bg-paper press block rounded-[18px] p-4 shadow-[var(--sh-card)]"
    >
      <div className="text-[15px] font-semibold">{c.tenant}</div>
      <div className="text-label-2 num text-[12px]">
        {c.caseNo ?? "—"} · {tType(c.type)}
      </div>
      {c.contract && <div className="text-label-2 mt-1 truncate text-[12px]">{c.contract}</div>}
      <div className="mt-2 flex items-center justify-between text-[13px]">
        <span className="num">{money(c.amountFils)}</span>
        {c.nextHearing && <span className="text-red-text num">{formatDate(c.nextHearing)}</span>}
      </div>
    </Link>
  );
  return (
    <>
      <LargeTitleHeader
        title={t("title")}
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              {t("new")}
            </Button>
          ) : undefined
        }
      >
        <SegmentedControl
          fill={false}
          options={[
            { value: "board", label: t("board") },
            { value: "list", label: t("list") },
          ]}
          value={view}
          onChange={(v) => setView(v as "board" | "list")}
        />
      </LargeTitleHeader>
      {cases.length === 0 ? (
        <EmptyState
          illustration={<Gavel className="text-label-3 mx-auto size-20" />}
          title={t("empty")}
          description={t("emptyText")}
          action={
            canManage ? (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                {t("new")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          {view === "board" ? (
            <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
              {COLS.map((s) => (
                <section key={s} className="bg-inset/60 w-72 shrink-0 rounded-[22px] p-3">
                  <h2 className="text-label-2 mb-2 flex items-center justify-between px-1 text-[13px] font-semibold">
                    {tStatus(s)}{" "}
                    <span className="num">{cases.filter((c) => c.status === s).length}</span>
                  </h2>
                  <div className="space-y-2">{cases.filter((c) => c.status === s).map(card)}</div>
                </section>
              ))}
            </div>
          ) : (
            <GroupedSection>
              {cases.map((c) => (
                <ListRow
                  key={c.id}
                  LinkComponent={Link}
                  href={`/legal/${c.id}`}
                  title={c.tenant}
                  subtitle={`${c.caseNo ?? "—"} · ${tType(c.type)}${c.nextHearing ? ` · ${formatDate(c.nextHearing)}` : ""}`}
                  trailing={<Pill className="bg-red/14 text-red-text">{tStatus(c.status)}</Pill>}
                  chevron
                />
              ))}
            </GroupedSection>
          )}
          <GroupedSection header={t("hearings")}>
            {hearings.length === 0 ? (
              <ListRow title={t("noHearings")} />
            ) : (
              hearings.map((c) => (
                <ListRow
                  key={c.id}
                  LinkComponent={Link}
                  href={`/legal/${c.id}`}
                  title={<span className="num">{formatDate(c.nextHearing)}</span>}
                  subtitle={`${c.tenant} · ${c.court ?? ""}`}
                  chevron
                />
              ))
            )}
          </GroupedSection>
        </div>
      )}
      <LegalCaseSheet
        open={creating}
        onOpenChange={setCreating}
        value={null}
        tenants={tenants}
        contracts={contracts}
      />
    </>
  );
}
