"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sidebar } from "./sidebar";
import { FloatingTabBar } from "./floating-tab-bar";
import dynamic from "next/dynamic";
import { useGlobalShortcuts } from "./keyboard";
import { SessionProvider, type ClientSession } from "./prefs-context";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { PullToRefresh } from "./pull-to-refresh";
import { AccountMenu } from "./account-menu";
import { NotificationBell } from "./notification-center";
import { LaunchAnimation } from "./launch-animation";

// Loaded on first use: cmdk and the shortcuts sheet stay out of every page's initial JS.
const CommandPalette = dynamic(() => import("./command-palette").then((m) => m.CommandPalette), {
  ssr: false,
});
const KeyboardShortcutsSheet = dynamic(
  () => import("./keyboard-sheet").then((m) => m.KeyboardShortcutsSheet),
  { ssr: false },
);

const ShellCtx = createContext<{ openPalette: () => void } | null>(null);

export function useShell() {
  return useContext(ShellCtx);
}

/** Authenticated shell: translucent sidebar (desktop), floating tab bar (mobile), palette, shortcuts. */
export function AppShell({
  session,
  children,
  banner,
}: {
  session: ClientSession;
  children: ReactNode;
  banner?: ReactNode;
}) {
  const t = useTranslations("common.a11y");
  const [palette, setPalette] = useState(false);
  const openPalette = useCallback(() => setPalette(true), []);
  const { help, setHelp } = useGlobalShortcuts(openPalette);
  const [paletteUsed, setPaletteUsed] = useState(false);
  const [helpUsed, setHelpUsed] = useState(false);
  if (palette && !paletteUsed) setPaletteUsed(true);
  if (help && !helpUsed) setHelpUsed(true);
  return (
    <SessionProvider value={session}>
      <PwaProvider>
        <ShellCtx.Provider value={{ openPalette }}>
          <a
            href="#main"
            className="bg-ink text-on-ink sr-only z-[100] rounded-full px-4 py-2 focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
          >
            {t("skipToContent")}
          </a>
          <div className="flex min-h-dvh">
            <Sidebar role={session.role} orgName={session.orgName} />
            <div className="min-w-0 flex-1">
              {banner}
              <PullToRefresh>
                <main
                  id="main"
                  className="mx-auto w-full max-w-[1440px] overflow-x-clip px-4 pb-[calc(120px+var(--safe-bottom))] lg:px-8 lg:pb-12"
                >
                  {children}
                </main>
              </PullToRefresh>
            </div>
          </div>
          <FloatingTabBar role={session.role} />
          <LaunchAnimation />
          {paletteUsed && <CommandPalette open={palette} onOpenChange={setPalette} />}
          {helpUsed && <KeyboardShortcutsSheet open={help} onOpenChange={setHelp} />}
        </ShellCtx.Provider>
      </PwaProvider>
    </SessionProvider>
  );
}

/** Search trigger + bell + account, shown at the trailing edge of every page header. */
export function HeaderUtilities() {
  const shell = useShell();
  const t = useTranslations("nav");
  if (!shell) return null;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={shell.openPalette}
        aria-label={t("search")}
        className="bg-paper text-label-2 press hidden h-10 items-center gap-2 rounded-full ps-3 pe-2 text-[14px] shadow-[0_1px_3px_rgba(16,24,40,.08)] md:flex"
      >
        <Search className="size-[18px]" />
        <span className="max-w-40 truncate">{t("search")}</span>
        <kbd className="bg-inset num rounded-[6px] px-1.5 text-[11px]" dir="ltr">
          ⌘K
        </kbd>
      </button>
      <button
        type="button"
        onClick={shell.openPalette}
        aria-label={t("search")}
        className="bg-paper text-label press flex size-10 items-center justify-center rounded-full shadow-[0_1px_3px_rgba(16,24,40,.08)] md:hidden"
      >
        <Search className="size-5" />
      </button>
      <NotificationBell />
      <AccountMenu />
    </div>
  );
}
