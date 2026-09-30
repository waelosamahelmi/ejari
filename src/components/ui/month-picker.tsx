"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  addPeriods,
  formatPeriod,
  makePeriod,
  monthNameAr,
  monthNameEn,
  parsePeriod,
  type Period,
} from "@/domain/dates";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/** YYYY-MM picker with prev/next arrows and a month grid popover. */
export function MonthPicker({
  value,
  onChange,
  className,
  max,
}: {
  value: Period;
  onChange: (p: Period) => void;
  className?: string;
  max?: Period;
}) {
  const locale = useLocale() as "ar" | "en";
  const t = useTranslations("ui");
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(parsePeriod(value).y);
  const nextDisabled = !!max && addPeriods(value, 1) > max;
  return (
    <div
      className={cn(
        "bg-paper ring-separator inline-flex h-11 items-center rounded-full p-1 shadow-[0_1px_2px_rgba(16,24,40,.05)] ring-1",
        className,
      )}
    >
      <button
        type="button"
        aria-label={t("prevMonth")}
        onClick={() => onChange(addPeriods(value, -1))}
        className="hover:bg-inset flex size-9 items-center justify-center rounded-full"
      >
        <ChevronRight className="size-5 ltr:rotate-180" />
      </button>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setYear(parsePeriod(value).y);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className="hover:bg-inset h-9 min-w-32 rounded-full px-3 text-[15px] font-semibold"
            aria-label={t("chooseMonth")}
          >
            {formatPeriod(value, locale)}
          </button>
        </PopoverTrigger>
        <PopoverContent align="center" className="w-[300px]">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label={t("prevYear")}
              onClick={() => setYear((y) => y - 1)}
              className="hover:bg-inset flex size-9 items-center justify-center rounded-full"
            >
              <ChevronRight className="size-5 ltr:rotate-180" />
            </button>
            <span className="num text-[16px] font-semibold">{year}</span>
            <button
              type="button"
              aria-label={t("nextYear")}
              onClick={() => setYear((y) => y + 1)}
              className="hover:bg-inset flex size-9 items-center justify-center rounded-full"
            >
              <ChevronLeft className="size-5 ltr:rotate-180" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {Array.from({ length: 12 }, (_, i) => {
              const p = makePeriod(year, i + 1);
              const active = p === value;
              const disabled = !!max && p > max;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                  className={cn(
                    "h-10 rounded-full text-[14px] font-medium disabled:opacity-30",
                    active ? "bg-ink text-on-ink" : "hover:bg-inset",
                  )}
                >
                  {locale === "ar" ? monthNameAr(i + 1) : monthNameEn(i + 1).slice(0, 3)}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        aria-label={t("nextMonth")}
        disabled={nextDisabled}
        onClick={() => onChange(addPeriods(value, 1))}
        className="hover:bg-inset flex size-9 items-center justify-center rounded-full disabled:opacity-30"
      >
        <ChevronLeft className="size-5 ltr:rotate-180" />
      </button>
    </div>
  );
}
