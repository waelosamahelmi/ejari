import Image from "next/image";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PHOTOS, type PhotoName } from "@/config/generated-assets";
import { CoverFallback } from "./cover-fallback";

export function resolvePhoto(src: string | null | undefined): { src: string; blur?: string } | null {
  if (!src) return null;
  const brand = Object.values(PHOTOS).find((p) => p.src === src);
  if (brand) return { src: brand.src, blur: brand.blur };
  return { src };
}

export function brandPhoto(name: PhotoName) {
  return PHOTOS[name];
}

/**
 * Photo that fills its (aspect-ratio'd) parent, with blur-up placeholder and
 * an optional bottom scrim. Falls back to the generated architectural cover.
 */
export function Photo({
  src,
  alt,
  name,
  sizes = "100vw",
  priority,
  scrim,
  className,
  children,
}: {
  src: string | null | undefined;
  alt: string;
  name: string;
  sizes?: string;
  priority?: boolean;
  scrim?: "bottom" | "both" | false;
  className?: string;
  children?: ReactNode;
}) {
  const p = resolvePhoto(src);
  return (
    <div className={cn("relative overflow-hidden", className)}>
      {p ? (
        <Image
          src={p.src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          placeholder={p.blur ? "blur" : "empty"}
          blurDataURL={p.blur}
          className="object-cover"
          unoptimized={p.src.startsWith("http") && !p.src.includes("supabase")}
        />
      ) : (
        <CoverFallback name={name} className="absolute inset-0" />
      )}
      {scrim && <div className="scrim-bottom pointer-events-none absolute inset-0" />}
      {scrim === "both" && <div className="scrim-top pointer-events-none absolute inset-0" />}
      {children}
    </div>
  );
}
