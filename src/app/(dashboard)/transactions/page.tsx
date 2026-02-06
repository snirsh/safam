import Link from "next/link";
import { db } from "@/lib/db";
import { categories, financialAccounts, transactions } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, sql, and, gte, lt } from "drizzle-orm";

function formatILS(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function parseMonth(param: string | undefined): { year: number; month: number } {
  if (param) {
    const match = /^(\d{4})-(\d{2})$/.exec(param);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]);
      if (y >= 2020 && y <= 2030 && m >= 1 && m <= 12) {
        return { year: y, month: m - 1 };
      }
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireAuth();
  const params = await searchParams;
  const { year, month } = parseMonth(params.month);

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  const txns = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.transactionType,
      date: transactions.date,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      accountName: financialAccounts.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(
      financialAccounts,
      eq(transactions.accountId, financialAccounts.id),
    )
    .where(
      and(
        eq(transactions.householdId, session.householdId),
        gte(transactions.date, start),
        lt(transactions.date, end),
      ),
    )
    .orderBy(sql`${transactions.date} DESC`);

  const income = txns
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = txns
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xl font-bold text-foreground">
          Transactions
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/transactions?month=${monthKey(prevMonth.getFullYear(), prevMonth.getMonth())}`}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            &larr;
          </Link>
          <span className="min-w-[140px] text-center font-mono text-sm text-foreground">
            {monthLabel(year, month)}
          </span>
          {isCurrentMonth ? (
            <span className="w-7" />
          ) : (
            <Link
              href={`/transactions?month=${monthKey(nextMonth.getFullYear(), nextMonth.getMonth())}`}
              className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Month summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Income
          </p>
          <p className="mt-0.5 font-mono text-lg font-bold text-green-500">
            {formatILS(income)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Expenses
          </p>
          <p className="mt-0.5 font-mono text-lg font-bold text-red-500">
            {formatILS(expenses)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Balance
          </p>
          <p
            className={`mt-0.5 font-mono text-lg font-bold ${income - expenses >= 0 ? "text-green-500" : "text-red-500"}`}
          >
            {formatILS(income - expenses)}
          </p>
        </div>
      </div>

      {txns.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No transactions for {monthLabel(year, month)}.
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {txns.length} transactions
          </p>

          {/* Desktop table */}
          <div className="hidden rounded-lg border border-border bg-card md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Description
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Category
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Account
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {txns.map((tx) => (
                  <tr
                    key={tx.id}
                    className="transition-colors hover:bg-accent/50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("he-IL")}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {tx.description}
                    </td>
                    <td className="px-4 py-3">
                      {tx.categoryName ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs text-muted-foreground">
                          {tx.categoryIcon} {tx.categoryName}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {tx.accountName}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-mono text-sm ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatILS(Math.abs(Number(tx.amount)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="space-y-2 md:hidden">
            {txns.map((tx) => (
              <div
                key={tx.id}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {tx.description}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString("he-IL")}
                      </span>
                      {tx.categoryName ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">
                          {tx.categoryIcon} {tx.categoryName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`ml-3 shrink-0 font-mono text-sm font-medium ${tx.type === "income" ? "text-green-500" : "text-red-500"}`}
                  >
                    {tx.type === "income" ? "+" : "-"}
                    {formatILS(Math.abs(Number(tx.amount)))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
