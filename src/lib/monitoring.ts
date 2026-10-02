/**
 * Error reporting (§2): Sentry is loaded lazily and only when a DSN is configured,
 * so it never costs bundle size or network in installs that don't use it.
 */
export function reportError(error: unknown) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  void import("@sentry/nextjs").then((S) => S.captureException(error)).catch(() => {});
}
