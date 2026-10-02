"use client";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  addPeriods,
  dayOfWeek,
  daysInMonth,
  formatDate,
  makeDate,
  makePeriod,
  monthNameAr,
  monthNameEn,
  parseDisplayDate,
  periodOf,
  todayKuwait,
  type ISODate,
} from "@/domain/dates";
import { inputBase } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const WEEK_AR = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];
const WEEK_EN = ["S", "M", "T", "W", "T", "F", "S"];

export function CalendarGrid({
  value,
  onSelect,
  month,
  onMonthChange,
  min,
  max,
}: {
  value: ISODate | null;
  onSelect: (d: ISODate) => void;
  month: string;
  onMonthChange: (p: string) => void;
  min?: ISODate;
  max?: ISODate;
}) {
  const locale = useLocale();
  const t = useTranslations("ui");
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = dayOfWeek(makeDate(y, m, 1));
  const total = daysInMonth(y, m);
  const today = todayKuwait();
  const cells: (number | null)[] = [
    ...Array.from({ length: first }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  return (
    <div className="w-[296px]">
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          aria-label={t("prevMonth")}
          className="hover:bg-inset flex size-9 items-center justify-center rounded-full"
          onClick={() => onMonthChange(addPeriods(month, -1))}
        >
          <ChevronRight className="size-5 ltr:rotate-180" />
        </button>
        <div className="text-[16px] font-semibold">
          {locale === "ar" ? monthNameAr(m) : monthNameEn(m)} <span className="num">{y}</span>
        </div>
        <button
          type="button"
          aria-label={t("nextMonth")}
          className="hover:bg-inset flex size-9 items-center justify-center rounded-full"
          onClick={() => onMonthChange(addPeriods(month, 1))}
        >
          <ChevronLeft className="size-5 ltr:rotate-180" />
        </button>
      </div>
      <div className="text-label-2 grid grid-cols-7 text-center text-[12px] font-medium">
        {(locale === "ar" ? WEEK_AR : WEEK_EN).map((d, i) => (
          <div key={i} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div role="grid" className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const iso = makeDate(y, m, d);
          const selected = iso === value;
          const disabled = (min && iso < min) || (max && iso > max);
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-selected={selected}
              disabled={!!disabled}
              onClick={() => onSelect(iso)}
              className={cn(
                "num mx-auto flex size-10 items-center justify-center rounded-full text-[15px] transition-colors disabled:opacity-25",
                selected ? "bg-ink text-on-ink font-semibold" : "hover:bg-inset",
                !selected && iso === today && "text-link font-semibold",
              )}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** dd/MM/yyyy date input with a calendar popover (Arabic month names). Value is ISO. */
export function DatePicker({
  value,
  onChange,
  id,
  invalid,
  min,
  max,
  className,
  placeholder = "dd/mm/yyyy",
}: {
  value: ISODate | null;
  onChange: (d: ISODate | null) => void;
  id?: string;
  invalid?: boolean;
  min?: ISODate;
  max?: ISODate;
  className?: string;
  placeholder?: string;
}) {
  const t = useTranslations("ui");
  const [text, setText] = useState(formatDate(value));
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(periodOf(value ?? todayKuwait()));
  useEffect(() => setText(formatDate(value)), [value]);
  useEffect(() => {
    if (open) setMonth(periodOf(value ?? todayKuwait()));
  }, [open, value]);
  const parsed = useMemo(() => parseDisplayDate(text), [text]);
  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        inputMode="numeric"
        placeholder={placeholder}
        aria-invalid={invalid || (text !== "" && !parsed) || undefined}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const p = parseDisplayDate(e.target.value);
          if (p) onChange(p);
          else if (e.target.value === "") onChange(null);
        }}
        onBlur={() => setText(formatDate(value))}
        className={cn(inputBase, "num h-[52px] pe-12 text-start")}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("openCalendar")}
            className="text-label-2 hover:text-label absolute end-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full"
          >
            <CalendarDays className="size-5" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end">
          <CalendarGrid
            value={value}
            month={month}
            onMonthChange={setMonth}
            min={min}
            max={max}
            onSelect={(d) => {
              onChange(d);
              setOpen(false);
            }}
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              className="text-link px-3 py-1.5 text-[14px] font-medium"
              onClick={() => {
                onChange(todayKuwait());
                setOpen(false);
              }}
            >
              {t("today")}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { makePeriod };
