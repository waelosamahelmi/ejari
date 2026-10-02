import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://ejarikw.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths: { path: string; priority: number }[] = [
    { path: "/welcome", priority: 1 },
    { path: "/signup", priority: 0.8 },
    { path: "/login", priority: 0.5 },
    { path: "/privacy", priority: 0.4 },
    { path: "/terms", priority: 0.4 },
  ];
  const now = new Date();
  return ["ar", "en"].flatMap((locale) =>
    paths.map((p) => ({
      url: `${BASE}/${locale}${p.path}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: p.priority,
    })),
  );
}
