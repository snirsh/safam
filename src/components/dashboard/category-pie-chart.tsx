"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface CategoryData {
  name: string;
  value: number;
  icon: string | null;
}

const COLORS = [
  "oklch(0.646 0.222 41.116)", // chart-1
  "oklch(0.6 0.118 184.704)", // chart-2
  "oklch(0.398 0.07 227.392)", // chart-3
  "oklch(0.828 0.189 84.429)", // chart-4
  "oklch(0.769 0.188 70.08)", // chart-5
];

export function CategoryPieChart({ data }: { data: CategoryData[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No expense data this month
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]!} />
            ))}
          </Pie>
          <Tooltip
            isAnimationActive={false}
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const entry = payload[0].payload as CategoryData;
              return (
                <div className="rounded-md border border-border bg-card px-3 py-2 shadow-md">
                  <p className="text-xs font-medium text-foreground">
                    {entry.icon} {entry.name}
                  </p>
                  <p className="font-mono text-sm text-muted-foreground">
                    {new Intl.NumberFormat("he-IL", {
                      style: "currency",
                      currency: "ILS",
                      maximumFractionDigits: 0,
                    }).format(entry.value)}
                  </p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
