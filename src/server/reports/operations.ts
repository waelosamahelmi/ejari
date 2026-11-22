import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchAll } from "@/server/db";
import type { SessionContext } from "@/lib/auth";
import type { OrgData } from "@/server/queries/dataset";
import type { ReportSpec, ReportParams, ReportType, RCol, Cell } from "./build";
import { addDays, formatDate } from "@/domain/dates";
import { rentForPeriod } from "@/domain/schedule";
export const OPERATION_REPORTS = [
  "collections",
  "expense-ledger",
  "property-contracts",
  "uncollected-receipts",
  "print-history",
] as const;
export async function operationReport(
  ctx: SessionContext,
  type: ReportType,
  p: ReportParams,
  locale: "ar" | "en",
  data: OrgData,
): Promise<ReportSpec> {
  const db = await supabaseServer();
  const ar = locale === "ar";
  const t = (a: string, e: string) => (ar ? a : e);
  const scope = new Set(
    data.ds.properties
      .filter(
        (x) => (!p.property || x.id === p.property) && (!p.owner || x.ownerIds.includes(p.owner)),
      )
      .map((x) => x.id),
  );
  const within = (d: string) => d >= p.dateFrom && d <= p.dateTo;
  const propName = (id: string) => data.properties.get(id)?.name ?? "";
  const title =
    type === "collections"
      ? t("كشف التحصيل", "Collection ledger")
      : type === "expense-ledger"
        ? t("كشف المصروفات", "Expense ledger")
        : type === "property-contracts"
          ? t("كشف عقود العقار", "Property contracts")
          : type === "uncollected-receipts"
            ? t("الوصلات المطبوعة غير المحصلة", "Printed uncollected receipts")
            : t("سجل طباعة الوصلات", "Receipt print history");
  const col = (key: string, a: string, e: string, kind?: "money" | "date" | "int"): RCol => ({
    key,
    header: t(a, e),
    type: kind,
  });
  const common = [
    col("number", "رقم الوصل / السند", "Receipt / voucher"),
    col("owner", "المالك", "Owner"),
    col("property", "العقار", "Property"),
  ];
  let columns: RCol[] = [];
  let rows: Record<string, Cell>[] = [];
  let totalKey: string | undefined;
  if (type === "collections") {
    const ownerRows = await fetchAll((a, b) =>
      db.from("payments").select("id,owner_id").eq("org_id", ctx.orgId).range(a, b),
    );
    const owners = new Map(ownerRows.map((r) => [r.id, r.owner_id]));
    columns = [
      ...common,
      col("unit", "الوحدة", "Unit"),
      col("tenant", "المستأجر", "Tenant"),
      col("date", "تاريخ التحصيل", "Collected on", "date"),
      col("amount", "المحصل د.ك", "Collected KWD", "money"),
    ];
    totalKey = "amount";
    rows = data.ds.payments
      .filter((x) => !x.voided && within(x.receivedAt))
      .flatMap((x) => {
        const c = data.ds.contracts.find((c) => c.id === x.contractId);
        if (
          !c ||
          !scope.has(c.propertyId) ||
          (p.owner && owners.get(x.id) && owners.get(x.id) !== p.owner)
        )
          return [];
        return [
          {
            _paymentId: x.id,
            number: x.receiptNo ?? "",
            owner: owners.get(x.id)
              ? (data.owners.get(owners.get(x.id)!)?.fullName ?? "")
              : (data.ds.properties.find((v) => v.id === c.propertyId)?.ownerNames.join("، ") ??
                ""),
            property: propName(c.propertyId),
            unit: c.unitIds.map((id) => data.units.get(id)?.label).join("، "),
            tenant: c.tenantName,
            date: x.receivedAt,
            amount: x.amountFils,
          },
        ];
      });
  } else if (type === "expense-ledger") {
    const vouchers = await fetchAll((a, b) =>
      db.from("expense_vouchers").select("id,notes,owner_id").eq("org_id", ctx.orgId).range(a, b),
    );
    columns = [
      ...common,
      col("date", "التاريخ", "Date", "date"),
      col("category", "نوع المصروف", "Category"),
      col("beneficiary", "المستفيد", "Beneficiary"),
      col("description", "البيان", "Description"),
      col("notes", "الملاحظات", "Notes"),
      col("amount", "المصروف د.ك", "Expense KWD", "money"),
    ];
    totalKey = "amount";
    rows = data.ds.expenseAllocations
      .filter((x) => within(x.voucherDate) && scope.has(x.propertyId))
      .filter(
        (x) =>
          !p.owner ||
          !vouchers.find((v) => v.id === x.voucherId)?.owner_id ||
          vouchers.find((v) => v.id === x.voucherId)?.owner_id === p.owner,
      )
      .map((x) => {
        const v = vouchers.find((v) => v.id === x.voucherId);
        return {
          _voucherId: x.voucherId,
          number: x.voucherNo,
          date: x.voucherDate,
          owner: v?.owner_id
            ? (data.owners.get(v.owner_id)?.fullName ?? "")
            : (data.ds.properties.find((p) => p.id === x.propertyId)?.ownerNames.join("، ") ?? ""),
          property: propName(x.propertyId),
          category: x.categoryName,
          beneficiary: x.beneficiaryName ?? "",
          description: x.description ?? "",
          notes: v?.notes ?? "",
          amount: x.amountFils,
        };
      });
  } else if (type === "property-contracts") {
    const contracts = await fetchAll((a, b) =>
      db
        .from("contracts")
        .select("id,owner_id,contract_rent_revisions(effective_from,monthly_rent_fils,created_at)")
        .eq("org_id", ctx.orgId)
        .range(a, b),
    );
    columns = [
      col("number", "رقم العقد", "Lease"),
      col("property", "العقار", "Property"),
      col("unit", "الوحدة", "Unit"),
      col("tenant", "المستأجر", "Tenant"),
      col("start", "بداية العقد", "Starts", "date"),
      col("end", "نهاية العقد", "Ends", "date"),
      col("amount", "القيمة الإيجارية د.ك", "Monthly rent KWD", "money"),
      col("status", "الحالة", "Status"),
    ];
    totalKey = "amount";
    rows = data.ds.contracts
      .filter(
        (c) =>
          c.status !== "draft" &&
          scope.has(c.propertyId) &&
          (!p.owner ||
            !contracts.find((r) => r.id === c.id)?.owner_id ||
            contracts.find((r) => r.id === c.id)?.owner_id === p.owner) &&
          c.startDate <= p.dateTo &&
          c.endDate >= p.dateFrom,
      )
      .map((c) => ({
        _contractId: c.id,
        number: c.contractNo,
        property: propName(c.propertyId),
        unit: c.unitIds.map((id) => data.units.get(id)?.label).join("، "),
        tenant: c.tenantName,
        start: c.startDate,
        end: c.endDate,
        status: ar
          ? {
              active: "ساري",
              notice_given: "إخطار",
              ended: "منتهي",
              terminated: "مفسوخ",
              renewed: "مجدد",
              draft: "مسودة",
            }[c.status]
          : c.status,
        amount: rentForPeriod(
          {
            ...c,
            revisions: (contracts.find((r) => r.id === c.id)?.contract_rent_revisions ?? []).map(
              (r) => ({
                effectiveFrom: r.effective_from,
                monthlyRentFils: r.monthly_rent_fils,
                createdAt: r.created_at,
              }),
            ),
          },
          (c.startDate > p.dateFrom ? c.startDate : p.dateFrom).slice(0, 7),
        ),
      }));
  } else {
    const counts = await fetchAll((a, b) =>
      db.from("v_document_print_counts").select("*").eq("org_id", ctx.orgId).range(a, b),
    );
    if (type === "uncollected-receipts") {
      const receipts = await fetchAll((a, b) =>
        db
          .from("collection_receipts")
          .select("*")
          .eq("status", "prepared")
          .eq("org_id", ctx.orgId)
          .gte("created_at", p.dateFrom + "T00:00:00+03:00")
          .lt("created_at", addDays(p.dateTo, 1) + "T00:00:00+03:00")
          .range(a, b),
      );
      columns = [
        ...common,
        col("tenant", "المستأجر / الوحدة", "Tenant / unit"),
        col("period", "عن شهر", "Period"),
        col("amount", "المبلغ د.ك", "Amount KWD", "money"),
        col("count", "مرات طلب الطباعة", "Print requests", "int"),
      ];
      totalKey = "amount";
      rows = receipts
        .filter((r) => scope.has(r.property_id) && (!p.owner || r.owner_id === p.owner))
        .flatMap((r) => {
          const n = counts.find((c) => c.kind === "collection" && c.document_id === r.id);
          if (!n?.print_count) return [];
          const s = r.snapshot as {
            ownerName: string;
            tenantName: string;
            unitLabels: string;
            propertyName: string;
          };
          return [
            {
              number: r.document_no,
              owner: s.ownerName,
              property: s.propertyName,
              tenant: s.tenantName + " · " + s.unitLabels,
              period: r.period,
              amount: r.amount_fils,
              count: Number(n.print_count),
            },
          ];
        });
    } else {
      const prints = await fetchAll((a, b) =>
        db
          .from("document_prints")
          .select("*")
          .eq("org_id", ctx.orgId)
          .gte("created_at", p.dateFrom + "T00:00:00+03:00")
          .lt("created_at", addDays(p.dateTo, 1) + "T00:00:00+03:00")
          .order("created_at")
          .range(a, b),
      );
      const grouped = new Map<string, Record<string, Cell>>();
      for (const r of prints.filter(
        (r) => scope.has(r.property_id) && (!p.owner || r.owner_id === p.owner),
      )) {
        const key = r.kind + r.document_id;
        const old = grouped.get(key);
        grouped.set(key, {
          number: r.document_no,
          owner: r.owner_id ? (data.owners.get(r.owner_id)?.fullName ?? "") : "",
          property: propName(r.property_id),
          kind:
            r.kind === "voucher" ? t("صرف", "Expense") : t("تحصيل / قبض", "Collection / receipt"),
          count: Number(old?.count ?? 0) + 1,
          lifetime: Number(
            counts.find((c) => c.document_id === r.document_id && c.kind === r.kind)?.print_count ??
              0,
          ),
        });
      }
      columns = [
        ...common,
        col("kind", "نوع المستند", "Document type"),
        col("count", "الطلبات خلال الفترة", "Requests in range", "int"),
        col("lifetime", "إجمالي طلبات الطباعة", "Lifetime print requests", "int"),
      ];
      rows = [...grouped.values()];
      totalKey = "count";
    }
  }
  rows.sort(
    (a, b) =>
      String(a.property ?? "").localeCompare(String(b.property ?? "")) ||
      String(a.date ?? a.start ?? a.number ?? "").localeCompare(
        String(b.date ?? b.start ?? b.number ?? ""),
      ),
  );
  const total = totalKey ? rows.reduce((n, r) => n + Number(r[totalKey!] ?? 0), 0) : 0;
  return {
    type,
    title,
    subtitle: `${formatDate(p.dateFrom)} – ${formatDate(p.dateTo)}`,
    kpis: [{ label: t("عدد السجلات", "Rows"), value: rows.length, type: "int" }],
    sections: [
      {
        columns,
        rows,
        totals: totalKey
          ? { [columns[0]!.key]: t("الإجمالي", "Total"), [totalKey]: total }
          : undefined,
      },
    ],
  };
}
