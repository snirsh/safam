"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { CategoryPieChart } from "@/components/dashboard/category-pie-chart";
import { IncomeExpensesChart } from "@/components/dashboard/income-expenses-chart";

type Lang = "en" | "he";

// ─── Sample data for live previews ──────────────────────────

const SAMPLE_PIE_DATA = [
  { name: "Food", value: 4200, icon: "🍕" },
  { name: "Housing", value: 7020, icon: "🏠" },
  { name: "Transportation", value: 1350, icon: "🚗" },
  { name: "Subscriptions", value: 780, icon: "🔄" },
  { name: "Children", value: 2100, icon: "👨‍👩‍👧" },
  { name: "Other", value: 1800, icon: null },
];

const SAMPLE_TREND_DATA = [
  { month: "Sep", income: 37500, expenses: 28400 },
  { month: "Oct", income: 37500, expenses: 31200 },
  { month: "Nov", income: 37500, expenses: 26800 },
  { month: "Dec", income: 40500, expenses: 33500 },
  { month: "Jan", income: 37500, expenses: 29100 },
  { month: "Feb", income: 37500, expenses: 24800 },
];

const SAMPLE_TRANSACTIONS = [
  { description: "שופרסל דיל - סניף רמת אביב", amount: -432, category: "🛒 Groceries", method: "rule" },
  { description: "העברת משכורת - חברת הייטק", amount: 25000, category: "💰 Salary", method: "rule" },
  { description: "Netflix", amount: -55, category: "📺 Streaming", method: "ai" },
  { description: "ארומה - קפה ומאפה", amount: -42, category: "☕ Coffee & Cafes", method: "rule" },
  { description: "משכנתא - בנק לאומי", amount: -6800, category: "🏦 Mortgage", method: "rule" },
];

const SAMPLE_RECURRING = [
  { description: "העברת משכורת - חברת הייטק", amount: "25,000", type: "income", confidence: 99, freq: "Monthly" },
  { description: "משכנתא - בנק לאומי", amount: "6,800", type: "expense", confidence: 99, freq: "Monthly" },
  { description: "Netflix", amount: "55", type: "expense", confidence: 98, freq: "Monthly" },
  { description: "ארנונה - עיריית תל אביב", amount: "850", type: "expense", confidence: 90, freq: "Bi-monthly" },
];

// ─── Translations ───────────────────────────────────────────

