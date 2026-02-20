/** Shared formatting and date helpers used across pages. */

export function formatILS(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("he-IL");
}

export function parseMonth(
  param: string | undefined,
): { year: number; month: number } {
  if (param) {
    const match = /^(\d{4})-(\d{2})$/.exec(param);
    if (match) {
      const y = Number(match[1]);
      const m = Number(match[2]);
      if (y >= 2020 && y <= 2030 && m >= 1 && m <= 12) {
        return { year: y, month: m - 1 };
      }
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

/** Label for a CC billing date: "Billed Mar 2, 2026" (month is 0-indexed). */
export function billingDateLabel(
  year: number,
  month: number,
  billingDay: number,
): string {
  const billingDate = new Date(year, month + 1, billingDay);
  return `Billed ${billingDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

export function getMonthBounds(
  year: number,
  month: number,
): { start: Date; end: Date } {
  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1),
  };
}
