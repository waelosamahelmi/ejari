"use client";
import { useState, useTransition } from "react";
import { Ban, Mail, MessageCircle, Pencil, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { Chip, ChipScroller, ContractStatusPill, Pill } from "@/components/ui/chip";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Toggle } from "@/components/ui/toggle";
import { AlertDialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { Documents } from "@/components/domain/documents";
import { TenantFormSheet } from "@/components/domain/tenants/tenant-form";
import { NoContractsIllustration } from "@/components/illustrations";
import { useMoney } from "@/components/shell/prefs-context";
import { setBlacklist } from "@/server/actions/master";
import { formatDate } from "@/domain/dates";
import { formatPhone, whatsappLink } from "@/domain/validation";
import { cn } from "@/lib/utils";
import { CHARGE_KINDS, type ContractStatus, type LegalStatus } from "@/domain/types";
import type { LedgerEntry } from "@/domain/ledger";

type LedgerRow = LedgerEntry & { contractNo: string };

export function TenantDetailView({
  tenant: tn,
  contracts,
  ledger,
  totals,
  reminders,
  legal,
  canEdit,
  reminderAction,
}: {
  tenant: {
    id: string;
    fullName: string;
    civilIdDisplay: string;
    civilIdRaw: string;
    civilIdChecksumOk: boolean;
    nationality: string | null;
    phones: string[];
    email: string | null;
    employer: string | null;
    emergencyContact: string | null;
    notes: string | null;
    blacklisted: boolean;
    blacklistReason: string | null;
  };
  contracts: {
    id: string;
    contractNo: string;
    status: ContractStatus;
    propertyName: string;
    units: string;
    rentFils: number;
    startDate: string;
    endDate: string;
  }[];
  ledger: LedgerRow[];
  totals: { arrears: number; credit: number };
  reminders: { id: string; channel: string; message: string; sent_at: string }[];
  legal: {
    id: string;
    case_no: string | null;
    court: string | null;
    type: string;
    status: LegalStatus;
    next_hearing_date: string | null;
    amount_claimed_fils: number;
  }[];
  canEdit: boolean;
  reminderAction?: React.ReactNode;
}) {
  const t = useTranslations("tenants");
  const tc = useTranslations("common");
  const tKind = useTranslations("enums.chargeKind");
  const tLegal = useTranslations("enums.legalStatus");
  const tErr = useTranslations("errors.field");
  const money = useMoney();
  const router = useRouter();
  const [section, setSection] = useState<
    "contracts" | "ledger" | "reminders" | "legal" | "documents"
  >("contracts");
  const [editing, setEditing] = useState(false);
  const [blk, setBlk] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  const ledgerCols: ColumnDef<LedgerRow, unknown>[] = [
    {
      accessorKey: "date",
      header: tc("labels.date"),
      cell: (c) => <span className="num">{formatDate(c.row.original.date)}</span>,
    },
    {
      id: "desc",
      header: tc("labels.description"),
      enableSorting: false,
      cell: (c) => {
        const r = c.row.original;
        const label =
          r.kind === "payment"
            ? `${tc("labels.reference")} ${r.description}`
            : r.kind === "adjustment"
              ? r.description
              : `${(CHARGE_KINDS as readonly string[]).includes(r.description) ? tKind(r.description as "rent") : r.description} ${r.period ?? ""}`;
        return (
          <span className={cn(r.kind === "free" && "text-teal-text")}>
            {label} <span className="text-label-3 num text-[12px]">{r.contractNo}</span>
          </span>
        );
      },
    },
    {
      accessorKey: "debitFils",
      header: "−",
      meta: { numeric: true },
      cell: (c) =>
        c.row.original.debitFils ? money(c.row.original.debitFils, { showCurrency: false }) : "",
    },
    {
      accessorKey: "creditFils",
      header: "+",
      meta: { numeric: true },
      cell: (c) =>
        c.row.original.creditFils ? (
          <span className="text-green-text">
            {money(c.row.original.creditFils, { showCurrency: false })}
          </span>
        ) : (
          ""
        ),
    },
    {
      accessorKey: "balanceFils",
      header: tc("labels.total"),
      meta: { numeric: true },
      cell: (c) => (
        <span
          className={cn("font-semibold", c.row.original.balanceFils > 0 ? "text-red-text" : "")}
        >
          {money(c.row.original.balanceFils, { showCurrency: false })}
        </span>
      ),
    },
  ];

  return (
    <>
      <LargeTitleHeader
        title={tn.fullName}
        subtitle={tn.blacklisted ? undefined : (tn.nationality ?? undefined)}
        back={{ href: "/tenants", label: t("title") }}
        actions={
          canEdit ? (
            <Button
              variant="secondary"
              size="icon"
              aria-label={t("edit")}
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </Button>
          ) : undefined
        }
      >
        {tn.blacklisted && (
          <Pill className="bg-ink text-on-ink h-7 px-3 text-[13px]">
            <Ban className="size-3.5" />
            {t("blacklist.badge")}
            {tn.blacklistReason ? ` — ${tn.blacklistReason}` : ""}
          </Pill>
        )}
      </LargeTitleHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-label-2 text-[13px]">{t("columns.balance")}</div>
                <div
                  className={cn(
                    "num text-[24px] font-semibold whitespace-nowrap",
                    totals.arrears > 0
                      ? "text-red-text"
                      : totals.credit > 0
                        ? "text-indigo-text"
                        : "",
                  )}
                >
                  {totals.arrears > 0
                    ? money(totals.arrears)
                    : totals.credit > 0
                      ? `+${money(totals.credit)}`
                      : money(0)}
                </div>
              </div>
              <div>
                <div className="text-label-2 text-[13px]">{t("sections.contracts")}</div>
                <div className="num text-[26px] font-semibold">
                  {
                    contracts.filter((c) => c.status === "active" || c.status === "notice_given")
                      .length
                  }
                </div>
              </div>
            </div>
            {tn.phones[0] && (
              <div className="mt-4 flex gap-2">
                <Button asChild variant="tinted" className="flex-1">
                  <a href={`tel:+965${tn.phones[0]}`}>
                    <Phone />
                    {tc("actions.call")}
                  </a>
                </Button>
                <Button asChild variant="tinted" className="flex-1">
                  <a href={whatsappLink(tn.phones[0], "")} target="_blank" rel="noreferrer">
                    <MessageCircle />
                    {tc("actions.whatsapp")}
                  </a>
                </Button>
              </div>
            )}
            {reminderAction && <div className="mt-2">{reminderAction}</div>}
          </Card>
          <GroupedSection header={t("sections.contact")}>
            {tn.civilIdDisplay && (
              <ListRow
                title={t("fields.civilId")}
                subtitle={
                  !tn.civilIdChecksumOk ? (
                    <span className="text-orange-text">{tErr("civilIdChecksum")}</span>
                  ) : undefined
                }
                trailing={
                  <span className="num" dir="ltr">
                    {tn.civilIdDisplay}
                  </span>
                }
              />
            )}
            {tn.phones.map((p) => (
              <ListRow
                key={p}
                title={t("fields.phones")}
                trailing={
                  <a className="num text-link" dir="ltr" href={`tel:+965${p}`}>
                    {formatPhone(p)}
                  </a>
                }
              />
            ))}
            {tn.email && (
              <ListRow
                title={t("fields.email")}
                trailing={
                  <a className="text-link" href={`mailto:${tn.email}`}>
                    <Mail className="size-4" />
                  </a>
                }
                subtitle={tn.email}
              />
            )}
            {tn.employer && <ListRow title={t("fields.employer")} trailing={tn.employer} />}
            {tn.emergencyContact && (
              <ListRow title={t("fields.emergency")} subtitle={tn.emergencyContact} />
            )}
            {tn.notes && <ListRow title={t("fields.notes")} subtitle={tn.notes} />}
          </GroupedSection>
          {canEdit && (
            <GroupedSection>
              <ListRow
                leading={<Ban className="text-label-2 size-5" />}
                title={t("blacklist.label")}
                trailing={
                  <Toggle
                    checked={tn.blacklisted}
                    ariaLabel={t("blacklist.label")}
                    onCheckedChange={(v) => {
                      if (v) setBlk(true);
                      else
                        start(async () => {
                          await setBlacklist(tn.id, false, null);
                          toast.success(t("blacklist.off"));
                          router.refresh();
                        });
                    }}
                  />
                }
              />
            </GroupedSection>
          )}
        </div>

        <div className="min-w-0 space-y-4">
          <ChipScroller>
            {(["contracts", "ledger", "reminders", "legal", "documents"] as const).map((s) => (
              <Chip
                key={s}
                active={section === s}
                onClick={() => setSection(s)}
                className="h-11 px-5 text-[15px]"
              >
                {t(`sections.${s}`)}
              </Chip>
            ))}
          </ChipScroller>
          {section === "contracts" &&
            (contracts.length === 0 ? (
              <EmptyState
                compact
                illustration={<NoContractsIllustration />}
                title={t("noContracts")}
              />
            ) : (
              <GroupedSection>
                {contracts.map((c) => (
                  <ListRow
                    key={c.id}
                    LinkComponent={Link}
                    href={`/contracts/${c.id}`}
                    title={`${c.propertyName} · ${c.units}`}
                    subtitle={
                      <span className="num">
                        {c.contractNo} · {formatDate(c.startDate)} – {formatDate(c.endDate)} ·{" "}
                        {money(c.rentFils)}
                      </span>
                    }
                    trailing={<ContractStatusPill status={c.status} />}
                    chevron
                  />
                ))}
              </GroupedSection>
            ))}
          {section === "ledger" && (
            <DataTable
              data={ledger}
              columns={ledgerCols}
              maxHeight="70vh"
              initialSorting={[{ id: "date", desc: true }]}
            />
          )}
          {section === "reminders" &&
            (reminders.length === 0 ? (
              <EmptyState compact title={t("noReminders")} />
            ) : (
              <GroupedSection>
                {reminders.map((r) => (
                  <ListRow
                    key={r.id}
                    title={
                      <span className="num text-[13px]">
                        {new Date(r.sent_at).toLocaleString("en-GB", { timeZone: "Asia/Kuwait" })}
                      </span>
                    }
                    subtitle={<span className="whitespace-pre-line">{r.message}</span>}
                  />
                ))}
              </GroupedSection>
            ))}
          {section === "legal" &&
            (legal.length === 0 ? (
              <EmptyState compact title={tLegal("none")} />
            ) : (
              <GroupedSection>
                {legal.map((l) => (
                  <ListRow
                    key={l.id}
                    LinkComponent={Link}
                    href={`/legal/${l.id}`}
                    title={l.case_no ?? l.court ?? ""}
                    subtitle={l.next_hearing_date ? formatDate(l.next_hearing_date) : undefined}
                    trailing={<Pill className="bg-red/14 text-red-text">{tLegal(l.status)}</Pill>}
                    chevron
                  />
                ))}
              </GroupedSection>
            ))}
          {section === "documents" && (
            <Documents entityType="tenant" entityId={tn.id} canEdit={canEdit} canDelete={canEdit} />
          )}
        </div>
      </div>

      <TenantFormSheet
        open={editing}
        onOpenChange={setEditing}
        tenant={{
          id: tn.id,
          fullName: tn.fullName,
          civilId: tn.civilIdRaw,
          nationality: tn.nationality ?? "",
          phones: tn.phones,
          email: tn.email ?? "",
          employer: tn.employer ?? "",
          emergencyContact: tn.emergencyContact ?? "",
          notes: tn.notes ?? "",
        }}
      />
      <AlertDialog
        open={blk}
        onOpenChange={setBlk}
        title={t("blacklist.label")}
        confirmLabel={tc("actions.confirm")}
        cancelLabel={tc("actions.cancel")}
        destructive
        loading={pending}
        confirmDisabled={!reason.trim()}
        onConfirm={() =>
          start(async () => {
            await setBlacklist(tn.id, true, reason);
            setBlk(false);
            toast.success(t("blacklist.on"));
            router.refresh();
          })
        }
      >
        <Textarea
          aria-label={t("blacklist.reason")}
          placeholder={t("blacklist.reason")}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </AlertDialog>
    </>
  );
}
