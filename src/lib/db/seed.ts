import { config } from "dotenv";
config({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { db } from "./index";
import {
  categories,
  categorizationRules,
  financialAccounts,
  households,
  recurringPatterns,
  syncLogs,
  transactions,
  users,
} from "./schema";

// ─── Category Definitions ──────────────────────────────────

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
  // Income
  { name: "Salary", icon: "💰", color: "#22c55e", parent: "Income" },
  { name: "Bonus", icon: "🎁", color: "#16a34a", parent: "Income" },
  { name: "Refunds", icon: "↩️", color: "#15803d", parent: "Income" },
  { name: "Rental Income", icon: "🏘️", color: "#059669", parent: "Income" },
  { name: "Freelance", icon: "💼", color: "#10b981", parent: "Income" },
  { name: "Child Allowance", icon: "👶", color: "#34d399", parent: "Income" },
  { name: "Other Income", icon: "💵", color: "#166534", parent: "Income" },

  // Housing
  { name: "Rent", icon: "🏠", color: "#3b82f6", parent: "Housing" },
  { name: "Mortgage", icon: "🏦", color: "#2563eb", parent: "Housing" },
  { name: "House Committee", icon: "🏢", color: "#1d4ed8", parent: "Housing" },
  { name: "Arnona", icon: "🏛️", color: "#1e40af", parent: "Housing" },
  { name: "Home Insurance", icon: "🛡️", color: "#1e3a8a", parent: "Housing" },
  { name: "Home Repairs", icon: "🔨", color: "#3730a3", parent: "Housing" },

  // Transportation
  { name: "Fuel", icon: "⛽", color: "#f97316", parent: "Transportation" },
  { name: "Public Transport", icon: "🚌", color: "#ea580c", parent: "Transportation" },
  { name: "Parking", icon: "🅿️", color: "#c2410c", parent: "Transportation" },
  { name: "Car Insurance", icon: "🛡️", color: "#9a3412", parent: "Transportation" },
  { name: "Car Maintenance", icon: "🔧", color: "#7c2d12", parent: "Transportation" },
  { name: "Car Lease", icon: "📝", color: "#431407", parent: "Transportation" },
  { name: "Tolls", icon: "🛣️", color: "#fb923c", parent: "Transportation" },

  // Food
  { name: "Groceries", icon: "🛒", color: "#a855f7", parent: "Food" },
  { name: "Restaurants", icon: "🍽️", color: "#9333ea", parent: "Food" },
  { name: "Delivery", icon: "🛵", color: "#7e22ce", parent: "Food" },
  { name: "Coffee & Cafes", icon: "☕", color: "#6b21a8", parent: "Food" },

  // Utilities
  { name: "Electricity", icon: "⚡", color: "#eab308", parent: "Utilities" },
  { name: "Water", icon: "💧", color: "#ca8a04", parent: "Utilities" },
  { name: "Internet", icon: "🌐", color: "#a16207", parent: "Utilities" },
  { name: "Phone", icon: "📱", color: "#854d0e", parent: "Utilities" },
  { name: "Cooking Gas", icon: "🔥", color: "#713f12", parent: "Utilities" },

  // Subscriptions
  { name: "Streaming", icon: "📺", color: "#ec4899", parent: "Subscriptions" },
  { name: "Software", icon: "💻", color: "#db2777", parent: "Subscriptions" },
  { name: "Gym", icon: "🏋️", color: "#be185d", parent: "Subscriptions" },

  // Healthcare
  { name: "Doctor", icon: "👨‍⚕️", color: "#14b8a6", parent: "Healthcare" },
  { name: "Pharmacy", icon: "💊", color: "#0d9488", parent: "Healthcare" },
  { name: "Health Insurance", icon: "🛡️", color: "#0f766e", parent: "Healthcare" },
  { name: "Dental", icon: "🦷", color: "#115e59", parent: "Healthcare" },
  { name: "Vision", icon: "👓", color: "#134e4a", parent: "Healthcare" },

  // Shopping
  { name: "Clothing", icon: "👕", color: "#f43f5e", parent: "Shopping" },
  { name: "Electronics", icon: "🔌", color: "#e11d48", parent: "Shopping" },
  { name: "Home Goods", icon: "🛋️", color: "#be123c", parent: "Shopping" },

  // Education
  { name: "Courses", icon: "📚", color: "#06b6d4", parent: "Education" },
  { name: "Books", icon: "📖", color: "#0891b2", parent: "Education" },

  // Entertainment
  { name: "Events", icon: "🎪", color: "#8b5cf6", parent: "Entertainment" },
  { name: "Travel", icon: "✈️", color: "#7c3aed", parent: "Entertainment" },
  { name: "Hobbies", icon: "🎨", color: "#6d28d9", parent: "Entertainment" },

  // Children & Family
  { name: "School Fees", icon: "🏫", color: "#fb923c", parent: "Children & Family" },
  { name: "Activities", icon: "⚽", color: "#f59e0b", parent: "Children & Family" },
  { name: "Summer Camp", icon: "🏕️", color: "#d97706", parent: "Children & Family" },
  { name: "Daycare", icon: "🍼", color: "#b45309", parent: "Children & Family" },
  { name: "Baby & Kids", icon: "🧸", color: "#92400e", parent: "Children & Family" },

  // Personal Care
  { name: "Haircuts", icon: "✂️", color: "#f472b6", parent: "Personal Care" },
  { name: "Beauty", icon: "💅", color: "#ec4899", parent: "Personal Care" },
  { name: "Toiletries", icon: "🧴", color: "#db2777", parent: "Personal Care" },

  // Financial
  { name: "Bank Fees", icon: "💳", color: "#94a3b8", parent: "Financial" },
  { name: "Loan Payments", icon: "📝", color: "#64748b", parent: "Financial" },

  // Gifts & Donations
  { name: "Gifts", icon: "🎀", color: "#a78bfa", parent: "Gifts & Donations" },
  { name: "Charity", icon: "❤️", color: "#8b5cf6", parent: "Gifts & Donations" },

  // Transfers
  { name: "Savings Transfer", icon: "🏦", color: "#64748b", parent: "Transfers" },

  // Other
  { name: "Other Expense", icon: "📝", color: "#475569", parent: "Other" },
];

// ─── Demo Account Definitions ──────────────────────────────

const DEMO_ACCOUNTS = [
  {
    name: "Bank Leumi - Checking",
    institution: "leumi",
    accountType: "bank" as const,
    lastFourDigits: "4521",
  },
  {
    name: "Isracard",
    institution: "isracard",
    accountType: "credit_card" as const,
    lastFourDigits: "8734",
  },
  {
    name: "One Zero - Savings",
    institution: "one_zero",
    accountType: "bank" as const,
    lastFourDigits: "1192",
  },
];

// ─── Demo Transaction Templates ────────────────────────────

function dateInMonth(monthsAgo: number, day: number): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, 10);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (day > lastDay) d.setDate(lastDay);
  return d;
}

