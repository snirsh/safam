import { requireAuth } from "@/lib/auth/session";
import { calculateForecast } from "@/lib/forecast/calculate";
import { formatILS } from "@/lib/format";
import { BalanceChart } from "@/components/forecast/balance-chart";

export default async function ForecastPage() {
  const session = await requireAuth();
  const forecast = await calculateForecast(session.householdId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-mono text-xl font-bold text-foreground">
        Forecast
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Current Balance
          </p>
          <p
            className={`mt-0.5 font-mono text-lg font-bold ${forecast.currentBalance >= 0 ? "text-green-500" : "text-red-500"}`}
          >
            {formatILS(forecast.currentBalance)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Projected EOM
          </p>
          <p
            className={`mt-0.5 font-mono text-lg font-bold ${forecast.projectedEndOfMonth >= 0 ? "text-green-500" : "text-red-500"}`}
          >
            {formatILS(forecast.projectedEndOfMonth)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pending Income
          </p>
          <p className="mt-0.5 font-mono text-lg font-bold text-green-500">
            +{formatILS(forecast.totalPendingIncome)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pending Expenses
          </p>
          <p className="mt-0.5 font-mono text-lg font-bold text-red-500">
            -{formatILS(forecast.totalPendingExpenses)}
          </p>
        </div>
      </div>

      {/* Balance projection chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Balance Projection
        </h2>
        <BalanceChart data={forecast.dataPoints} />
      </div>

      {/* Pending recurring list */}
      {forecast.pendingRecurring.length > 0 ? (
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Upcoming ({forecast.pendingRecurring.length})
          </h2>
          <div className="rounded-lg border border-border bg-card">
            <div className="divide-y divide-border">
              {forecast.pendingRecurring.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {p.description}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.expectedDate}
                      </span>
                      {p.categoryName ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">
                          {p.categoryIcon} {p.categoryName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p
                    className={`ml-4 shrink-0 font-mono text-sm font-medium ${p.type === "income" ? "text-green-500" : "text-red-500"}`}
                  >
                    {p.type === "income" ? "+" : "-"}
                    {formatILS(p.expectedAmount)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No pending recurring transactions for the rest of this month.
        </div>
      )}
    </div>
  );
}
