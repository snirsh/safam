export interface CategorizationRule {
  pattern: string;
  categoryId: string;
  priority: number;
}

/**
 * Match a transaction description against household categorization rules.
 * Rules must be pre-sorted by priority DESC.
 * Returns the first matching rule's categoryId, or null.
 */
export function matchRule(
  rules: CategorizationRule[],
  description: string,
): { categoryId: string; pattern: string } | null {
  const normalized = description.toLowerCase();

  for (const rule of rules) {
    if (normalized.includes(rule.pattern.toLowerCase())) {
      return { categoryId: rule.categoryId, pattern: rule.pattern };
    }
  }

  return null;
}
