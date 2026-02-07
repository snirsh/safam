import { Skeleton } from "@/components/ui/skeleton";

export default function RecurringLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card px-4 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-1 h-6 w-20" />
          </div>
        ))}
      </div>

      {/* Pattern list */}
      <Skeleton className="h-3 w-20" />
      <div className="rounded-lg border border-border bg-card">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <div>
                <Skeleton className="h-4 w-36" />
                <Skeleton className="mt-1 h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
