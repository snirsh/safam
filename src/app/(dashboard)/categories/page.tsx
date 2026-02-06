import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq } from "drizzle-orm";

export default async function CategoriesPage() {
  const session = await requireAuth();

  const parentCategories = await db
    .select()
    .from(categories)
    .where(
      eq(categories.householdId, session.householdId),
    )
    .orderBy(categories.name);

  const parents = parentCategories.filter((c) => !c.parentId);
  const children = parentCategories.filter((c) => c.parentId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="font-mono text-xl font-bold text-foreground">
        Categories
      </h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {parents.map((parent) => {
          const subs = children.filter((c) => c.parentId === parent.id);
          return (
            <div
              key={parent.id}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2">
                <span>{parent.icon}</span>
                <span className="font-medium text-foreground">
                  {parent.name}
                </span>
                <span
                  className="ml-auto h-3 w-3 rounded-full"
                  style={{ backgroundColor: parent.color ?? "#888" }}
                />
              </div>
              {subs.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {subs.map((sub) => (
                    <span
                      key={sub.id}
                      className="rounded-md bg-accent px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {sub.icon} {sub.name}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
