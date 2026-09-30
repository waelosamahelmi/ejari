import type { MetadataRoute } from "next";

/** Installable PWA manifest (§19.1). Arabic-first; shortcuts deep-link into the Arabic app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "إيجاري | Ejari",
    short_name: "إيجاري",
    description:
      "إدارة الإيجارات والتحصيل والتقارير لمكاتب العقار في الكويت — Rental management for Kuwaiti property offices.",
    lang: "ar",
    dir: "rtl",
    scope: "/",
    start_url: "/ar/dashboard?source=pwa",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#ECEEF2",
    theme_color: "#ECEEF2",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/monochrome-96.png", sizes: "96x96", type: "image/png", purpose: "monochrome" },
    ],
    shortcuts: [
      {
        name: "سجّل دفعة",
        short_name: "دفعة",
        description: "Record payment",
        url: "/ar/collections?pay=1&source=shortcut",
        icons: [{ src: "/icons/shortcut-payment.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "تحصيل هذا الشهر",
        short_name: "التحصيل",
        description: "This month's collections",
        url: "/ar/collections?source=shortcut",
        icons: [{ src: "/icons/shortcut-collections.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "سند صرف جديد",
        short_name: "سند صرف",
        description: "New voucher",
        url: "/ar/expenses/new?source=shortcut",
        icons: [{ src: "/icons/shortcut-voucher.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "الوحدات المتأخرة",
        short_name: "المتأخرات",
        description: "Late units",
        url: "/ar/reports/late?source=shortcut",
        icons: [{ src: "/icons/shortcut-late.png", sizes: "96x96", type: "image/png" }],
      },
    ],
    screenshots: [
      {
        src: "/screenshots/narrow-dashboard.png",
        sizes: "780x1688",
        type: "image/png",
        form_factor: "narrow",
        label: "لوحة التحكم",
      },
      {
        src: "/screenshots/narrow-collections.png",
        sizes: "780x1688",
        type: "image/png",
        form_factor: "narrow",
        label: "التحصيل الشهري",
      },
      {
        src: "/screenshots/narrow-property.png",
        sizes: "780x1688",
        type: "image/png",
        form_factor: "narrow",
        label: "العقار ومبنى الوحدات",
      },
      {
        src: "/screenshots/wide-dashboard.png",
        sizes: "2880x1800",
        type: "image/png",
        form_factor: "wide",
        label: "لوحة التحكم",
      },
      {
        src: "/screenshots/wide-collections.png",
        sizes: "2880x1800",
        type: "image/png",
        form_factor: "wide",
        label: "كشف التحصيل",
      },
    ],
    share_target: {
      action: "/share",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "files", accept: ["image/*", "application/pdf"] }],
      },
    },
  } as MetadataRoute.Manifest;
}
