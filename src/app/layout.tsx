import type { ReactNode } from "react";
import "./globals.css";

/** Root layout is a pass-through: `[locale]` and `print` each render their own <html>. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
