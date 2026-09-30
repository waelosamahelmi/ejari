import type { Transition } from "motion/react";

export const spring: Transition = { type: "spring", stiffness: 400, damping: 32 };
export const gentle: Transition = { type: "spring", stiffness: 260, damping: 30 };
export const snappy: Transition = { type: "spring", stiffness: 520, damping: 38 };
export const fade: Transition = { duration: 0.18, ease: [0.2, 0.9, 0.25, 1] };
