import type { ReactNode } from "react";
import Image from "next/image";
import { Photo } from "@/components/ui/photo";
import { PHOTOS } from "@/config/generated-assets";

/**
 * Login/auth frame: hero photo with scrim and a weight-contrast headline; the
 * form sits in a bottom sheet (mobile) or a white card beside the photo (desktop).
 */
export function AuthFrame({ headline, strong, subtitle, children, lockupAlt }: { headline: string; strong: string; subtitle: string; children: ReactNode; lockupAlt: string }) {
  const photo = PHOTOS["hero-dusk"];
  return (
    <div className="min-h-dvh bg-[var(--brand-dusk)] lg:grid lg:grid-cols-[1.1fr_1fr] lg:gap-6 lg:p-6">
      <Photo src={photo.src} name="hero" alt="" priority scrim="both" sizes="(min-width: 1024px) 55vw, 100vw" className="h-[46dvh] w-full lg:h-[calc(100dvh-48px)] lg:rounded-[32px]">
        <div className="absolute inset-x-0 top-0 p-5 pt-[calc(20px+var(--safe-top))] lg:p-8">
          <Image src="/brand/lockup-ar-white.svg" alt={lockupAlt} width={132} height={40} className="h-9 w-auto ltr:hidden" priority />
          <Image src="/brand/lockup-en-white.svg" alt={lockupAlt} width={132} height={40} className="h-9 w-auto rtl:hidden" priority />
        </div>
        <div className="absolute inset-x-0 bottom-0 hidden p-10 text-white lg:block">
          <h1 className="max-w-lg text-[44px] leading-[1.1] font-normal tracking-tight">
            {headline} <strong className="font-semibold">{strong}</strong>
          </h1>
          <p className="mt-3 max-w-md text-[17px] text-white/80">{subtitle}</p>
        </div>
      </Photo>
      <div className="bg-bg relative -mt-8 min-h-[54dvh] rounded-t-[32px] px-5 pt-7 pb-[calc(24px+var(--safe-bottom))] lg:mt-0 lg:flex lg:min-h-0 lg:items-center lg:justify-center lg:rounded-[32px] lg:bg-transparent lg:p-0">
        <div className="mx-auto w-full max-w-[420px] lg:bg-paper lg:rounded-[32px] lg:p-10 lg:shadow-[var(--sh-float)]">{children}</div>
      </div>
    </div>
  );
}
