/**
 * Detect credit card payment transactions on bank statements.
 * These are inter-account transfers that should not be counted as expenses.
 */

const CC_PAYMENT_PATTERNS: RegExp[] = [
  /ישראכרט/,
  /isracard/i,
  /כרטיס אשראי/,
  /כרטיסי אשראי/,
  /כ\.?א\.?ל/,
  /visa\s*cal/i,
  /ויזה\s*כ/,
  /\bcal\b/i,
  /מקס\b/,
  /לאומי\s*קארד/,
  /leumi\s*card/i,
  /דיינרס/,
  /diners/i,
  /אמריקן\s*אקספרס/,
  /american\s*express/i,
  /\bamex\b/i,
];

/**
 * Returns true if the description matches a known credit card payment pattern.
 * Only meaningful for bank account transactions.
 */
export function isCreditCardPayment(description: string): boolean {
  return CC_PAYMENT_PATTERNS.some((pattern) => pattern.test(description));
}