interface TxSeed {
  description: string;
  amount: number;
  type: "income" | "expense";
  categoryName: string;
  accountName: string;
  day: number;
}

const MONTHLY_RECURRING: TxSeed[] = [
  { description: "העברת משכורת - חברת הייטק", amount: 18000, type: "income", categoryName: "Salary", accountName: "Bank Leumi - Checking", day: 1 },
  { description: "העברת משכורת - מרכז רפואי", amount: 14000, type: "income", categoryName: "Salary", accountName: "Bank Leumi - Checking", day: 1 },
  { description: "קצבת ילדים - ביטוח לאומי", amount: 300, type: "income", categoryName: "Child Allowance", accountName: "Bank Leumi - Checking", day: 5 },
  { description: "שכר דירה - העברה חודשית", amount: 5500, type: "expense", categoryName: "Rent", accountName: "Bank Leumi - Checking", day: 1 },
  { description: "ועד בית", amount: 180, type: "expense", categoryName: "House Committee", accountName: "Bank Leumi - Checking", day: 3 },
  { description: "בזק - אינטרנט", amount: 170, type: "expense", categoryName: "Internet", accountName: "Isracard", day: 10 },
  { description: "פלאפון - חבילה", amount: 70, type: "expense", categoryName: "Phone", accountName: "Isracard", day: 10 },
  { description: "סלקום - חבילה", amount: 80, type: "expense", categoryName: "Phone", accountName: "Isracard", day: 10 },
  { description: "Netflix", amount: 55, type: "expense", categoryName: "Streaming", accountName: "Isracard", day: 12 },
  { description: "Spotify Premium Family", amount: 30, type: "expense", categoryName: "Streaming", accountName: "Isracard", day: 14 },
  { description: "הולמס פלייס - מנוי חודשי", amount: 280, type: "expense", categoryName: "Gym", accountName: "Isracard", day: 3 },
  { description: "ביטוח רכב - הראל", amount: 350, type: "expense", categoryName: "Car Insurance", accountName: "Bank Leumi - Checking", day: 20 },
  { description: "מכבי שירותי בריאות - משלים", amount: 200, type: "expense", categoryName: "Health Insurance", accountName: "Bank Leumi - Checking", day: 8 },
  { description: "חוג שחייה - ילדים", amount: 300, type: "expense", categoryName: "Activities", accountName: "Isracard", day: 5 },
  { description: "העברה לחיסכון", amount: 3000, type: "expense", categoryName: "Savings Transfer", accountName: "Bank Leumi - Checking", day: 2 },
];

