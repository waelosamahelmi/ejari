import { Skeleton } from "@/components/ui/skeleton";

/** Generic page skeleton matching the large-title layout (avoids layout shift). */
export default function Loading() {
  return (
    <div className="pt-14" aria-busy="true">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="mt-2 h-4 w-32" />
      <Skeleton className="mt-6 h-[52px] w-full rounded-full" />
      <div className="mt-6 space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-[16px]" />
        ))}
      </div>
    </div>
  );
}
