"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { requireActionContext, ActionError } from "@/lib/auth";
import { run } from "@/server/action";
import { PUBLIC_ENV } from "@/lib/env";
import { notifyOrg } from "@/server/notify/events";

const reval = () => revalidatePath("/[locale]", "layout");

/** Invites (or links) an auth user by email; returns the user id. */
async function inviteAuthUser(email: string, locale: "ar" | "en", displayName: string) {
  const admin = supabaseAdmin();
  const redirectTo = `${PUBLIC_ENV.appUrl}/${locale}/auth/callback?next=${encodeURIComponent(`/${locale}/reset-password`)}`;
  const inv = await admin.auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name: displayName } });
  if (!inv.error && inv.data.user) return inv.data.user.id;
  // Already registered: find the user and send a magic link instead.
  for (let page = 1; page < 50; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const u = data.users.find((x) => x.email?.toLowerCase() === email);
    if (u) {
      await admin.auth.signInWithOtp({ email, options: { emailRedirectTo: `${PUBLIC_ENV.appUrl}/${locale}/auth/callback`, shouldCreateUser: false } }).catch(() => {});
      return u.id;
    }
    if (data.users.length < 200) break;
  }
  throw inv.error ?? new ActionError("generic");
}

export async function inviteUser(input: { email: string; role: "admin" | "accountant" | "collector" | "viewer"; displayName: string; locale: "ar" | "en" }) {
  return run(async () => {
    const ctx = await requireActionContext("manage_users");
    const d = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["admin", "accountant", "collector", "viewer"]), displayName: z.string().trim().min(1).max(80), locale: z.enum(["ar", "en"]) }).parse(input);
    const userId = await inviteAuthUser(d.email, d.locale, d.displayName);
    const db = await supabaseServer();
    const { error } = await db.from("org_members").upsert({ org_id: ctx.orgId, user_id: userId, role: d.role, display_name: d.displayName, email: d.email, active: true }, { onConflict: "org_id,user_id" });
    if (error) throw error;
    await supabaseAdmin().from("user_settings").upsert({ user_id: userId, org_id: ctx.orgId, locale: d.locale }, { onConflict: "user_id", ignoreDuplicates: true });
    reval();
  });
}

export async function setMember(id: string, patch: { role?: "admin" | "accountant" | "collector" | "viewer" | "owner"; active?: boolean }) {
  return run(async () => {
    const ctx = await requireActionContext("manage_users");
    const db = await supabaseServer();
    const { data: m } = await db.from("org_members").select("user_id").eq("id", id).single();
    if (m?.user_id === ctx.userId && (patch.active === false || (patch.role && patch.role !== "admin"))) throw new ActionError("forbidden");
    const { error } = await db.from("org_members").update(patch).eq("id", id);
    if (error) throw error;
    if (patch.role && m) await notifyOrg(ctx.orgId, ctx.userId, "test", { url: "/settings", userIds: [m.user_id], dedupeKey: `role:${id}:${Date.now()}` }).catch(() => {});
    reval();
  });
}

/** Invites an owner to the read-only portal and links owners.portal_user_id. */
export async function inviteOwnerToPortal(ownerId: string, locale: "ar" | "en") {
  return run(async () => {
    const ctx = await requireActionContext("manage_users");
    const db = await supabaseServer();
    const { data: o } = await db.from("owners").select("email, full_name").eq("id", ownerId).single();
    if (!o?.email) throw new ActionError("validation");
    const userId = await inviteAuthUser(o.email.toLowerCase(), locale, o.full_name);
    const up = await db.from("org_members").upsert({ org_id: ctx.orgId, user_id: userId, role: "owner", display_name: o.full_name, email: o.email, active: true }, { onConflict: "org_id,user_id" });
    if (up.error) throw up.error;
    const { error } = await db.from("owners").update({ portal_user_id: userId }).eq("id", ownerId);
    if (error) throw error;
    reval();
    return o.email;
  });
}