function variableTransactions(monthsAgo: number): TxSeed[] {
  const v = monthsAgo + 1;
  return [
    { description: "חברת החשמל - תשלום חודשי", amount: 320 + v * 60, type: "expense", categoryName: "Electricity", accountName: "Isracard", day: 15 },
    { description: "מקורות - תשלום מים", amount: 80 + v * 15, type: "expense", categoryName: "Water", accountName: "Isracard", day: 18 },
    { description: "שופרסל דיל - סניף דיזנגוף", amount: 380 + v * 40, type: "expense", categoryName: "Groceries", accountName: "Isracard", day: 4 },
    { description: "רמי לוי - קניות שבועיות", amount: 520 + v * 30, type: "expense", categoryName: "Groceries", accountName: "Isracard", day: 11 },
    { description: "שופרסל דיל - סניף דיזנגוף", amount: 290 + v * 25, type: "expense", categoryName: "Groceries", accountName: "Isracard", day: 18 },
    { description: "מגה בעיר - פירות וירקות", amount: 180 + v * 20, type: "expense", categoryName: "Groceries", accountName: "Isracard", day: 22 },
    { description: "רמי לוי - קניות שבועיות", amount: 450 + v * 35, type: "expense", categoryName: "Groceries", accountName: "Isracard", day: 27 },
    { description: "סונול - תחנת דלק", amount: 250 + v * 30, type: "expense", categoryName: "Fuel", accountName: "Isracard", day: 7 },
    { description: "פז - תחנת דלק", amount: 280 + v * 20, type: "expense", categoryName: "Fuel", accountName: "Isracard", day: 21 },
    { description: "גולדה - גלידה", amount: 85 + v * 10, type: "expense", categoryName: "Restaurants", accountName: "Isracard", day: 6 },
    { description: "שיפודי התקווה - ארוחה", amount: 220 + v * 15, type: "expense", categoryName: "Restaurants", accountName: "Isracard", day: 16 },
    { description: "מסעדת נאמה - ארוחת ערב", amount: 340 + v * 20, type: "expense", categoryName: "Restaurants", accountName: "Isracard", day: 24 },
    { description: "ארומה - קפה ומאפה", amount: 42 + v * 5, type: "expense", categoryName: "Coffee & Cafes", accountName: "Isracard", day: 3 },
    { description: "קפה גרג - ארוחת בוקר", amount: 68 + v * 8, type: "expense", categoryName: "Coffee & Cafes", accountName: "Isracard", day: 13 },
    { description: "ארומה - קפה", amount: 28, type: "expense", categoryName: "Coffee & Cafes", accountName: "Isracard", day: 20 },
    { description: "וולט - משלוח אוכל", amount: 95 + v * 10, type: "expense", categoryName: "Delivery", accountName: "Isracard", day: 9 },
    { description: "וולט - משלוח אוכל", amount: 78 + v * 8, type: "expense", categoryName: "Delivery", accountName: "Isracard", day: 23 },
  ];
}

