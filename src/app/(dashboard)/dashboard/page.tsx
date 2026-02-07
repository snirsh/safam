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

  // Fetch this month's transactions
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
  const expenses = Math.abs(
    Number(monthlyTxns.find((t) => t.type === "expense")?.total ?? 0),
  );
  const balance = income - expenses;

  // Fetch monthly transaction count
  const [txnCountRow] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.householdId, session.householdId),
        gte(transactions.date, start),
        lt(transactions.date, end),
      ),
    );
  const txnCount = Number(txnCountRow?.count ?? 0);

  // Fetch category count
  const [catCountRow] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(categories)
    .where(eq(categories.householdId, session.householdId));
  const catCount = Number(catCountRow?.count ?? 0);

  // Fetch account count
  const [acctCountRow] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(financialAccounts)
    .where(eq(financialAccounts.householdId, session.householdId));
  const acctCount = Number(acctCountRow?.count ?? 0);

  // Fetch recurring count
  const [recCountRow] = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(recurringPatterns)
    .where(eq(recurringPatterns.householdId, session.householdId));
  const recCount = Number(recCountRow?.count ?? 0);

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

  // Top 5 + "Other"
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

  // Transform to chart data
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

  // Forecast summary
  const forecast = await calculateForecast(session.householdId);

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

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Income" value={formatILS(income)} variant="green" />
        <SummaryCard
          label="Expenses"
          value={formatILS(expenses)}
          variant="red"
        />
        <SummaryCard
          label="Balance"
          value={formatILS(balance)}
          variant={balance >= 0 ? "green" : "red"}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Categories" value={String(catCount)} />
        <StatCard
          label="Transactions"
          value={String(txnCount)}
          detail="this month"
        />
        <StatCard
          label="Accounts"
          value={String(acctCount)}
          detail="connected"
        />
        <StatCard
          label="Recurring"
          value={String(recCount)}
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
            <div>
              <p className="text-xs text-muted-foreground">Projected EOM</p>
              <p
                className={`font-mono text-2xl font-bold ${forecast.projectedEndOfMonth >= 0 ? "text-green-500" : "text-red-500"}`}
              >
                {formatILS(forecast.projectedEndOfMonth)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Pending Income</p>
                <p className="font-mono text-sm font-medium text-green-500">
                  +{formatILS(forecast.totalPendingIncome)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Pending Expenses
                </p>
                <p className="font-mono text-sm font-medium text-red-500">
                  -{formatILS(forecast.totalPendingExpenses)}
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
                    <span className="truncate text-muted-foreground">
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
}: {
  label: string;
  value: string;
  variant: "green" | "red";
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-bold ${variant === "green" ? "text-green-500" : "text-red-500"}`}
      >
        {value}
      </p>
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
