import { db } from "@/lib/db";
import {
  categories,
  financialAccounts,
  recurringPatterns,
  transactions,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, sql, and, gte, lt } from "drizzle-orm";

function formatILS(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export default async function DashboardPage() {
  const session = await requireAuth();
  const { start, end } = getMonthBounds();

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

  // Fetch category count
  const categoryCount = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(categories)
    .where(eq(categories.householdId, session.householdId));

  const catCount = Number(categoryCount[0]?.count ?? 0);

  // Fetch account count
  const accountCount = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(financialAccounts)
    .where(eq(financialAccounts.householdId, session.householdId));
  const acctCount = Number(accountCount[0]?.count ?? 0);

  // Fetch recurring count
  const recurringCount = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(recurringPatterns)
    .where(eq(recurringPatterns.householdId, session.householdId));
  const recCount = Number(recurringCount[0]?.count ?? 0);

  // Fetch recent transactions
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
        <StatCard label="Transactions" value={String(recentTxns.length)} detail="recent" />
        <StatCard label="Accounts" value={String(acctCount)} detail="connected" />
        <StatCard label="Recurring" value={String(recCount)} detail="detected" />
      </div>

      {/* Recent transactions */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="font-mono text-sm font-medium text-foreground">
            Recent Transactions
          </h2>
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
                  className={`font-mono text-sm ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}
                >
                  {tx.type === "income" ? "+" : "-"}
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
