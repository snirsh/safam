# Forecast Calculation Fix - Summary

**Date**: February 9, 2026
**Commit**: `1d9d2fa`
**Status**: ✅ Complete

## Problem Statement

The forecast page was showing incorrect metrics:
- **Current Balance**: -₪340,761 (completely wrong)
- **Issue**: Forecast was calculating ALL-TIME totals instead of monthly metrics
- **Root Cause**: Added starting balance logic that summed all transactions across all time

### Additional Issues Discovered

1. **Refund Double-Counting**
   - CC refunds: -100₪ (reduces debt = income) ✓
   - Bank deposits: +100₪ (refund deposited = income) ❌
   - **Result**: Both counted as income = +200₪ instead of +100₪

2. **Wrong Transaction Categorization**
   - Previous script changed 3 transactions with ~4,000₪ amounts to income
   - Only 1 was correct (actual rental income)
   - 2 were wrong (phone bill and medical expenses)

3. **Recurring Pattern Wrong Category**
   - 4,000₪ rent pattern showed as "Transfers" instead of "Rental Income"

4. **Cross-Month Expense Bleeding**
   - CC payment on Feb 2nd pays for JANUARY charges
   - Shouldn't count against February forecast

## Solution

### Core Concept: Monthly Forecast

The forecast page should show **current month metrics only**:

```
Current Balance = This month's (Income - Expenses - Transfers)
Projected EOM = Current Balance + Pending Recurring
```

**Why exclude transfers?**
- Transfers include CC payments (money moving from bank to pay CC)
- Transfers include refund deposits (to avoid double-counting)
- Including them gives accurate "cash in bank" for the month

### Implementation Changes

#### 1. Forecast Calculation ([src/lib/forecast/calculate.ts](../src/lib/forecast/calculate.ts))

**Before** (All-Time Calculation):
```typescript
// Get starting balances from all accounts
const accounts = await db
  .select({ startingBalance: financialAccounts.startingBalance })
  .from(financialAccounts)
  .where(eq(financialAccounts.householdId, householdId));

const totalStartingBalance = accounts.reduce(
  (sum, acc) => sum + Number(acc.startingBalance ?? 0), 0);

// Get ALL-time transaction totals
const totals = await db
  .select({...})
  .from(transactions)
  .where(eq(transactions.householdId, householdId)) // No date filter!
  .groupBy(transactions.transactionType);

const currentBalance = totalStartingBalance + income - expenses - transfers;
```

**After** (Monthly Calculation):
```typescript
// Get current month's realized totals
const totals = await db
  .select({
    type: transactions.transactionType,
    total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
  })
  .from(transactions)
  .where(
    and(
      eq(transactions.householdId, householdId),
      gte(transactions.date, monthStart),  // Filter: current month only
      lt(transactions.date, monthEnd),
    ),
  )
  .groupBy(transactions.transactionType);

// Monthly net: Income - Expenses - Transfers
const currentBalance = income - expenses - transfers;
```

**Key Changes**:
- ❌ Removed starting balance logic
- ✅ Added date filters: `gte(monthStart)` and `lt(monthEnd)`
- ✅ Formula now calculates ONLY current month transactions
- ✅ Removed unused `financialAccounts` import

#### 2. Data Fixes (Production Database)

All scripts ran against production: `postgresql://neondb_owner:npg_YXNfVOezQ2c5@ep-misty-hall-agtdlw17-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require`

**Fix 1: Refund Double-Counting** ([src/scripts/fix-refund-double-counting.ts](../src/scripts/fix-refund-double-counting.ts))
- Found bank income transactions with refund keywords (החזר, REFUND, זיכוי)
- Marked as `transfer` type to avoid double-counting
- **Result**: 18 transactions fixed (note: this was from earlier session, not run in current session)

**Fix 2: Revert Wrong Income** ([src/scripts/revert-wrong-income.ts](../src/scripts/revert-wrong-income.ts))
- Reverted 4 transactions back to `expense`:
  - טלפון ני/VAND STAR/קניה (₪4,167.63) - Phone bill
  - מרכז מומחים למלנומה (₪702.00) - Medical
  - מרכז מומחים למלנומה (₪1,200.00) - Medical
  - מרכז מומחים למלנומה (₪3,855.00) - Medical
- Kept the actual 4,000₪ rent transaction as income

**Fix 3: Recurring Pattern Category** ([src/scripts/fix-recurring-category.ts](../src/scripts/fix-recurring-category.ts))
- Found pattern: "העברה ממזרחי טפחו/דורי איתי ואסתי" (₪4,000.00)
- Updated category from "Transfers" → "Rental Income"
- **Result**: Rent now shows as pending income (green +) instead of transfer

#### 3. Cleanup

**Removed Scripts**:
- `src/scripts/debug-forecast.ts` - Temporary debug script
- `src/scripts/set-starting-balance.ts` - No longer needed with monthly calc
- `src/scripts/check-transactions.ts` - Temporary investigation script
- `src/scripts/fix-rental-income.ts` - Old broken version

**Kept Scripts** (for reference):
- `src/scripts/fix-refund-double-counting.ts`
- `src/scripts/revert-wrong-income.ts`
- `src/scripts/fix-recurring-category.ts`

