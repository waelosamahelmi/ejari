"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { PUBLIC_ENV } from "@/lib/env";
import { run } from "@/server/action";
import { ActionError } from "@/lib/auth";

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
    const { data: m } = await supabase.from("org_members").select("role").eq("user_id", u.user!.id).eq("active", true).limit(1).maybeSingle();
    if (u.user) {
      const { data: s } = await supabase.from("user_settings").select("sessions_count").eq("user_id", u.user.id).maybeSingle();
      await supabase.from("user_settings").upsert({ user_id: u.user.id, sessions_count: (s?.sessions_count ?? 0) + 1 });
    }
    return { role: m?.role ?? null };
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
      options: { shouldCreateUser: false, emailRedirectTo: `${PUBLIC_ENV.appUrl}/${input.locale}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    // Don't reveal whether the email exists.
    if (error && error.status !== 400 && error.code !== "otp_disabled" && error.code !== "user_not_found") throw error;
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

export async function createOrganization(input: { name: string; nameEn?: string }) {
  return run(async () => {
    const d = z.object({ name: z.string().trim().min(2).max(120), nameEn: z.string().trim().max(120).optional() }).parse(input);
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc("create_org", { p_name: d.name, p_name_en: d.nameEn || undefined });
    if (error) throw error;
    const orgId = data as string;
    // Seed default expense categories for the new office.
    const cats: [string, string, "operating" | "payroll"][] = [
      ["راتب شهري", "Monthly salary", "payroll"],
      ["مصاريف صيانة", "Maintenance", "operating"],
      ["وقود وسيارات", "Fuel & vehicles", "operating"],
      ["كهرباء وماء", "Electricity & water", "operating"],
      ["نظافة", "Cleaning", "operating"],
      ["رسوم حكومية", "Government fees", "operating"],
      ["قرطاسية وتصوير", "Stationery & copies", "operating"],
      ["عمولات", "Commissions", "operating"],
      ["تأمين", "Insurance", "operating"],
      ["أخرى", "Other", "operating"],
    ];
    await supabase.from("expense_categories").insert(cats.map(([name_ar, name_en, type]) => ({ org_id: orgId, name_ar, name_en, type })));
    return orgId;
  });
}
