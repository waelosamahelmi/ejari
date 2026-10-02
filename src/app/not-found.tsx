import Link from "next/link";
import ar from "@/messages/ar/errors.json";
import en from "@/messages/en/errors.json";

/** Paths outside any locale (rare: middleware normally adds one). Bilingual and self-contained. */
export default function RootNotFound() {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#ECEEF2",
          color: "#0E0F12",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif",
          padding: 16,
          textAlign: "center",
        }}
      >
        <main>
          <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>{ar.page.notFoundTitle}</h1>
          <p lang="en" dir="ltr" style={{ color: "rgba(60,60,67,.6)", margin: "0 0 24px" }}>
            {en.page.notFoundTitle}
          </p>
          <Link
            href="/ar"
            style={{
              display: "inline-block",
              padding: "14px 28px",
              borderRadius: 9999,
              background: "#0E0F12",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            {ar.page.home} · {en.page.home}
          </Link>
        </main>
      </body>
    </html>
  );
}
