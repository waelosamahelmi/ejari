"use client";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Multi-step flow with progress dots, back/next and save-draft (§9.3). */
export function Wizard({
  steps,
  current,
  onBack,
  onNext,
  onSaveDraft,
  nextLabel,
  nextDisabled,
  nextLoading,
  saving,
  children,
  hideFooter,
  className,
}: {
  steps: string[];
  current: number;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  saving?: boolean;
  children: ReactNode;
  hideFooter?: boolean;
  className?: string;
}) {
  const t = useTranslations("ui");
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-label-2 text-[13px]">{t("step", { n: current + 1, total: steps.length })}</div>
          <div className="text-[22px] font-semibold">{steps[current]}</div>
        </div>
        <ol className="flex items-center gap-1.5" aria-label={t("step", { n: current + 1, total: steps.length })}>
          {steps.map((s, i) => (
            <li key={s} aria-current={i === current ? "step" : undefined} title={s}>
              <motion.span
                layout
                className={cn("block h-2 rounded-full", i === current ? "bg-ink w-6" : i < current ? "bg-ink/60 w-2" : "bg-label-3 w-2")}
              />
            </li>
          ))}
        </ol>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      {!hideFooter && (
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="tinted" onClick={onBack} disabled={current === 0}>
            {t("wizard.back")}
          </Button>
          <div className="flex gap-2">
            {onSaveDraft && (
              <Button variant="secondary" onClick={onSaveDraft} loading={saving}>
                {t("wizard.saveDraft")}
              </Button>
            )}
            <Button onClick={onNext} disabled={nextDisabled} loading={nextLoading}>
              {nextLabel ?? (current === steps.length - 1 ? t("wizard.finish") : t("wizard.next"))}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
