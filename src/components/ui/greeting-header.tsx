import type { ReactNode } from "react";
import { ChevronDown, MapPin } from "lucide-react";

/** "مرحبًا، وائل" + org switcher line + trailing round bell (§21.1.12). */
export function GreetingHeader({
  greeting,
  org,
  trailing,
  onOrgClick,
}: {
  name?: string;
  greeting: string;
  org: string;
  trailing?: ReactNode;
  onOrgClick?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[20px] font-semibold">{greeting}</p>
        <button
          type="button"
          onClick={onOrgClick}
          className="text-label-2 mt-0.5 flex max-w-full items-center gap-1 text-[14px]"
        >
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span className="truncate">{org}</span>
          <ChevronDown className="size-3.5 shrink-0" aria-hidden />
        </button>
      </div>
      {trailing}
    </div>
  );
}
