"use client";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLocale } from "next-intl";
import { monthNameAr, monthNameEn, parsePeriod } from "@/domain/dates";

/** Stacked bars (collected vs arrears) with an occupancy line (§6.10.5). */
export default function AccountingChart({ data, labels, format }: { data: { period: string; collected: number; arrears: number; occupancy: number }[]; labels: { collected: string; arrears: string; occupancy: string }; format: (f: number) => string }) {
  const locale = useLocale();
  const rtl = locale === "ar";
  const rows = data.map((d) => ({ name: (rtl ? monthNameAr : monthNameEn)(parsePeriod(d.period).m).slice(0, rtl ? 5 : 3), collected: d.collected / 1000, arrears: d.arrears / 1000, occupancy: Math.round(d.occupancy * 100) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--separator)" />
        <XAxis dataKey="name" reversed={rtl} tickLine={false} axisLine={false} tick={{ fill: "var(--label-2)", fontSize: 11 }} />
        <YAxis yAxisId="kwd" orientation={rtl ? "right" : "left"} tickLine={false} axisLine={false} width={48} tick={{ fill: "var(--label-2)", fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}K` : String(v))} />
        <YAxis yAxisId="pct" orientation={rtl ? "left" : "right"} domain={[0, 100]} hide />
        <Tooltip
          contentStyle={{ background: "var(--bg-elevated)", border: "none", borderRadius: 14, boxShadow: "var(--sh-float)", direction: rtl ? "rtl" : "ltr" }}
          formatter={(value, name) => (name === labels.occupancy ? [`${String(value)}%`, String(name)] : [format(Math.round(Number(value) * 1000)), String(name)])}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="kwd" dataKey="collected" stackId="a" name={labels.collected} fill="var(--brand-gulf)" barSize={18} />
        <Bar yAxisId="kwd" dataKey="arrears" stackId="a" name={labels.arrears} fill="var(--red)" radius={[6, 6, 0, 0]} barSize={18} />
        <Line yAxisId="pct" dataKey="occupancy" name={labels.occupancy} type="monotone" stroke="var(--brand-sand)" strokeWidth={2.5} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
