"use client";
import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { SettingsShell } from "@/components/domain/settings/settings-shell";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { savePreferences } from "@/server/actions/preferences";
import { applyTheme } from "@/components/shell/theme";

export function PreferencesForm({ title, prefs }: { title: string; prefs: { theme: "light" | "dark" | "system"; digits: "latn" | "arab"; density: "comfortable" | "compact" } }) {
  const t = useTranslations("settings.prefs");
  const tc = useTranslations("common.labels");
  const tui = useTranslations("ui");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [, start] = useTransition();
  const [p, setP] = useState(prefs);
  return (
    <SettingsShell title={title}>
      <Card className="space-y-5 p-5">
        <Field label={t("language")}>
          <SegmentedControl options={[{ value: "ar", label: tc("arabic") }, { value: "en", label: tc("english") }]} value={locale} onChange={(l) => start(async () => { await savePreferences({ locale: l as "ar" | "en" }); router.replace(pathname, { locale: l as "ar" | "en" }); })} />
        </Field>
        <Field label={t("theme")}>
          <SegmentedControl options={(["light", "dark", "system"] as const).map((x) => ({ value: x, label: tc(x) }))} value={p.theme} onChange={(x) => { setP({ ...p, theme: x }); applyTheme(x); start(async () => { await savePreferences({ theme: x }); }); }} />
        </Field>
        <Field label={t("digits")}>
          <SegmentedControl options={[{ value: "latn", label: t("latn") }, { value: "arab", label: t("arab") }]} value={p.digits} onChange={(x) => { setP({ ...p, digits: x as "latn" | "arab" }); start(async () => { await savePreferences({ digits: x as "latn" | "arab" }); router.refresh(); }); }} />
        </Field>
        <Field label={t("density")}>
          <SegmentedControl options={[{ value: "comfortable", label: tui("comfortable") }, { value: "compact", label: tui("compact") }]} value={p.density} onChange={(x) => { setP({ ...p, density: x as "comfortable" | "compact" }); start(async () => { await savePreferences({ density: x as "comfortable" | "compact" }); router.refresh(); }); }} />
        </Field>
      </Card>
    </SettingsShell>
  );
}
