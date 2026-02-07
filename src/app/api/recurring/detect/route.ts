import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { detectRecurringPatterns } from "@/lib/recurring/detect";

export async function POST() {
  try {
    const session = await requireAuth();
    const result = await detectRecurringPatterns(session.householdId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Detection failed";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("POST /api/recurring/detect error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
