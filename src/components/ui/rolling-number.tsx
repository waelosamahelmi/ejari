"use client";
import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

/** Animates a number from its previous value to the next (rolling counter). */
export function RollingNumber({ value, format, className, duration = 0.8 }: { value: number; format: (n: number) => string; className?: string; duration?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      duration,
      ease: [0.2, 0.9, 0.25, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduced, duration]);
  return <span className={className}>{format(shown)}</span>;
}
