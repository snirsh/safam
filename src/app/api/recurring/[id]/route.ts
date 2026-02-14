import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recurringPatterns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";
import { frequencyToDays } from "@/lib/recurring/intervals";
import type { Frequency } from "@/lib/recurring/intervals";

const VALID_FREQUENCIES = Object.keys(frequencyToDays);

async function verifyOwnership(id: string, householdId: string) {
  const [existing] = await db
    .select({ id: recurringPatterns.id })
    .from(recurringPatterns)
    .where(
      and(
        eq(recurringPatterns.id, id),
        eq(recurringPatterns.householdId, householdId),
      ),
    );
  return existing;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = (await request.json()) as {
      isActive?: boolean;
      description?: string;
      expectedAmount?: number;
      frequency?: string;
      categoryId?: string | null;
      accountId?: string | null;
      nextExpectedDate?: string | null;
    };

    if (!await verifyOwnership(id, session.householdId)) {
      return NextResponse.json(
        { error: "Pattern not found" },
        { status: 404 },
      );
    }

    if (body.frequency && !VALID_FREQUENCIES.includes(body.frequency)) {
      return NextResponse.json(
        { error: "Invalid frequency" },
        { status: 400 },
      );
    }

    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if (body.isActive !== undefined) updateSet.isActive = body.isActive;
    if (body.description !== undefined)
      updateSet.description = body.description.trim();
    if (body.expectedAmount !== undefined)
      updateSet.expectedAmount = body.expectedAmount.toFixed(2);
    if (body.frequency !== undefined) updateSet.frequency = body.frequency;
    if (body.categoryId !== undefined) updateSet.categoryId = body.categoryId;
    if (body.accountId !== undefined) updateSet.accountId = body.accountId;
    if (body.nextExpectedDate !== undefined) {
      updateSet.nextExpectedDate = body.nextExpectedDate
        ? new Date(body.nextExpectedDate)
        : null;
    }

    if (Object.keys(updateSet).length <= 1) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    // If frequency changes and no explicit nextExpectedDate, recalculate
    if (body.frequency && body.nextExpectedDate === undefined) {
      const [pattern] = await db
        .select({ lastOccurrence: recurringPatterns.lastOccurrence })
        .from(recurringPatterns)
        .where(eq(recurringPatterns.id, id));
      if (pattern?.lastOccurrence) {
        const days = frequencyToDays[body.frequency as Frequency];
        const next = new Date(pattern.lastOccurrence);
        next.setDate(next.getDate() + days);
        updateSet.nextExpectedDate = next;
      }
    }

    await db
      .update(recurringPatterns)
      .set(updateSet)
      .where(eq(recurringPatterns.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update pattern";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    if (!await verifyOwnership(id, session.householdId)) {
      return NextResponse.json(
        { error: "Pattern not found" },
        { status: 404 },
      );
    }

    await db
      .delete(recurringPatterns)
      .where(eq(recurringPatterns.id, id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete pattern";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
