import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";
import withBundleAnalyzerInit from "@next/bundle-analyzer";
import { execSync } from "node:child_process";

// `ANALYZE=true pnpm build` writes .next/analyze/{client,nodejs}.html (and .json with ANALYZE_JSON=true).
const withBundleAnalyzer = withBundleAnalyzerInit({
  enabled: process.env.ANALYZE === "true",
  analyzerMode: process.env.ANALYZE_JSON === "true" ? "json" : "static",
});

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const revision = (() => {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return String(Date.now());
  }
})();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  // Never hard-reload on reconnect (a collector may be mid-form); the app syncs the outbox instead.
  reloadOnOnline: false,
  cacheOnNavigation: false,
  disable: process.env.NODE_ENV !== "production",
  additionalPrecacheEntries: [
    { url: "/ar/offline", revision },
    { url: "/en/offline", revision },
    { url: "/brand/photos/hero-dusk-640.webp", revision },
    { url: "/brand/photos/building-1-640.webp", revision },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
    // Keep client-side router cache between navigations so moving back/forward is instant.
    staleTimes: { dynamic: 30, static: 300 },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "http", hostname: "127.0.0.1" }, { protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default withSerwist(withNextIntl(withBundleAnalyzer(nextConfig)));
