import { cn } from "@/lib/utils";

/** iOS-style activity indicator (8 petals). */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("relative inline-block size-5", className)}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-full animate-[spin_0.9s_steps(8)_infinite]"
        aria-hidden
      >
        {Array.from({ length: 8 }, (_, i) => (
          <rect
            key={i}
            x="11"
            y="2"
            width="2"
            height="6"
            rx="1"
            fill="currentColor"
            opacity={0.25 + (i / 8) * 0.75}
            transform={`rotate(${i * 45} 12 12)`}
          />
        ))}
      </svg>
    </span>
  );
}
