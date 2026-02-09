import Link from "next/link";
import { db } from "@/lib/db";
import {
  categories,
  financialAccounts,
  recurringPatterns,
  transactions,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, sql, and, gte, lt } from "drizzle-orm";
import { formatILS, getMonthBounds } from "@/lib/format";
import { calculateForecast } from "@/lib/forecast/calculate";
import { CategoryPieChart } from "@/components/dashboard/category-pie-chart";
import { IncomeExpensesChart } from "@/components/dashboard/income-expenses-chart";

export default async function DashboardPage() {
  const session = await requireAuth();
  const now = new Date();
  const { start, end } = getMonthBounds(now.getFullYear(), now.getMonth());

  // Fetch this month's transactions (all accounts, for spending overview)
  const monthlyTxns = await db
    .select({
      type: transactions.transactionType,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, session.householdId),
        gte(transactions.date, start),
        lt(transactions.date, end),
      ),
    )
    .groupBy(transactions.transactionType);

  const income = Number(
    monthlyTxns.find((t) => t.type === "income")?.total ?? 0,
  );
  const spending = Math.abs(
    Number(monthlyTxns.find((t) => t.type === "expense")?.total ?? 0),
  );
  const net = income - spending;

  // Forecast (includes bank balance, projected EOM, CC liability)
  const forecast = await calculateForecast(session.householdId);

  // Stats counts
  const [[txnCountRow], [catCountRow], [acctCountRow], [recCountRow]] =
    await Promise.all([
      db
        .select({ count: sql<string>`COUNT(*)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.householdId, session.householdId),
            gte(transactions.date, start),
            lt(transactions.date, end),
          ),
        ),
      db
        .select({ count: sql<string>`COUNT(*)` })
        .from(categories)
        .where(eq(categories.householdId, session.householdId)),
      db
        .select({ count: sql<string>`COUNT(*)` })
        .from(financialAccounts)
        .where(eq(financialAccounts.householdId, session.householdId)),
      db
        .select({ count: sql<string>`COUNT(*)` })
        .from(recurringPatterns)
        .where(eq(recurringPatterns.householdId, session.householdId)),
    ]);

  // Category breakdown for pie chart (expenses only, current month)
  const categoryBreakdown = await db
    .select({
      categoryName: categories.name,
      categoryIcon: categories.icon,
      total: sql<string>`SUM(ABS(${transactions.amount}))`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.householdId, session.householdId),
        eq(transactions.transactionType, "expense"),
        gte(transactions.date, start),
        lt(transactions.date, end),
      ),
    )
    .groupBy(categories.name, categories.icon)
    .orderBy(sql`SUM(ABS(${transactions.amount})) DESC`);

  const top5 = categoryBreakdown.slice(0, 5);
  const rest = categoryBreakdown.slice(5);
  const otherTotal = rest.reduce((sum, c) => sum + Number(c.total), 0);
  const pieData = top5.map((c) => ({
    name: c.categoryName ?? "Uncategorized",
    value: Number(c.total),
    icon: c.categoryIcon,
  }));
  if (otherTotal > 0) {
    pieData.push({ name: "Other", value: otherTotal, icon: null });
  }

  // 6-month income vs expenses trend
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const trendData = await db
    .select({
      month: sql<string>`TO_CHAR(${transactions.date}, 'YYYY-MM')`,
      type: transactions.transactionType,
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, session.householdId),
        gte(transactions.date, sixMonthsAgo),
        lt(transactions.date, end),
      ),
    )
    .groupBy(
      sql`TO_CHAR(${transactions.date}, 'YYYY-MM')`,
      transactions.transactionType,
    )
    .orderBy(sql`TO_CHAR(${transactions.date}, 'YYYY-MM') ASC`);

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-US", { month: "short" }),
    };
  });

  const chartData = months.map(({ key, label }) => ({
    month: label,
    income: Number(
      trendData.find((t) => t.month === key && t.type === "income")?.total ?? 0,
    ),
    expenses: Math.abs(
      Number(
        trendData.find((t) => t.month === key && t.type === "expense")?.total ??
          0,
      ),
    ),
  }));

  // Recent transactions
  const recentTxns = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.transactionType,
      date: transactions.date,
      categoryName: categories.name,
      categoryIcon: categories.icon,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.householdId, session.householdId))
    .orderBy(sql`${transactions.date} DESC`)
    .limit(5);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-mono text-xl font-bold text-foreground">
        Dashboard
      </h1>

      {/* Hero section: Bank Balance + Projected EOM */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Bank Balance
          </p>
          <p
            className={`mt-1 font-mono text-3xl font-bold ${forecast.bankBalance >= 0 ? "text-green-500" : "text-red-500"}`}
          >
            {formatILS(forecast.bankBalance)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            End of Month
          </p>
          <p
            className={`mt-1 font-mono text-3xl font-bold ${forecast.isSafe ? "text-green-500" : "text-red-500"}`}
          >
            {formatILS(forecast.projectedEndOfMonth)}
          </p>
          <p
            className={`mt-1 text-xs font-medium ${forecast.isSafe ? "text-green-500" : "text-red-500"}`}
          >
            {forecast.isSafe ? "You're on track" : "Action needed"}
          </p>
        </div>
      </div>

      {/* Monthly summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Income" value={formatILS(income)} variant="green" />
        <SummaryCard
          label="Spending"
          value={formatILS(spending)}
          variant="red"
        />
        <SummaryCard
          label="Net"
          value={`${net >= 0 ? "+" : ""}${formatILS(net)}`}
          variant={net >= 0 ? "green" : "red"}
        />
        <SummaryCard
          label="CC Pending"
          value={formatILS(forecast.ccLiability)}
          variant="muted"
          detail="hits bank next month"
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Categories"
          value={String(Number(catCountRow?.count ?? 0))}
        />
        <StatCard
          label="Transactions"
          value={String(Number(txnCountRow?.count ?? 0))}
          detail="this month"
        />
        <StatCard
          label="Accounts"
          value={String(Number(acctCountRow?.count ?? 0))}
          detail="connected"
        />
        <StatCard
          label="Recurring"
          value={String(Number(recCountRow?.count ?? 0))}
          detail="detected"
        />
      </div>

      {/* Charts row: Pie + Forecast */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Expenses by Category
          </h2>
          <CategoryPieChart data={pieData} />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Forecast
            </h2>
            <Link
              href="/forecast"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              View details &rarr;
            </Link>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  Pending Bank Income
                </p>
                <p className="font-mono text-sm font-medium text-green-500">
                  +{formatILS(forecast.totalPendingBankIncome)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Pending Bank Expenses
                </p>
                <p className="font-mono text-sm font-medium text-red-500">
                  -{formatILS(forecast.totalPendingBankExpenses)}
                </p>
              </div>
            </div>
            {forecast.pendingRecurring.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Upcoming</p>
                {forecast.pendingRecurring.slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="flex items-center gap-1.5 truncate text-muted-foreground">
                      <span
                        className={`rounded px-1 py-0.5 text-[10px] font-medium ${p.accountType === "bank" ? "bg-blue-500/10 text-blue-500" : "bg-orange-500/10 text-orange-500"}`}
                      >
                        {p.accountType === "bank" ? "Bank" : "CC"}
                      </span>
                      {p.description}
                    </span>
                    <span
                      className={`ml-2 shrink-0 font-mono ${p.type === "income" ? "text-green-500" : "text-red-500"}`}
                    >
                      {p.type === "income" ? "+" : "-"}
                      {formatILS(p.expectedAmount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Income vs Expenses trend */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Income vs Expenses (6 months)
        </h2>
        <IncomeExpensesChart data={chartData} />
      </div>

      {/* Recent transactions */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-mono text-sm font-medium text-foreground">
            Recent Transactions
          </h2>
          <Link
            href="/transactions"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View all &rarr;
          </Link>
        </div>
        {recentTxns.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No transactions yet. Connect a bank account and sync to get started.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentTxns.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm text-foreground">{tx.description}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("he-IL")}
                    </p>
                    {tx.categoryName ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">
                        {tx.categoryIcon} {tx.categoryName}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span
                  className={`font-mono text-sm ${tx.type === "income" ? "text-green-500" : tx.type === "transfer" ? "text-muted-foreground" : "text-red-500"}`}
                >
                  {tx.type === "income" ? "+" : tx.type === "transfer" ? "" : "-"}
                  {formatILS(Math.abs(Number(tx.amount)))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  variant,
  detail,
}: {
  label: string;
  value: string;
  variant: "green" | "red" | "muted";
  detail?: string;
}) {
  const colorClass =
    variant === "green"
      ? "text-green-500"
      : variant === "red"
        ? "text-red-500"
        : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 font-mono text-lg font-bold ${colorClass}`}>
        {value}
      </p>
      {detail ? (
        <p className="text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-bold text-foreground">{value}</p>
      {detail ? (
        <p className="text-xs text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}
