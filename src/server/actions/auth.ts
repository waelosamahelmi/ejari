"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { PUBLIC_ENV } from "@/lib/env";
import { run } from "@/server/action";
import { ActionError, DEFAULT_SETTINGS } from "@/lib/auth";
import { passwordProblem } from "@/domain/account";

// Simple fixed-window limiter (per IP + key). Supabase Auth also rate-limits server-side.
const hits = new Map<string, { n: number; at: number }>();
async function limit(key: string, max = 6, windowMs = 60_000) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const k = `${ip}:${key}`;
  const now = Date.now();
  const cur = hits.get(k);
  if (!cur || now - cur.at > windowMs) hits.set(k, { n: 1, at: now });
  else if (++cur.n > max) throw new ActionError("rate_limited");
}

const email = z.string().trim().toLowerCase().email();

export async function signInWithPassword(input: { email: string; password: string }) {
  return run(async () => {
    const data = z.object({ email, password: z.string().min(1) }).parse(input);
    await limit(`login:${data.email}`);
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword(data);
    if (error) throw new ActionError("invalid_credentials");
    const { data: u } = await supabase.auth.getUser();
    const { data: m } = await supabase
      .from("org_members")
      .select("role")
      .eq("user_id", u.user!.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (u.user) {
      const { data: s } = await supabase
        .from("user_settings")
        .select("sessions_count")
        .eq("user_id", u.user.id)
        .maybeSingle();
      await supabase
        .from("user_settings")
        .upsert({ user_id: u.user.id, sessions_count: (s?.sessions_count ?? 0) + 1 });
    }
    return { role: m?.role ?? null };
  });
}

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email,
  password: z.string().min(1),
  locale: z.enum(["ar", "en"]),
  terms: z.literal(true),
});

/**
 * Self-serve office registration. With email confirmations on, Supabase sends the branded
 * confirmation email and no session is returned; locally (confirmations off) the user is
 * signed in straight away and continues to the setup wizard.
 */
