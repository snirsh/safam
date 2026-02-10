"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";

interface SwipeableTransactionCardProps {
  children: React.ReactNode;
  onSwipeAction: () => void;
  actionLabel?: string;
}

export function SwipeableTransactionCard({
  children,
  onSwipeAction,
  actionLabel = "Categorize",
}: SwipeableTransactionCardProps) {
  const x = useMotionValue(0);
  const actionOpacity = useTransform(x, [-100, -50, 0], [1, 0.5, 0]);
  const [swiped, setSwiped] = useState(false);

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -80) {
      setSwiped(true);
      onSwipeAction();
      // Reset after a short delay
      setTimeout(() => setSwiped(false), 300);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Action revealed behind */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-center px-4"
        style={{
          opacity: swiped ? 1 : actionOpacity,
          backgroundColor: "#C15F3C",
        }}
      >
        <span className="text-xs font-medium text-white">{actionLabel}</span>
      </motion.div>

      {/* Draggable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="relative"
      >
        {children}
      </motion.div>
    </div>
  );
}
