"use client";
import { useEffect } from "react";
import ar from "@/messages/ar/errors.json";
import en from "@/messages/en/errors.json";
import common from "@/messages/ar/common.json";
import commonEn from "@/messages/en/common.json";
import { reportError } from "@/lib/monitoring";

/** Last-resort boundary (root layout failed): bilingual, self-contained, no providers. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => reportError(error), [error]);
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
        }}
      >
        <main
          style={{
            background: "#fff",
            borderRadius: 28,
            padding: 32,
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 12px 32px rgba(16,24,40,.06)",
          }}
        >
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>{ar.page.title}</h1>
          <p style={{ color: "rgba(60,60,67,.6)", margin: "0 0 20px", lineHeight: 1.7 }}>
            {ar.page.subtitle}
          </p>
          <p dir="ltr" lang="en" style={{ color: "rgba(60,60,67,.6)", margin: "0 0 24px" }}>
            <strong style={{ color: "#0E0F12" }}>{en.page.title}.</strong> {en.page.subtitle}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              height: 52,
              width: "100%",
              border: 0,
              borderRadius: 9999,
              background: "#0E0F12",
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {common.actions.retry} · {commonEn.actions.retry}
          </button>
        </main>
      </body>
    </html>
  );
}
