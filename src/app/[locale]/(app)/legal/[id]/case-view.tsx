"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { Chip, ChipScroller } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Documents } from "@/components/domain/documents";
import { LegalCaseSheet } from "@/components/domain/legal/case-form";
import { useMoney } from "@/components/shell/prefs-context";
import { useAction } from "@/hooks/use-action";
import { addLegalEvent, setLegalStatus, type LegalCaseInput } from "@/server/actions/legal";
import { formatDate, todayKuwait } from "@/domain/dates";
import { LEGAL_STATUSES } from "@/domain/types";

export function CaseView({ value, tenant, contractNo, events, canManage, tenants, contracts }: { value: LegalCaseInput & { id: string }; tenant: string; contractNo: string | null; events: { id: string; event_date: string; title: string; notes: string | null }[]; canManage: boolean; tenants: { id: string; name: string }[]; contracts: { id: string; tenantId: string; label: string }[] }) {
  const t = useTranslations("legal");
  const tStatus = useTranslations("enums.legalStatus");
  const tType = useTranslations("enums.legalType");
  const tc = useTranslations("common.actions");
  const money = useMoney();
  const router = useRouter();
  const { exec, pending } = useAction();
  const [edit, setEdit] = useState(false);
  const [ev, setEv] = useState(false);
  const [evDate, setEvDate] = useState(todayKuwait());
  const [evTitle, setEvTitle] = useState("");
  const [evNotes, setEvNotes] = useState("");
  const label = (s: string) => ((LEGAL_STATUSES as readonly string[]).includes(s) ? tStatus(s as "filed") : s);
  return (
    <>
      <LargeTitleHeader title={tenant} subtitle={`${value.caseNo ?? "—"} · ${tType(value.type)}`} back={{ href: "/legal", label: t("title") }} actions={canManage ? <Button variant="secondary" size="icon" aria-label={t("edit")} onClick={() => setEdit(true)}><Pencil /></Button> : undefined}>
        {canManage && (
          <ChipScroller>
            {LEGAL_STATUSES.filter((s) => s !== "none").map((s) => (
              <Chip key={s} active={value.status === s} onClick={() => value.status !== s && exec(() => setLegalStatus(value.id, s), { onSuccess: () => router.refresh() })}>{tStatus(s)}</Chip>
            ))}
          </ChipScroller>
        )}
      </LargeTitleHeader>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <GroupedSection>
            <ListRow title={t("fields.status")} trailing={tStatus(value.status)} />
            <ListRow title={t("fields.court")} trailing={value.court ?? "—"} />
            <ListRow title={t("fields.amount")} trailing={<span className="num">{money(value.amountClaimedFils)}</span>} />
            <ListRow title={t("fields.nextHearing")} trailing={<span className="num text-red-text">{formatDate(value.nextHearingDate)}</span>} />
            <ListRow title={t("fields.lawyer")} trailing={value.lawyer ?? "—"} />
            {contractNo && value.contractId && <ListRow LinkComponent={Link} href={`/contracts/${value.contractId}`} title={t("fields.contract")} trailing={<span className="num">{contractNo}</span>} chevron />}
            {value.notes && <ListRow title={t("fields.notes")} subtitle={value.notes} />}
          </GroupedSection>
          <Documents entityType="legal_case" entityId={value.id} canEdit={canManage} canDelete={canManage} />
        </div>
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[18px] font-semibold">{t("timeline")}</h2>
            {canManage && <Button size="sm" variant="secondary" onClick={() => setEv(true)}><Plus />{t("addEvent")}</Button>}
          </div>
          <ol className="border-separator relative space-y-5 border-s-2 ps-5">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className="bg-red absolute -start-[27px] top-1.5 size-3 rounded-full ring-4 ring-[var(--bg-elevated)]" />
                <div className="text-[15px] font-medium">{label(e.title)}</div>
                <div className="text-label-2 num text-[12px]">{formatDate(e.event_date)}</div>
                {e.notes && <p className="text-label-2 mt-1 text-[14px]">{e.notes}</p>}
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <LegalCaseSheet open={edit} onOpenChange={setEdit} value={value} tenants={tenants} contracts={contracts} />
      <Sheet open={ev} onOpenChange={setEv} title={t("addEvent")} footer={<Button block size="lg" loading={pending} disabled={!evTitle.trim()} onClick={() => exec(() => addLegalEvent(value.id, { date: evDate, title: evTitle, notes: evNotes }), { success: t("saved"), onSuccess: () => { setEv(false); setEvTitle(""); setEvNotes(""); router.refresh(); } })}>{tc("save")}</Button>}>
        <div className="space-y-4">
          <Field label={t("eventDate")} htmlFor="ev-date"><DatePicker id="ev-date" value={evDate} onChange={(d) => d && setEvDate(d)} /></Field>
          <Field label={t("eventTitle")} htmlFor="ev-title"><Input id="ev-title" value={evTitle} onChange={(e) => setEvTitle(e.target.value)} /></Field>
          <Field label={t("eventNotes")} htmlFor="ev-notes"><Textarea id="ev-notes" value={evNotes} onChange={(e) => setEvNotes(e.target.value)} /></Field>
        </div>
      </Sheet>
    </>
  );
}
