"use client";
import { Check, Gavel, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn, firstName } from "@/lib/utils";
import { UNIT_STATUS_STYLE, PERIOD_STATUS_STYLE } from "@/lib/status";
import { useMoney } from "@/components/shell/prefs-context";
import type { PeriodStatus, UnitStatus } from "@/domain/types";

export interface StackTile {
  id: string;
  label: string;
  type: string;
  floor: number | null;
  sortOrder: number;
  status: UnitStatus;
  periodStatus: PeriodStatus;
  tenantName: string | null;
  rentFils: number;
  askingRentFils: number;
  underMaintenance: boolean;
}

function groupKey(u: StackTile): number {
  if (u.type === "roof") return 10_000;
  if (u.floor === null) return -10_000;
  return u.floor;
}

/**
 * Building Stack: floors as horizontal rows from roof to basement; each unit a
 * tile colored by status (label, tenant first name, rent). In `select` mode the
 * tiles toggle selection (contract wizard); occupied units are disabled.
 */
export function BuildingStack({
  units,
  mode = "link",
  selected,
  onToggle,
  isDisabled,
}: {
  units: StackTile[];
  mode?: "link" | "select";
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  isDisabled?: (u: StackTile) => string | null;
}) {
  const t = useTranslations("properties.stack");
  const tStatus = useTranslations("enums.unitStatus");
  const tPeriod = useTranslations("enums.periodStatus");
  const money = useMoney();
  const groups = new Map<number, StackTile[]>();
  for (const u of units) {
    const k = groupKey(u);
    groups.set(k, [...(groups.get(k) ?? []), u]);
  }
  const keys = [...groups.keys()].sort((a, b) => b - a);
  const floorLabel = (k: number) => (k === 10_000 ? t("roof") : k === -10_000 ? t("noFloor") : k === 0 ? t("ground") : k < 0 ? t("basement") : t("floor", { n: k }));

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {keys.map((k) => (
          <div key={k} className="flex items-stretch gap-3">
            <div className="text-label-2 flex w-16 shrink-0 items-center justify-end text-end text-[12px] font-medium sm:w-20">{floorLabel(k)}</div>
            <div className="bg-paper-2 flex flex-1 flex-wrap gap-2 rounded-[16px] p-2 ring-1 ring-separator">
              {groups
                .get(k)!
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((u) => {
                  const disabled = mode === "select" ? isDisabled?.(u) ?? null : null;
                  const isSel = selected?.has(u.id);
                  const style = UNIT_STATUS_STYLE[u.status];
                  const pay = PERIOD_STATUS_STYLE[u.periodStatus];
                  const content = (
                    <>
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-[14px] font-semibold">{u.label}</span>
                        {u.status === "legal" ? (
                          <Gavel className="text-red-text size-3.5 shrink-0" aria-hidden />
                        ) : u.underMaintenance ? (
                          <Wrench className="text-orange-text size-3.5 shrink-0" aria-hidden />
                        ) : isSel ? (
                          <Check className="size-4 shrink-0" aria-hidden />
                        ) : (
                          <span className={cn("size-2 shrink-0 rounded-full", u.status === "vacant" ? style.dot : pay.dot)} aria-hidden />
                        )}
                      </div>
                      <div className="text-label-2 truncate text-[12px]">{u.tenantName ? firstName(u.tenantName) : tStatus(u.status)}</div>
                      <div className="num text-label-2 truncate text-[12px]">{money(u.rentFils || u.askingRentFils, { showCurrency: false })}</div>
                    </>
                  );
                  const cls = cn(
                    "press flex h-[76px] w-[112px] flex-col justify-between rounded-[12px] p-2.5 text-start transition-shadow",
                    style.tile,
                    isSel && "bg-ink text-on-ink ring-ink [&_.text-label-2]:text-on-ink/70",
                    disabled && "cursor-not-allowed opacity-45",
                  );
                  const aria = `${u.label} — ${u.tenantName ?? tStatus(u.status)}${u.status !== "vacant" ? ` — ${tPeriod(u.periodStatus)}` : ""}${disabled ? ` — ${disabled}` : ""}`;
                  if (mode === "select")
                    return (
                      <button key={u.id} type="button" aria-pressed={isSel} aria-label={aria} title={disabled ?? undefined} disabled={!!disabled} onClick={() => onToggle?.(u.id)} className={cls}>
                        {content}
                      </button>
                    );
                  return (
                    <Link key={u.id} href={`/units/${u.id}`} aria-label={aria} className={cls}>
                      {content}
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 ps-[76px] sm:ps-[92px]" aria-label={t("legend")}>
        {(["occupied", "vacant", "reserved", "in_grace", "notice", "legal"] as const).map((s) => (
          <span key={s} className="text-label-2 flex items-center gap-1.5 text-[12px]">
            <span className={cn("size-2 rounded-full", UNIT_STATUS_STYLE[s].dot)} />
            {tStatus(s)}
          </span>
        ))}
        {(["paid", "partial", "unpaid"] as const).map((s) => (
          <span key={s} className="text-label-2 flex items-center gap-1.5 text-[12px]">
            <span className={cn("size-2 rounded-full", PERIOD_STATUS_STYLE[s].dot)} />
            {tPeriod(s)}
          </span>
        ))}
      </div>
    </div>
  );
}
