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
import { frequencyToDays } from "@/lib/recurring/intervals";
import type { Frequency } from "@/lib/recurring/intervals";

const VALID_FREQUENCIES = Object.keys(frequencyToDays);

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

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = (await request.json()) as {
      description: string;
      expectedAmount: number;
      frequency: string;
      categoryId?: string | null;
      accountId?: string | null;
      nextExpectedDate?: string | null;
    };

    if (!body.description?.trim() || !body.expectedAmount || !body.frequency) {
      return NextResponse.json(
        { error: "description, expectedAmount, and frequency are required" },
        { status: 400 },
      );
    }

    if (!VALID_FREQUENCIES.includes(body.frequency)) {
      return NextResponse.json(
        { error: "Invalid frequency" },
        { status: 400 },
      );
    }

    const nextExpectedDate = body.nextExpectedDate
      ? new Date(body.nextExpectedDate)
      : null;

    const [created] = await db
      .insert(recurringPatterns)
      .values({
        householdId: session.householdId,
        description: body.description.trim(),
        expectedAmount: body.expectedAmount.toFixed(2),
        frequency: body.frequency as Frequency,
        categoryId: body.categoryId ?? null,
        accountId: body.accountId ?? null,
        nextExpectedDate,
        isActive: true,
        confidence: "1.00",
      })
      .returning();

    return NextResponse.json({ pattern: created }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create pattern";
    // Handle unique constraint violation
    if (
      message.includes("duplicate key") ||
      message.includes("unique constraint")
    ) {
      return NextResponse.json(
        { error: "A pattern with this description already exists" },
        { status: 409 },
      );
    }
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
