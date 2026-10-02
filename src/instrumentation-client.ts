// Client-side Sentry, enabled only when NEXT_PUBLIC_SENTRY_DSN is set (loaded as a separate chunk).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  void import("@sentry/nextjs").then((Sentry) =>
    Sentry.init({ dsn, tracesSampleRate: 0.1, environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV }),
  );
}
