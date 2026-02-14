"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ScrapingSimulationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institution: string;
  accountName: string;
}

interface Step {
  label: string;
  duration: number;
}

const STEPS: Step[] = [
  { label: "Connecting to bank...", duration: 1500 },
  { label: "Authenticating...", duration: 1200 },
  { label: "Fetching transactions...", duration: 2500 },
  { label: "Processing transactions...", duration: 1000 },
  { label: "Categorizing with AI...", duration: 1200 },
];

const BANK_COLORS: Record<string, string> = {
  leumi: "bg-blue-500",
  hapoalim: "bg-red-500",
  isracard: "bg-orange-500",
  one_zero: "bg-emerald-500",
  max: "bg-purple-500",
};

const BANK_LABELS: Record<string, string> = {
  leumi: "Bank Leumi",
  hapoalim: "Bank Hapoalim",
  isracard: "Isracard",
  one_zero: "ONE Zero",
  max: "Max",
};

export function ScrapingSimulation({
  open,
  onOpenChange,
  institution,
  accountName,
}: ScrapingSimulationProps) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [txCount] = useState(() => 35 + Math.floor(Math.random() * 30));
  const [dupeCount] = useState(() => Math.floor(Math.random() * 5));

  const runSimulation = useCallback(async () => {
    setCurrentStep(-1);
    setProgress(0);
    setDone(false);

    for (let i = 0; i < STEPS.length; i++) {
      setCurrentStep(i);
      const step = STEPS[i]!;

      // Animate progress during "Fetching" step
      if (i === 2) {
        const interval = step.duration / 20;
        for (let p = 0; p <= 100; p += 5) {
          setProgress(p);
          await sleep(interval);
        }
      } else {
        await sleep(step.duration);
      }
    }

    setDone(true);
  }, []);

  useEffect(() => {
    if (open) {
      runSimulation();
    }
  }, [open, runSimulation]);

  const bankColor = BANK_COLORS[institution] ?? "bg-gray-500";
  const bankLabel = BANK_LABELS[institution] ?? institution;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`h-8 w-8 rounded-lg ${bankColor} flex items-center justify-center`}>
              <span className="text-sm font-bold text-white">
                {bankLabel.charAt(0)}
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold">{accountName}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {bankLabel}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Steps */}
          <div className="space-y-3">
            <AnimatePresence mode="wait">
              {!done ? (
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3"
                >
                  <motion.div
                    className={`h-5 w-5 rounded-full border-2 ${bankColor.replace("bg-", "border-")}`}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  />
                  <span className="text-sm text-foreground">
                    {STEPS[currentStep]?.label ?? "Initializing..."}
                  </span>
                </motion.div>
              ) : (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs text-white">
                    ✓
                  </div>
                  <span className="text-sm font-medium text-green-500">
                    Sync complete!
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Progress bar (shown during fetch step) */}
          {currentStep === 2 && !done ? (
            <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
              <motion.div
                className={`h-full rounded-full ${bankColor}`}
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          ) : null}

          {/* Results (shown when done) */}
          {done ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-lg border border-border bg-accent/50 p-4"
            >
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="font-mono text-2xl font-bold text-foreground">
                    {txCount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    transactions found
                  </p>
                </div>
                <div>
                  <p className="font-mono text-2xl font-bold text-muted-foreground">
                    {dupeCount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    duplicates skipped
                  </p>
                </div>
              </div>
            </motion.div>
          ) : null}

          {/* Step indicators */}
          <div className="flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  i < currentStep
                    ? "bg-green-500"
                    : i === currentStep
                      ? bankColor
                      : "bg-accent"
                }`}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
