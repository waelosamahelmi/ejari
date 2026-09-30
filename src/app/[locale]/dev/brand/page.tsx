/* Brand reference page (§18.6). Public: documents the identity for designers and partners. */
import Image from "next/image";
import { pageLocale, type LocaleParams } from "@/lib/i18n";
import * as Illustrations from "@/components/illustrations";
import { PHOTOS } from "@/config/generated-assets";

export const metadata = { title: "Brand" };

const PALETTE = [
  {
    name: "Ink",
    token: "--brand-ink",
    light: "#0E0F12",
    dark: "#F5F5F7",
    on: "#FFFFFF",
    use: "Primary actions",
  },
  {
    name: "Paper",
    token: "--brand-paper",
    light: "#FFFFFF",
    dark: "#1C1C1E",
    on: "#0E0F12",
    use: "Cards, sheets",
  },
  {
    name: "Mist",
    token: "--brand-mist",
    light: "#ECEEF2",
    dark: "#0B0B0D",
    on: "#0E0F12",
    use: "App background",
  },
  {
    name: "Sand",
    token: "--brand-sand",
    light: "#C9A66B",
    dark: "#D9B77C",
    on: "#0E0F12",
    use: "Premium highlight ≤ 5 %",
  },
  {
    name: "Gulf",
    token: "--brand-gulf",
    light: "#2F5BFF",
    dark: "#5B7FFF",
    on: "#FFFFFF",
    use: "Links, focus, chart 1",
  },
  {
    name: "Rose",
    token: "--brand-rose",
    light: "#F0508C",
    dark: "#FF6FA3",
    on: "#FFFFFF",
    use: "One emphasis per screen",
  },
];

function lum(hex: string) {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m) as [number, number];
  return ((x + 0.05) / (y + 0.05)).toFixed(2);
}

export default async function BrandPage({ params }: LocaleParams) {
  await pageLocale(params);
  return (
    <main className="bg-bg mx-auto max-w-6xl space-y-14 px-5 py-12">
      <header className="space-y-4">
        <Image
          src="/brand/lockup-bilingual.svg"
          alt="إيجاري | Ejari"
          width={220}
          height={220}
          className="h-40 w-auto dark:invert"
          priority
        />
        <h1 className="text-[40px] leading-tight font-normal">
          كل باب… <strong className="font-semibold">في مكانه</strong> · Every door,{" "}
          <strong className="font-semibold">accounted for</strong>
        </h1>
      </header>
      <section className="space-y-4">
        <h2 className="text-[22px] font-semibold">Logos</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "mark.svg",
            "lockup-ar.svg",
            "lockup-en.svg",
            "lockup-bilingual.svg",
            "wordmark-ar.svg",
            "wordmark-en.svg",
            "app-icon.svg",
            "app-icon-maskable.svg",
          ].map((f) => (
            <figure key={f} className="card grid aspect-[4/3] place-items-center p-6">
              <Image
                src={`/brand/${f}`}
                alt={f}
                width={200}
                height={120}
                className="max-h-24 w-auto"
              />
              <figcaption className="text-label-2 text-[12px]">{f}</figcaption>
            </figure>
          ))}
          <figure className="grid aspect-[4/3] place-items-center rounded-[28px] bg-[#0E0F12] p-6">
            <Image
              src="/brand/lockup-bilingual-white.svg"
              alt="white"
              width={140}
              height={140}
              className="max-h-24 w-auto"
            />
          </figure>
        </div>
      </section>
      <section className="space-y-4">
        <h2 className="text-[22px] font-semibold">Palette & contrast</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PALETTE.map((p) => (
            <div key={p.name} className="card overflow-hidden">
              <div className="grid grid-cols-2">
                <div
                  className="h-24 p-3 text-[13px] font-semibold"
                  style={{ background: p.light, color: p.on }}
                >
                  {p.light}
                </div>
                <div
                  className="h-24 p-3 text-[13px] font-semibold"
                  style={{
                    background: p.dark,
                    color: p.name === "Ink" || p.name === "Sand" ? "#0E0F12" : "#fff",
                  }}
                >
                  {p.dark}
                </div>
              </div>
              <div className="p-4 text-[14px]">
                <div className="font-semibold">
                  {p.name} <code className="text-label-2 text-[12px]">{p.token}</code>
                </div>
                <div className="text-label-2">{p.use}</div>
                <div className="num mt-1 text-[13px]">
                  vs white {contrast(p.light, "#FFFFFF")}:1 · vs ink {contrast(p.light, "#0E0F12")}
                  :1
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-[22px] font-semibold">Type scale</h2>
        <div className="card space-y-2 p-6">
          <p className="text-[34px] font-bold">Large Title — إدارة عقاراتك</p>
          <p className="text-[28px] font-semibold">Title 1 — الكشف الشهري</p>
          <p className="text-[22px] font-semibold">Title 2 — المتأخرات</p>
          <p className="text-[20px] font-semibold">Title 3 — الوحدات الخالية</p>
          <p className="text-[17px] font-semibold">Headline — سجّل دفعة</p>
          <p className="text-[17px]">Body — كل وحدة ومستأجر وعقد في دفتر واحد.</p>
          <p className="text-[13px]">Footnote — آخر تحديث قبل دقيقتين</p>
          <p className="num text-[44px] font-semibold">
            8,890.000 <span className="text-label-2 text-[15px]">د.ك</span>
          </p>
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-[22px] font-semibold">Illustrations</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {Object.entries(Illustrations).map(([n, C]) => (
            <div key={n} className="card p-5">
              <C />
              <p className="text-label-2 mt-2 truncate text-[11px]">{n}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-[22px] font-semibold">Photography</h2>
        <p className="text-label-2 max-w-2xl text-[15px]">
          Modern Gulf residential architecture, golden hour or dusk, calm skies, no people, no
          brands. Always scrim text on photos. Photos lead on places (properties, units, onboarding)
          — never on ledgers.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(PHOTOS).map(([n, p]) => (
            <div key={n} className="relative aspect-[4/5] overflow-hidden rounded-[20px]">
              <Image
                src={p.src}
                alt={n}
                fill
                sizes="25vw"
                placeholder="blur"
                blurDataURL={p.blur}
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-[22px] font-semibold">Voice</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card space-y-2 p-6 text-[16px]" dir="rtl">
            <p>٧٠٫٠٠٠ د.ك متأخرات على وحدتين</p>
            <p>لا توجد وحدات متأخرة هذا الشهر. عمل رائع.</p>
            <p>سجّل دفعة · اطبع الكشف</p>
          </div>
          <div className="card space-y-2 p-6 text-[16px]" dir="ltr">
            <p>70.000 KWD overdue across 2 units</p>
            <p>No late units this month. Nicely done.</p>
            <p>Record payment · Print statement</p>
          </div>
        </div>
      </section>
    </main>
  );
}
