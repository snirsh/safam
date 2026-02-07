"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center justify-center py-16">
      <div className="rounded-lg border border-border bg-card px-8 py-6 text-center">
        <h2 className="font-mono text-lg font-bold text-foreground">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md border border-border bg-accent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/80"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
