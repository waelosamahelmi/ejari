import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Photo } from "./photo";

/**
 * Full-bleed photo hero (~42 % of the viewport) with glass controls on top and
 * a bottom scrim for white text (§21.1.1, §21.1.15).
 */
export function PhotoHero({
  src,
  name,
  alt,
  location,
  title,
  topStart,
  topEnd,
  pills,
  className,
  children,
}: {
  src: string | null | undefined;
  name: string;
  alt: string;
  location?: ReactNode;
  title: ReactNode;
  topStart?: ReactNode;
  topEnd?: ReactNode;
  pills?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Photo
      src={src}
      name={name}
      alt={alt}
      priority
      scrim="both"
      sizes="(min-width: 1024px) 70vw, 100vw"
      className={cn("h-[42dvh] min-h-[320px] w-full lg:h-[380px] lg:rounded-[32px]", className)}
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 pt-[calc(16px+var(--safe-top))] lg:pt-4">
        <div>{topStart}</div>
        <div className="flex gap-2">{topEnd}</div>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5 pb-10 text-white lg:pb-6">
        {location && (
          <p className="mb-1 flex items-center gap-1.5 text-[14px] text-white/85">
            <MapPin className="size-4" aria-hidden />
            {location}
          </p>
        )}
        <h1 className="text-[28px] leading-tight font-semibold drop-shadow-sm lg:text-[34px]">
          {title}
        </h1>
        {pills && <div className="mt-3 flex flex-wrap gap-2">{pills}</div>}
        {children}
      </div>
    </Photo>
  );
}
