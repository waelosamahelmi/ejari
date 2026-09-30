"use client";
import { createBrowserClient } from "@supabase/ssr";
import { PUBLIC_ENV } from "@/lib/env";
import type { Database } from "./types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function supabaseBrowser() {
  client ??= createBrowserClient<Database>(PUBLIC_ENV.supabaseUrl, PUBLIC_ENV.supabaseAnonKey);
  return client;
}
