import type { PeriodStatus, UnitStatus } from "@/domain/types";

/** Status → colors (used by pills, heatmap, building stack). §9.3 mapping. */
export const PERIOD_STATUS_STYLE: Record<
  PeriodStatus,
  { bg: string; fg: string; dot: string; cell: string }
> = {
  paid: { bg: "bg-green/14", fg: "text-green-text", dot: "bg-green", cell: "bg-green" },
  partial: { bg: "bg-orange/16", fg: "text-orange-text", dot: "bg-orange", cell: "bg-orange" },
  unpaid: { bg: "bg-red/14", fg: "text-red-text", dot: "bg-red", cell: "bg-red" },
  due: {
    bg: "bg-transparent ring-1 ring-inset ring-label-3",
    fg: "text-label-2",
    dot: "bg-label-3",
    cell: "bg-transparent ring-1 ring-inset ring-label-3",
  },
  advance: { bg: "bg-indigo/14", fg: "text-indigo-text", dot: "bg-indigo", cell: "bg-indigo" },
  free: { bg: "bg-teal/16", fg: "text-teal-text", dot: "bg-teal", cell: "bg-teal" },
  vacant: { bg: "bg-gray/16", fg: "text-gray-text", dot: "bg-gray", cell: "bg-gray/35" },
  legal: {
    bg: "bg-red/14",
    fg: "text-red-text",
    dot: "bg-red",
    cell: "bg-red [background-image:repeating-linear-gradient(45deg,transparent_0_3px,rgba(255,255,255,.35)_3px_5px)]",
  },
};

export const UNIT_STATUS_STYLE: Record<
  UnitStatus,
  { bg: string; fg: string; tile: string; dot: string }
> = {
  occupied: {
    bg: "bg-green/14",
    fg: "text-green-text",
    tile: "bg-paper ring-1 ring-inset ring-green/40",
    dot: "bg-green",
  },
  vacant: {
    bg: "bg-gray/16",
    fg: "text-gray-text",
    tile: "bg-inset ring-1 ring-inset ring-dashed ring-label-3",
    dot: "bg-gray",
  },
  reserved: {
    bg: "bg-indigo/14",
    fg: "text-indigo-text",
    tile: "bg-paper ring-1 ring-inset ring-indigo/50",
    dot: "bg-indigo",
  },
  in_grace: {
    bg: "bg-teal/16",
    fg: "text-teal-text",
    tile: "bg-paper ring-1 ring-inset ring-teal/50",
    dot: "bg-teal",
  },
  notice: {
    bg: "bg-orange/16",
    fg: "text-orange-text",
    tile: "bg-paper ring-1 ring-inset ring-orange/50",
    dot: "bg-orange",
  },
  legal: {
    bg: "bg-red/14",
    fg: "text-red-text",
    tile: "bg-paper ring-1 ring-inset ring-red/50",
    dot: "bg-red",
  },
};
