import "server-only";
import { ZodError } from "zod";
import { ActionError } from "@/lib/auth";
import { AllocationError } from "@/domain/allocation";
import { ExpenseAllocationError } from "@/domain/expenses";

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

interface DbErrorLike {
  message?: string;
  code?: string;
  hint?: string | null;
  details?: string | null;
}

/** Maps Postgres / domain errors to stable, translatable codes (errors.<code>). */
export function errorCode(e: unknown): string {
  if (e instanceof ActionError) return e.code;
  if (e instanceof AllocationError) return e.code;
  if (e instanceof ExpenseAllocationError) return e.code;
  if (e instanceof ZodError) return "validation";
  const db = e as DbErrorLike;
  const msg = db?.message ?? "";
  if (db?.hint === "period_closed" || /period .* is closed/.test(msg)) return "period_closed";
  if (/contract_units_no_overlap|exclusion constraint/.test(msg) || db?.code === "23P01")
    return "overlap";
  if (db?.code === "23505") return "duplicate";
  if (db?.code === "23503") return "has_dependents";
  if (db?.code === "42501" || /row-level security/.test(msg)) return "forbidden";
  if (/fetch failed|network/i.test(msg)) return "network";
  return "generic";
}

export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of e.issues) fieldErrors[issue.path.join(".")] = issue.message;
      return { ok: false, error: "validation", fieldErrors };
    }
    const code = errorCode(e);
    if (code === "generic") console.error("[action]", e);
    return { ok: false, error: code };
  }
}

/** Throws the Supabase error (if any) so `run` maps it. */
export function must<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error;
  if (res.data === null || res.data === undefined) throw new ActionError("notFound");
  return res.data as NonNullable<T>;
}

export function check(res: { error: unknown }): void {
  if (res.error) throw res.error;
}
