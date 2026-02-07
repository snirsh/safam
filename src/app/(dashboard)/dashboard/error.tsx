"use client";

export default function DashboardPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-mono text-xl font-bold text-foreground">
        Dashboard
      </h1>
      <div className="rounded-lg border border-border bg-card px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          Failed to load dashboard: {error.message}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-3 rounded-md border border-border bg-accent px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/80"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
