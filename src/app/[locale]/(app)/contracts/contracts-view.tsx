"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Link, useRouter } from "@/i18n/navigation";
import { LargeTitleHeader } from "@/components/shell/large-title-header";
import { SearchField } from "@/components/ui/search-field";
import { Chip, ChipScroller, ContractStatusPill, Pill } from "@/components/ui/chip";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NoContractsIllustration, NoResultsIllustration } from "@/components/illustrations";
import { useMoney } from "@/components/shell/prefs-context";
import { addDays, formatDate } from "@/domain/dates";
import { normalizeDigits } from "@/domain/money";
import type { ContractStatus, ContractType } from "@/domain/types";

interface Row { id: string; contractNo: string; type: ContractType; status: ContractStatus; startDate: string; endDate: string; rentFils: number; autoRenew: boolean; tenant: string; propertyId: string; property: string; units: string }
type Filter = "all" | "active" | "draft" | "notice" | "expiring" | "ended";

export function ContractsView({ rows, today, canCreate }: { rows: Row[]; today: string; canCreate: boolean }) {
  const t = useTranslations("contracts");
  const tType = useTranslations("enums.contractType");
  const money = useMoney();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("active");
  const [type, setType] = useState<"all" | ContractType>("all");
  const limit = addDays(today, 90);
  const filtered = useMemo(() => {
    const s = normalizeDigits(q).trim().toLowerCase();
    return rows.filter((r) => {
      if (type !== "all" && r.type !== type) return false;
      if (filter === "active" && r.status !== "active" && r.status !== "notice_given") return false;
      if (filter === "draft" && r.status !== "draft") return false;
      if (filter === "notice" && r.status !== "notice_given") return false;
      if (filter === "expiring" && !((r.status === "active" || r.status === "notice_given") && r.endDate >= today && r.endDate <= limit)) return false;
      if (filter === "ended" && !["ended", "terminated", "renewed"].includes(r.status)) return false;
      return !s || [r.contractNo, r.tenant, r.property, r.units].some((x) => x.toLowerCase().includes(s));
    });
  }, [rows, q, filter, type, today, limit]);

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "contractNo", header: t("columns.no"), cell: (c) => <span className="num font-medium">{c.row.original.status === "draft" ? "—" : c.row.original.contractNo}</span> },
    { accessorKey: "tenant", header: t("columns.tenant") },
    { id: "units", header: t("columns.units"), cell: (c) => <span className="text-label-2">{c.row.original.property} · {c.row.original.units}</span>, enableSorting: false },
    { accessorKey: "rentFils", header: t("columns.rent"), meta: { numeric: true }, cell: (c) => money(c.row.original.rentFils) },
    { accessorKey: "startDate", header: t("columns.start"), cell: (c) => <span className="num">{formatDate(c.row.original.startDate)}</span> },
    { accessorKey: "endDate", header: t("columns.end"), cell: (c) => <span className="num">{formatDate(c.row.original.endDate)}</span> },
    { accessorKey: "status", header: t("columns.status"), cell: (c) => <span className="flex items-center gap-1.5"><ContractStatusPill status={c.row.original.status} /><Pill className="bg-inset text-label-2">{tType(c.row.original.type)}</Pill></span> },
  ];

  return (
    <>
      <LargeTitleHeader title={t("title")} actions={canCreate ? <Button asChild><Link href="/contracts/new"><Plus />{t("new")}</Link></Button> : undefined}>
        <SearchField value={q} onValueChange={setQ} placeholder={t("search")} />
        <ChipScroller className="mt-3">
          {(["active", "all", "draft", "notice", "expiring", "ended"] as const).map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>{t(`filters.${f}`)}</Chip>
          ))}
          <span className="bg-separator mx-1 w-px self-stretch" />
          {(["all", "residential", "investment"] as const).map((k) => (
            <Chip key={k} active={type === k} onClick={() => setType(k)}>{k === "all" ? t("filters.type") : tType(k)}</Chip>
          ))}
        </ChipScroller>
      </LargeTitleHeader>
      {rows.length === 0 ? (
        <EmptyState illustration={<NoContractsIllustration />} title={t("empty")} description={t("emptyText")} action={canCreate ? <Button asChild size="lg"><Link href="/contracts/new"><Plus />{t("new")}</Link></Button> : undefined} />
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(r) => router.push(r.status === "draft" ? `/contracts/new?draft=${r.id}` : `/contracts/${r.id}`)}
          empty={<EmptyState compact illustration={<NoResultsIllustration />} title={t("noResults")} />}
          renderCard={(r) => (
            <Link href={r.status === "draft" ? `/contracts/new?draft=${r.id}` : `/contracts/${r.id}`} className="bg-paper press block rounded-[20px] p-4 shadow-[var(--sh-card)]">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[16px] font-semibold">{r.tenant}</span>
                <ContractStatusPill status={r.status} />
              </div>
              <div className="text-label-2 mt-1 truncate text-[13px]">{r.property} · {r.units}</div>
              <div className="mt-2 flex justify-between text-[13px]">
                <span className="num text-label-2">{r.status === "draft" ? tType(r.type) : r.contractNo}</span>
                <span className="num font-semibold">{money(r.rentFils)}</span>
              </div>
            </Link>
          )}
        />
      )}
    </>
  );
}
