import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────

export const accountTypeEnum = pgEnum("account_type", ["bank", "credit_card"]);

export const frequencyEnum = pgEnum("frequency", [
  "weekly",
  "bi_weekly",
  "monthly",
  "bi_monthly",
  "quarterly",
  "semi_annual",
  "yearly",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "expense",
  "transfer",
]);

// ─── Households ──────────────────────────────────────────

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Users ───────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .references(() => households.id)
    .notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── WebAuthn Credentials ────────────────────────────────

export const webauthnCredentials = pgTable("webauthn_credentials", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: jsonb("transports").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── WebAuthn Challenges (ephemeral) ─────────────────────

export const challenges = pgTable("challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  challenge: text("challenge").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Financial Accounts ──────────────────────────────────

export const financialAccounts = pgTable("financial_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .references(() => households.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  institution: varchar("institution", { length: 50 }).notNull(),
  accountType: accountTypeEnum("account_type").notNull(),
  lastFourDigits: varchar("last_four_digits", { length: 4 }),
  encryptedCredentials: text("encrypted_credentials"),
  isActive: boolean("is_active").default(true).notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  startingBalance: numeric("starting_balance", { precision: 12, scale: 2 })
    .default("0")
    .notNull(),
  billingDay: integer("billing_day"), // 1-31, only relevant for credit_card accounts
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Categories ──────────────────────────────────────────

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .references(() => households.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 7 }),
  parentId: uuid("parent_id"),
  isSystem: boolean("is_system").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Transactions ────────────────────────────────────────

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .references(() => households.id)
      .notNull(),
    accountId: uuid("account_id")
      .references(() => financialAccounts.id)
      .notNull(),
    externalId: varchar("external_id", { length: 255 }),
    date: timestamp("date").notNull(),
    processedDate: timestamp("processed_date"),
    description: varchar("description", { length: 500 }).notNull(),
    originalDescription: varchar("original_description", { length: 500 }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("ILS").notNull(),
    transactionType: transactionTypeEnum("transaction_type").notNull(),
    categoryId: uuid("category_id").references(() => categories.id),
    isCategoryOverridden: boolean("is_category_overridden")
      .default(false)
      .notNull(),
    classificationMethod: varchar("classification_method", { length: 20 }),
    encryptedRawPayload: text("encrypted_raw_payload"),
    memo: varchar("memo", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("tx_idempotent_idx").on(table.accountId, table.externalId),
    index("tx_household_date_idx").on(table.householdId, table.date),
    index("tx_household_processed_date_idx").on(table.householdId, table.processedDate),
    index("tx_category_idx").on(table.categoryId),
  ],
);

// ─── Categorization Rules (learning) ─────────────────────

export const categorizationRules = pgTable(
  "categorization_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .references(() => households.id)
      .notNull(),
    pattern: varchar("pattern", { length: 255 }).notNull(),
    categoryId: uuid("category_id")
      .references(() => categories.id)
      .notNull(),
    priority: integer("priority").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("rule_pattern_idx").on(table.householdId, table.pattern),
  ],
);

// ─── Recurring Patterns ──────────────────────────────────

export const recurringPatterns = pgTable(
  "recurring_patterns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .references(() => households.id)
      .notNull(),
    description: varchar("description", { length: 255 }).notNull(),
    expectedAmount: numeric("expected_amount", { precision: 12, scale: 2 }).notNull(),
    frequency: frequencyEnum("frequency").notNull(),
    categoryId: uuid("category_id").references(() => categories.id),
    accountId: uuid("account_id").references(() => financialAccounts.id),
    lastOccurrence: timestamp("last_occurrence"),
    nextExpectedDate: timestamp("next_expected_date"),
    isActive: boolean("is_active").default(true).notNull(),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("recurring_household_desc_idx").on(
      table.householdId,
      table.description,
    ),
  ],
);

// ─── Sync Log ────────────────────────────────────────────

export const syncLogs = pgTable("sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .references(() => financialAccounts.id)
    .notNull(),
  status: varchar("status", { length: 20 }).notNull(),
  transactionsAdded: integer("transactions_added").default(0).notNull(),
  transactionsDuplicate: integer("transactions_duplicate").default(0).notNull(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
});

// ─── Relations ───────────────────────────────────────────

export const householdsRelations = relations(households, ({ many }) => ({
  users: many(users),
  financialAccounts: many(financialAccounts),
  categories: many(categories),
  transactions: many(transactions),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  household: one(households, {
    fields: [users.householdId],
    references: [households.id],
  }),
  webauthnCredentials: many(webauthnCredentials),
}));

export const webauthnCredentialsRelations = relations(
  webauthnCredentials,
  ({ one }) => ({
    user: one(users, {
      fields: [webauthnCredentials.userId],
      references: [users.id],
    }),
  }),
);

export const financialAccountsRelations = relations(
  financialAccounts,
  ({ one, many }) => ({
    household: one(households, {
      fields: [financialAccounts.householdId],
      references: [households.id],
    }),
    transactions: many(transactions),
    syncLogs: many(syncLogs),
  }),
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  household: one(households, {
    fields: [categories.householdId],
    references: [households.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryParent",
  }),
  children: many(categories, { relationName: "categoryParent" }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  household: one(households, {
    fields: [transactions.householdId],
    references: [households.id],
  }),
  account: one(financialAccounts, {
    fields: [transactions.accountId],
    references: [financialAccounts.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const categorizationRulesRelations = relations(
  categorizationRules,
  ({ one }) => ({
    household: one(households, {
      fields: [categorizationRules.householdId],
      references: [households.id],
    }),
    category: one(categories, {
      fields: [categorizationRules.categoryId],
      references: [categories.id],
    }),
  }),
);

export const recurringPatternsRelations = relations(
  recurringPatterns,
  ({ one }) => ({
    household: one(households, {
      fields: [recurringPatterns.householdId],
      references: [households.id],
    }),
    category: one(categories, {
      fields: [recurringPatterns.categoryId],
      references: [categories.id],
    }),
    account: one(financialAccounts, {
      fields: [recurringPatterns.accountId],
      references: [financialAccounts.id],
    }),
  }),
);

export const syncLogsRelations = relations(syncLogs, ({ one }) => ({
  account: one(financialAccounts, {
    fields: [syncLogs.accountId],
    references: [financialAccounts.id],
  }),
}));
