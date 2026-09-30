"use client";
import type { ReactNode } from "react";
import { ChevronRight, MapPin, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassButton, GlassPill } from "./glass";
import { Photo } from "./photo";

/**
 * Property card: photo fills the card, glass pin, scrim with location, name,
 * glass metric pills and a glass "details" pill with a white round chevron (§21.1.6).
 */
export function PropertyPhotoCard({
  name,
  location,
  photo,
  pills,
  ctaLabel,
  href,
  pinned,
  onTogglePin,
  pinLabel,
  className,
  aspect = "aspect-[4/5]",
  LinkComponent,
  priority,
}: {
  name: string;
  location?: ReactNode;
  photo: string | null | undefined;
  pills?: ReactNode;
  ctaLabel: string;
  href: string;
  pinned?: boolean;
  onTogglePin?: () => void;
  pinLabel?: string;
  className?: string;
  aspect?: string;
  LinkComponent: React.ElementType;
  priority?: boolean;
}) {
  const L = LinkComponent;
  return (
    <Photo
      src={photo}
      name={name}
      alt={name}
      scrim="bottom"
      priority={priority}
      sizes="(min-width: 1280px) 25vw, (min-width: 768px) 40vw, 85vw"
      className={cn("group rounded-[28px] shadow-[var(--sh-card)]", aspect, className)}
    >
      <L href={href} className="absolute inset-0 z-0" aria-label={`${ctaLabel} — ${name}`} />
      {onTogglePin && (
        <GlassButton
          onClick={onTogglePin}
          aria-pressed={pinned}
          aria-label={pinLabel}
          className={cn("absolute end-3.5 top-3.5 z-10", pinned && "bg-white text-[#0E0F12]")}
        >
          <Pin className={cn(pinned && "fill-current")} />
        </GlassButton>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 text-white">
        {location && (
          <p className="flex items-center gap-1 text-[13px] text-white/85">
            <MapPin className="size-3.5" aria-hidden />
            {location}
          </p>
        )}
        <h3 className="mt-0.5 text-[22px] leading-tight font-semibold">{name}</h3>
        {pills && <div className="mt-2.5 flex flex-wrap gap-1.5">{pills}</div>}
        <div className="glass mt-3 flex h-12 items-center justify-between rounded-full ps-5 pe-1.5 text-[15px] font-medium">
          <span>{ctaLabel}</span>
          <span className="flex size-9 items-center justify-center rounded-full bg-white text-[#0E0F12]">
            <ChevronRight className="flip-rtl size-5" aria-hidden />
          </span>
        </div>
      </div>
    </Photo>
  );
}

export { GlassPill };
