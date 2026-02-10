"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export function RefreshButton() {
  const router = useRouter();

  return (
    <motion.button
      whileTap={{ scale: 0.9, rotate: 180 }}
      transition={{ duration: 0.3 }}
      onClick={() => router.refresh()}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title="Refresh"
    >
      <span className="font-mono text-sm">&#8635;</span>
    </motion.button>
  );
}
