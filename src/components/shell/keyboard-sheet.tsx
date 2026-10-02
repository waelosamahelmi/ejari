"use client";
import { useTranslations } from "next-intl";
import { Sheet } from "@/components/ui/sheet";

export function KeyboardShortcutsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations("ui.shortcuts");
  const rows: [string[], string][] = [
    [["⌘", "K"], t("palette")],
    [["/"], t("search")],
    [["?"], t("help")],
    [["G", "D"], t("goDashboard")],
    [["G", "C"], t("goCollections")],
    [["N", "P"], t("newPayment")],
    [["N", "C"], t("newContract")],
    [["N", "V"], t("newVoucher")],
  ];
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("title")}>
      <ul className="bg-paper divide-separator divide-y-[0.5px] overflow-hidden rounded-[20px]">
        {rows.map(([keys, label]) => (
          <li key={label} className="flex h-12 items-center justify-between px-4 text-[15px]">
            <span>{label}</span>
            <span className="flex gap-1" dir="ltr">
              {keys.map((k) => (
                <kbd
                  key={k}
                  className="bg-inset num min-w-7 rounded-[8px] px-2 py-0.5 text-center text-[13px] font-semibold"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
