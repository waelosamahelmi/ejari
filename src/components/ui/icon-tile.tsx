import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  ink: "bg-ink text-on-ink",
  gray: "bg-gray text-white",
  green: "bg-green text-white",
  orange: "bg-orange text-white",
  red: "bg-red text-white",
  indigo: "bg-indigo text-white",
  teal: "bg-teal text-white",
  gulf: "bg-gulf text-white",
  sand: "bg-sand text-white",
  rose: "bg-rose text-white",
  soft: "bg-inset text-label",
} as const;

export type Tone = keyof typeof TONES;

/** Leading icon tile: colored rounded square like iOS Settings. */
export function IconTile({ tone = "ink", children, size = "md", className }: { tone?: Tone; children: ReactNode; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        size === "sm" && "size-7 rounded-[8px] [&_svg]:size-4",
        size === "md" && "size-9 rounded-[10px] [&_svg]:size-[18px]",
        size === "lg" && "size-12 rounded-[14px] [&_svg]:size-6",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Round icon circle (amenity column, chips). */
export function IconCircle({ children, className, active }: { children: ReactNode; className?: string; active?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full [&_svg]:size-5",
        active ? "bg-on-ink text-ink" : "bg-paper text-label shadow-[0_1px_3px_rgba(16,24,40,.08)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