export async function signUp(input: z.input<typeof signupSchema>) {
  return run(async () => {
    const d = signupSchema.parse(input);
    const problem = passwordProblem(d.password);
    if (problem) throw new ActionError(problem === "short" ? "password_short" : "password_weak");
    await limit(`signup:${d.email}`, 5, 10 * 60_000);
    const supabase = await supabaseServer();
    const next = `/${d.locale}/setup`;
    const { data, error } = await supabase.auth.signUp({
      email: d.email,
      password: d.password,
      options: {
        data: { full_name: d.name },
        emailRedirectTo: `${PUBLIC_ENV.appUrl}/${d.locale}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      if (/already registered/i.test(error.message)) throw new ActionError("email_taken");
      throw error;
    }
    return { next: (data.session ? "setup" : "verify") as "setup" | "verify" };
  });
}

/** Re-sends the signup confirmation email (no-op when the address isn't awaiting confirmation). */
export async function resendConfirmation(input: { email: string; locale: "ar" | "en" }) {
  return run(async () => {
    const e = email.parse(input.email);
    await limit(`resend:${e}`, 3, 10 * 60_000);
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: e,
      options: {
        emailRedirectTo: `${PUBLIC_ENV.appUrl}/${input.locale}/auth/callback?next=${encodeURIComponent(`/${input.locale}/setup`)}`,
      },
    });
    if (error && error.code !== "user_not_found") throw error;
  });
}

export async function sendMagicLink(input: { email: string; locale: "ar" | "en"; next?: string }) {
  return run(async () => {
    const e = email.parse(input.email);
    await limit(`magic:${e}`, 3);
    const supabase = await supabaseServer();
    const next = input.next?.startsWith("/") ? input.next : `/${input.locale}/dashboard`;
    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${PUBLIC_ENV.appUrl}/${input.locale}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // Don't reveal whether the email exists.
    if (
      error &&
      error.status !== 400 &&
      error.code !== "otp_disabled" &&
      error.code !== "user_not_found"
    )
      throw error;
  });
}

export async function sendPasswordReset(input: { email: string; locale: "ar" | "en" }) {
  return run(async () => {
    const e = email.parse(input.email);
    await limit(`reset:${e}`, 3);
    const supabase = await supabaseServer();
    await supabase.auth.resetPasswordForEmail(e, {
      redirectTo: `${PUBLIC_ENV.appUrl}/${input.locale}/auth/callback?next=${encodeURIComponent(`/${input.locale}/reset-password`)}`,
    });
  });
}

export async function updatePassword(input: { password: string }) {
  return run(async () => {
    const { password } = z.object({ password: z.string().min(8) }).parse(input);
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  });
}

const setupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  nameEn: z.string().trim().max(120).optional(),
  prefs: z.object({
    locale: z.enum(["ar", "en"]),
    digits: z.enum(["latn", "arab"]),
    theme: z.enum(["light", "dark", "system"]),
    density: z.enum(["comfortable", "compact"]),
  }),
  firstProperty: z
    .object({
      name: z.string().trim().min(1).max(120),
      area: z.string().trim().max(80).optional(),
      block: z.string().trim().max(40).optional(),
      street: z.string().trim().max(80).optional(),
      count: z.number().int().min(1).max(200),
      askingRentFils: z.number().int().min(0).max(100_000_000_000),
    })
    .optional(),
});

const DEFAULT_CATEGORIES: [string, string, "operating" | "payroll" | "capital"][] = [
  ["راتب شهري", "Monthly salary", "payroll"],
  ["مصاريف صيانة", "Maintenance", "operating"],
  ["وقود وسيارات", "Fuel & vehicles", "operating"],
  ["كهرباء وماء", "Electricity & water", "operating"],
  ["نظافة", "Cleaning", "operating"],
  ["رسوم حكومية", "Government fees", "operating"],
  ["قرطاسية وتصوير", "Stationery & copies", "operating"],
  ["عمولات", "Commissions", "operating"],
  ["تأمين", "Insurance", "operating"],
  ["شراء", "Purchase", "capital"],
  ["أخرى", "Other", "operating"],
];

/**
 * First-run setup: creates the office for the signed-in user, makes them admin, applies
 * preferences and optionally creates a first property with numbered units.
 */
export async function completeSetup(input: z.input<typeof setupSchema>) {
  return run(async () => {
    const d = setupSchema.parse(input);
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ActionError("unauthenticated");
    const { data: existing } = await supabase
      .from("org_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (existing) throw new ActionError("already_setup");

    const { data, error } = await supabase.rpc("create_org", {
      p_name: d.name,
      p_name_en: d.nameEn || undefined,
    });
    if (error) throw error;
    const orgId = data as string;

    // Office defaults + the onboarding preferences.
    const { error: orgErr } = await supabase
      .from("orgs")
      .update({ settings: { ...DEFAULT_SETTINGS, digits: d.prefs.digits } })
      .eq("id", orgId);
    if (orgErr) throw orgErr;
    const { error: catErr } = await supabase
      .from("expense_categories")
      .insert(DEFAULT_CATEGORIES.map(([name_ar, name_en, type]) => ({ org_id: orgId, name_ar, name_en, type })));
    if (catErr) throw catErr;
    const { error: prefErr } = await supabase.from("user_settings").upsert({
      user_id: user.id,
      org_id: orgId,
      locale: d.prefs.locale,
      digits: d.prefs.digits,
      theme: d.prefs.theme,
      density: d.prefs.density,
      onboarding_done: true,
    });
    if (prefErr) throw prefErr;

    if (d.firstProperty) {
      const p = d.firstProperty;
      const { data: prop, error: propErr } = await supabase
        .from("properties")
        .insert({
          org_id: orgId,
          name: p.name,
          area: p.area || null,
          block: p.block || null,
          street: p.street || null,
          property_type: "residential",
        })
        .select("id")
        .single();
      if (propErr) throw propErr;
      const perFloor = 4;
      const rows = Array.from({ length: p.count }, (_, i) => ({
        org_id: orgId,
        property_id: prop.id,
        label: String(i + 1),
        sort_order: i + 1,
        type: "apartment" as const,
        floor: 1 + Math.floor(i / perFloor),
        asking_rent_fils: p.askingRentFils,
      }));
      const { error: unitErr } = await supabase.from("units").insert(rows);
      if (unitErr) throw unitErr;
    }
    return { orgId };
  });
}
