/**
 * Demo seed script — generates 12 months of realistic Israeli family budget data.
 * Family: "משפחת כהן" (The Cohen Family)
 *
 * Usage: DATABASE_URL=<url> pnpm tsx scripts/seed-demo.ts
 * Or with .env.local: pnpm tsx scripts/seed-demo.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { db } from "../src/lib/db/index";
import {
  categories,
  categorizationRules,
  financialAccounts,
  households,
  recurringPatterns,
  syncLogs,
  transactions,
  users,
} from "../src/lib/db/schema";

// ─── Helpers ────────────────────────────────────────────────

function dateInMonth(monthsAgo: number, day: number): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, 10);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (day > lastDay) d.setDate(lastDay);
  return d;
}

/** Add random variation to an amount: ±percentage */
function vary(base: number, pct: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * (pct / 100);
  return Math.round(base * factor);
}

/** Deterministic-ish seed for reproducibility within a month */
function monthSeed(monthsAgo: number): number {
  return (monthsAgo * 7 + 3) % 13;
}

// ─── Category Definitions (reused from main seed) ──────────

const PARENT_CATEGORIES = [
  { name: "Income", icon: "💰", color: "#22c55e" },
  { name: "Housing", icon: "🏠", color: "#3b82f6" },
  { name: "Transportation", icon: "🚗", color: "#f97316" },
  { name: "Food", icon: "🍕", color: "#a855f7" },
  { name: "Utilities", icon: "🔧", color: "#eab308" },
  { name: "Subscriptions", icon: "🔄", color: "#ec4899" },
  { name: "Healthcare", icon: "🏥", color: "#14b8a6" },
  { name: "Shopping", icon: "🛍️", color: "#f43f5e" },
  { name: "Education", icon: "🎓", color: "#06b6d4" },
  { name: "Entertainment", icon: "🎭", color: "#8b5cf6" },
  { name: "Children & Family", icon: "👨‍👩‍👧", color: "#fb923c" },
  { name: "Personal Care", icon: "💆", color: "#f472b6" },
  { name: "Financial", icon: "🏛️", color: "#94a3b8" },
  { name: "Gifts & Donations", icon: "🎁", color: "#a78bfa" },
  { name: "Transfers", icon: "🔄", color: "#64748b" },
  { name: "Other", icon: "📋", color: "#475569" },
];

