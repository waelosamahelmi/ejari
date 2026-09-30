"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const ARCH = "M14 50V24a18 18 0 0 1 36 0v26";

/** ≤ 700 ms launch: arch stroke draws in, fills, wordmark fades up, cross-fade to app. Once per session. */
export function LaunchAnimation() {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (reduced || sessionStorage.getItem("ijari-launched")) return;
      sessionStorage.setItem("ijari-launched", "1");
    } catch {
      return;
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 700);
    return () => clearTimeout(t);
  }, [reduced]);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="launch"
          aria-hidden
          className="fixed inset-0 z-[200] grid place-items-center bg-[var(--brand-dusk)]"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="flex flex-col items-center gap-3">
            <svg viewBox="0 0 64 64" className="size-20">
              <motion.path d={ARCH} fill="none" stroke="var(--brand-ink)" strokeWidth={3} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, ease: "easeOut" }} />
              <motion.path
                d="M14 50V24a18 18 0 0 1 36 0v26h-14.5V23.5a3.5 3.5 0 0 0-7 0V50z"
                fill="var(--brand-ink)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25, duration: 0.15 }}
              />
              <motion.circle cx="32" cy="57.5" r="3" fill="var(--brand-ink)" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.35, type: "spring", stiffness: 500, damping: 20 }} />
            </svg>
            <motion.img src="/brand/wordmark-ar.svg" alt="" className="h-8 dark:invert" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.2 }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
