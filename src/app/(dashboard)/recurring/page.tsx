import { db } from "@/lib/db";
import {
  categories,
  financialAccounts,
  recurringPatterns,
} from "@/lib/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { formatILS } from "@/lib/format";
import { PatternToggle } from "@/components/recurring/pattern-toggle";
import { RedetectButton } from "@/components/recurring/redetect-button";
import { MotionPage, MotionList, MotionItem, AnimatedNumber } from "@/components/motion";

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  bi_weekly: "Bi-weekly",
  monthly: "Monthly",
  bi_monthly: "Bi-monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  yearly: "Yearly",
};

export default async function RecurringPage() {
  const session = await requireAuth();
  const parentCategories = alias(categories, "parent_categories");

  const patterns = await db
    .select({
      id: recurringPatterns.id,
      description: recurringPatterns.description,
      expectedAmount: recurringPatterns.expectedAmount,
      frequency: recurringPatterns.frequency,
      isActive: recurringPatterns.isActive,
      confidence: recurringPatterns.confidence,
      nextExpectedDate: recurringPatterns.nextExpectedDate,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      parentCategoryName: parentCategories.name,
      accountName: financialAccounts.name,
    })
    .from(recurringPatterns)
    .leftJoin(categories, eq(recurringPatterns.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .leftJoin(
      financialAccounts,
      eq(recurringPatterns.accountId, financialAccounts.id),
    )
    .where(eq(recurringPatterns.householdId, session.householdId))
    .orderBy(recurringPatterns.description);

  const incomePatterns = patterns.filter(
    (p) => p.parentCategoryName === "Income",
  );
  const expensePatterns = patterns.filter(
    (p) => p.parentCategoryName !== "Income",
  );

  const monthlyIncome = incomePatterns
    .filter((p) => p.isActive && p.frequency === "monthly")
    .reduce((sum, p) => sum + Number(p.expectedAmount), 0);
  const monthlyExpenses = expensePatterns
    .filter((p) => p.isActive && p.frequency === "monthly")
    .reduce((sum, p) => sum + Number(p.expectedAmount), 0);

  return (
    <MotionPage className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xl font-bold text-foreground">
          Recurring
        </h1>
        <RedetectButton />
      </div>

      {/* Summary cards */}
      <MotionList className="grid grid-cols-3 gap-2 sm:gap-4">
        <MotionItem className="rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
            Monthly Income
          </p>
          <AnimatedNumber value={monthlyIncome} prefix="+" className="mt-0.5 block truncate font-mono text-base font-bold text-green-500 sm:text-lg" />
        </MotionItem>
        <MotionItem className="rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
            Monthly Expenses
          </p>
          <AnimatedNumber value={monthlyExpenses} prefix="-" className="mt-0.5 block truncate font-mono text-base font-bold text-red-500 sm:text-lg" />
        </MotionItem>
        <MotionItem className="rounded-lg border border-border bg-card px-3 py-2 sm:px-4 sm:py-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
            Net Recurring
          </p>
          <AnimatedNumber
            value={monthlyIncome - monthlyExpenses}
            className={`mt-0.5 block truncate font-mono text-base font-bold sm:text-lg ${monthlyIncome - monthlyExpenses >= 0 ? "text-green-500" : "text-red-500"}`}
          />
        </MotionItem>
      </MotionList>

      {patterns.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No recurring patterns detected yet. Import more transactions to
          detect patterns.
        </div>
      ) : (
        <>
          {/* Income patterns */}
          {incomePatterns.length > 0 ? (
            <div>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Income ({incomePatterns.length})
              </h2>
              <PatternList patterns={incomePatterns} type="income" />
            </div>
          ) : null}

          {/* Expense patterns */}
          {expensePatterns.length > 0 ? (
            <div>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Expenses ({expensePatterns.length})
              </h2>
              <PatternList patterns={expensePatterns} type="expense" />
            </div>
          ) : null}
        </>
      )}
    </MotionPage>
  );
}

interface PatternRow {
  id: string;
  description: string;
  expectedAmount: string;
  frequency: string;
  isActive: boolean;
  confidence: string | null;
  nextExpectedDate: Date | null;
  categoryName: string | null;
  categoryIcon: string | null;
  accountName: string | null;
}

function PatternList({
  patterns,
  type,
}: {
  patterns: PatternRow[];
  type: "income" | "expense";
}) {
  const amountColor = type === "income" ? "text-green-500" : "text-red-500";
  const prefix = type === "income" ? "+" : "-";

  return (
    <div className="rounded-lg border border-border bg-card">
      <MotionList className="divide-y divide-border">
        {patterns.map((p) => {
          const confidence = Number(p.confidence ?? 0);
          const confidenceLabel =
            confidence >= 0.95
              ? "High"
              : confidence >= 0.85
                ? "Med"
                : "Low";
          const confidenceColor =
            confidence >= 0.95
              ? "text-green-500"
              : confidence >= 0.85
                ? "text-yellow-500"
                : "text-red-500";

          return (
            <MotionItem
              key={p.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <PatternToggle patternId={p.id} isActive={p.isActive} />
                  <p className="truncate text-sm text-foreground">
                    {p.description}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 pl-4">
                  {p.categoryName ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">
                      {p.categoryIcon} {p.categoryName}
                    </span>
                  ) : null}
                  <span className="rounded-md bg-accent px-1.5 py-0.5 text-xs text-muted-foreground">
                    {frequencyLabels[p.frequency] ?? p.frequency}
                  </span>
                  <span className={`text-xs font-medium ${confidenceColor}`}>
                    {confidenceLabel}
                  </span>
                </div>
              </div>
              <div className="ml-4 shrink-0 text-right">
                <p className={`font-mono text-sm font-medium ${amountColor}`}>
                  {prefix}
                  {formatILS(Number(p.expectedAmount))}
                </p>
                {p.nextExpectedDate ? (
                  <p className="font-mono text-xs text-muted-foreground">
                    next:{" "}
                    {new Date(p.nextExpectedDate).toLocaleDateString("he-IL")}
                  </p>
                ) : null}
              </div>
            </MotionItem>
          );
        })}
      </MotionList>
    </div>
  );
}
