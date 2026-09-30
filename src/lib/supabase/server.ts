import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { PUBLIC_ENV } from "@/lib/env";
import type { Database } from "./types";

/** Supabase client bound to the current user's session (RLS applies). */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient<Database>(PUBLIC_ENV.supabaseUrl, PUBLIC_ENV.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the middleware refreshes sessions instead.
        }
      },
    },
  });
}
