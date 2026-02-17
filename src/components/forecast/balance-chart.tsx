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
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { MotionFade } from "@/components/motion";

interface PendingItem {
  description: string;
  amount: number;
  type: "income" | "expense";
  categoryName: string | null;
  categoryIcon: string | null;
}

interface DataPoint {
  date: string;
  balance: number;
  label?: string;
  items?: PendingItem[];
}

export function BalanceChart({ data }: { data: DataPoint[] }) {
  const reducedMotion = useReducedMotion();

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
  const hasNegative = minBalance < 0;

  const strokeColor = hasNegative
    ? "hsl(0, 84%, 60%)"
    : "hsl(142, 76%, 36%)";

  return (
    <MotionFade className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="balanceGradientGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="balanceGradientRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
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
              const fmt = (v: number) =>
                new Intl.NumberFormat("he-IL", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }).format(v);
              return (
                <div className="min-w-[180px] rounded-md border border-border bg-card px-3 py-2 shadow-md">
                  <p className="text-xs text-muted-foreground">{point.date}</p>
                  <p
                    className={`font-mono text-sm font-bold ${point.balance >= 0 ? "text-green-500" : "text-red-500"}`}
                  >
                    {new Intl.NumberFormat("he-IL", {
                      style: "currency",
                      currency: "ILS",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(point.balance)}
                  </p>
                  {point.items && point.items.length > 0 ? (
                    <div className="mt-1.5 space-y-1 border-t border-border pt-1.5">
                      {point.items.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 text-xs"
                        >
                          <span className="flex items-center gap-1 truncate text-muted-foreground">
                            {item.categoryIcon ? (
                              <span>{item.categoryIcon}</span>
                            ) : null}
                            <span className="truncate">{item.description}</span>
                          </span>
                          <span
                            className={`shrink-0 font-mono ${item.type === "income" ? "text-green-500" : "text-red-500"}`}
                          >
                            {item.type === "income" ? "+" : "-"}
                            {fmt(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={strokeColor}
            strokeWidth={2}
            fill={hasNegative ? "url(#balanceGradientRed)" : "url(#balanceGradientGreen)"}
            isAnimationActive={!reducedMotion}
            animationDuration={800}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </MotionFade>
  );
}
