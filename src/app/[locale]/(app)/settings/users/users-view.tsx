"use client";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { SettingsShell } from "@/components/domain/settings/settings-shell";
import { GroupedSection } from "@/components/ui/grouped-list";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { Toggle } from "@/components/ui/toggle";
import { Pill } from "@/components/ui/chip";
import { useAction } from "@/hooks/use-action";
import { inviteUser, setMember } from "@/server/actions/users";
import { initials } from "@/lib/utils";
import type { Role } from "@/domain/types";

type StaffRole = "admin" | "accountant" | "collector" | "viewer";

export function UsersView({ title, rows, me }: { title: string; me: string; rows: { id: string; userId: string; role: Role; name: string; email: string; active: boolean }[] }) {
  const t = useTranslations("settings.users");
  const tRole = useTranslations("enums.role");
  const tc = useTranslations("common.actions");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const { exec, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("collector");
  return (
    <SettingsShell title={title}>
      <Button onClick={() => setOpen(true)}><UserPlus />{t("invite")}</Button>
      <GroupedSection>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
            <span className="bg-inset flex size-10 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold">{initials(r.name || r.email)}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium">{r.name} {r.userId === me && <Pill className="bg-inset text-label-2">{t("you")}</Pill>}</div>
              <div className="text-label-2 truncate text-[13px]" dir="ltr">{r.email}</div>
            </div>
            <Select aria-label={t("role")} className="h-10 w-36 text-[14px]" value={r.role} disabled={r.userId === me} onChange={(e) => exec(() => setMember(r.id, { role: e.target.value as Role }), { onSuccess: () => router.refresh() })}>
              {(["admin", "accountant", "collector", "viewer", "owner"] as const).map((x) => <option key={x} value={x}>{tRole(x)}</option>)}
            </Select>
            <Toggle checked={r.active} disabled={r.userId === me} ariaLabel={t("active")} onCheckedChange={(v) => exec(() => setMember(r.id, { active: v }), { onSuccess: () => router.refresh() })} />
          </div>
        ))}
      </GroupedSection>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t("invite")}
        footer={<Button block size="lg" loading={pending} disabled={!email || !name} onClick={() => exec(() => inviteUser({ email, role, displayName: name, locale }), { onSuccess: () => { toast.success(t("invited", { email })); setOpen(false); setEmail(""); setName(""); router.refresh(); } })}>{tc("confirm")}</Button>}
      >
        <div className="space-y-4">
          <Field label={t("email")} htmlFor="u-email"><Input id="u-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label={t("name")} htmlFor="u-name"><Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t("role")} hint={t(`roleHelp.${role}`)}>
            <SegmentedControl size="sm" options={(["admin", "accountant", "collector", "viewer"] as const).map((x) => ({ value: x, label: tRole(x) }))} value={role} onChange={setRole} />
          </Field>
        </div>
      </Sheet>
    </SettingsShell>
  );
}
