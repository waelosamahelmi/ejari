"use client";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { SettingsShell } from "@/components/domain/settings/settings-shell";
import { GroupedSection } from "@/components/ui/grouped-list";
import { Button } from "@/components/ui/button";
import { AlertDialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { Toggle } from "@/components/ui/toggle";
import { Pill } from "@/components/ui/chip";
import { useAction } from "@/hooks/use-action";
import { inviteUser, setMember, setMemberAccess, removeMember } from "@/server/actions/users";
import { initials } from "@/lib/utils";
import type { Role } from "@/domain/types";

type StaffRole = "admin" | "accountant" | "collector" | "viewer";

export function UsersView({
  title,
  rows,
  me,
  properties,
}: {
  title: string;
  me: string;
  properties: { id: string; name: string }[];
  rows: {
    propertyIds: string[] | null;
    id: string;
    userId: string;
    role: Role;
    name: string;
    email: string;
    active: boolean;
  }[];
}) {
  const t = useTranslations("settings.users");
  const tRole = useTranslations("enums.role");
  const tc = useTranslations("common.actions");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const { exec, pending } = useAction();
  const [accessMember, setAccessMember] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [propertyIds, setPropertyIds] = useState<string[] | null>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("collector");
  return (
    <SettingsShell title={title}>
      <div className="bg-inset mb-5 rounded-2xl p-4 text-sm">
        <p className="font-semibold">{t("accessHelpTitle")}</p>
        <ol className="mt-2 list-decimal space-y-1 ps-5">
          <li>{t("accessHelpInvite")}</li>
          <li>{t("accessHelpEmail")}</li>
          <li>{t("accessHelpLogin")}</li>
        </ol>
      </div>
      <Button
        onClick={() => {
          setPropertyIds([]);
          setOpen(true);
        }}
      >
        <UserPlus />
        {t("invite")}
      </Button>
      <GroupedSection>
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="bg-inset flex size-10 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold">
              {initials(r.name || r.email)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium">
                {r.name}{" "}
                {r.userId === me && <Pill className="bg-inset text-label-2">{t("you")}</Pill>}
              </div>
              <div className="text-label-2 truncate text-[13px]" dir="ltr">
                {r.email}
              </div>
            </div>
            <Select
              aria-label={t("role")}
              className="h-10 w-36 text-[14px]"
              value={r.role}
              disabled={r.userId === me}
              onChange={(e) =>
                exec(() => setMember(r.id, { role: e.target.value as Role }), {
                  onSuccess: () => router.refresh(),
                })
              }
            >
              {(["admin", "accountant", "collector", "viewer", "owner"] as const).map((x) => (
                <option key={x} value={x}>
                  {tRole(x)}
                </option>
              ))}
            </Select>
            {r.userId !== me && r.role !== "owner" && r.role !== "admin" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setAccessMember(r.id);
                  setPropertyIds(r.propertyIds);
                }}
              >
                {t("properties")}
              </Button>
            )}
            {r.userId !== me && (
              <Button variant="plain" size="sm" onClick={() => setRemoveId(r.id)}>
                {t("remove")}
              </Button>
            )}
            <Toggle
              checked={r.active}
              disabled={r.userId === me}
              ariaLabel={t("active")}
              onCheckedChange={(v) =>
                exec(() => setMember(r.id, { active: v }), { onSuccess: () => router.refresh() })
              }
            />
          </div>
        ))}
      </GroupedSection>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t("invite")}
        footer={
          <Button
            block
            size="lg"
            loading={pending}
            disabled={!email || !name}
            onClick={() =>
              exec(
                () =>
                  inviteUser({
                    email,
                    role,
                    displayName: name,
                    locale,
                    propertyIds: role === "admin" ? null : propertyIds,
                  }),
                {
                  onSuccess: () => {
                    toast.success(t("invited", { email }));
                    setOpen(false);
                    setEmail("");
                    setName("");
                    router.refresh();
                  },
                },
              )
            }
          >
            {tc("confirm")}
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label={t("email")} htmlFor="u-email">
            <Input
              id="u-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label={t("name")} htmlFor="u-name">
            <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          {role !== "admin" && (
            <PropertyAccess properties={properties} value={propertyIds} onChange={setPropertyIds} />
          )}
          <Field label={t("role")} hint={t(`roleHelp.${role}`)}>
            <SegmentedControl
              size="sm"
              options={(["admin", "accountant", "collector", "viewer"] as const).map((x) => ({
                value: x,
                label: tRole(x),
              }))}
              value={role}
              onChange={setRole}
            />
          </Field>
        </div>
      </Sheet>
      <Sheet
        open={!!accessMember}
        onOpenChange={(o) => !o && setAccessMember(null)}
        title={t("properties")}
        footer={
          <Button
            block
            loading={pending}
            onClick={() =>
              accessMember &&
              exec(() => setMemberAccess(accessMember, propertyIds), {
                onSuccess: () => {
                  setAccessMember(null);
                  router.refresh();
                },
              })
            }
          >
            {tc("save")}
          </Button>
        }
      >
        <PropertyAccess properties={properties} value={propertyIds} onChange={setPropertyIds} />
      </Sheet>
      <AlertDialog
        open={!!removeId}
        onOpenChange={(o) => !o && setRemoveId(null)}
        title={t("remove")}
        description={t("removeHelp")}
        confirmLabel={tc("confirm")}
        cancelLabel={tc("cancel")}
        destructive
        loading={pending}
        onConfirm={() =>
          removeId &&
          exec(() => removeMember(removeId), {
            onSuccess: () => {
              setRemoveId(null);
              router.refresh();
            },
          })
        }
      />
    </SettingsShell>
  );
}

function PropertyAccess({
  properties,
  value,
  onChange,
}: {
  properties: { id: string; name: string }[];
  value: string[] | null;
  onChange: (v: string[] | null) => void;
}) {
  const t = useTranslations("settings.users");
  return (
    <fieldset className="space-y-3">
      <legend className="font-semibold">{t("properties")}</legend>
      <p className="text-label-2 text-sm">{t("scopeHelp")}</p>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={value === null}
          onChange={(e) => onChange(e.target.checked ? null : [])}
        />
        {t("allProperties")}
      </label>
      {value !== null &&
        properties.map((p) => (
          <label key={p.id} className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={value.includes(p.id)}
              onChange={(e) =>
                onChange(e.target.checked ? [...value, p.id] : value.filter((id) => id !== p.id))
              }
            />
            {p.name}
          </label>
        ))}
    </fieldset>
  );
}
