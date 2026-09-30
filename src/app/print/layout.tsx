import type { ReactNode } from "react";
import { inter, plexArabic } from "@/lib/fonts";
import "../globals.css";
import "./print.css";

export const metadata = { robots: { index: false } };

/** Print routes: no app chrome, A4 pages; document language chosen per request (?lang=). */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${plexArabic.variable} ${inter.variable}`}
        style={{ fontFamily: "var(--ff-arabic), var(--ff-latin), sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
