import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { categories, financialAccounts, transactions } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, sql, and, gte, lt, ilike } from "drizzle-orm";
import { formatILS, parseMonth, monthKey, monthLabel } from "@/lib/format";
import { effectiveDateExpr } from "@/lib/db/helpers";
import { FilterBar } from "@/components/transactions/filter-bar";
import { CategorySelector } from "@/components/transactions/category-selector";
import { ClassificationBadge } from "@/components/transactions/classification-badge";
import { MotionPage, MotionList, MotionItem, MotionTbody, MotionTr, staggerContainer, staggerItem, AnimatedNumber } from "@/components/motion";

interface SearchParams {
  month?: string;
  category?: string;
  account?: string;
  type?: string;
  search?: string;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireAuth();
  const params = await searchParams;
  const { year, month } = parseMonth(params.month);

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);

  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const now = new Date();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth();

  // Use billing date (processedDate) when available and valid, fall back to purchase date.
  const effectiveDate = effectiveDateExpr();

  // Build filter conditions
  const conditions = [
    eq(transactions.householdId, session.householdId),
    gte(effectiveDate, start),
    lt(effectiveDate, end),
  ];

  if (params.category) {
    // Also match parent category — if selected category is a parent,
    // include all transactions with child categories too
    const [selectedCat] = await db
      .select({ parentId: categories.parentId })
      .from(categories)
      .where(eq(categories.id, params.category))
      .limit(1);

    if (selectedCat && !selectedCat.parentId) {
      // It's a parent category — get all child IDs
      const childCats = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.parentId, params.category));
      const allIds = [
        params.category,
        ...childCats.map((c) => c.id),
      ];
      conditions.push(
        sql`${transactions.categoryId} IN (${sql.join(
          allIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
    } else {
      conditions.push(eq(transactions.categoryId, params.category));
    }
  }

  if (params.account) {
    conditions.push(eq(transactions.accountId, params.account));
  }

  if (params.type === "income" || params.type === "expense" || params.type === "transfer") {
    conditions.push(eq(transactions.transactionType, params.type));
  }

  if (params.search) {
    conditions.push(ilike(transactions.description, `%${params.search}%`));
  }

  const txns = await db
    .select({
      id: transactions.id,
      description: transactions.description,
      amount: transactions.amount,
      type: transactions.transactionType,
      date: transactions.date,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryParentId: categories.parentId,
      classificationMethod: transactions.classificationMethod,
      accountName: financialAccounts.name,
      accountType: financialAccounts.accountType,
      processedDate: transactions.processedDate,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(
      financialAccounts,
      eq(transactions.accountId, financialAccounts.id),
    )
    .where(and(...conditions))
    .orderBy(sql`${effectiveDate} DESC`);

  const income = txns
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = txns
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Fetch all categories for filters and category selector
  const allCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.householdId, session.householdId))
    .orderBy(categories.name);

  const parentCategories = allCategories.filter((c) => !c.parentId);
  const childCategories = allCategories.filter((c) => c.parentId);

  // For filter bar: flat list of parent categories
  const filterCategories = parentCategories.map((p) => ({
    id: p.id,
    name: p.name,
    icon: p.icon,
  }));

  // For category selector: nested groups
  const categoryGroups = parentCategories.map((parent) => ({
    id: parent.id,
    name: parent.name,
    icon: parent.icon,
    children: childCategories
      .filter((c) => c.parentId === parent.id)
      .map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
  }));

  // Fetch accounts for filter
  const accountsList = await db
    .select({ id: financialAccounts.id, name: financialAccounts.name, accountType: financialAccounts.accountType })
    .from(financialAccounts)
    .where(eq(financialAccounts.householdId, session.householdId))
    .orderBy(financialAccounts.name);

  return (
    <MotionPage className="mx-auto max-w-4xl space-y-6">
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

      {/* Filters */}
      <Suspense>
        <FilterBar categories={filterCategories} accounts={accountsList} />
      </Suspense>

      {/* Month summary */}
      <MotionList className="grid grid-cols-3 gap-2 sm:gap-4">
        <MotionItem className="min-w-0 overflow-hidden rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
            Income
          </p>
          <AnimatedNumber value={income} className="mt-0.5 block truncate font-mono text-sm font-bold text-green-500 sm:text-lg" />
        </MotionItem>
        <MotionItem className="min-w-0 overflow-hidden rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
            Expenses
          </p>
          <AnimatedNumber value={expenses} className="mt-0.5 block truncate font-mono text-sm font-bold text-red-500 sm:text-lg" />
        </MotionItem>
        <MotionItem className="min-w-0 overflow-hidden rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
            Balance
          </p>
          <AnimatedNumber
            value={income - expenses}
            className={`mt-0.5 block truncate font-mono text-sm font-bold sm:text-lg ${income - expenses >= 0 ? "text-green-500" : "text-red-500"}`}
          />
        </MotionItem>
      </MotionList>

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
              <MotionTbody className="divide-y divide-border" initial="initial" animate="animate" variants={staggerContainer}>
                {txns.map((tx) => (
                  <MotionTr
                    key={tx.id}
                    className="transition-colors hover:bg-accent/50"
                    variants={staggerItem}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString("he-IL")}
                      {tx.processedDate && tx.accountType === "credit_card" ? (
                        <span className="block text-[10px] text-muted-foreground/60">
                          billed {new Date(tx.processedDate).toLocaleDateString("he-IL")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {tx.description}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <CategorySelector
                          transactionId={tx.id}
                          currentCategoryName={tx.categoryName}
                          currentCategoryIcon={tx.categoryIcon}
                          categories={categoryGroups}
                        />
                        <ClassificationBadge method={tx.classificationMethod} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {tx.accountName}
                    </td>
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-mono text-sm ${tx.type === "income" ? "text-green-500" : tx.type === "transfer" ? "text-muted-foreground" : "text-red-500"}`}
                    >
                      {tx.type === "income" ? "+" : tx.type === "transfer" ? "" : "-"}
                      {formatILS(Math.abs(Number(tx.amount)))}
                    </td>
                  </MotionTr>
                ))}
              </MotionTbody>
            </table>
          </div>

          {/* Mobile card list */}
          <MotionList className="space-y-2 md:hidden">
            {txns.map((tx) => (
              <MotionItem
                key={tx.id}
                className="overflow-hidden rounded-lg border border-border bg-card px-3 py-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      {tx.description}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString("he-IL")}
                        {tx.processedDate && tx.accountType === "credit_card" ? (
                          <span className="ml-1 text-[10px] text-muted-foreground/60">
                            (billed {new Date(tx.processedDate).toLocaleDateString("he-IL")})
                          </span>
                        ) : null}
                      </span>
                      <CategorySelector
                        transactionId={tx.id}
                        currentCategoryName={tx.categoryName}
                        currentCategoryIcon={tx.categoryIcon}
                        categories={categoryGroups}
                      />
                      <ClassificationBadge method={tx.classificationMethod} />
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-sm font-medium ${tx.type === "income" ? "text-green-500" : tx.type === "transfer" ? "text-muted-foreground" : "text-red-500"}`}
                  >
                    {tx.type === "income" ? "+" : tx.type === "transfer" ? "" : "-"}
                    {formatILS(Math.abs(Number(tx.amount)))}
                  </span>
                </div>
            </MotionItem>
            ))}
          </MotionList>
        </>
      )}
    </MotionPage>
  );
}
