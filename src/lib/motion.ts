// Centralized animation constants for Safam
// Design principle: fast, subtle, purposeful (warm minimalism)

// Durations (seconds)
export const duration = {
  fast: 0.15, // micro-interactions (button press, toggle)
  normal: 0.2, // standard transitions (fade, slide)
  slow: 0.25, // page transitions, larger elements
} as const;

// Easings — no springs (power-user tool, not playful)
export const easing = {
  enter: [0, 0, 0.2, 1] as const, // ease-out for entries
  exit: [0.4, 0, 1, 1] as const, // ease-in for exits
  inOut: [0.4, 0, 0.2, 1] as const, // ease-in-out
} as const;

// Stagger config
export const stagger = {
  fast: 0.03, // 30ms between items
  normal: 0.04, // 40ms between items
} as const;

// --- Reusable variants ---

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const;

export const fadeSlideUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
} as const;

// Page enter animation (no exit — App Router unmounts immediately)
export const pageTransition = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: easing.enter },
  },
} as const;

// Container variant that staggers children
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: stagger.fast,
      delayChildren: 0.05,
    },
  },
} as const;

// Individual staggered item
export const staggerItem = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.normal, ease: easing.enter },
  },
} as const;
