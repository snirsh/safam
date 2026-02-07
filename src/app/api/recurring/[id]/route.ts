import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recurringPatterns } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = (await request.json()) as { isActive?: boolean };

    // Verify pattern belongs to household
    const [existing] = await db
      .select({ id: recurringPatterns.id })
      .from(recurringPatterns)
      .where(
        and(
          eq(recurringPatterns.id, id),
          eq(recurringPatterns.householdId, session.householdId),
        ),
      );

    if (!existing) {
      return NextResponse.json(
        { error: "Pattern not found" },
        { status: 404 },
      );
    }

    if (body.isActive === undefined) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    await db
      .update(recurringPatterns)
      .set({ isActive: body.isActive, updatedAt: new Date() })
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
