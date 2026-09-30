"use client";
import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)", true);
export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
export const useIsStandalone = () => useMediaQuery("(display-mode: standalone)");
