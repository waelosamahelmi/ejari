"use client";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale } from "next-intl";
import { monthNameAr, monthNameEn, parsePeriod } from "@/domain/dates";

/** Stacked view: collected vs expected bars + occupancy line. Time flows toward the reading end (RTL: newest on the left). */
export default function TrendChart({
  data,
  labels,
  format,
}: {
  data: { period: string; expectedFils: number; collectedFils: number; occupancy: number }[];
  labels: { collected: string; expected: string; occupancy: string };
  format: (fils: number) => string;
}) {
  const locale = useLocale();
  const rtl = locale === "ar";
  const rows = data.map((d) => ({
    name: (rtl ? monthNameAr : monthNameEn)(parsePeriod(d.period).m).slice(0, rtl ? 5 : 3),
    expected: d.expectedFils / 1000,
    collected: d.collectedFils / 1000,
    occupancy: Math.round(d.occupancy * 100),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--separator)" />
        <XAxis dataKey="name" reversed={rtl} tickLine={false} axisLine={false} tick={{ fill: "var(--label-2)", fontSize: 11 }} />
        <YAxis yAxisId="kwd" orientation={rtl ? "right" : "left"} tickLine={false} axisLine={false} width={48} tick={{ fill: "var(--label-2)", fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} />
        <YAxis yAxisId="pct" orientation={rtl ? "left" : "right"} domain={[0, 100]} hide />
        <Tooltip
          cursor={{ fill: "color-mix(in srgb, var(--label) 5%, transparent)" }}
          contentStyle={{ background: "var(--bg-elevated)", border: "none", borderRadius: 14, boxShadow: "var(--sh-float)", direction: rtl ? "rtl" : "ltr" }}
          formatter={(value, name) => (name === labels.occupancy ? [`${String(value)}%`, String(name)] : [format(Math.round(Number(value) * 1000)), String(name)])}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "var(--label-2)" }} />
        <Bar yAxisId="kwd" dataKey="expected" name={labels.expected} fill="var(--bg-inset)" radius={[6, 6, 0, 0]} barSize={14} />
        <Bar yAxisId="kwd" dataKey="collected" name={labels.collected} fill="var(--brand-gulf)" radius={[6, 6, 0, 0]} barSize={14} />
        <Line yAxisId="pct" dataKey="occupancy" name={labels.occupancy} type="monotone" stroke="var(--brand-sand)" strokeWidth={2.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
