import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://ejarikw.com";

/** Only the public marketing/legal surfaces are indexable; the app itself is not. */
export default function robots(): MetadataRoute.Robots {
  const publicPaths = ["/welcome", "/login", "/signup", "/privacy", "/terms"];
  const allow = ["ar", "en"].flatMap((l) => publicPaths.map((p) => `/${l}${p}`));
  return {
    rules: [{ userAgent: "*", allow, disallow: "/" }],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
