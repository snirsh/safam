"use client";

import { motion } from "framer-motion";
import { staggerItem } from "@/lib/motion";

export function MotionItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}
