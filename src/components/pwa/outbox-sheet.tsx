"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog } from "@/components/ui/dialog";
import { Pill } from "@/components/ui/chip";
import { useMoney } from "@/components/shell/prefs-context";
import { discardOutboxItem, retryOutboxItem } from "@/lib/offline/outbox-client";
import type { OutboxItem } from "@/lib/offline/db";
import { formatDate } from "@/domain/dates";

/** Offline payments waiting to sync + the "Needs review" list with fix / discard (§19.3). */
export function OutboxSheet({
  open,
  onOpenChange,
  items,
  online,
  onSync,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: OutboxItem[];
  online: boolean;
  onSync: () => Promise<void>;
}) {
  const t = useTranslations("pwa.outbox");
  const tc = useTranslations("common.actions");
  const tErr = useTranslations("errors") as unknown as {
    (k: string): string;
    has(k: string): boolean;
  };
  const money = useMoney();
  const [busy, setBusy] = useState(false);
  const [receipts, setReceipts] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<string | null>(null);

  const syncNow = async () => {
    setBusy(true);
    try {
      await onSync();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        title={t("title")}
        footer={
          <Button
            size="lg"
            block
            disabled={!online || items.every((i) => i.status === "review")}
            loading={busy}
            onClick={syncNow}
          >
            <RefreshCw />
            {t("syncNow")}
          </Button>
        }
      >
        {items.length === 0 ? (
          <p className="text-label-2 py-8 text-center text-[15px]">{t("empty")}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.clientId} className="bg-paper rounded-[20px] p-4 shadow-[var(--sh-card)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[16px] font-semibold">{i.meta.tenantName}</div>
                    <div className="text-label-2 truncate text-[13px]">
                      {i.meta.propertyName} · <bdi>{i.meta.unitLabels}</bdi> ·{" "}
                      <span className="num">{formatDate(i.input.receivedAt)}</span>
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="num text-[16px] font-semibold">{money(i.input.amountFils)}</div>
                    <Pill
                      className={
                        i.status === "review"
                          ? "bg-orange/14 text-orange-text"
                          : "bg-inset text-label-2"
                      }
                    >
                      {t(i.status)}
                    </Pill>
                  </div>
                </div>
                {i.status === "review" && (
                  <div className="mt-3 space-y-3">
                    {i.error && (
                      <p className="text-orange-text text-[14px]">
                        {tErr.has(i.error) ? tErr(i.error) : tErr("generic")}
                      </p>
                    )}
                    <Input
                      aria-label={t("receiptNo")}
                      placeholder={t("receiptNo")}
                      inputMode="numeric"
                      className="num"
                      value={receipts[i.clientId] ?? i.input.receiptNo ?? ""}
                      onChange={(e) => setReceipts((r) => ({ ...r, [i.clientId]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={async () => {
                          await retryOutboxItem(
                            i.clientId,
                            receipts[i.clientId] !== undefined
                              ? { receiptNo: receipts[i.clientId] }
                              : undefined,
                          );
                          if (online) await syncNow();
                        }}
                      >
                        {t("retry")}
                      </Button>
                      <Button
                        className="flex-1"
                        variant="secondary"
                        onClick={() => setConfirm(i.clientId)}
                      >
                        <span className="text-red-text">{t("discard")}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t("discard")}
        description={t("discardConfirm")}
        destructive
        confirmLabel={t("discard")}
        cancelLabel={tc("cancel")}
        onConfirm={async () => {
          if (confirm) await discardOutboxItem(confirm);
          setConfirm(null);
        }}
      />
    </>
  );
}
