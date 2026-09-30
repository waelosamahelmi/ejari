"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActionContext } from "@/lib/auth";
import { run } from "@/server/action";

const ONE_YEAR = 60 * 60 * 24 * 365;

const prefSchema = z.object({
  locale: z.enum(["ar", "en"]).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  accent: z.enum(["ink", "blue", "indigo", "teal", "green", "orange", "pink"]).optional(),
  digits: z.enum(["latn", "arab"]).optional(),
  density: z.enum(["comfortable", "compact"]).optional(),
  dashboard_layout: z.any().optional(),
  quiet_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quiet_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  digest_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  muted_property_ids: z.array(z.string().uuid()).optional(),
  install_prompt_dismissed_at: z.string().optional(),
  onboarding_done: z.boolean().optional(),
});

/** Saves user preferences (cookie for instant SSR + user_settings row). */
export async function savePreferences(input: z.input<typeof prefSchema>) {
  return run(async () => {
    const data = prefSchema.parse(input);
    const store = await cookies();
    if (data.locale) store.set("NEXT_LOCALE", data.locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    if (data.theme) store.set("ijari-theme", data.theme, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    if (data.accent) store.set("ijari-accent", data.accent, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    if (data.digits) store.set("ijari-digits", data.digits, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    if (data.density) store.set("ijari-density", data.density, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
    const ctx = await requireActionContext().catch(() => null);
    if (!ctx) return;
    const supabase = await supabaseServer();
    const { error } = await supabase.from("user_settings").upsert({ user_id: ctx.userId, org_id: ctx.orgId, ...data });
    if (error) throw error;
  });
}

export async function markOnboarded() {
  (await cookies()).set("ijari-onboarded", "1", { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
}
