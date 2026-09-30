import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "إيجاري | Ejari";

/** Satori has no bidi support: lay Arabic words out right-to-left manually. */
function Words({ text, rtl, style }: { text: string; rtl: boolean; style: Record<string, string | number> }) {
  return (
    <div style={{ display: "flex", flexDirection: rtl ? "row-reverse" : "row", justifyContent: rtl ? "flex-start" : "flex-start", gap: "0.16em", ...style }}>
      {text.split(" ").map((w, i) => (
        <span key={i}>{w}</span>
      ))}
    </div>
  );
}

export default async function OgImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const ar = locale !== "en";
  const [semi, regular, mark] = await Promise.all([
    readFile(path.join(process.cwd(), "src/assets/fonts/IBMPlexSansArabic-SemiBold.ttf")),
    readFile(path.join(process.cwd(), "src/assets/fonts/IBMPlexSansArabic-Regular.ttf")),
    readFile(path.join(process.cwd(), "public/brand/mark-white.svg"), "utf8"),
  ]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(180deg, #1A1F2B 0%, #241C24 100%)",
          color: "white",
          fontFamily: "Plex",
          alignItems: ar ? "flex-end" : "flex-start",
        }}
      >
        <div style={{ display: "flex", flexDirection: ar ? "row-reverse" : "row", alignItems: "center", gap: 20 }}>
          <img src={`data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`} width={88} height={88} alt="" />
          <div style={{ fontSize: 56, fontWeight: 600 }}>{ar ? "إيجاري" : "Ejari"}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: ar ? "flex-end" : "flex-start" }}>
          <div style={{ fontSize: 76, lineHeight: 1.1, display: "flex", flexDirection: ar ? "row-reverse" : "row", gap: 22 }}>
            <Words rtl={ar} text={ar ? "كل باب…" : "Every door,"} style={{ fontWeight: 400 }} />
            <Words rtl={ar} text={ar ? "في مكانه" : "accounted for"} style={{ fontWeight: 600 }} />
          </div>
          <Words rtl={ar} text={ar ? "إدارة الإيجارات للمكاتب العقارية في الكويت" : "Rental management for Kuwaiti property offices"} style={{ fontSize: 32, opacity: 0.75 }} />
        </div>
        <div style={{ height: 6, width: 160, background: "#C9A66B", borderRadius: 3 }} />
      </div>
    ),
    { ...size, fonts: [{ name: "Plex", data: regular, weight: 400 }, { name: "Plex", data: semi, weight: 600 }] },
  );
}
