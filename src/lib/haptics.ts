/** Light haptic tap (Android; iOS Safari ignores the Vibration API). Skipped under reduced motion. */
export function haptic(pattern: number | number[] = 10) {
  if (typeof navigator === "undefined" || typeof window === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported
  }
}
