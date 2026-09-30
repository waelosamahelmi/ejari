"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Check, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { SettingsShell } from "@/components/domain/settings/settings-shell";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GroupedSection, ListRow } from "@/components/ui/grouped-list";
import { Toggle } from "@/components/ui/toggle";
import { useAction } from "@/hooks/use-action";
import { saveOrgProfile, saveOrgSettings, uploadOrgLogo } from "@/server/actions/settings";
import { savePreferences } from "@/server/actions/preferences";
import { applyTheme } from "@/components/shell/theme";
import { cn } from "@/lib/utils";

const ACCENTS = [
  ["ink", "#0E0F12"],
  ["blue", "#007AFF"],
  ["indigo", "#5856D6"],
  ["teal", "#30B0C7"],
  ["green", "#34C759"],
  ["orange", "#FF9500"],
  ["pink", "#F0508C"],
] as const;

export function OrgForm(props: { title: string; name: string; nameEn: string | null; logoUrl: string | null; letterhead: boolean; poweredBy: boolean; accent: string }) {
  const t = useTranslations("settings.org");
  const tc = useTranslations("common.actions");
  const router = useRouter();
  const { exec, pending } = useAction();
  const [name, setName] = useState(props.name);
  const [nameEn, setNameEn] = useState(props.nameEn ?? "");
  const [accent, setAccent] = useState(props.accent);
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <SettingsShell title={props.title}>
      <Card className="space-y-4 p-5">
        <Field label={t("name")} htmlFor="o-name"><Input id="o-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t("nameEn")} htmlFor="o-en"><Input id="o-en" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></Field>
        <Button loading={pending} onClick={() => exec(() => saveOrgProfile({ name, nameEn: nameEn || null }), { success: t("saved"), onSuccess: () => router.refresh() })}>{tc("save")}</Button>
      </Card>
      <Card className="flex items-center gap-4 p-5">
        <div className="bg-inset grid size-20 place-items-center overflow-hidden rounded-[18px]">
          {props.logoUrl ? <Image src={props.logoUrl} alt="" width={80} height={80} unoptimized className="size-full object-contain" /> : <Image src="/brand/mark.svg" alt="" width={40} height={40} className="dark:invert" />}
        </div>
        <div className="flex-1">
          <div className="text-[16px] font-semibold">{t("logo")}</div>
          <Button variant="secondary" size="sm" className="mt-2" onClick={() => fileRef.current?.click()}><Upload />{t("uploadLogo")}</Button>
          <input ref={fileRef} type="file" hidden accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.set("file", f); await exec(() => uploadOrgLogo(fd), { success: t("saved"), onSuccess: () => router.refresh() }); }} />
        </div>
      </Card>
      <GroupedSection>
        <ListRow title={t("letterhead")} subtitle={t("letterheadHint")} trailing={<Toggle checked={props.letterhead} ariaLabel={t("letterhead")} onCheckedChange={(v) => exec(() => saveOrgSettings({ letterhead: v }), { onSuccess: () => router.refresh() })} />} />
        <ListRow title={t("poweredBy")} trailing={<Toggle checked={props.poweredBy} ariaLabel={t("poweredBy")} onCheckedChange={(v) => exec(() => saveOrgSettings({ poweredBy: v }), { onSuccess: () => router.refresh() })} />} />
      </GroupedSection>
      <GroupedSection header={t("accent")}>
        <div className="flex flex-wrap gap-3 p-4">
          {ACCENTS.map(([k, color]) => (
            <button
              key={k}
              type="button"
              aria-label={k}
              aria-pressed={accent === k}
              onClick={() => {
                setAccent(k);
                applyTheme((document.documentElement.dataset.theme as "light") ?? "system", k);
                void savePreferences({ accent: k as "ink" });
                void saveOrgSettings({ accent: k });
              }}
              className={cn("grid size-10 place-items-center rounded-full ring-offset-2 ring-offset-[var(--bg-elevated)]", accent === k && "ring-2 ring-[var(--label)]")}
              style={{ background: color }}
            >
              {accent === k && <Check className="size-5 text-white" />}
            </button>
          ))}
        </div>
      </GroupedSection>
    </SettingsShell>
  );
}
