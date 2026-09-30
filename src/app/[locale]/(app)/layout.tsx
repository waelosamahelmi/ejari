import { pageLocale } from "@/lib/i18n";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageLocale(params);
  const ctx = await getSessionContext();
  if (!ctx) {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    redirect(`/${locale}/${data.user ? "no-org" : "login"}`);
  }
  if (ctx.role === "owner") redirect(`/${locale}/owner`);
  return (
    <AppShell
      session={{
        userId: ctx.userId,
        displayName: ctx.displayName,
        email: ctx.email,
        role: ctx.role,
        orgId: ctx.orgId,
        orgName: locale === "en" && ctx.orgNameEn ? ctx.orgNameEn : ctx.orgName,
        orgNameEn: ctx.orgNameEn,
        digits: ctx.prefs.digits,
        density: ctx.prefs.density,
        theme: ctx.prefs.theme,
        accent: ctx.prefs.accent,
      }}
    >
      {children}
    </AppShell>
  );
}
