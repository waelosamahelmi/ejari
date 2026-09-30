import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconCircle } from "./icon-tile";

/** Row of rounded 16px photo tiles (unit gallery). */
export function ThumbStrip({ photos, className, onSelect, alt }: { photos: { src: string; blur?: string }[]; className?: string; onSelect?: (i: number) => void; alt: string }) {
  return (
    <div className={cn("no-scrollbar flex gap-2 overflow-x-auto", className)}>
      {photos.map((p, i) => (
        <button key={p.src + i} type="button" onClick={() => onSelect?.(i)} className="press relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-[16px]">
          <Image src={p.src} alt={`${alt} ${i + 1}`} fill sizes="96px" className="object-cover" placeholder={p.blur ? "blur" : "empty"} blurDataURL={p.blur} />
        </button>
      ))}
    </div>
  );
}

/** Vertical column of round icon tiles with labels (bedrooms, bathrooms, area, floor, meters). */
export function AmenityColumn({ items, className }: { items: { icon: ReactNode; label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-3">
          <IconCircle>{it.icon}</IconCircle>
          <div className="min-w-0">
            <div className="text-label-2 text-[12px]">{it.label}</div>
            <div className="num truncate text-[15px] font-semibold">{it.value}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
