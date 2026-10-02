"use client";
import type { ReactNode } from "react";
import { LazyMotion } from "motion/react";

// Animation features (incl. drag for swipe actions) load as a separate chunk after hydration.
const loadFeatures = () => import("./motion-features").then((m) => m.default);

/** App-wide LazyMotion: components use the lightweight `m.*` renderer (`strict` forbids `motion.*`). */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  );
}
