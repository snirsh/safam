"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useSpring, useTransform, motion } from "framer-motion";
import { formatILS } from "@/lib/format";

interface AnimatedNumberProps {
  value: number;
  format?: ((n: number) => string) | undefined;
  prefix?: string | undefined;
  className?: string | undefined;
}

export function AnimatedNumber({
  value,
  format = formatILS,
  prefix,
  className,
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { duration: 800, bounce: 0 });
  const display = useTransform(spring, (current) => {
    const formatted = format(Math.round(current));
    return prefix ? `${prefix}${formatted}` : formatted;
  });
  const ref = useRef(false);

  useEffect(() => {
    // Only animate on first mount, then snap to value on updates
    if (!ref.current) {
      ref.current = true;
      motionValue.set(value);
    } else {
      spring.set(value);
    }
  }, [value, motionValue, spring]);

  return <motion.span className={className}>{display}</motion.span>;
}
