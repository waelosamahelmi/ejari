"use server";
import { requireActionContext } from "@/lib/auth";
import { loadOrgData } from "@/server/queries/dataset";
import { monthlyStatement, type MonthlyStatement } from "@/domain/reports";
import { isValidPeriod } from "@/domain/dates";
import { run } from "@/server/action";
import { ActionError } from "@/lib/auth";

export async function getStatement(propertyId: string, period: string) {
  return run(async (): Promise<MonthlyStatement> => {
    const ctx = await requireActionContext();
    if (!isValidPeriod(period)) throw new ActionError("validation");
    const data = await loadOrgData(ctx);
    return monthlyStatement(data.idx, propertyId, period);
  });
}