const SUBCATEGORIES = [
  { name: "Salary", icon: "💰", color: "#22c55e", parent: "Income" },
  { name: "Bonus", icon: "🎁", color: "#16a34a", parent: "Income" },
  { name: "Refunds", icon: "↩️", color: "#15803d", parent: "Income" },
  { name: "Rental Income", icon: "🏘️", color: "#059669", parent: "Income" },
  { name: "Freelance", icon: "💼", color: "#10b981", parent: "Income" },
  { name: "Child Allowance", icon: "👶", color: "#34d399", parent: "Income" },
  { name: "Other Income", icon: "💵", color: "#166534", parent: "Income" },
  { name: "Rent", icon: "🏠", color: "#3b82f6", parent: "Housing" },
  { name: "Mortgage", icon: "🏦", color: "#2563eb", parent: "Housing" },
  { name: "House Committee", icon: "🏢", color: "#1d4ed8", parent: "Housing" },
  { name: "Arnona", icon: "🏛️", color: "#1e40af", parent: "Housing" },
  { name: "Home Insurance", icon: "🛡️", color: "#1e3a8a", parent: "Housing" },
  { name: "Home Repairs", icon: "🔨", color: "#3730a3", parent: "Housing" },
  { name: "Fuel", icon: "⛽", color: "#f97316", parent: "Transportation" },
  { name: "Public Transport", icon: "🚌", color: "#ea580c", parent: "Transportation" },
  { name: "Parking", icon: "🅿️", color: "#c2410c", parent: "Transportation" },
  { name: "Car Insurance", icon: "🛡️", color: "#9a3412", parent: "Transportation" },
  { name: "Car Maintenance", icon: "🔧", color: "#7c2d12", parent: "Transportation" },
  { name: "Car Lease", icon: "📝", color: "#431407", parent: "Transportation" },
  { name: "Tolls", icon: "🛣️", color: "#fb923c", parent: "Transportation" },
  { name: "Groceries", icon: "🛒", color: "#a855f7", parent: "Food" },
  { name: "Restaurants", icon: "🍽️", color: "#9333ea", parent: "Food" },
  { name: "Delivery", icon: "🛵", color: "#7e22ce", parent: "Food" },
  { name: "Coffee & Cafes", icon: "☕", color: "#6b21a8", parent: "Food" },
  { name: "Electricity", icon: "⚡", color: "#eab308", parent: "Utilities" },
  { name: "Water", icon: "💧", color: "#ca8a04", parent: "Utilities" },
  { name: "Internet", icon: "🌐", color: "#a16207", parent: "Utilities" },
  { name: "Phone", icon: "📱", color: "#854d0e", parent: "Utilities" },
  { name: "Cooking Gas", icon: "🔥", color: "#713f12", parent: "Utilities" },
  { name: "Streaming", icon: "📺", color: "#ec4899", parent: "Subscriptions" },
  { name: "Software", icon: "💻", color: "#db2777", parent: "Subscriptions" },
  { name: "Gym", icon: "🏋️", color: "#be185d", parent: "Subscriptions" },
  { name: "Doctor", icon: "👨‍⚕️", color: "#14b8a6", parent: "Healthcare" },
  { name: "Pharmacy", icon: "💊", color: "#0d9488", parent: "Healthcare" },
  { name: "Health Insurance", icon: "🛡️", color: "#0f766e", parent: "Healthcare" },
  { name: "Dental", icon: "🦷", color: "#115e59", parent: "Healthcare" },
  { name: "Vision", icon: "👓", color: "#134e4a", parent: "Healthcare" },
  { name: "Clothing", icon: "👕", color: "#f43f5e", parent: "Shopping" },
  { name: "Electronics", icon: "🔌", color: "#e11d48", parent: "Shopping" },
  { name: "Home Goods", icon: "🛋️", color: "#be123c", parent: "Shopping" },
  { name: "Courses", icon: "📚", color: "#06b6d4", parent: "Education" },
  { name: "Books", icon: "📖", color: "#0891b2", parent: "Education" },
  { name: "Events", icon: "🎪", color: "#8b5cf6", parent: "Entertainment" },
  { name: "Travel", icon: "✈️", color: "#7c3aed", parent: "Entertainment" },
  { name: "Hobbies", icon: "🎨", color: "#6d28d9", parent: "Entertainment" },
  { name: "School Fees", icon: "🏫", color: "#fb923c", parent: "Children & Family" },
  { name: "Activities", icon: "⚽", color: "#f59e0b", parent: "Children & Family" },
  { name: "Summer Camp", icon: "🏕️", color: "#d97706", parent: "Children & Family" },
  { name: "Daycare", icon: "🍼", color: "#b45309", parent: "Children & Family" },
  { name: "Baby & Kids", icon: "🧸", color: "#92400e", parent: "Children & Family" },
  { name: "Haircuts", icon: "✂️", color: "#f472b6", parent: "Personal Care" },
  { name: "Beauty", icon: "💅", color: "#ec4899", parent: "Personal Care" },
  { name: "Toiletries", icon: "🧴", color: "#db2777", parent: "Personal Care" },
  { name: "Bank Fees", icon: "💳", color: "#94a3b8", parent: "Financial" },
  { name: "Loan Payments", icon: "📝", color: "#64748b", parent: "Financial" },
  { name: "Gifts", icon: "🎀", color: "#a78bfa", parent: "Gifts & Donations" },
  { name: "Charity", icon: "❤️", color: "#8b5cf6", parent: "Gifts & Donations" },
  { name: "Savings Transfer", icon: "🏦", color: "#64748b", parent: "Transfers" },
  { name: "Other Expense", icon: "📝", color: "#475569", parent: "Other" },
];

// ─── Demo Accounts ──────────────────────────────────────────

const DEMO_ACCOUNTS = [
  {
    name: "Bank Leumi - Checking",
    institution: "leumi",
    accountType: "bank" as const,
    lastFourDigits: "4521",
    startingBalance: "45000",
  },
  {
    name: "Bank Hapoalim - Joint",
    institution: "hapoalim",
    accountType: "bank" as const,
    lastFourDigits: "7890",
    startingBalance: "18000",
  },
  {
    name: "Isracard",
    institution: "isracard",
    accountType: "credit_card" as const,
    lastFourDigits: "8734",
    billingDay: 2,
  },
  {
    name: "Max - Leumi Card",
    institution: "max",
    accountType: "credit_card" as const,
    lastFourDigits: "3456",
    billingDay: 10,
  },
];

// ─── Transaction Templates ──────────────────────────────────

interface TxSeed {
  description: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  categoryName: string;
  accountName: string;
  day: number;
  classificationMethod?: string;
}

