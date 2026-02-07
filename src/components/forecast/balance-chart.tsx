"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DataPoint {
  date: string;
  balance: number;
  label?: string;
}

export function BalanceChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        No data to display
      </div>
    );
  }

  const minBalance = Math.min(...data.map((d) => d.balance));
  const maxBalance = Math.max(...data.map((d) => d.balance));
  const padding = Math.max(Math.abs(maxBalance - minBalance) * 0.1, 100);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => {
              const d = new Date(v + "T00:00:00");
              return d.getDate().toString();
            }}
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
            domain={[minBalance - padding, maxBalance + padding]}
            width={50}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const point = payload[0].payload as DataPoint;
              return (
                <div className="rounded-md border border-border bg-card px-3 py-2 shadow-md">
                  <p className="text-xs text-muted-foreground">{point.date}</p>
                  <p className="font-mono text-sm font-bold text-foreground">
                    {new Intl.NumberFormat("he-IL", {
                      style: "currency",
                      currency: "ILS",
                      maximumFractionDigits: 0,
                    }).format(point.balance)}
                  </p>
                  {point.label ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {point.label}
                    </p>
                  ) : null}
                </div>
              );
            }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="hsl(142, 76%, 36%)"
            strokeWidth={2}
            fill="url(#balanceGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
