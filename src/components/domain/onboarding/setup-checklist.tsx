"use client";
import { useEffect, useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronLeft, Download, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { checklistProgress, type ChecklistItem } from "@/domain/account";
import { dismissChecklist } from "@/server/actions/preferences";
import { cn } from "@/lib/utils";

/** Live activation checklist (§ launch readiness): every row deep-links to the exact flow. */
export function SetupChecklist({
  items,
  onStartTour,
}: {
  items: ChecklistItem[];
  onStartTour: () => void;
}) {
  const t = useTranslations("dashboard.checklist");
  const [hidden, setHidden] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [, start] = useTransition();
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
  }, []);
  if (hidden) return null;

  const main = items.filter((i) => i.key !== "tour");
  const tour = items.find((i) => i.key === "tour");
  const done = main.filter((i) => i.done).length;
  const progress = checklistProgress(items);

  const dismiss = () => {
    setHidden(true);
    start(async () => {
      await dismissChecklist();
    });
  };

  const rowInner = (label: string, isDone: boolean) => (
    <>
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          isDone ? "bg-green text-white" : "bg-inset text-label-3",
        )}
      >
        {isDone ? <Check className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
      </span>
      <span className={cn("flex-1 text-[15px]", isDone && "text-label-2 line-through")}>{label}</span>
      {!isDone && <ChevronLeft className="text-label-3 size-4 ltr:rotate-180" />}
    </>
  );

  return (
    <Card className="mt-5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold">{t("title")}</h2>
          <p className="text-label-2 mt-0.5 text-[13px]">
            {t("progress", { done, total: main.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("dismiss")}
          className="text-label-3 hover:text-label -me-1 flex size-9 shrink-0 items-center justify-center rounded-full"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="bg-inset mt-3 h-1.5 overflow-hidden rounded-full">
        <div
          className="bg-green h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <ul className="mt-3 divide-y-[0.5px] divide-[var(--separator)]">
        {main.map((i) =>
          i.done ? (
            <li key={i.key} className="flex min-h-11 items-center gap-3 py-2">
              {rowInner(t(i.key), true)}
            </li>
          ) : (
            <li key={i.key}>
              <Link href={i.href} className="flex min-h-11 items-center gap-3 py-2">
                {rowInner(t(i.key), false)}
              </Link>
            </li>
          ),
        )}
        {tour && (
          <li>
            <button
              type="button"
              onClick={onStartTour}
              className="flex min-h-11 w-full items-center gap-3 py-2 text-start"
            >
              {rowInner(t("tour"), false)}
            </button>
          </li>
        )}
        {!installed && (
          <li>
            <Link href="/settings/install" className="flex min-h-11 items-center gap-3 py-2">
              <span className="bg-inset text-label-3 flex size-6 shrink-0 items-center justify-center rounded-full">
                <Download className="size-3.5" />
              </span>
              <span className="flex-1 text-[15px]">{t("install")}</span>
              <ChevronLeft className="text-label-3 size-4 ltr:rotate-180" />
            </Link>
          </li>
        )}
      </ul>
    </Card>
  );
}

/** Welcome hero for an office that has not created a property yet. */
export function NewOrgHero({ onStartTour }: { onStartTour: () => void }) {
  const t = useTranslations("dashboard.checklist.newOrg");
  return (
    <Card className="mt-5 overflow-hidden p-0">
      <div className="relative p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:url(/brand/arch-pattern.svg)] [background-size:48px_56px] opacity-[0.05] dark:invert"
        />
        <div className="relative">
          <h2 className="text-[22px] leading-tight font-semibold">{t("title")}</h2>
          <p className="text-label-2 mt-1.5 max-w-[46ch] text-[15px] leading-6">{t("text")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="lg">
              <Link href="/properties?new=1">
                {t("cta")}
                <ArrowLeft className="size-5 ltr:rotate-180" />
              </Link>
            </Button>
            <Button variant="secondary" size="lg" onClick={onStartTour}>
              {t("secondary")}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
