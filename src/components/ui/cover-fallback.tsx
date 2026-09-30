import { cn, initials } from "@/lib/utils";

const PALETTES = [
  ["#C9D4E3", "#D8CCD6", "#8E7FA0"],
  ["#D6D2C4", "#E3CFC0", "#A0806A"],
  ["#C4D6D6", "#CFD8E6", "#5F8A96"],
  ["#D9CFE3", "#E6D6D0", "#8F7A9E"],
  ["#CBD9CC", "#E0DCCB", "#6F8F72"],
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Generated architectural cover when a property has no photo: dusk gradient, arch motif, initials. Never a gray box. */
export function CoverFallback({
  name,
  className,
  showInitials = true,
}: {
  name: string;
  className?: string;
  showInitials?: boolean;
}) {
  const p = PALETTES[hash(name) % PALETTES.length]!;
  const id = `cf-${hash(name)}`;
  return (
    <svg
      viewBox="0 0 400 500"
      preserveAspectRatio="xMidYMid slice"
      className={cn("size-full", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p[0]} />
          <stop offset="1" stopColor={p[1]} />
        </linearGradient>
        <linearGradient id={`${id}-glow`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#E9C98F" stopOpacity=".9" />
          <stop offset="1" stopColor="#FFF4DE" stopOpacity=".1" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill={`url(#${id}-sky)`} />
      {/* facade with arched windows */}
      <g opacity=".92">
        <rect x="70" y="170" width="260" height="330" fill="#F4F1EC" />
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3].map((col) => {
            const x = 96 + col * 58;
            const y = 200 + row * 90;
            const lit = (row * 4 + col + hash(name)) % 3 === 0;
            return (
              <path
                key={`${row}-${col}`}
                d={`M${x} ${y + 60}V${y + 16}a16 16 0 0 1 32 0V${y + 60}z`}
                fill={lit ? `url(#${id}-glow)` : p[2]}
                opacity={lit ? 1 : 0.55}
              />
            );
          }),
        )}
      </g>
      <path d="M170 500V420a30 30 0 0 1 60 0v80z" fill={p[2]} opacity=".8" />
      <rect y="470" width="400" height="30" fill="#000" opacity=".06" />
      {showInitials && (
        <text
          x="200"
          y="120"
          textAnchor="middle"
          fontSize="64"
          fontWeight="600"
          fill="#fff"
          opacity=".9"
          style={{ fontFamily: "var(--ff-arabic), var(--ff-latin), sans-serif" }}
        >
          {initials(name)}
        </text>
      )}
    </svg>
  );
}
