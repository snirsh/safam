import { requireAuth } from "@/lib/auth/session";
import { calculateForecast } from "@/lib/forecast/calculate";
import { formatILS } from "@/lib/format";
import { BalanceChart } from "@/components/forecast/balance-chart";
import { MotionPage, MotionList, MotionItem } from "@/components/motion";

export default async function ForecastPage() {
  const session = await requireAuth();
  const forecast = await calculateForecast(session.householdId);

  return (
    <MotionPage className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-mono text-xl font-bold text-foreground">
        Forecast
      </h1>

      {/* Hero: Bank Balance → Projected EOM */}
      <MotionList className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MotionItem className="rounded-lg border border-border bg-card px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Bank Balance Now
          </p>
          <p
            className={`mt-1 font-mono text-3xl font-bold ${forecast.bankBalance >= 0 ? "text-green-500" : "text-red-500"}`}
          >
            {formatILS(forecast.bankBalance)}
          </p>
        </MotionItem>
        <MotionItem className="rounded-lg border border-border bg-card px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Projected End of Month
          </p>
          <p
            className={`mt-1 font-mono text-3xl font-bold ${forecast.isSafe ? "text-green-500" : "text-red-500"}`}
          >
            {formatILS(forecast.projectedEndOfMonth)}
          </p>
          <p
            className={`mt-1 text-xs font-medium ${forecast.isSafe ? "text-green-500" : "text-red-500"}`}
          >
            {forecast.isSafe ? "You're on track" : "Action needed — consider transferring from savings"}
          </p>
        </MotionItem>
      </MotionList>

      {/* Detail cards */}
      <MotionList className="grid grid-cols-3 gap-2 sm:gap-4">
        <MotionItem className="min-w-0 overflow-hidden rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
            Pending Income
          </p>
          <p className="mt-0.5 truncate font-mono text-sm font-bold text-green-500 sm:text-lg">
            +{formatILS(forecast.totalPendingBankIncome)}
          </p>
        </MotionItem>
        <MotionItem className="min-w-0 overflow-hidden rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
            Pending Expenses
          </p>
          <p className="mt-0.5 truncate font-mono text-sm font-bold text-red-500 sm:text-lg">
            -{formatILS(forecast.totalPendingBankExpenses)}
          </p>
        </MotionItem>
        <MotionItem className="min-w-0 overflow-hidden rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
            CC Liability
          </p>
          <p className="mt-0.5 truncate font-mono text-sm font-bold text-muted-foreground sm:text-lg">
            {formatILS(forecast.ccLiability)}
          </p>
          <p className="hidden text-xs text-muted-foreground sm:block">hits bank next month</p>
        </MotionItem>
      </MotionList>

      {/* Balance projection chart */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Balance Projection
        </h2>
        <BalanceChart data={forecast.dataPoints} />
      </div>

      {/* Upcoming recurring list */}
      {forecast.pendingRecurring.length > 0 ? (
        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Upcoming ({forecast.pendingRecurring.length})
          </h2>
          <div className="rounded-lg border border-border bg-card">
            <MotionList className="divide-y divide-border">
              {forecast.pendingRecurring.map((p) => (
                <MotionItem
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${p.accountType === "bank" ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500"}`}
                      >
                        {p.accountType === "bank" ? "Bank" : "CC"}
                      </span>
                      <p className="truncate text-sm text-foreground">
                        {p.description}
                      </p>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
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
                    className={`shrink-0 font-mono text-xs font-medium sm:text-sm ${p.type === "income" ? "text-green-500" : "text-red-500"}`}
                  >
                    {p.type === "income" ? "+" : "-"}
                    {formatILS(p.expectedAmount)}
                  </p>
                </MotionItem>
              ))}
            </MotionList>
            <div className="border-t border-border px-4 py-2">
              <p className="text-xs text-muted-foreground">
                Items tagged CC are informational — they&apos;ll deduct from your bank next month.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No pending recurring transactions for the rest of this month.
        </div>
      )}
    </MotionPage>
  );
}
