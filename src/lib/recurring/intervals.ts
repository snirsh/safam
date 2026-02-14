export type Frequency =
  | "weekly"
  | "bi_weekly"
  | "monthly"
  | "bi_monthly"
  | "quarterly"
  | "semi_annual"
  | "yearly";

export const frequencyToDays: Record<Frequency, number> = {
  weekly: 7,
  bi_weekly: 14,
  monthly: 30,
  bi_monthly: 60,
  quarterly: 90,
  semi_annual: 182,
  yearly: 365,
};

const FREQUENCY_RANGES: Array<{
  min: number;
  max: number;
  frequency: Frequency;
}> = [
  { min: 5, max: 9, frequency: "weekly" },
  { min: 12, max: 18, frequency: "bi_weekly" },
  { min: 25, max: 38, frequency: "monthly" },
  { min: 55, max: 70, frequency: "bi_monthly" },
  { min: 80, max: 105, frequency: "quarterly" },
  { min: 160, max: 200, frequency: "semi_annual" },
  { min: 340, max: 395, frequency: "yearly" },
];

export function daysToFrequency(medianDays: number): Frequency | null {
  for (const range of FREQUENCY_RANGES) {
    if (medianDays >= range.min && medianDays <= range.max) {
      return range.frequency;
    }
  }
  return null;
}

export function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function standardDeviation(nums: number[]): number {
  if (nums.length < 2) return 0;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance =
    nums.reduce((sum, n) => sum + (n - avg) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

export function mode<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  const counts = new Map<T, number>();
  let maxCount = 0;
  let maxItem: T = items[0]!;
  for (const item of items) {
    const count = (counts.get(item) ?? 0) + 1;
    counts.set(item, count);
    if (count > maxCount) {
      maxCount = count;
      maxItem = item;
    }
  }
  return maxItem;
}