**Package.json**:
- Removed temporary script entries
- Clean scripts section

## Expected Results

After deployment, the forecast page should show:

### Current Month (e.g., February 2026)

**Current Balance**: Net of current month's bank transactions
```
= Bank Income - Bank Expenses - Bank Transfers
```

**Pending Recurring**: Unfulfilled patterns expected this month
- ✅ Rent (4,000₪) shows as **Income** (green +)
- ✅ Other recurring bills show as **Expenses** (red -)

**Projected End of Month**:
```
= Current Balance + Pending Income - Pending Expenses
```

### Example Calculation

From user's scenario:
- February bank transactions: 7,089₪ net (rent, mortgage, income, salary)
- CC charges in February: 1,533₪ (will be paid March 2nd)
- March forecast: 7,089 (recurring) - 1,533 (CC liability) = 5,556₪

## Verification Queries

### Check Transaction Types
```sql
SELECT description, amount, transaction_type
FROM transactions
WHERE description IN (
  'טלפון ני/VAND STAR/קניה',
  'מרכז מומחים למלנומה',
  'הפקדה לפקדון'
);
-- Should show: first ones as expense, last one as income
```

### Check Recurring Pattern
```sql
SELECT
  rp.description,
  rp.expected_amount,
  c.name as category,
  pc.name as parent_category
FROM recurring_patterns rp
LEFT JOIN categories c ON rp.category_id = c.id
LEFT JOIN categories pc ON c.parent_id = pc.id
WHERE ABS(rp.expected_amount - 4000) < 10;
-- Should show: category = "Rental Income", parent = "Income"
```

### Check Refunds
```sql
SELECT COUNT(*) as refund_transfers
FROM transactions
WHERE transaction_type = 'transfer'
  AND (description LIKE '%החזר%'
    OR description LIKE '%REFUND%'
    OR description LIKE '%זיכוי%');
-- Should show: 18+ transfers (refund deposits marked to avoid double-count)
```

## Files Changed

- ✏️ [src/lib/forecast/calculate.ts](../src/lib/forecast/calculate.ts) - Reverted to monthly calculation
- ✏️ [package.json](../package.json) - Removed temporary scripts
- ➕ [src/scripts/fix-recurring-category.ts](../src/scripts/fix-recurring-category.ts) - New
- ➕ [src/scripts/fix-refund-double-counting.ts](../src/scripts/fix-refund-double-counting.ts) - New
- ➕ [src/scripts/revert-wrong-income.ts](../src/scripts/revert-wrong-income.ts) - New
- ➖ `src/scripts/fix-rental-income.ts` - Deleted (old broken version)
- ➖ `src/scripts/set-starting-balance.ts` - Deleted (no longer needed)
- ➖ `src/scripts/debug-forecast.ts` - Deleted (temporary)
- ➖ `src/scripts/check-transactions.ts` - Deleted (temporary)

## Lessons Learned

### 1. Forecast vs. Account Balance
- **Forecast**: Shows monthly cash flow projection
- **Account Balance**: Shows actual bank balance (all-time)
- These are different metrics and should be shown separately

### 2. Transaction Types Matter
- **Income**: Money coming in (salary, refunds on CC side)
- **Expense**: Money going out (bills, purchases)
- **Transfer**: Internal movements (CC payments, refund deposits)
- Transfers should be excluded from income/expense totals to avoid double-counting

### 3. Cross-Month CC Payments
- CC payment on Feb 2nd pays for **January** charges
- CC charges in February will be paid on **March** 2nd
- Each month's forecast should only include that month's bank transactions
- CC liability can be shown separately as "pending next month"

### 4. Local vs Production DB
- `.env.local` points to LOCAL database
- Production changes require overriding `DATABASE_URL`
- Use: `DATABASE_URL='...' pnpm tsx script.ts`

### 5. Data Fix Scripts
- Always log what will be changed before making changes
- Use exact matching (descriptions, amounts) when possible
- Keep fix scripts for reference even after running

## Future Improvements

1. **Add Account Balance Widget**
   - Show actual bank balance (all-time total)
   - Separate from monthly forecast
   - Formula: `Starting Balance + All Income - All Expenses - All Transfers`

2. **CC Liability Indicator**
   - Show current month's CC charges as "pending next month"
   - Helps with cash flow planning

3. **Multi-Month Forecast**
   - Extend beyond current month
   - Show next 3-6 months based on recurring patterns

4. **Semi-Annual Frequency**
   - User has ESSP program (every 6 months)
   - Add `semi_annual` frequency to `intervals.ts`
   - Gap: between quarterly (80-105d) and yearly (340-395d)

## References

- Plan file: [/Users/snirsh/.claude/plans/snazzy-waddling-rainbow.md](~/.claude/plans/snazzy-waddling-rainbow.md)
- Commit: `1d9d2fa` on `main` branch
- Previous phase commits:
  - Phase 1: `b1d080b`
  - Phase 2: `e316679`
  - Phase 3: `1f3832d`
  - Phase 4+5: `3e9f75d`
  - Phase 6: `3ff769b`
  - Phase 7: `be694af`
  - Phase 8: `cbbfbb3`