function oneOffTransactions(monthsAgo: number): TxSeed[] {
  switch (monthsAgo) {
    case 0:
      return [
        { description: "פארם - תרופות", amount: 85, type: "expense", categoryName: "Pharmacy", accountName: "Isracard", day: 3 },
        { description: "רב-קו - טעינה", amount: 100, type: "expense", categoryName: "Public Transport", accountName: "Bank Leumi - Checking", day: 4 },
      ];
    case 1:
      return [
        { description: "ZARA - ביגוד", amount: 420, type: "expense", categoryName: "Clothing", accountName: "Isracard", day: 8 },
        { description: "iDigital - כיסוי לטלפון", amount: 150, type: "expense", categoryName: "Electronics", accountName: "Isracard", day: 15 },
        { description: "ד\"ר כהן - שיניים", amount: 350, type: "expense", categoryName: "Dental", accountName: "Isracard", day: 19 },
        { description: "מספרת יופי - תספורת", amount: 120, type: "expense", categoryName: "Haircuts", accountName: "Isracard", day: 22 },
        { description: "ארנונה - תשלום דו-חודשי", amount: 900, type: "expense", categoryName: "Arnona", accountName: "Bank Leumi - Checking", day: 15 },
        { description: "עמלת ניהול חשבון", amount: 25, type: "expense", categoryName: "Bank Fees", accountName: "Bank Leumi - Checking", day: 28 },
        { description: "כביש 6 - אגרה", amount: 32, type: "expense", categoryName: "Tolls", accountName: "Isracard", day: 12 },
      ];
    case 2:
      return [
        { description: "ACE - כלי בית", amount: 280, type: "expense", categoryName: "Home Goods", accountName: "Isracard", day: 5 },
        { description: "IKEA - ריהוט", amount: 850, type: "expense", categoryName: "Home Goods", accountName: "Isracard", day: 12 },
        { description: "החזר מס - רשות המסים", amount: 2400, type: "income", categoryName: "Refunds", accountName: "Bank Leumi - Checking", day: 20 },
        { description: "מתנה ליום הולדת", amount: 200, type: "expense", categoryName: "Gifts", accountName: "Isracard", day: 18 },
        { description: "רב-קו - טעינה", amount: 100, type: "expense", categoryName: "Public Transport", accountName: "Bank Leumi - Checking", day: 7 },
        { description: "עמלת ניהול חשבון", amount: 25, type: "expense", categoryName: "Bank Fees", accountName: "Bank Leumi - Checking", day: 28 },
        { description: "טיפול שיניים - ד\"ר לוי", amount: 500, type: "expense", categoryName: "Dental", accountName: "Isracard", day: 22 },
      ];
    case 3:
      return [
        { description: "H&M - ביגוד ילדים", amount: 350, type: "expense", categoryName: "Baby & Kids", accountName: "Isracard", day: 9 },
        { description: "בונוס שנתי", amount: 8000, type: "income", categoryName: "Bonus", accountName: "Bank Leumi - Checking", day: 15 },
        { description: "ארנונה - תשלום דו-חודשי", amount: 900, type: "expense", categoryName: "Arnona", accountName: "Bank Leumi - Checking", day: 15 },
        { description: "סופ\"ש צימר בצפון", amount: 1200, type: "expense", categoryName: "Travel", accountName: "Isracard", day: 20 },
        { description: "צדקה - עמותת לתת", amount: 180, type: "expense", categoryName: "Charity", accountName: "Bank Leumi - Checking", day: 10 },
        { description: "עמלת ניהול חשבון", amount: 25, type: "expense", categoryName: "Bank Fees", accountName: "Bank Leumi - Checking", day: 28 },
        { description: "תיקון אינסטלציה", amount: 450, type: "expense", categoryName: "Home Repairs", accountName: "Bank Leumi - Checking", day: 25 },
        { description: "משקפי ראייה - אופטיקנה", amount: 800, type: "expense", categoryName: "Vision", accountName: "Isracard", day: 14 },
      ];
    default:
      return [];
  }
}

// ─── Main Seed Function ────────────────────────────────────

