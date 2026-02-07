"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PatternToggle({
  patternId,
  isActive,
}: {
  patternId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    try {
      const res = await fetch(`/api/recurring/${patternId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error("Failed to update");
      router.refresh();
    } catch {
      // Revert on error — refresh will restore server state
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="group flex h-5 w-5 shrink-0 items-center justify-center"
      title={isActive ? "Deactivate pattern" : "Activate pattern"}
    >
      <span
        className={`block h-2.5 w-2.5 rounded-full transition-colors ${
          pending
            ? "animate-pulse bg-muted-foreground"
            : isActive
              ? "bg-green-500 group-hover:bg-green-400"
              : "bg-muted-foreground group-hover:bg-green-500"
        }`}
      />
    </button>
  );
}
