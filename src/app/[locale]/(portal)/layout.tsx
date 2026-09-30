import type { ReactNode } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { pageLocale } from "@/lib/i18n";
import { SessionProvider } from "@/components/shell/prefs-context";
import { AccountMenu } from "@/components/shell/account-menu";
import { NotificationBell } from "@/components/shell/notification-center";
import { Link } from "@/i18n/navigation";
import { PwaProvider } from "@/components/pwa/pwa-provider";

/** Owner portal: simplified read-only shell (§10.12). */
export default async function PortalLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await pageLocale(params);
  const ctx = await getSessionContext();
  if (!ctx) redirect(`/${locale}/login`);
  if (ctx.role !== "owner") redirect(`/${locale}/dashboard`);
  return (
    <SessionProvider
      value={{
        userId: ctx.userId,
        displayName: ctx.displayName,
        email: ctx.email,
        role: ctx.role,
        orgId: ctx.orgId,
        orgName: ctx.orgName,
        orgNameEn: ctx.orgNameEn,
        digits: ctx.prefs.digits,
        density: ctx.prefs.density,
        theme: ctx.prefs.theme,
        accent: ctx.prefs.accent,
      }}
    >
      <header className="material-bar sticky top-0 z-30 pt-[var(--safe-top)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/owner" className="flex items-center gap-2">
            <Image
              src="/brand/app-icon.svg"
              alt=""
              width={32}
              height={32}
              className="rounded-[8px]"
            />
            <span className="text-[15px] font-semibold">
              {locale === "en" && ctx.orgNameEn ? ctx.orgNameEn : ctx.orgName}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <AccountMenu />
          </div>
        </div>
      </header>
      <PwaProvider offlineRoutes={["/owner"]}>
        <main id="main" className="mx-auto max-w-6xl overflow-x-clip px-4 pb-16">
          {children}
        </main>
      </PwaProvider>
    </SessionProvider>
  );
}
