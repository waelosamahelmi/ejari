import type { ReactNode } from "react";
import Image from "next/image";

/** Compact centered auth card on the dusk backdrop with the arch pattern (forgot/reset/no-org). */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center bg-[var(--brand-dusk)] px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:url(/brand/arch-pattern.svg)] [background-size:48px_56px] dark:invert" />
      <div className="bg-paper relative w-full max-w-[420px] rounded-[32px] p-7 shadow-[var(--sh-float)] sm:p-9">
        <Image src="/brand/mark.svg" alt="" width={44} height={44} className="mb-5 dark:invert" priority />
        <h1 className="text-[26px] leading-tight font-semibold">{title}</h1>
        {subtitle && <p className="text-label-2 mt-1.5 mb-6 text-[15px] leading-6">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
