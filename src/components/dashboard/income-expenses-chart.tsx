"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MonthlyData {
  month: string;
  income: number;
  expenses: number;
}

export function IncomeExpensesChart({ data }: { data: MonthlyData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No transaction data
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v: number) =>
              new Intl.NumberFormat("he-IL", {
                notation: "compact",
                compactDisplay: "short",
              }).format(v)
            }
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={50}
          />
          <Tooltip
            isAnimationActive={false}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-md border border-border bg-card px-3 py-2 shadow-md">
                  <p className="mb-1 text-xs font-medium text-foreground">
                    {label}
                  </p>
                  {payload.map((entry) => (
                    <p
                      key={entry.name}
                      className="font-mono text-xs"
                      style={{ color: entry.color }}
                    >
                      {entry.name === "income" ? "Income" : "Expenses"}:{" "}
                      {new Intl.NumberFormat("he-IL", {
                        style: "currency",
                        currency: "ILS",
                        maximumFractionDigits: 0,
                      }).format(entry.value as number)}
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Bar dataKey="income" fill="hsl(142, 76%, 36%)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expenses" fill="hsl(0, 84%, 60%)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
