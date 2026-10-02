"use client";
import { Ellipsis } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { navFor, TAB_KEYS } from "./nav-config";
import type { Role } from "@/domain/types";

/**
 * Detached dark pill floating 12px above the safe area; active tab expands to
 * icon + label (§21.1.4). Content scrolls under it.
 */
export function FloatingTabBar({ role }: { role: Role }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = navFor(role).filter((n) => TAB_KEYS.includes(n.key));
  const inTabs = items.some((i) => pathname.startsWith(i.href));
  const tabs = [
    ...items.map((i) => ({ key: i.key, href: i.href, icon: i.icon, label: t(i.key) })),
    { key: "more", href: "/more", icon: Ellipsis, label: t("more") },
  ];
  return (
    <nav
      aria-label={t("more")}
      className="fixed inset-x-0 bottom-[calc(12px+var(--safe-bottom))] z-40 flex justify-center px-4 lg:hidden print:hidden"
    >
      <ul className="flex items-center gap-1 rounded-full bg-[var(--tabbar-bg)] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,.28)] backdrop-blur-xl">
        {tabs.map((tab) => {
          const active =
            tab.key === "more" ? !inTabs && pathname !== "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.key} className="relative">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                aria-label={tab.label}
                className={cn(
                  "relative flex h-12 items-center justify-center gap-2 rounded-full px-3.5 transition-[background-color,color] duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none",
                  active ? "bg-white text-[#0E0F12]" : "text-white/80 hover:text-white",
                )}
              >
                <Icon className="relative size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                {active && (
                  <span className="relative max-w-24 truncate text-[14px] font-semibold">
                    {tab.label}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
