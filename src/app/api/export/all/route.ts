import { NextResponse, type NextRequest } from "next/server";
import { getSessionContext } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { supabaseServer } from "@/lib/supabase/server";
import { fetchAll } from "@/server/db";
import { buildWorkbook, xlsxResponse, type SheetSpec } from "@/lib/export/excel";

const TABLES = [
  "owners", "properties", "property_owners", "units", "tenants", "contracts", "contract_units", "contract_rent_revisions", "charges", "payments", "payment_allocations",
  "adjustments", "expense_categories", "beneficiaries", "expense_vouchers", "expense_lines", "expense_allocations", "recurring_expenses", "deposits", "deposit_properties",
  "legal_cases", "legal_case_events", "reminders_log", "monthly_closings",
] as const;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Full data export (RLS-scoped): Excel with one sheet per table, or one concatenated CSV with a table column. */
export async function GET(req: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!can(ctx.role, "view_reports")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const db = await supabaseServer();
  const data: Record<string, Record<string, unknown>[]> = {};
  for (const tbl of TABLES) data[tbl] = await fetchAll((f, t) => db.from(tbl).select("*").range(f, t) as unknown as PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>);
  const stamp = new Date().toISOString().slice(0, 10);
  if (req.nextUrl.searchParams.get("format") === "csv") {
    const lines: string[] = ["table,row_json"];
    for (const [tbl, rows] of Object.entries(data)) for (const r of rows) lines.push(`${tbl},${csvEscape(r)}`);
    return new Response("﻿" + lines.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="ejari-export-${stamp}.csv"` } });
  }
  const sheets: SheetSpec[] = Object.entries(data).map(([tbl, rows]) => {
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    return {
      name: tbl,
      rtl: false,
      columns: keys.map((k) => ({ header: k, key: k, width: 18, type: k.endsWith("_fils") ? ("int" as const) : ("text" as const) })),
      rows: rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v !== null && typeof v === "object" ? JSON.stringify(v) : v]))),
    };
  });
  return xlsxResponse(await buildWorkbook(sheets, { creator: "Ejari" }), `ejari-export-${stamp}.xlsx`);
}
