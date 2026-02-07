import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  transactions,
  categories,
  categorizationRules,
} from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const body = (await request.json()) as { categoryId?: string };
    if (!body.categoryId) {
      return NextResponse.json(
        { error: "categoryId is required" },
        { status: 400 },
      );
    }

    // Verify the category belongs to the user's household
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.id, body.categoryId),
          eq(categories.householdId, session.householdId),
        ),
      )
      .limit(1);

    if (!category) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }

    // Verify the transaction belongs to the user's household
    const [tx] = await db
      .select({
        id: transactions.id,
        description: transactions.description,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.id, id),
          eq(transactions.householdId, session.householdId),
        ),
      )
      .limit(1);

    if (!tx) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    // Update the transaction with the new category
    await db
      .update(transactions)
      .set({
        categoryId: body.categoryId,
        isCategoryOverridden: true,
        classificationMethod: "manual",
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, id));

    // Auto-create/update categorization rule for future auto-categorization
    const normalizedPattern = tx.description.trim().toLowerCase();
    await db
      .insert(categorizationRules)
      .values({
        householdId: session.householdId,
        pattern: normalizedPattern,
        categoryId: body.categoryId,
      })
      .onConflictDoUpdate({
        target: [categorizationRules.householdId, categorizationRules.pattern],
        set: {
          categoryId: body.categoryId,
        },
      });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PATCH /api/transactions/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 },
    );
  }
}
