import "server-only";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_ENV } from "@/lib/env";
import type { Database } from "./types";

/**
 * Service-role client. Server-only; bypasses RLS. Use only for trusted system
 * work (charge materialization, cron, notifications, invites) after checking
 * the caller's role.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient<Database>(PUBLIC_ENV.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
