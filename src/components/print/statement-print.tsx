import { fromFils } from "@/domain/money";
import { formatDate } from "@/domain/dates";
import type { MonthlyStatement } from "@/domain/reports";

const fmt = (f: number) => (f ? fromFils(f) : "");

/** Paper-replica monthly statement (§6.6): columns right→left exactly as the office prints them. */
export function StatementPrint({
  s,
  labels,
  monthTitle,
}: {
  s: MonthlyStatement;
  monthTitle: string;
  labels: Record<string, string>;
}) {
  return (
    <section className="break-inside-avoid" dir="rtl">
      <div className="mb-3 grid grid-cols-3 items-end gap-3 text-[10.5pt]">
        <div>
          <div>
            <strong>{labels.property}:</strong> {s.propertyName}
          </div>
          <div>
            <strong>{labels.owner}:</strong> {s.ownerNames.join("، ")}
          </div>
        </div>
        <div className="text-center">
          <div className="text-[15pt] font-bold">{labels.title}</div>
          <div className="text-[11pt]">{monthTitle}</div>
        </div>
        <div className="num text-end" dir="rtl">
          <div>
            {labels.from}: {formatDate(s.fromDate)}
          </div>
          <div>
            {labels.to}: {formatDate(s.toDate)}
          </div>
        </div>
      </div>
      <table className="print-table">
        <thead>
          <tr>
            <th>{labels.unit}</th>
            <th>{labels.tenant}</th>
            <th>{labels.legal}</th>
            <th>{labels.rent}</th>
            <th>{labels.receipts}</th>
            <th>{labels.collected}</th>
            <th>{labels.prevNext}</th>
            <th>{labels.lastPayment}</th>
            <th>{labels.arrears}</th>
            <th>{labels.notes}</th>
          </tr>
        </thead>
        <tbody>
          {s.rows.map((r) => (
            <tr key={r.contractId ?? r.unitIds[0]}>
              <td className="text-center font-semibold">{r.unitLabels}</td>
              <td>{r.vacant ? labels.vacant : r.tenantName}</td>
              <td className="text-center">{r.vacant ? "" : r.legalLabel}</td>
              <td className="num text-center">{r.vacant ? "" : fromFils(r.rentFils)}</td>
              <td className="num text-center text-[8.5pt]">{r.receiptNos.join(", ")}</td>
              <td className="num text-center">{r.vacant ? "" : fromFils(r.collectedFils)}</td>
              <td className="num text-center text-[8.5pt]">
                {r.previousFils > 0 && (
                  <div>
                    {fmt(r.previousFils)} {labels.prev}
                  </div>
                )}
                {r.nextFils > 0 && (
                  <div>
                    {fmt(r.nextFils)} {labels.next}
                  </div>
                )}
              </td>
              <td className="num text-center">{formatDate(r.lastPaymentDate)}</td>
              <td className="num text-center">{r.vacant ? "" : fromFils(r.arrearsFils)}</td>
              <td className="text-[8.5pt]">
                {r.notes
                  .map((n) => (n === "free" ? labels.free : n === "notice" ? labels.notice : n))
                  .join(" · ")}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="text-center">
              {labels.total}
            </td>
            <td className="num text-center">{fromFils(s.totals.rentFils)}</td>
            <td />
            <td className="num text-center">{fromFils(s.totals.collectedFils)}</td>
            <td className="num text-center">{fmt(s.totals.previousFils + s.totals.nextFils)}</td>
            <td />
            <td className="num text-center">{fromFils(s.totals.arrearsFils)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <div className="mt-8 grid grid-cols-2 gap-10 text-[10.5pt]">
        <div>
          {labels.recipient}:{" "}
          <span className="inline-block w-48 border-b border-dotted border-black" />
        </div>
        <div>
          {labels.signature}:{" "}
          <span className="inline-block w-48 border-b border-dotted border-black" />
        </div>
      </div>
    </section>
  );
}
