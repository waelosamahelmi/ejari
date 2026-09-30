import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="pt-[calc(12px+var(--safe-top))] lg:pt-6" aria-busy="true">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-2 h-10 w-72" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-11 w-48 rounded-full" />
        <Skeleton className="h-11 w-48 rounded-full" />
      </div>
      <div className="mt-6 flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton
            key={i}
            className="aspect-[4/5] w-[78vw] max-w-[340px] shrink-0 rounded-[28px] lg:w-1/4"
          />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 min-[400px]:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-[168px] rounded-[28px]" />
        <Skeleton className="col-span-full h-[352px] rounded-[28px] min-[400px]:col-span-2 lg:row-span-2" />
        <Skeleton className="h-[168px] rounded-[28px]" />
        <Skeleton className="h-[168px] rounded-[28px]" />
        <Skeleton className="h-[168px] rounded-[28px]" />
        <Skeleton className="col-span-full h-[240px] rounded-[28px] lg:col-span-4" />
      </div>
    </div>
  );
}