// These recur every single month
const MONTHLY_RECURRING: TxSeed[] = [
  // Income
  { description: "העברת משכורת - חברת הייטק בע\"מ", amount: 25000, type: "income", categoryName: "Salary", accountName: "Bank Leumi - Checking", day: 1 },
  { description: "העברת משכורת - מרפאת שיניים כהן", amount: 12000, type: "income", categoryName: "Salary", accountName: "Bank Hapoalim - Joint", day: 5 },
  { description: "קצבת ילדים - ביטוח לאומי", amount: 500, type: "income", categoryName: "Child Allowance", accountName: "Bank Leumi - Checking", day: 20 },

  // Housing
  { description: "משכנתא - בנק לאומי", amount: 6800, type: "expense", categoryName: "Mortgage", accountName: "Bank Leumi - Checking", day: 3 },
  { description: "ועד בית - רח' הגפן 12", amount: 220, type: "expense", categoryName: "House Committee", accountName: "Bank Leumi - Checking", day: 5 },

  // Utilities — subscriptions
  { description: "בזק - אינטרנט ביתי", amount: 170, type: "expense", categoryName: "Internet", accountName: "Isracard", day: 8 },
  { description: "פלאפון - חבילת סלולר", amount: 120, type: "expense", categoryName: "Phone", accountName: "Isracard", day: 7 },
  { description: "Netflix", amount: 55, type: "expense", categoryName: "Streaming", accountName: "Max - Leumi Card", day: 15 },
  { description: "Spotify Premium Family", amount: 30, type: "expense", categoryName: "Streaming", accountName: "Max - Leumi Card", day: 1 },
  { description: "הולמס פלייס - מנוי חודשי", amount: 350, type: "expense", categoryName: "Gym", accountName: "Isracard", day: 5 },

  // Kids
  { description: "חוגים - צהרון + שחייה", amount: 1800, type: "expense", categoryName: "Activities", accountName: "Bank Leumi - Checking", day: 1 },

  // Insurance / health
  { description: "ביטוח רכב - הראל", amount: 450, type: "expense", categoryName: "Car Insurance", accountName: "Bank Leumi - Checking", day: 20 },
  { description: "מכבי שירותי בריאות - משלים זהב", amount: 280, type: "expense", categoryName: "Health Insurance", accountName: "Bank Leumi - Checking", day: 1 },

  // Savings transfer
  { description: "העברה לחיסכון - ONE Zero", amount: 4000, type: "transfer", categoryName: "Savings Transfer", accountName: "Bank Leumi - Checking", day: 2 },
];

// Groceries & food — generated per month with variety
function groceryTransactions(monthsAgo: number): TxSeed[] {
  const stores = [
    { name: "שופרסל דיל - סניף רמת אביב", base: 420 },
    { name: "רמי לוי - קניות שבועיות", base: 550 },
    { name: "יוחננוף - סניף דיזנגוף", base: 380 },
    { name: "שופרסל אונליין - משלוח", base: 320 },
    { name: "מגה בעיר - פירות וירקות", base: 190 },
    { name: "רמי לוי - קניות סופ\"ש", base: 480 },
  ];

  const seed = monthSeed(monthsAgo);
  const txs: TxSeed[] = [];

  // 4-6 grocery runs per month
  const count = 4 + (seed % 3);
  for (let i = 0; i < count; i++) {
    const store = stores[(seed + i) % stores.length]!;
    txs.push({
      description: store.name,
      amount: vary(store.base, 15),
      type: "expense",
      categoryName: "Groceries",
      accountName: i % 3 === 0 ? "Max - Leumi Card" : "Isracard",
      day: 3 + i * 5 + (seed % 3),
      classificationMethod: "rule",
    });
  }
  return txs;
}

function fuelTransactions(monthsAgo: number): TxSeed[] {
  const stations = ["סונול - תחנת דלק", "פז - תחנת דלק", "דלק - תחנת שירות"];
  const seed = monthSeed(monthsAgo);
  return [
    {
      description: stations[seed % stations.length]!,
      amount: vary(280, 10),
      type: "expense",
      categoryName: "Fuel",
      accountName: "Isracard",
      day: 7 + (seed % 3),
      classificationMethod: "rule",
    },
    {
      description: stations[(seed + 1) % stations.length]!,
      amount: vary(310, 10),
      type: "expense",
      categoryName: "Fuel",
      accountName: "Isracard",
      day: 21 + (seed % 4),
      classificationMethod: "rule",
    },
  ];
}

function diningTransactions(monthsAgo: number): TxSeed[] {
  const seed = monthSeed(monthsAgo);
  const restaurants = [
    { name: "שיפודי התקווה - ארוחה", base: 240 },
    { name: "מסעדת נאמה - ארוחת ערב", base: 380 },
    { name: "אורנה ואלה - ברנץ'", base: 190 },
    { name: "BBB - ארוחה משפחתית", base: 220 },
    { name: "מוזס - המבורגר", base: 160 },
    { name: "פיצה האט - משלוח", base: 120 },
  ];
  const cafes = [
    { name: "ארומה - קפה ומאפה", base: 42 },
    { name: "קפה גרג - ארוחת בוקר", base: 68 },
    { name: "ארומה - קפה", base: 28 },
    { name: "קפה לנדוור - ארוחת צהריים", base: 95 },
    { name: "קופי בין - קפה וקרואסון", base: 35 },
  ];
  const deliveries = [
    { name: "וולט - משלוח אוכל", base: 95 },
    { name: "וולט - משלוח מסעדה", base: 115 },
    { name: "תן ביס - משלוח", base: 85 },
  ];

  const txs: TxSeed[] = [];

  // 2-3 restaurant visits
  const restCount = 2 + (seed % 2);
  for (let i = 0; i < restCount; i++) {
    const r = restaurants[(seed + i) % restaurants.length]!;
    txs.push({
      description: r.name,
      amount: vary(r.base, 15),
      type: "expense",
      categoryName: "Restaurants",
      accountName: i % 2 === 0 ? "Isracard" : "Max - Leumi Card",
      day: 6 + i * 8 + (seed % 3),
      classificationMethod: i === 0 ? "ai" : "rule",
    });
  }

  // 3-5 cafe visits
  const cafeCount = 3 + (seed % 3);
  for (let i = 0; i < cafeCount; i++) {
    const c = cafes[(seed + i) % cafes.length]!;
    txs.push({
      description: c.name,
      amount: vary(c.base, 10),
      type: "expense",
      categoryName: "Coffee & Cafes",
      accountName: "Isracard",
      day: 2 + i * 6 + (seed % 2),
      classificationMethod: "rule",
    });
  }

  // 2-3 deliveries
  const delCount = 2 + (seed % 2);
  for (let i = 0; i < delCount; i++) {
    const d = deliveries[(seed + i) % deliveries.length]!;
    txs.push({
      description: d.name,
      amount: vary(d.base, 12),
      type: "expense",
      categoryName: "Delivery",
      accountName: "Isracard",
      day: 9 + i * 10 + (seed % 3),
      classificationMethod: "rule",
    });
  }

  return txs;
}

