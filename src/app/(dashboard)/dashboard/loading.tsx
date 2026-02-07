import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Skeleton className="h-7 w-32" />

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card px-4 py-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-8 w-24" />
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card px-4 py-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-1 h-6 w-10" />
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-3 h-64 w-full" />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-10 w-32" />
          <Skeleton className="mt-4 h-20 w-full" />
        </div>
      </div>

      {/* Trend chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="mt-3 h-64 w-full" />
      </div>

      {/* Recent transactions */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-4 w-36" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-0">
            <div>
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