async function seed() {
  console.log("Seeding database...\n");

  // 1. Clear all data
  console.log("Clearing existing data...");
  await db.execute(sql`TRUNCATE households CASCADE`);

  // 2. Create household
  const householdRows = await db
    .insert(households)
    .values({ name: "Safam Household" })
    .returning();
  const household = householdRows[0];
  if (!household) throw new Error("Failed to create household");
  console.log(`Created household: ${household.id}`);

  // 3. Create users
  const userRows = await db
    .insert(users)
    .values([
      { householdId: household.id, displayName: "Dev User" },
      { householdId: household.id, displayName: "Dev Spouse" },
    ])
    .returning();
  console.log(`Created ${userRows.length} dev users`);

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
    if (!parentId) {
      console.warn(`Parent "${sub.parent}" not found for "${sub.name}"`);
      continue;
    }
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
      })
      .returning();
    const row = rows[0];
    if (row) accountMap.set(acct.name, row.id);
  }
  console.log(`Created ${accountMap.size} financial accounts`);

  // 6. Generate and insert transactions
  let txCount = 0;
  for (const monthsAgo of [3, 2, 1, 0]) {
    const isCurrentMonth = monthsAgo === 0;
    const maxDay = isCurrentMonth ? new Date().getDate() : 31;

    const allTxns: TxSeed[] = [
      ...MONTHLY_RECURRING,
      ...variableTransactions(monthsAgo),
      ...oneOffTransactions(monthsAgo),
    ].filter((tx) => tx.day <= maxDay);

    for (const tx of allTxns) {
      const categoryId = categoryMap.get(tx.categoryName);
      const accountId = accountMap.get(tx.accountName);
      if (!categoryId) {
        console.warn(`Category "${tx.categoryName}" not found, skipping "${tx.description}"`);
        continue;
      }
      if (!accountId) {
        console.warn(`Account "${tx.accountName}" not found, skipping "${tx.description}"`);
        continue;
      }

      const txDate = dateInMonth(monthsAgo, tx.day);
      const externalId = `demo-${txDate.toISOString().slice(0, 10)}-${tx.description.slice(0, 20)}-${tx.amount}`;

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
        categoryId,
        classificationMethod: "rule",
      });
      txCount++;
    }
  }
  console.log(`Created ${txCount} demo transactions`);

  // 7. Create recurring patterns
  const recurringDefs = [
    { description: "העברת משכורת - חברת הייטק", amount: "18000", frequency: "monthly" as const, categoryName: "Salary", accountName: "Bank Leumi - Checking", confidence: "0.99" },
    { description: "העברת משכורת - מרכז רפואי", amount: "14000", frequency: "monthly" as const, categoryName: "Salary", accountName: "Bank Leumi - Checking", confidence: "0.99" },
    { description: "שכר דירה - העברה חודשית", amount: "5500", frequency: "monthly" as const, categoryName: "Rent", accountName: "Bank Leumi - Checking", confidence: "0.99" },
    { description: "בזק - אינטרנט", amount: "170", frequency: "monthly" as const, categoryName: "Internet", accountName: "Isracard", confidence: "0.95" },
    { description: "Netflix", amount: "55", frequency: "monthly" as const, categoryName: "Streaming", accountName: "Isracard", confidence: "0.98" },
    { description: "Spotify Premium Family", amount: "30", frequency: "monthly" as const, categoryName: "Streaming", accountName: "Isracard", confidence: "0.98" },
    { description: "הולמס פלייס - מנוי חודשי", amount: "280", frequency: "monthly" as const, categoryName: "Gym", accountName: "Isracard", confidence: "0.97" },
    { description: "ביטוח רכב - הראל", amount: "350", frequency: "monthly" as const, categoryName: "Car Insurance", accountName: "Bank Leumi - Checking", confidence: "0.96" },
    { description: "ארנונה - תשלום דו-חודשי", amount: "900", frequency: "bi_monthly" as const, categoryName: "Arnona", accountName: "Bank Leumi - Checking", confidence: "0.90" },
    { description: "חברת החשמל - תשלום חודשי", amount: "440", frequency: "monthly" as const, categoryName: "Electricity", accountName: "Isracard", confidence: "0.85" },
    { description: "העברה לחיסכון", amount: "3000", frequency: "monthly" as const, categoryName: "Savings Transfer", accountName: "Bank Leumi - Checking", confidence: "0.95" },
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
      nextExpectedDate: dateInMonth(-1, 1),
      confidence: rp.confidence,
    });
    recurringCount++;
  }
  console.log(`Created ${recurringCount} recurring patterns`);

  // 8. Create categorization rules
  const ruleDefs = [
    { pattern: "שופרסל", categoryName: "Groceries" },
    { pattern: "רמי לוי", categoryName: "Groceries" },
    { pattern: "מגה בעיר", categoryName: "Groceries" },
    { pattern: "ארומה", categoryName: "Coffee & Cafes" },
    { pattern: "קפה גרג", categoryName: "Coffee & Cafes" },
    { pattern: "סונול", categoryName: "Fuel" },
    { pattern: "פז", categoryName: "Fuel" },
    { pattern: "וולט", categoryName: "Delivery" },
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

  // 9. Create sync logs
  const leumiId = accountMap.get("Bank Leumi - Checking");
  const isracardId = accountMap.get("Isracard");
  if (leumiId && isracardId) {
    const syncDate = new Date();
    syncDate.setHours(6, 0, 0, 0);
    await db.insert(syncLogs).values([
      {
        accountId: leumiId,
        status: "success",
        transactionsAdded: 45,
        transactionsDuplicate: 0,
        startedAt: syncDate,
        completedAt: new Date(syncDate.getTime() + 12000),
      },
      {
        accountId: isracardId,
        status: "success",
        transactionsAdded: 82,
        transactionsDuplicate: 3,
        startedAt: new Date(syncDate.getTime() + 15000),
        completedAt: new Date(syncDate.getTime() + 28000),
      },
    ]);
    console.log("Created 2 sync logs");
  }

  console.log("\nSeed complete!");
}

seed().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
