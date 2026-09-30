export const WIDGETS = [
  "today",
  "collection",
  "arrears",
  "occupancy",
  "vacant",
  "cash",
  "trend",
  "heatmap",
  "expiring",
  "first",
  "expenses",
  "legal",
  "quick",
] as const;
export type WidgetKey = (typeof WIDGETS)[number];
export interface Layout {
  order: WidgetKey[];
  hidden: WidgetKey[];
}
