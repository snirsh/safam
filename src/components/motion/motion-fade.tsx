"use client";

import { motion } from "framer-motion";
import { fadeIn, duration, easing } from "@/lib/motion";

export function MotionFade({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={fadeIn.initial}
      animate={{
        ...fadeIn.animate,
        transition: { duration: duration.normal, ease: easing.enter, delay },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
