"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SyncButton({
  accountId,
  disabled,
}: {
  accountId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSync() {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/accounts/${accountId}/sync`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Sync failed");
      }

      const result = (await response.json()) as { added: number; duplicates: number };
      toast.success(`Synced: +${result.added} transactions`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleSync}
      disabled={isLoading || disabled}
    >
      {isLoading ? "Syncing..." : "Sync Now"}
    </Button>
  );
}
