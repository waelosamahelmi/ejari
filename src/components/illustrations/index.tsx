/**
 * Empty-state illustrations (§18.6): one style — 1.75px rounded strokes in ink
 * (currentColor), one sand accent, the arch motif recurring.
 */
import type { ReactNode } from "react";

const SAND = "var(--brand-sand)";

function Frame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className="h-auto w-full"
    >
      <path d="M12 104h136" opacity=".35" />
      {children}
    </svg>
  );
}

const Arch = ({
  x,
  y,
  w,
  h,
  fill,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
}) => (
  <path
    d={`M${x} ${y + h}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}`}
    fill={fill ?? "none"}
  />
);

export function NoPropertiesIllustration() {
  return (
    <Frame>
      <path d="M44 104V40h72v64" />
      <path d="M36 40h88" />
      <Arch x={70} y={74} w={20} h={30} fill={SAND} />
      {[52, 94].map((x) =>
        [48, 62].map((y) => <Arch key={`${x}-${y}`} x={x} y={y} w={12} h={10} />),
      )}
      <path d="M80 24v16M72 30h16" opacity=".5" />
    </Frame>
  );
}

export function NoUnitsIllustration() {
  return (
    <Frame>
      <rect x="40" y="28" width="80" height="76" rx="4" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}${c}`}
            x={48 + c * 24}
            y={36 + r * 22}
            width="16"
            height="14"
            rx="3"
            fill={r === 1 && c === 1 ? SAND : "none"}
            strokeDasharray={r === 1 && c === 1 ? undefined : "3 3"}
          />
        )),
      )}
    </Frame>
  );
}

export function NoTenantsIllustration() {
  return (
    <Frame>
      <Arch x={50} y={30} w={60} h={74} />
      <circle cx="80" cy="58" r="10" />
      <path d="M62 94c3-12 10-18 18-18s15 6 18 18" />
      <circle cx="112" cy="36" r="5" fill={SAND} stroke="none" />
    </Frame>
  );
}

export function NoContractsIllustration() {
  return (
    <Frame>
      <path d="M52 22h42l14 14v68H52z" />
      <path d="M94 22v14h14" />
      <path d="M62 50h36M62 60h36M62 70h24" opacity=".6" />
      <path d="M62 88c6-6 10 4 16-2s8 2 14-2" stroke={SAND} strokeWidth={2.2} />
    </Frame>
  );
}

export function NoPaymentsIllustration() {
  return (
    <Frame>
      <path d="M50 20h60v84l-7.5-6-7.5 6-7.5-6-7.5 6-7.5-6-7.5 6-7.5-6-7.5 6z" />
      <path d="M62 40h36M62 52h36M62 64h20" opacity=".6" />
      <circle cx="94" cy="78" r="7" fill={SAND} stroke="none" />
    </Frame>
  );
}

export function NoExpensesIllustration() {
  return (
    <Frame>
      <rect x="40" y="38" width="80" height="54" rx="10" />
      <path d="M40 54h80" />
      <rect x="92" y="62" width="28" height="16" rx="8" />
      <circle cx="100" cy="70" r="3" fill={SAND} stroke="none" />
      <path d="M52 30l40-10 6 18" opacity=".6" />
    </Frame>
  );
}

export function NotificationsIllustration() {
  return (
    <Frame>
      <path d="M58 86V58a22 22 0 0 1 44 0v28" />
      <path d="M50 86h60" />
      <path d="M74 94a6 6 0 0 0 12 0" />
      <circle cx="104" cy="40" r="6" fill={SAND} stroke="none" />
      <path d="M80 30v6" />
    </Frame>
  );
}

export function OfflineIllustration() {
  return (
    <Frame>
      <Arch x={52} y={24} w={56} h={80} />
      <path d="M64 70a22 22 0 0 1 32 0M70 78a12 12 0 0 1 20 0" />
      <circle cx="80" cy="88" r="3" fill={SAND} stroke="none" />
      <path d="M58 52l44 44" />
    </Frame>
  );
}

export function NoLateUnitsIllustration() {
  return (
    <Frame>
      <Arch x={54} y={26} w={52} h={78} fill="none" />
      <path d="M68 66l9 9 17-19" strokeWidth={2.4} />
      {[
        [40, 40],
        [120, 34],
        [128, 64],
        [34, 70],
      ].map(([x, y], i) => (
        <path
          key={i}
          d={`M${x} ${y! - 4}v8M${x! - 4} ${y}h8`}
          stroke={i % 2 ? SAND : "currentColor"}
        />
      ))}
    </Frame>
  );
}

export function NoVacantUnitsIllustration() {
  return (
    <Frame>
      <path d="M44 104V36h72v68" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <Arch key={`${r}${c}`} x={54 + c * 20} y={44 + r * 18} w={12} h={12} fill={SAND} />
        )),
      )}
      <path d="M36 36h88" />
    </Frame>
  );
}

export function NoResultsIllustration() {
  return (
    <Frame>
      <circle cx="72" cy="58" r="22" />
      <path d="M88 74l18 18" strokeWidth={2.4} />
      <Arch x={64} y={50} w={16} h={16} fill={SAND} />
    </Frame>
  );
}
