import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-7" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-7 w-7" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28" />
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card px-4 py-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1 h-6 w-24" />
          </div>
        ))}
      </div>

      <Skeleton className="h-3 w-24" />

      {/* Table rows */}
      <div className="rounded-lg border border-border bg-card">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-40 flex-1" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
