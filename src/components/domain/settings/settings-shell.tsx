"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LargeTitleHeader } from "@/components/shell/large-title-header";

export function SettingsShell({
  title,
  children,
  wide,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useTranslations("settings");
  return (
    <>
      <LargeTitleHeader title={title} back={{ href: "/settings", label: t("title") }} />
      <div className={wide ? "space-y-6" : "max-w-2xl space-y-6"}>{children}</div>
    </>
  );
}
