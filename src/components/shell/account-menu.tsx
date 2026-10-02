"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { initials } from "@/lib/utils";
import { useSession } from "./prefs-context";

const AccountMenuImpl = dynamic(
  () => import("./account-menu-impl").then((m) => m.AccountMenuImpl),
  {
    ssr: false,
    loading: () => <AvatarButton />,
  },
);

function AvatarButton({ onActivate }: { onActivate?: () => void }) {
  const s = useSession();
  const t = useTranslations("common.a11y");
  return (
    <button
      type="button"
      aria-label={`${initials(s.displayName)} — ${t("account")}`}
      aria-haspopup="menu"
      onClick={onActivate}
      onPointerEnter={onActivate ? () => void import("./account-menu-impl") : undefined}
      className="bg-ink text-on-ink press flex size-10 items-center justify-center rounded-full text-[14px] font-semibold"
    >
      {initials(s.displayName)}
    </button>
  );
}

/** Account menu: the avatar renders immediately; the dropdown (Radix + popper) loads on first use. */
export function AccountMenu() {
  const [active, setActive] = useState(false);
  return active ? (
    <AccountMenuImpl defaultOpen />
  ) : (
    <AvatarButton onActivate={() => setActive(true)} />
  );
}
