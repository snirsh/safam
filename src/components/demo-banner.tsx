"use client";

import { useState } from "react";

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (process.env["NEXT_PUBLIC_DEMO_MODE"] !== "true" || dismissed) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 bg-primary px-4 py-1.5 text-xs text-primary-foreground">
      <span>Demo mode — data resets periodically</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 rounded px-1.5 py-0.5 text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
        aria-label="Dismiss banner"
      >
        &times;
      </button>
    </div>
  );
}
