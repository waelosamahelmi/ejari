"use client";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { IconTile } from "@/components/ui/icon-tile";
import { navFor } from "./nav-config";
import type { Role } from "@/domain/types";

/** Translucent desktop sidebar on the start edge, grouped sections, collapsible. */
export function Sidebar({ role, orgName }: { role: Role; orgName: string }) {
  const t = useTranslations("nav");
  const tApp = useTranslations("common.app");
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("ijari-sidebar") === "1");
    } catch {}
  }, []);
  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("ijari-sidebar", c ? "0" : "1");
      } catch {}
      return !c;
    });
  };
  const items = navFor(role);
  const sections = (["work", "finance", "records", "admin"] as const)
    .map((s) => ({ s, items: items.filter((i) => i.section === s) }))
    .filter((x) => x.items.length);
  return (
    <aside
      className={cn(
        "material-sidebar border-separator sticky top-0 hidden h-dvh shrink-0 flex-col border-e-[0.5px] transition-[width] duration-300 lg:flex print:hidden",
        collapsed ? "w-[76px]" : "w-[264px]",
      )}
    >
      <div
        className={cn("flex h-16 items-center gap-2.5 px-4", collapsed && "justify-center px-0")}
      >
        <Image
          src="/brand/app-icon.svg"
          alt=""
          width={34}
          height={34}
          className="rounded-[9px]"
          priority
        />
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[16px] leading-5 font-semibold">{tApp("name")}</div>
            <div className="text-label-2 truncate text-[12px] leading-4">{orgName}</div>
          </div>
        )}
      </div>
      <nav
        className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4"
        aria-label={t("sections.work")}
      >
        {sections.map(({ s, items }) => (
          <div key={s} className="mt-4 first:mt-1">
            {!collapsed && (
              <div className="text-label-2 px-3 pb-1.5 text-[12px] font-medium">
                {t(`sections.${s}`)}
              </div>
            )}
            <ul className="space-y-0.5">
              {items.map((n) => {
                const active = pathname.startsWith(n.href);
                const Icon = n.icon;
                return (
                  <li key={n.key}>
                    <Link
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? t(n.key) : undefined}
                      className={cn(
                        "flex h-10 items-center gap-3 rounded-[12px] px-2 text-[15px] transition-colors",
                        active
                          ? "bg-paper text-label font-semibold shadow-[0_1px_3px_rgba(16,24,40,.08)]"
                          : "text-label hover:bg-[color-mix(in_srgb,var(--label)_6%,transparent)]",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <IconTile tone={n.tone} size="sm">
                        <Icon />
                      </IconTile>
                      {!collapsed && <span className="truncate">{t(n.key)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-separator border-t-[0.5px] p-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? t("expand") : t("collapse")}
          className="text-label-2 hover:text-label hover:bg-inset flex h-10 w-full items-center justify-center rounded-[12px]"
        >
          {collapsed ? (
            <PanelLeftOpen className="flip-rtl size-5" />
          ) : (
            <PanelLeftClose className="flip-rtl size-5" />
          )}
        </button>
      </div>
    </aside>
  );
}
