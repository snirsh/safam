"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export function RedetectButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function redetect() {
    setPending(true);
    try {
      const res = await fetch("/api/recurring/detect", { method: "POST" });
      if (!res.ok) throw new Error("Detection failed");
      const data = (await res.json()) as { detected: number; updated: number };
      toast.success(
        `Detection complete: ${data.detected} new, ${data.updated} updated`,
      );
      router.refresh();
    } catch {
      toast.error("Failed to run detection");
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.button
      type="button"
      onClick={redetect}
      disabled={pending}
      whileTap={{ scale: 0.97 }}
      className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={pending ? "loading" : "idle"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          {pending ? "Detecting..." : "Re-detect"}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
