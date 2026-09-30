import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";

export const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--ff-arabic",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--ff-latin",
  display: "swap",
});