// Seasonal electricity variation (higher in summer months)
function electricityAmount(monthsAgo: number): number {
  const date = dateInMonth(monthsAgo, 1);
  const month = date.getMonth(); // 0-11
  // Summer (June-Sept) = higher, winter lower
  const seasonal = [350, 320, 340, 380, 450, 580, 650, 620, 520, 420, 370, 340];
  return vary(seasonal[month]!, 8);
}

function utilityTransactions(monthsAgo: number): TxSeed[] {
  return [
    {
      description: "חברת החשמל - תשלום חודשי",
      amount: electricityAmount(monthsAgo),
      type: "expense",
      categoryName: "Electricity",
      accountName: "Isracard",
      day: 15,
      classificationMethod: "rule",
    },
    {
      description: "מקורות - חשבון מים",
      amount: vary(180, 15),
      type: "expense",
      categoryName: "Water",
      accountName: "Bank Leumi - Checking",
      day: 10,
      classificationMethod: "rule",
    },
  ];
}

// One-off / occasional transactions that vary per month
function oneOffTransactions(monthsAgo: number): TxSeed[] {
  const txs: TxSeed[] = [];

  // Bi-monthly arnona
  if (monthsAgo % 2 === 1) {
    txs.push({
      description: "ארנונה - עיריית תל אביב",
      amount: 850,
      type: "expense",
      categoryName: "Arnona",
      accountName: "Bank Leumi - Checking",
      day: 15,
      classificationMethod: "rule",
    });
  }

  // Bi-monthly car insurance (alternating)
  if (monthsAgo % 2 === 0) {
    txs.push({
      description: "ביטוח דירה - הפניקס",
      amount: 320,
      type: "expense",
      categoryName: "Home Insurance",
      accountName: "Bank Leumi - Checking",
      day: 18,
      classificationMethod: "ai",
    });
  }

  // Monthly bank fee
  txs.push({
    description: "עמלת ניהול חשבון",
    amount: 25,
    type: "expense",
    categoryName: "Bank Fees",
    accountName: "Bank Leumi - Checking",
    day: 28,
    classificationMethod: "rule",
  });

  // Gas (cooking) every 2 months
  if (monthsAgo % 2 === 0) {
    txs.push({
      description: "סופרגז - בלון גז",
      amount: vary(95, 5),
      type: "expense",
      categoryName: "Cooking Gas",
      accountName: "Bank Leumi - Checking",
      day: 12,
      classificationMethod: "ai",
    });
  }

  // Specific one-offs per month
  switch (monthsAgo % 12) {
    case 0: // Current month
      txs.push(
        { description: "פארם - תרופות ואביזרים", amount: 85, type: "expense", categoryName: "Pharmacy", accountName: "Isracard", day: 3, classificationMethod: "ai" },
        { description: "רב-קו - טעינת כרטיס", amount: 100, type: "expense", categoryName: "Public Transport", accountName: "Bank Leumi - Checking", day: 4, classificationMethod: "rule" },
      );
      break;
    case 1:
      txs.push(
        { description: "ZARA - ביגוד חורף", amount: 420, type: "expense", categoryName: "Clothing", accountName: "Isracard", day: 8, classificationMethod: "ai" },
        { description: "iDigital - כיסוי לטלפון", amount: 150, type: "expense", categoryName: "Electronics", accountName: "Max - Leumi Card", day: 15 },
        { description: "ד\"ר כהן - טיפול שיניים", amount: 350, type: "expense", categoryName: "Dental", accountName: "Isracard", day: 19, classificationMethod: "ai" },
        { description: "מספרת יופי - תספורת", amount: 120, type: "expense", categoryName: "Haircuts", accountName: "Isracard", day: 22, classificationMethod: "rule" },
      );
      break;
    case 2:
      txs.push(
        { description: "ACE - כלי בית ומטבח", amount: 280, type: "expense", categoryName: "Home Goods", accountName: "Isracard", day: 5, classificationMethod: "ai" },
        { description: "IKEA - ריהוט לסלון", amount: 850, type: "expense", categoryName: "Home Goods", accountName: "Max - Leumi Card", day: 12 },
        { description: "החזר מס - רשות המסים", amount: 2400, type: "income", categoryName: "Refunds", accountName: "Bank Leumi - Checking", day: 20 },
        { description: "מתנה ליום הולדת - חבר", amount: 200, type: "expense", categoryName: "Gifts", accountName: "Isracard", day: 18, classificationMethod: "manual" },
      );
      break;
    case 3:
      txs.push(
        { description: "H&M - ביגוד ילדים", amount: 350, type: "expense", categoryName: "Baby & Kids", accountName: "Isracard", day: 9, classificationMethod: "ai" },
        { description: "בונוס שנתי - חברת הייטק", amount: 8000, type: "income", categoryName: "Bonus", accountName: "Bank Leumi - Checking", day: 15 },
        { description: "סופ\"ש צימר בצפון", amount: 1200, type: "expense", categoryName: "Travel", accountName: "Max - Leumi Card", day: 20, classificationMethod: "manual" },
        { description: "צדקה - עמותת לתת", amount: 180, type: "expense", categoryName: "Charity", accountName: "Bank Leumi - Checking", day: 10, classificationMethod: "manual" },
        { description: "תיקון אינסטלציה - ביתי", amount: 450, type: "expense", categoryName: "Home Repairs", accountName: "Bank Leumi - Checking", day: 25, classificationMethod: "ai" },
      );
      break;
    case 4:
      txs.push(
        { description: "משקפי ראייה - אופטיקנה", amount: 800, type: "expense", categoryName: "Vision", accountName: "Isracard", day: 14, classificationMethod: "ai" },
        { description: "Amazon.com - ספרים", amount: 180, type: "expense", categoryName: "Books", accountName: "Max - Leumi Card", day: 7 },
        { description: "כביש 6 - אגרה", amount: 32, type: "expense", categoryName: "Tolls", accountName: "Isracard", day: 12, classificationMethod: "rule" },
        { description: "iHerb - ויטמינים ותוספים", amount: 350, type: "expense", categoryName: "Pharmacy", accountName: "Max - Leumi Card", day: 22, classificationMethod: "ai" },
      );
      break;
    case 5:
      txs.push(
        { description: "מכשנאי חשמל - מכונת כביסה חדשה", amount: 3800, type: "expense", categoryName: "Home Goods", accountName: "Isracard", day: 10 },
        { description: "עבודה פרילנס - פרויקט אתר", amount: 4500, type: "income", categoryName: "Freelance", accountName: "Bank Leumi - Checking", day: 18 },
        { description: "רב-קו - טעינת כרטיס", amount: 100, type: "expense", categoryName: "Public Transport", accountName: "Bank Leumi - Checking", day: 6, classificationMethod: "rule" },
      );
      break;
    case 6:
      txs.push(
        { description: "טיפול שיניים - ד\"ר לוי", amount: 3500, type: "expense", categoryName: "Dental", accountName: "Isracard", day: 22, classificationMethod: "ai" },
        { description: "FOX - ביגוד קיץ", amount: 550, type: "expense", categoryName: "Clothing", accountName: "Max - Leumi Card", day: 8, classificationMethod: "ai" },
        { description: "AliExpress - אביזרים לבית", amount: 230, type: "expense", categoryName: "Home Goods", accountName: "Isracard", day: 16 },
        { description: "מספרה - תספורת ילדים", amount: 80, type: "expense", categoryName: "Haircuts", accountName: "Isracard", day: 25, classificationMethod: "rule" },
      );
      break;
    case 7:
      txs.push(
        { description: "קייטנת קיץ - ילדים", amount: 2800, type: "expense", categoryName: "Summer Camp", accountName: "Bank Leumi - Checking", day: 1 },
        { description: "חופשה משפחתית - ים המלח", amount: 2200, type: "expense", categoryName: "Travel", accountName: "Max - Leumi Card", day: 15, classificationMethod: "manual" },
        { description: "חניון אחוזת החוף", amount: 45, type: "expense", categoryName: "Parking", accountName: "Isracard", day: 15, classificationMethod: "ai" },
      );
      break;
    case 8:
      txs.push(
        { description: "שנה טובה - מתנות למשפחה", amount: 600, type: "expense", categoryName: "Gifts", accountName: "Isracard", day: 10, classificationMethod: "manual" },
        { description: "ציוד לבית ספר - ילדים", amount: 450, type: "expense", categoryName: "School Fees", accountName: "Max - Leumi Card", day: 2 },
        { description: "ביגוד לחזרה ללימודים", amount: 680, type: "expense", categoryName: "Baby & Kids", accountName: "Isracard", day: 5, classificationMethod: "ai" },
        { description: "צדקה - קרן לב\"ב", amount: 250, type: "expense", categoryName: "Charity", accountName: "Bank Hapoalim - Joint", day: 8, classificationMethod: "manual" },
      );
      break;
    case 9:
      txs.push(
        { description: "תיקון רכב - מוסך דוד", amount: 2100, type: "expense", categoryName: "Car Maintenance", accountName: "Bank Leumi - Checking", day: 11, classificationMethod: "ai" },
        { description: "טסט שנתי - רכב", amount: 280, type: "expense", categoryName: "Car Maintenance", accountName: "Bank Leumi - Checking", day: 11, classificationMethod: "ai" },
        { description: "קורס אונליין - Udemy", amount: 120, type: "expense", categoryName: "Courses", accountName: "Max - Leumi Card", day: 20 },
      );
      break;
    case 10:
      txs.push(
        { description: "מתנת יום הולדת - ילד", amount: 1500, type: "expense", categoryName: "Gifts", accountName: "Isracard", day: 18, classificationMethod: "manual" },
        { description: "מסיבת יום הולדת - אולם", amount: 2500, type: "expense", categoryName: "Events", accountName: "Max - Leumi Card", day: 20, classificationMethod: "ai" },
        { description: "Castro - ביגוד", amount: 320, type: "expense", categoryName: "Clothing", accountName: "Isracard", day: 6, classificationMethod: "ai" },
      );
      break;
    case 11:
      txs.push(
        { description: "חנוכיות ונרות - חנוכה", amount: 150, type: "expense", categoryName: "Other Expense", accountName: "Isracard", day: 10 },
        { description: "עבודה פרילנס - ייעוץ טכני", amount: 3000, type: "income", categoryName: "Freelance", accountName: "Bank Leumi - Checking", day: 25 },
        { description: "מתנות חנוכה - ילדים", amount: 800, type: "expense", categoryName: "Gifts", accountName: "Max - Leumi Card", day: 15, classificationMethod: "manual" },
        { description: "מספרה - צבע ותספורת", amount: 250, type: "expense", categoryName: "Beauty", accountName: "Isracard", day: 4, classificationMethod: "ai" },
      );
      break;
  }

  // A few uncategorized transactions (for demo — shows AI categorization potential)
  if (monthsAgo % 4 === 0) {
    txs.push({
      description: "תשלום - שירות לא מזוהה",
      amount: vary(150, 30),
      type: "expense",
      categoryName: "__uncategorized__",
      accountName: "Isracard",
      day: 26,
    });
  }

  return txs;
}

