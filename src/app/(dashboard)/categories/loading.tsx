import { Skeleton } from "@/components/ui/skeleton";

export default function CategoriesLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-5 w-32" />
            <div className="mt-3 flex flex-wrap gap-1">
              {Array.from({ length: 4 }, (_, j) => (
                <Skeleton key={j} className="h-5 w-20" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
