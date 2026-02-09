/**
 * Seeds local DB with test data for verifying the forecast rework.
 *
 * Expected results after running:
 * - Bank balance: 10,000 + 15,000 - 5,200 - 3,000 = 16,800
 * - CC liability: 500 + 1,200 = 1,700
 * - Pending bank recurring: salary (+15,000) and mortgage (-5,200) if not yet fulfilled
 * - Pending CC recurring: Netflix (-55) shown but doesn't affect projection
 *
 * Usage: pnpm tsx scripts/seed-forecast-test.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/lib/db/index";
import {
  households,
  users,
  categories,
  financialAccounts,
  transactions,
  recurringPatterns,
} from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

const HOUSEHOLD_NAME = "__forecast_test__";

async function main() {
  console.log("Cleaning up previous test data...");

  // Find and delete existing test household
  const existing = await db
    .select({ id: households.id })
    .from(households)
    .where(eq(households.name, HOUSEHOLD_NAME));

  for (const h of existing) {
    await db.delete(recurringPatterns).where(eq(recurringPatterns.householdId, h.id));
    await db.delete(transactions).where(eq(transactions.householdId, h.id));
    await db.delete(financialAccounts).where(eq(financialAccounts.householdId, h.id));
    await db.delete(categories).where(eq(categories.householdId, h.id));
    await db.delete(users).where(eq(users.householdId, h.id));
    await db.delete(households).where(eq(households.id, h.id));
  }

  console.log("Creating test household...");

  const [household] = await db
    .insert(households)
    .values({ name: HOUSEHOLD_NAME })
    .returning({ id: households.id });

  const householdId = household!.id;

  // Create a test user
  await db.insert(users).values({
    householdId,
    displayName: "Test User",
  });

  // Create categories
  const [incomeParent] = await db
    .insert(categories)
    .values({ householdId, name: "Income", icon: "💰", color: "#22c55e", isSystem: true })
    .returning({ id: categories.id });

  const [housingParent] = await db
    .insert(categories)
    .values({ householdId, name: "Housing", icon: "🏠", color: "#3b82f6", isSystem: true })
    .returning({ id: categories.id });

  const [subsParent] = await db
    .insert(categories)
    .values({ householdId, name: "Subscriptions", icon: "🔄", color: "#ec4899", isSystem: true })
    .returning({ id: categories.id });

  const [transfersParent] = await db
    .insert(categories)
    .values({ householdId, name: "Transfers", icon: "🔄", color: "#64748b", isSystem: true })
    .returning({ id: categories.id });

  const [salaryCat] = await db
    .insert(categories)
    .values({ householdId, name: "Salary", icon: "💰", color: "#22c55e", parentId: incomeParent!.id, isSystem: true })
    .returning({ id: categories.id });

  const [mortgageCat] = await db
    .insert(categories)
    .values({ householdId, name: "Mortgage", icon: "🏦", color: "#2563eb", parentId: housingParent!.id, isSystem: true })
    .returning({ id: categories.id });

  const [netflixCat] = await db
    .insert(categories)
    .values({ householdId, name: "Netflix", icon: "📺", color: "#e11d48", parentId: subsParent!.id, isSystem: true })
    .returning({ id: categories.id });

  const [ccPaymentCat] = await db
    .insert(categories)
    .values({ householdId, name: "CC Payment", icon: "💳", color: "#64748b", parentId: transfersParent!.id, isSystem: true })
    .returning({ id: categories.id });

  // Create accounts
  const [bankAccount] = await db
    .insert(financialAccounts)
    .values({
      householdId,
      name: "Test Bank",
      institution: "one_zero",
      accountType: "bank",
      lastFourDigits: "1234",
      startingBalance: "10000",
    })
    .returning({ id: financialAccounts.id });

  const [ccAccount] = await db
    .insert(financialAccounts)
    .values({
      householdId,
      name: "Test CC",
      institution: "isracard",
      accountType: "credit_card",
      lastFourDigits: "5678",
      startingBalance: "0",
    })
    .returning({ id: financialAccounts.id });

  const bankId = bankAccount!.id;
  const ccId = ccAccount!.id;

  // Create transactions this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Bank: Salary on the 5th
  await db.insert(transactions).values({
    householdId,
    accountId: bankId,
    externalId: "test-salary-1",
    date: new Date(monthStart.getFullYear(), monthStart.getMonth(), 5),
    description: "Salary deposit",
    amount: "15000",
    transactionType: "income",
    categoryId: salaryCat!.id,
  });

  // Bank: Mortgage on the 3rd
  await db.insert(transactions).values({
    householdId,
    accountId: bankId,
    externalId: "test-mortgage-1",
    date: new Date(monthStart.getFullYear(), monthStart.getMonth(), 3),
    description: "Mortgage payment",
    amount: "5200",
    transactionType: "expense",
    categoryId: mortgageCat!.id,
  });

  // Bank: CC payment on the 2nd (transfer)
  await db.insert(transactions).values({
    householdId,
    accountId: bankId,
    externalId: "test-cc-payment-1",
    date: new Date(monthStart.getFullYear(), monthStart.getMonth(), 2),
    description: "Isracard payment",
    amount: "3000",
    transactionType: "transfer",
    categoryId: ccPaymentCat!.id,
  });

  // CC: Netflix on the 8th
  await db.insert(transactions).values({
    householdId,
    accountId: ccId,
    externalId: "test-netflix-1",
    date: new Date(monthStart.getFullYear(), monthStart.getMonth(), 8),
    description: "Netflix subscription",
    amount: "55",
    transactionType: "expense",
    categoryId: netflixCat!.id,
  });

  // CC: Groceries on the 6th
  await db.insert(transactions).values({
    householdId,
    accountId: ccId,
    externalId: "test-groceries-1",
    date: new Date(monthStart.getFullYear(), monthStart.getMonth(), 6),
    description: "Supermarket",
    amount: "1200",
    transactionType: "expense",
  });

  // Create recurring patterns
  // Bank: Salary (monthly, next expected on 10th)
  await db.insert(recurringPatterns).values({
    householdId,
    description: "Salary deposit",
    expectedAmount: "15000",
    frequency: "monthly",
    categoryId: salaryCat!.id,
    accountId: bankId,
    lastOccurrence: new Date(monthStart.getFullYear(), monthStart.getMonth(), 5),
    nextExpectedDate: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 5),
    confidence: "0.95",
  });

  // Bank: Mortgage (monthly, next expected on 15th — unfulfilled this month)
  await db.insert(recurringPatterns).values({
    householdId,
    description: "Mortgage payment",
    expectedAmount: "5200",
    frequency: "monthly",
    categoryId: mortgageCat!.id,
    accountId: bankId,
    lastOccurrence: new Date(monthStart.getFullYear(), monthStart.getMonth(), 3),
    nextExpectedDate: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 3),
    confidence: "0.92",
  });

  // CC: Netflix (monthly, next expected on 20th — unfulfilled)
  await db.insert(recurringPatterns).values({
    householdId,
    description: "Netflix subscription",
    expectedAmount: "55",
    frequency: "monthly",
    categoryId: netflixCat!.id,
    accountId: ccId,
    lastOccurrence: new Date(monthStart.getFullYear(), monthStart.getMonth(), 8),
    nextExpectedDate: new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 8),
    confidence: "0.90",
  });

  console.log("\nTest data created successfully!");
  console.log(`Household ID: ${householdId}`);
  console.log("\nExpected values:");
  console.log("  Bank balance: 10,000 + 15,000 - 5,200 - 3,000 = 16,800");
  console.log("  CC liability: 55 + 1,200 = 1,255");
  console.log("  Salary recurring: fulfilled this month (already happened)");
  console.log("  Mortgage recurring: fulfilled this month (already happened)");
  console.log("  Netflix recurring: fulfilled this month (already happened)");
  console.log("\nNote: All recurring patterns have nextExpectedDate in NEXT month,");
  console.log("so no pending items this month. Projected EOM = bank balance = 16,800");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
