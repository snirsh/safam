"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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

  async function handleSync(full?: boolean) {
    setIsLoading(true);

    try {
      const url = full
        ? `/api/accounts/${accountId}/sync?full=1`
        : `/api/accounts/${accountId}/sync`;
      const response = await fetch(url, { method: "POST" });

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
    <>
      <motion.div whileTap={{ scale: 0.97 }}>
        <Button
          size="sm"
          variant="outline"
          className="h-10 sm:h-8"
          onClick={() => handleSync()}
          disabled={isLoading || disabled}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={isLoading ? "loading" : "idle"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              {isLoading ? "Syncing..." : "Sync Now"}
            </motion.span>
          </AnimatePresence>
        </Button>
      </motion.div>
      <Button
        size="sm"
        variant="outline"
        className="h-10 sm:h-8"
        onClick={() => handleSync(true)}
        disabled={isLoading || disabled}
      >
        {isLoading ? "Syncing..." : "Last 30 days"}
      </Button>
    </>
  );
}
