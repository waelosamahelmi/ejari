"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface OnboardingSlide {
  title: string;
  strong: string;
  subtitle: string;
  photo: { src: string; blur: string };
}

/**
 * First-launch pager: full-bleed architecture photo, dark fade at the bottom,
 * weight-contrast headline, elongated active dot, white + glass pills (§21.2).
 */
export function OnboardingPager({
  slides,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  pageLabel,
  logo,
}: {
  slides: OnboardingSlide[];
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  pageLabel: (n: number, total: number) => string;
  logo?: React.ReactNode;
}) {
  const [i, setI] = useState(0);
  const s = slides[i]!;
  const next = () => (i < slides.length - 1 ? setI(i + 1) : onPrimary());
  return (
    <div className="relative h-dvh overflow-hidden bg-black text-white">
      <AnimatePresence initial={false}>
        <motion.div key={i} className="absolute inset-0" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.9, 0.25, 1] }}>
          <Image src={s.photo.src} alt="" fill priority={i === 0} sizes="100vw" placeholder="blur" blurDataURL={s.photo.blur} className="object-cover" />
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.78),rgba(0,0,0,.35)_45%,rgba(0,0,0,0)_70%)]" />
      <div className="scrim-top absolute inset-0" />
      <div className="absolute inset-x-0 top-0 p-6 pt-[calc(20px+var(--safe-top))]">{logo}</div>
      <motion.div
        className="absolute inset-x-0 bottom-0 mx-auto max-w-lg px-6 pb-[calc(28px+var(--safe-bottom))]"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_, info) => {
          const rtl = document.documentElement.dir === "rtl";
          const dx = rtl ? -info.offset.x : info.offset.x;
          if (dx < -60) next();
          if (dx > 60 && i > 0) setI(i - 1);
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
            <h1 className="text-[40px] leading-[1.1] font-normal tracking-tight">
              {s.title} <strong className="font-semibold">{s.strong}</strong>
            </h1>
            <p className="mt-3 text-[16px] leading-6 text-white/80">{s.subtitle}</p>
          </motion.div>
        </AnimatePresence>
        <div className="my-7 flex items-center gap-1.5" role="tablist">
          {slides.map((_, n) => (
            <button
              key={n}
              type="button"
              role="tab"
              aria-selected={n === i}
              aria-label={pageLabel(n + 1, slides.length)}
              onClick={() => setI(n)}
              className={cn("h-1.5 rounded-full bg-white transition-all duration-300", n === i ? "w-6" : "w-1.5 opacity-50")}
            />
          ))}
        </div>
        <div className="space-y-3">
          <button type="button" onClick={next} className="press h-[52px] w-full rounded-full bg-white text-[16px] font-semibold text-[#0E0F12]">
            {primaryLabel}
          </button>
          <button type="button" onClick={onSecondary} className="glass press h-[52px] w-full rounded-full text-[16px] font-semibold text-white">
            {secondaryLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