const content = {
  en: {
    tagline: "Your family budget, on autopilot",
    subtitle:
      "Connect your Israeli bank accounts, let AI categorize your spending, detect recurring payments, and forecast your cash flow.",
    cta: "Explore the Demo",
    livePreview: "Live Preview",
    features: [
      {
        id: "sync",
        icon: "~",
        title: "Auto Bank Sync",
        description:
          "Connects to Israeli banks — Leumi, Hapoalim, Isracard, ONE Zero — and pulls transactions automatically.",
      },
      {
        id: "ai",
        icon: "*",
        title: "AI Categorization",
        description:
          "Gemini AI automatically sorts your transactions into meaningful categories. Learns from your corrections.",
      },
      {
        id: "recurring",
        icon: "@",
        title: "Recurring Detection",
        description:
          "Automatically finds your salary, rent, subscriptions, and utilities. Never miss a payment.",
      },
      {
        id: "forecast",
        icon: "%",
        title: "Cash Flow Forecast",
        description:
          "See your projected end-of-month balance. Know if you're on track before the month ends.",
      },
    ],
    security: {
      title: "Secure by design",
      items: [
        "Passwordless login with passkeys (Face ID, Touch ID)",
        "Bank credentials encrypted at rest",
        "Your data stays yours",
      ],
    },
    footer: "Built with Next.js, Vercel & Neon Postgres",
  },
  he: {
    tagline: "התקציב המשפחתי שלכם, באוטומט",
    subtitle:
      "חברו את חשבונות הבנק שלכם, תנו ל-AI לסווג את ההוצאות, לזהות תשלומים חוזרים ולחזות את תזרים המזומנים.",
    cta: "נסו את הדמו",
    livePreview: "תצוגה חיה",
    features: [
      {
        id: "sync",
        icon: "~",
        title: "סנכרון אוטומטי",
        description:
          "מתחבר לבנקים בישראל — לאומי, הפועלים, ישראכרט, ONE Zero — ומושך עסקאות אוטומטית.",
      },
      {
        id: "ai",
        icon: "*",
        title: "סיווג חכם עם AI",
        description:
          "Gemini AI מסווג את העסקאות שלכם לקטגוריות משמעותיות. לומד מהתיקונים שלכם.",
      },
      {
        id: "recurring",
        icon: "@",
        title: "זיהוי חיובים חוזרים",
        description:
          "מזהה אוטומטית משכורת, שכירות, מנויים וחשבונות. לא תפספסו תשלום.",
      },
      {
        id: "forecast",
        icon: "%",
        title: "תחזית תזרים",
        description:
          "צפו ביתרה הצפויה לסוף החודש. דעו אם אתם במסלול הנכון לפני שהחודש נגמר.",
      },
    ],
    security: {
      title: "מאובטח מהיסוד",
      items: [
        "כניסה ללא סיסמה עם Passkeys (Face ID, Touch ID)",
        "פרטי בנק מוצפנים",
        "המידע שלכם נשאר שלכם",
      ],
    },
    footer: "נבנה עם Next.js, Vercel ו-Neon Postgres",
  },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

// ─── Component ──────────────────────────────────────────────

export function LandingPage() {
  const [lang, setLang] = useState<Lang>("en");
  const t = content[lang];
  const dir = lang === "he" ? "rtl" : "ltr";

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-background/80 px-6 py-3 backdrop-blur-sm">
        <span className="font-mono text-xl font-bold">safam</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === "en" ? "he" : "en")}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            {lang === "en" ? "עב" : "EN"}
          </button>
          <ThemeToggle />
        </div>
      </nav>

      {/* Hero */}
      <motion.section
        className="mx-auto max-w-3xl px-6 py-20 text-center"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.h1
          className="text-4xl font-bold tracking-tight sm:text-5xl"
          variants={fadeUp}
        >
          {t.tagline}
        </motion.h1>
        <motion.p
          className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground"
          variants={fadeUp}
        >
          {t.subtitle}
        </motion.p>
        <motion.div className="mt-8" variants={fadeUp}>
          <Link href="/dashboard">
            <Button size="lg" className="text-base">
              {t.cta}
            </Button>
          </Link>
        </motion.div>
      </motion.section>

      {/* Live preview: Dashboard snapshot */}
      <motion.section
        className="mx-auto max-w-5xl px-6 pb-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={stagger}
      >
        <motion.div
          className="overflow-hidden rounded-xl border border-border bg-card shadow-lg"
          variants={fadeUp}
        >
          {/* Fake dashboard header */}
          <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-red-400/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-400/60" />
              <div className="h-3 w-3 rounded-full bg-green-400/60" />
            </div>
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              safam / dashboard
            </span>
          </div>
          {/* Dashboard content */}
          <div className="p-4 sm:p-6">
            {/* KPI cards */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard label="Bank Balance" value="63,200" color="text-green-500" />
              <KpiCard label="End of Month" value="51,400" color="text-green-500" subtitle="On track" />
              <KpiCard label="Income" value="37,500" color="text-green-500" />
              <KpiCard label="Spending" value="24,800" color="text-red-500" />
            </div>
            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Expenses by Category
                </p>
                <CategoryPieChart data={SAMPLE_PIE_DATA} />
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Income vs Expenses (6 months)
                </p>
                <IncomeExpensesChart data={SAMPLE_TREND_DATA} />
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* Feature cards with live mini-previews */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <motion.div
          className="grid gap-6 sm:grid-cols-2"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={stagger}
        >
          {t.features.map((feature) => (
            <motion.div
              key={feature.id}
              className="rounded-xl border border-border bg-card p-6"
              variants={fadeUp}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 font-mono text-lg font-bold text-primary">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {feature.description}
              </p>
              {/* Mini preview per feature */}
              <div className="mt-4">
                <FeaturePreview featureId={feature.id} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Security */}
      <motion.section
        className="border-t border-border bg-card px-6 py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
      >
        <div className="mx-auto max-w-3xl text-center">
          <motion.h2 className="text-2xl font-bold" variants={fadeUp}>
            {t.security.title}
          </motion.h2>
          <motion.ul className="mt-6 space-y-3" variants={stagger}>
            {t.security.items.map((item) => (
              <motion.li
                key={item}
                className="text-sm text-muted-foreground"
                variants={fadeUp}
              >
                {item}
              </motion.li>
            ))}
          </motion.ul>
          <motion.div className="mt-8" variants={fadeUp}>
            <Link href="/dashboard">
              <Button size="lg" className="text-base">
                {content[lang].cta}
              </Button>
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        {t.footer}
      </footer>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function KpiCard({ label, value, color, subtitle }: { label: string; value: string; color: string; subtitle?: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`font-mono text-lg font-bold ${color}`}>
        {value}
      </p>
      {subtitle ? (
        <p className="text-[10px] text-green-500">{subtitle}</p>
      ) : null}
    </div>
  );
}

function FeaturePreview({ featureId }: { featureId: string }) {
  switch (featureId) {
    case "sync":
      return <SyncPreview />;
    case "ai":
      return <AiPreview />;
    case "recurring":
      return <RecurringPreview />;
    case "forecast":
      return <ForecastPreview />;
    default:
      return null;
  }
}

function SyncPreview() {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/50 p-3">
      {["Bank Leumi · 4521", "Hapoalim · 7890", "Isracard · 8734", "Max · 3456"].map((acct) => (
        <div key={acct} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{acct}</span>
          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-500">
            Synced
          </span>
        </div>
      ))}
    </div>
  );
}

function AiPreview() {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-background/50 p-3">
      {SAMPLE_TRANSACTIONS.slice(0, 4).map((tx) => (
        <div key={tx.description} className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-muted-foreground">{tx.description}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="rounded bg-accent px-1.5 py-0.5 text-[10px]">
              {tx.category}
            </span>
            {tx.method === "ai" ? (
              <span className="rounded bg-purple-500/10 px-1 py-0.5 text-[10px] font-medium text-purple-500">
                AI
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecurringPreview() {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-background/50 p-3">
      {SAMPLE_RECURRING.map((r) => (
        <div key={r.description} className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-muted-foreground">{r.description}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className={`font-mono ${r.type === "income" ? "text-green-500" : "text-red-500"}`}>
              {r.type === "income" ? "+" : "-"}{r.amount}
            </span>
            <span className="rounded bg-accent px-1 py-0.5 text-[10px]">{r.freq}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ForecastPreview() {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground">Current</p>
          <p className="font-mono text-sm font-bold text-green-500">63,200</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">End of Month</p>
          <p className="font-mono text-sm font-bold text-green-500">51,400</p>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Pending income</span>
          <span className="font-mono text-green-500">+25,000</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Pending expenses</span>
          <span className="font-mono text-red-500">-14,300</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">CC liability</span>
          <span className="font-mono text-red-500">-8,200</span>
        </div>
      </div>
    </div>
  );
}
