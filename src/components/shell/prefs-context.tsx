"use client";
import { createContext, useContext, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { formatKWD } from "@/domain/money";
import type { Role } from "@/domain/types";

export interface ClientSession {
  userId: string;
  displayName: string;
  email: string;
  role: Role;
  orgId: string;
  orgName: string;
  orgNameEn: string | null;
  digits: "latn" | "arab";
  density: "comfortable" | "compact";
  theme: "light" | "dark" | "system";
  accent: string;
}

const Ctx = createContext<ClientSession | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: ClientSession;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): ClientSession {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside SessionProvider");
  return v;
}

export function useOptionalSession(): ClientSession | null {
  return useContext(Ctx);
}

/** Money formatter honoring locale + digit preference. */
export function useMoney() {
  const locale = useLocale() as "ar" | "en";
  const s = useOptionalSession();
  const digits = s?.digits ?? "latn";
  return (
    fils: number,
    opts: { showCurrency?: boolean; compact?: boolean; signed?: boolean } = {},
  ) =>
    formatKWD(fils, {
      locale,
      digits,
      showCurrency: opts.showCurrency ?? true,
      compact: opts.compact,
      signed: opts.signed,
    });
}

/** Number formatter (counts, percents) honoring digit preference. */
/** Joins names with the locale's list comma ("، " in Arabic, ", " in English). */
export function useJoin() {
  const locale = useLocale();
  return (items: readonly string[]) => items.filter(Boolean).join(locale === "ar" ? "، " : ", ");
}

/** Percent with the locale's sign (٪ in Arabic, % in English); `n` is already ×100. */
export function usePercent() {
  const locale = useLocale();
  const num = useNum();
  return (n: number, opts: Intl.NumberFormatOptions = {}) =>
    `${num(n, opts)}${locale === "ar" ? "٪" : "%"}`;
}

export function useNum() {
  const locale = useLocale();
  const s = useOptionalSession();
  const nu = s?.digits === "arab" ? "arab" : "latn";
  return (n: number, opts: Intl.NumberFormatOptions = {}) =>
    new Intl.NumberFormat(`${locale}-KW-u-nu-${nu}`, opts).format(n);
}
