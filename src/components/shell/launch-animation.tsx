"use client";
import { useEffect, useState } from "react";

const ARCH = "M14 50V24a18 18 0 0 1 36 0v26";

/**
 * ≤ 700 ms launch (§18.6): arch stroke draws in, fills, wordmark fades up, cross-fade
 * to the app. Once per session, skipped under reduced motion. Pure CSS keyframes
 * (defined in globals.css) so the shell doesn't pay for the animation library.
 */
export function LaunchAnimation() {
  const [phase, setPhase] = useState<"hidden" | "in" | "out">("hidden");
  useEffect(() => {
    try {
      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        sessionStorage.getItem("ijari-launched")
      )
        return;
      sessionStorage.setItem("ijari-launched", "1");
    } catch {
      return;
    }
    setPhase("in");
    const out = setTimeout(() => setPhase("out"), 520);
    const done = setTimeout(() => setPhase("hidden"), 720);
    return () => {
      clearTimeout(out);
      clearTimeout(done);
    };
  }, []);
  if (phase === "hidden") return null;
  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[200] grid place-items-center bg-[var(--brand-dusk)] transition-opacity duration-200 ${phase === "out" ? "opacity-0" : "opacity-100"}`}
    >
      <div className="flex flex-col items-center gap-3">
        <svg viewBox="0 0 64 64" className="size-20">
          <path
            d={ARCH}
            fill="none"
            stroke="var(--brand-ink)"
            strokeWidth={3}
            strokeLinecap="round"
            pathLength={1}
            className="launch-draw"
          />
          <path
            d="M14 50V24a18 18 0 0 1 36 0v26h-14.5V23.5a3.5 3.5 0 0 0-7 0V50z"
            fill="var(--brand-ink)"
            className="launch-fill"
          />
          <circle cx="32" cy="57.5" r="3" fill="var(--brand-ink)" className="launch-dot" />
        </svg>
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static SVG in a transient overlay */}
        <img src="/brand/wordmark-ar.svg" alt="" className="launch-word h-8 dark:invert" />
      </div>
    </div>
  );
}
