"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Command } from "cmdk";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Building2,
  CalendarDays,
  DoorOpen,
  FilePlus2,
  FileSignature,
  HandCoins,
  LayoutGrid,
  Receipt,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { searchEverything, type SearchHit } from "@/server/actions/search";
import { addPeriods, formatPeriod, periodOf, todayKuwait } from "@/domain/dates";
import { useLocale } from "next-intl";
import { useSession } from "./prefs-context";
import { can } from "@/lib/permissions";

const KIND_ICON = {
  tenant: Users,
  unit: DoorOpen,
  contract: FileSignature,
  receipt: Receipt,
  voucher: Wallet,
  property: Building2,
} as const;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("ui.palette");
  const tNav = useTranslations("nav");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const session = useSession();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, start] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    const id = ++seq.current;
    if (q.trim().length < 1) {
      setHits([]);
      return;
    }
    const h = setTimeout(() => {
      start(async () => {
        const r = await searchEverything(q).catch(() => []);
        if (id === seq.current) setHits(r);
      });
    }, 160);
    return () => clearTimeout(h);
  }, [q]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };
  const lastMonth = addPeriods(periodOf(todayKuwait()), -1);
  const groups = (["property", "tenant", "unit", "contract", "receipt", "voucher"] as const)
    .map((k) => ({ k, items: hits.filter((h) => h.kind === k) }))
    .filter((g) => g.items.length);
  const groupLabel = {
    property: tNav("properties"),
    tenant: t("tenants"),
    unit: t("units"),
    contract: t("contracts"),
    receipt: t("receipts"),
    voucher: t("vouchers"),
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-[70] bg-black/25" />
        <DialogPrimitive.Content className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed inset-x-3 top-[max(12px,10vh)] z-[70] mx-auto max-w-[640px] outline-none">
          <DialogPrimitive.Title className="sr-only">{t("placeholder")}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t("placeholder")}
          </DialogPrimitive.Description>
          <Command
            shouldFilter={false}
            loop
            className="material-sidebar overflow-hidden rounded-[24px] shadow-[var(--sh-pop)] ring-1 ring-black/5 dark:ring-white/10"
          >
            <div className="border-separator flex items-center gap-3 border-b-[0.5px] px-5">
              <Search className="text-label-2 size-5 shrink-0" aria-hidden />
              <Command.Input
                value={q}
                onValueChange={setQ}
                placeholder={t("placeholder")}
                className="placeholder:text-label-2 h-14 w-full bg-transparent text-[17px] outline-none"
              />
            </div>
            <Command.List className="max-h-[min(60vh,480px)] overflow-y-auto p-2">
              <Command.Empty className="text-label-2 py-8 text-center text-[15px]">
                {pending ? t("searching") : t("empty")}
              </Command.Empty>
              {q.trim() === "" && (
                <>
                  <Command.Group
                    heading={t("actions")}
                    className="[&_[cmdk-group-heading]]:text-label-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px]"
                  >
                    {can(session.role, "record_payment") && (
                      <Item icon={HandCoins} onSelect={() => go("/collections?pay=1")}>
                        {t("recordPayment")}
                      </Item>
                    )}
                    {can(session.role, "manage_contracts") && (
                      <Item icon={FilePlus2} onSelect={() => go("/contracts/new")}>
                        {t("newContract")}
                      </Item>
                    )}
                    {can(session.role, "manage_expenses") && (
                      <Item icon={Wallet} onSelect={() => go("/expenses/new")}>
                        {t("newVoucher")}
                      </Item>
                    )}
                    <Item
                      icon={CalendarDays}
                      onSelect={() => go(`/collections?period=${lastMonth}`)}
                    >
                      {t("statement", { month: formatPeriod(lastMonth, locale) })}
                    </Item>
                  </Command.Group>
                  <Command.Group
                    heading={t("navigate")}
                    className="[&_[cmdk-group-heading]]:text-label-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px]"
                  >
                    <Item icon={LayoutGrid} onSelect={() => go("/dashboard")}>
                      {tNav("dashboard")}
                    </Item>
                    <Item icon={HandCoins} onSelect={() => go("/collections")}>
                      {tNav("collections")}
                    </Item>
                    <Item icon={Building2} onSelect={() => go("/properties")}>
                      {tNav("properties")}
                    </Item>
                    <Item icon={Users} onSelect={() => go("/tenants")}>
                      {tNav("tenants")}
                    </Item>
                    <Item icon={FileSignature} onSelect={() => go("/contracts")}>
                      {tNav("contracts")}
                    </Item>
                  </Command.Group>
                </>
              )}
              {groups.map((g) => (
                <Command.Group
                  key={g.k}
                  heading={groupLabel[g.k]}
                  className="[&_[cmdk-group-heading]]:text-label-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[12px]"
                >
                  {g.items.map((h) => (
                    <Item
                      key={h.kind + h.id}
                      icon={KIND_ICON[h.kind]}
                      onSelect={() => go(h.href)}
                      subtitle={h.subtitle}
                    >
                      {h.title}
                    </Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Item({
  icon: Icon,
  children,
  subtitle,
  onSelect,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  subtitle?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="data-[selected=true]:bg-ink data-[selected=true]:text-on-ink [&[data-selected=true]_.sub]:text-on-ink/70 flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2 text-[15px]"
    >
      <Icon className="size-[18px] shrink-0 opacity-80" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {subtitle && (
        <span className="sub text-label-2 max-w-[45%] truncate text-[13px]">{subtitle}</span>
      )}
    </Command.Item>
  );
}
