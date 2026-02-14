"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function DemoWelcomeToast() {
  const shown = useRef(false);

  useEffect(() => {
    if (
      process.env["NEXT_PUBLIC_DEMO_MODE"] !== "true" ||
      shown.current
    ) {
      return;
    }
    shown.current = true;

    // Small delay so it doesn't fire during hydration
    const timer = setTimeout(() => {
      toast.info("Welcome to Safam! Explore 12 months of sample data.", {
        duration: 5000,
      });
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
