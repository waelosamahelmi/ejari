/** Single source of truth for product identity. */
export const APP = {
  nameAr: "إيجاري",
  nameEn: "Ijari",
  fullName: "إيجاري | Ijari",
  taglineAr: "كل باب… في مكانه.",
  taglineEn: "Every door, accounted for.",
  timeZone: "Asia/Kuwait",
  currency: "KWD",
  locales: ["ar", "en"] as const,
  defaultLocale: "ar" as const,
  colors: {
    ink: "#0E0F12",
    mist: "#ECEEF2",
    mistDark: "#0B0B0D",
    sand: "#C9A66B",
    gulf: "#2F5BFF",
    rose: "#F0508C",
  },
} as const;

export type Locale = (typeof APP.locales)[number];
