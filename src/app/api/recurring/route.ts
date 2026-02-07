import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  recurringPatterns,
  categories,
  financialAccounts,
} from "@/lib/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
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
      .leftJoin(
        parentCategories,
        eq(categories.parentId, parentCategories.id),
      )
      .leftJoin(
        financialAccounts,
        eq(recurringPatterns.accountId, financialAccounts.id),
      )
      .where(eq(recurringPatterns.householdId, session.householdId))
      .orderBy(recurringPatterns.description);

    return NextResponse.json({ patterns });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch patterns";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
