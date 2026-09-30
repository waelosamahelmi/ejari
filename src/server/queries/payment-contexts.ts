import "server-only";
import { chargeStates } from "@/domain/ledger";
import { periodOf, type ISODate } from "@/domain/dates";
import type { PaymentContext } from "@/server/actions/payments";
import type { OrgData } from "./dataset";

/**
 * Record-payment contexts for many contracts at once, computed from the loaded
 * dataset. Embedded in the collections page so the payment sheet works offline
 * from the cached page (§19.3).
 */
export function paymentContexts(
  data: OrgData,
  contractIds: readonly string[],
  collectors: PaymentContext["collectors"],
  today: ISODate,
): Record<string, PaymentContext> {
  const out: Record<string, PaymentContext> = {};
  const thisPeriod = periodOf(today);
  for (const id of new Set(contractIds)) {
    const c = data.ds.contracts.find((x) => x.id === id);
    if (!c) continue;
    const l = data.idx.ledger(id);
    const open = [...chargeStates(l).values()]
      .filter((s) => s.outstandingFils > 0)
      .map((s) => ({
        id: s.charge.id,
        period: s.charge.period,
        kind: s.charge.kind,
        dueDate: s.charge.dueDate,
        outstandingFils: s.outstandingFils,
      }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const paid = l.payments.filter((p) => !p.voided).reduce((s, p) => s + p.amountFils, 0);
    const allocated = l.allocations.reduce((s, a) => s + a.amountFils, 0);
    const units = c.unitIds.map((u) => data.units.get(u)).filter((u) => !!u);
    out[id] = {
      contractId: id,
      contractNo: c.contractNo,
      tenantId: c.tenantId,
      tenantName: c.tenantName,
      tenantPhone: c.tenantPhones?.[0] ?? null,
      propertyName: data.properties.get(c.propertyId)?.name ?? "",
      unitLabels: units.map((u) => u.label).join(", "),
      monthlyRentFils: c.monthlyRentFils,
      open,
      dueNowFils: open.filter((o) => o.dueDate <= today).reduce((a, o) => a + o.outstandingFils, 0),
      thisMonthFils: open
        .filter((o) => o.period === thisPeriod)
        .reduce((a, o) => a + o.outstandingFils, 0),
      creditFils: Math.max(0, paid - allocated),
      collectors,
    };
  }
  return out;
}
