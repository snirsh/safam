"use client";

import { motion } from "framer-motion";
import { pageTransition } from "@/lib/motion";

export function MotionPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      className={className}
    >
      {children}
    </motion.div>
  );
}
