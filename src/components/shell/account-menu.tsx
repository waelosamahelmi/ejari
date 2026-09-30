"use client";
import { useTransition } from "react";
import { Globe, LogOut, Moon, Settings, Sun, SunMoon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { savePreferences, signOut } from "@/server/actions/preferences";
import { initials } from "@/lib/utils";
import { useSession } from "./prefs-context";
import { applyTheme } from "./theme";
import { clearClientData } from "@/lib/offline/clear";

export function AccountMenu() {
  const s = useSession();
  const t = useTranslations("common");
  const tRole = useTranslations("enums.role");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [, start] = useTransition();

  const switchLocale = () => {
    const next = locale === "ar" ? "en" : "ar";
    start(async () => {
      await savePreferences({ locale: next });
      router.replace(pathname, { locale: next });
      router.refresh();
    });
  };
  const setTheme = (theme: "light" | "dark" | "system") => {
    applyTheme(theme);
    start(async () => {
      await savePreferences({ theme });
    });
  };
  const doSignOut = () =>
    start(async () => {
      await clearClientData();
      await signOut();
      window.location.href = `/${locale}/login`;
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("a11y.account")}
        className="bg-ink text-on-ink press flex size-10 items-center justify-center rounded-full text-[14px] font-semibold"
      >
        {initials(s.displayName)}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="px-3 pt-2 pb-1">
          <div className="truncate text-[15px] font-semibold">{s.displayName}</div>
          <div className="text-label-2 truncate text-[13px]">
            {tRole(s.role)} · {s.orgName}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Globe />} onSelect={switchLocale}>
          {locale === "ar" ? t("labels.english") : t("labels.arabic")}
        </DropdownMenuItem>
        <DropdownMenuLabel>{t("labels.appearance")}</DropdownMenuLabel>
        <DropdownMenuItem icon={<Sun />} onSelect={() => setTheme("light")}>
          {t("labels.light")}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<Moon />} onSelect={() => setTheme("dark")}>
          {t("labels.dark")}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<SunMoon />} onSelect={() => setTheme("system")}>
          {t("labels.system")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Settings />} onSelect={() => router.push("/settings")}>
          {tNav("settings")}
        </DropdownMenuItem>
        <DropdownMenuItem icon={<LogOut />} destructive onSelect={doSignOut}>
          {t("actions.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
