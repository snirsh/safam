/**
 * Helpers to determine whether a category belongs to the "Income" direction.
 * Used to guard against tagging income transactions as expenses and vice versa.
 */

const INCOME_PARENT_NAME = "Income";

type CategoryWithParent = {
  id: string;
  name: string;
  parentName: string | null;
};

/**
 * Returns true if the category is under the "Income" parent or IS the "Income" root.
 */
export const isIncomeCategorySync = (
  categoryId: string,
  categories: CategoryWithParent[],
): boolean => {
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return false;
  // It's the "Income" root itself (parentName is null and name is "Income")
  if (cat.parentName === null && cat.name === INCOME_PARENT_NAME) return true;
  // It's a subcategory under "Income"
  return cat.parentName === INCOME_PARENT_NAME;
};

/**
 * Check if a category is direction-compatible with a transaction type.
 * - Income transactions should only use Income categories
 * - Expense transactions should only use non-Income categories
 */
export const isCategoryDirectionCompatible = (
  transactionType: "income" | "expense" | "transfer",
  categoryId: string,
  categories: CategoryWithParent[],
): boolean => {
  if (transactionType === "transfer") return true;

  const isIncome = isIncomeCategorySync(categoryId, categories);

  if (transactionType === "income") return isIncome;
  if (transactionType === "expense") return !isIncome;

  return true;
};

/**
 * Filter category options to only those compatible with the given transaction type.
 */
export const filterCategoriesByDirection = (
  transactionType: "income" | "expense" | "transfer",
  categories: CategoryWithParent[],
): CategoryWithParent[] => {
  if (transactionType === "transfer") return categories;

  return categories.filter((cat) => {
    const isIncome = isIncomeCategorySync(cat.id, categories);
    return transactionType === "income" ? isIncome : !isIncome;
  });
};
