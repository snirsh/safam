import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

interface CategoryWithChildren {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  isSystem: boolean;
  children: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  }[];
}

export async function GET() {
  try {
    const session = await requireAuth();

    const allCategories = await db
      .select()
      .from(categories)
      .where(eq(categories.householdId, session.householdId))
      .orderBy(categories.name);

    // Build nested structure: parents with children
    const parents = allCategories.filter((c) => !c.parentId);
    const children = allCategories.filter((c) => c.parentId);

    const nested: CategoryWithChildren[] = parents.map((parent) => ({
      id: parent.id,
      name: parent.name,
      icon: parent.icon,
      color: parent.color,
      parentId: parent.parentId,
      isSystem: parent.isSystem,
      children: children
        .filter((c) => c.parentId === parent.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          icon: c.icon,
          color: c.color,
        })),
    }));

    return NextResponse.json({ categories: nested });
  } catch (error) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const body = (await request.json()) as {
      name?: string;
      icon?: string;
      color?: string;
      parentId?: string;
    };

    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 },
      );
    }

    // If parentId is provided, verify it exists and belongs to household
    if (body.parentId) {
      const [parent] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(
          eq(categories.id, body.parentId),
        )
        .limit(1);

      if (!parent) {
        return NextResponse.json(
          { error: "Parent category not found" },
          { status: 404 },
        );
      }
    }

    const [created] = await db
      .insert(categories)
      .values({
        householdId: session.householdId,
        name: body.name.trim(),
        icon: body.icon ?? null,
        color: body.color ?? null,
        parentId: body.parentId ?? null,
        isSystem: false,
      })
      .returning();

    return NextResponse.json({ category: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/categories error:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
      { status: 500 },
    );
  }
}