// ─── Main Seed Function ────────────────────────────────────

async function seedDemo() {
  console.log("Seeding demo database (Cohen Family - 12 months)...\n");

  // 1. Clear all data
  console.log("Clearing existing data...");
  await db.execute(sql`TRUNCATE households CASCADE`);

  // 2. Create household
  const householdRows = await db
    .insert(households)
    .values({ name: "משפחת כהן" })
    .returning();
  const household = householdRows[0];
  if (!household) throw new Error("Failed to create household");
  console.log(`Created household: ${household.name} (${household.id})`);

  // 3. Create users
  const userRows = await db
    .insert(users)
    .values([
      { householdId: household.id, displayName: "יובל כהן" },
      { householdId: household.id, displayName: "מיכל כהן" },
    ])
    .returning();
  console.log(`Created ${userRows.length} users`);

  // 4. Create categories
  const parentMap = new Map<string, string>();
  for (const parent of PARENT_CATEGORIES) {
    const rows = await db
      .insert(categories)
      .values({
        householdId: household.id,
        name: parent.name,
        icon: parent.icon,
        color: parent.color,
        isSystem: true,
      })
      .returning();
    const row = rows[0];
    if (row) parentMap.set(parent.name, row.id);
  }
  console.log(`Created ${parentMap.size} parent categories`);

  const categoryMap = new Map<string, string>();
  for (const [name, id] of parentMap) {
    categoryMap.set(name, id);
  }

  let subcategoryCount = 0;
  for (const sub of SUBCATEGORIES) {
    const parentId = parentMap.get(sub.parent);
    if (!parentId) continue;
    const rows = await db
      .insert(categories)
      .values({
        householdId: household.id,
        name: sub.name,
        icon: sub.icon,
        color: sub.color,
        parentId,
        isSystem: true,
      })
      .returning();
    const row = rows[0];
    if (row) categoryMap.set(sub.name, row.id);
    subcategoryCount++;
  }
  console.log(`Created ${subcategoryCount} subcategories`);

  // 5. Create financial accounts
  const accountMap = new Map<string, string>();
  for (const acct of DEMO_ACCOUNTS) {
    const rows = await db
      .insert(financialAccounts)
      .values({
        householdId: household.id,
        name: acct.name,
        institution: acct.institution,
        accountType: acct.accountType,
        lastFourDigits: acct.lastFourDigits,
        lastSyncedAt: new Date(),
        startingBalance: "startingBalance" in acct ? acct.startingBalance : "0",
        billingDay: "billingDay" in acct ? acct.billingDay : undefined,
      })
      .returning();
    const row = rows[0];
    if (row) accountMap.set(acct.name, row.id);
  }
  console.log(`Created ${accountMap.size} financial accounts`);

  // 6. Generate and insert transactions (12 months)
  let txCount = 0;
  let uncategorizedCount = 0;

  for (let monthsAgo = 11; monthsAgo >= 0; monthsAgo--) {
    const isCurrentMonth = monthsAgo === 0;
    const maxDay = isCurrentMonth ? new Date().getDate() : 28;

    const allTxns: TxSeed[] = [
      ...MONTHLY_RECURRING,
      ...groceryTransactions(monthsAgo),
      ...fuelTransactions(monthsAgo),
      ...diningTransactions(monthsAgo),
      ...utilityTransactions(monthsAgo),
      ...oneOffTransactions(monthsAgo),
    ].filter((tx) => tx.day <= maxDay);

    for (const tx of allTxns) {
      const accountId = accountMap.get(tx.accountName);
      if (!accountId) {
        console.warn(`Account "${tx.accountName}" not found, skipping "${tx.description}"`);
        continue;
      }

      let categoryId: string | undefined;
      if (tx.categoryName === "__uncategorized__") {
        uncategorizedCount++;
      } else {
        categoryId = categoryMap.get(tx.categoryName);
        if (!categoryId) {
          console.warn(`Category "${tx.categoryName}" not found, skipping "${tx.description}"`);
          continue;
        }
      }

      const txDate = dateInMonth(monthsAgo, tx.day);
      const externalId = `demo-${txDate.toISOString().slice(0, 10)}-${tx.description.slice(0, 30)}-${tx.amount}`;

      // Determine classification method
      let method = tx.classificationMethod;
      if (!method && categoryId) {
        // Distribute: 60% rule, 25% ai, 10% manual, 5% none
        const roll = Math.random();
        if (roll < 0.6) method = "rule";
        else if (roll < 0.85) method = "ai";
        else if (roll < 0.95) method = "manual";
        // else undefined (uncategorized feel)
      }

      await db.insert(transactions).values({
        householdId: household.id,
        accountId,
        externalId,
        date: txDate,
        processedDate: txDate,
        description: tx.description,
        originalDescription: tx.description,
        amount: String(tx.amount),
        transactionType: tx.type,
        categoryId: categoryId ?? null,
        classificationMethod: method ?? null,
      });
      txCount++;
    }
  }
  console.log(`Created ${txCount} transactions (${uncategorizedCount} uncategorized)`);

  // 7. Create recurring patterns
  const recurringDefs = [
    { description: "העברת משכורת - חברת הייטק בע\"מ", amount: "25000", frequency: "monthly" as const, categoryName: "Salary", accountName: "Bank Leumi - Checking", confidence: "0.99" },
    { description: "העברת משכורת - מרפאת שיניים כהן", amount: "12000", frequency: "monthly" as const, categoryName: "Salary", accountName: "Bank Hapoalim - Joint", confidence: "0.99" },
    { description: "קצבת ילדים - ביטוח לאומי", amount: "500", frequency: "monthly" as const, categoryName: "Child Allowance", accountName: "Bank Leumi - Checking", confidence: "0.97" },
    { description: "משכנתא - בנק לאומי", amount: "6800", frequency: "monthly" as const, categoryName: "Mortgage", accountName: "Bank Leumi - Checking", confidence: "0.99" },
    { description: "בזק - אינטרנט ביתי", amount: "170", frequency: "monthly" as const, categoryName: "Internet", accountName: "Isracard", confidence: "0.95" },
    { description: "פלאפון - חבילת סלולר", amount: "120", frequency: "monthly" as const, categoryName: "Phone", accountName: "Isracard", confidence: "0.96" },
    { description: "Netflix", amount: "55", frequency: "monthly" as const, categoryName: "Streaming", accountName: "Max - Leumi Card", confidence: "0.98" },
    { description: "Spotify Premium Family", amount: "30", frequency: "monthly" as const, categoryName: "Streaming", accountName: "Max - Leumi Card", confidence: "0.98" },
    { description: "הולמס פלייס - מנוי חודשי", amount: "350", frequency: "monthly" as const, categoryName: "Gym", accountName: "Isracard", confidence: "0.97" },
    { description: "ביטוח רכב - הראל", amount: "450", frequency: "monthly" as const, categoryName: "Car Insurance", accountName: "Bank Leumi - Checking", confidence: "0.96" },
    { description: "מכבי שירותי בריאות - משלים זהב", amount: "280", frequency: "monthly" as const, categoryName: "Health Insurance", accountName: "Bank Leumi - Checking", confidence: "0.95" },
    { description: "ארנונה - עיריית תל אביב", amount: "850", frequency: "bi_monthly" as const, categoryName: "Arnona", accountName: "Bank Leumi - Checking", confidence: "0.90" },
    { description: "חברת החשמל - תשלום חודשי", amount: "450", frequency: "monthly" as const, categoryName: "Electricity", accountName: "Isracard", confidence: "0.85" },
    { description: "העברה לחיסכון - ONE Zero", amount: "4000", frequency: "monthly" as const, categoryName: "Savings Transfer", accountName: "Bank Leumi - Checking", confidence: "0.95" },
    { description: "חוגים - צהרון + שחייה", amount: "1800", frequency: "monthly" as const, categoryName: "Activities", accountName: "Bank Leumi - Checking", confidence: "0.93" },
  ];

  let recurringCount = 0;
  for (const rp of recurringDefs) {
    const categoryId = categoryMap.get(rp.categoryName);
    const accountId = accountMap.get(rp.accountName);
    if (!categoryId || !accountId) continue;

    await db.insert(recurringPatterns).values({
      householdId: household.id,
      description: rp.description,
      expectedAmount: rp.amount,
      frequency: rp.frequency,
      categoryId,
      accountId,
      lastOccurrence: dateInMonth(0, 1),
      nextExpectedDate: dateInMonth(-1, 1), // next month
      confidence: rp.confidence,
    });
    recurringCount++;
  }
  console.log(`Created ${recurringCount} recurring patterns`);

  // 8. Create categorization rules
  const ruleDefs = [
    { pattern: "שופרסל", categoryName: "Groceries" },
    { pattern: "רמי לוי", categoryName: "Groceries" },
    { pattern: "יוחננוף", categoryName: "Groceries" },
    { pattern: "מגה בעיר", categoryName: "Groceries" },
    { pattern: "ארומה", categoryName: "Coffee & Cafes" },
    { pattern: "קפה גרג", categoryName: "Coffee & Cafes" },
    { pattern: "קפה לנדוור", categoryName: "Coffee & Cafes" },
    { pattern: "קופי בין", categoryName: "Coffee & Cafes" },
    { pattern: "סונול", categoryName: "Fuel" },
    { pattern: "פז", categoryName: "Fuel" },
    { pattern: "דלק", categoryName: "Fuel" },
    { pattern: "וולט", categoryName: "Delivery" },
    { pattern: "תן ביס", categoryName: "Delivery" },
    { pattern: "Netflix", categoryName: "Streaming" },
    { pattern: "Spotify", categoryName: "Streaming" },
    { pattern: "הולמס פלייס", categoryName: "Gym" },
    { pattern: "חברת החשמל", categoryName: "Electricity" },
    { pattern: "מקורות", categoryName: "Water" },
    { pattern: "בזק", categoryName: "Internet" },
    { pattern: "רב-קו", categoryName: "Public Transport" },
    { pattern: "כביש 6", categoryName: "Tolls" },
    { pattern: "ביטוח לאומי", categoryName: "Child Allowance" },
    { pattern: "ארנונה", categoryName: "Arnona" },
    { pattern: "עמלת ניהול", categoryName: "Bank Fees" },
    { pattern: "פלאפון", categoryName: "Phone" },
    { pattern: "סלקום", categoryName: "Phone" },
    { pattern: "H&M", categoryName: "Clothing" },
    { pattern: "ZARA", categoryName: "Clothing" },
    { pattern: "FOX", categoryName: "Clothing" },
    { pattern: "Castro", categoryName: "Clothing" },
  ];

  let ruleCount = 0;
  for (const rule of ruleDefs) {
    const categoryId = categoryMap.get(rule.categoryName);
    if (!categoryId) continue;
    await db.insert(categorizationRules).values({
      householdId: household.id,
      pattern: rule.pattern,
      categoryId,
      priority: 10,
    });
    ruleCount++;
  }
  console.log(`Created ${ruleCount} categorization rules`);

  // 9. Create sync logs (12 months of weekly syncs)
  const leumiId = accountMap.get("Bank Leumi - Checking");
  const hapoalimId = accountMap.get("Bank Hapoalim - Joint");
  const isracardId = accountMap.get("Isracard");
  const maxId = accountMap.get("Max - Leumi Card");

  if (leumiId && hapoalimId && isracardId && maxId) {
    const syncValues = [];
    for (let weeksAgo = 48; weeksAgo >= 0; weeksAgo--) {
      const syncDate = new Date();
      syncDate.setDate(syncDate.getDate() - weeksAgo * 7);
      syncDate.setHours(6, 0, 0, 0);

      // Occasionally a sync fails (for realism)
      const isFailed = weeksAgo === 23;

      for (const accountId of [leumiId, hapoalimId, isracardId, maxId]) {
        const added = isFailed && accountId === isracardId ? 0 : 5 + Math.floor(Math.random() * 15);
        const dupes = Math.floor(Math.random() * 3);
        syncValues.push({
          accountId,
          status: isFailed && accountId === isracardId ? "error" : "success",
          transactionsAdded: added,
          transactionsDuplicate: dupes,
          errorMessage: isFailed && accountId === isracardId ? "Navigation timeout exceeded: 30000ms" : null,
          startedAt: new Date(syncDate.getTime() + Math.random() * 5000),
          completedAt: new Date(syncDate.getTime() + 10000 + Math.random() * 20000),
        });
      }
    }
    // Insert in batches
    for (let i = 0; i < syncValues.length; i += 50) {
      await db.insert(syncLogs).values(syncValues.slice(i, i + 50));
    }
    console.log(`Created ${syncValues.length} sync logs`);
  }

  console.log("\nDemo seed complete!");
}

seedDemo().catch((err: unknown) => {
  console.error("Demo seed failed:", err);
  process.exit(1);
});
