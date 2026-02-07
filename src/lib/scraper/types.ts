/** Raw transaction from a scraper before transformation. */
export interface RawTransaction {
  identifier: string | number;
  date: string; // ISO 8601
  processedDate?: string;
  description: string;
  originalAmount: number;
  originalCurrency: string;
  chargedAmount: number;
  chargedCurrency: string;
  memo?: string;
}

/** Transformed transaction ready for DB ingestion. */
export interface TransformedTransaction {
  externalId: string;
  date: string;
  processedDate?: string;
  description: string;
  originalDescription?: string;
  amount: number;
  currency?: string;
  type: "income" | "expense";
  memo?: string;
}

/** Result from a scraper run. */
export interface ScrapeResult {
  success: boolean;
  transactions: RawTransaction[];
  error?: string;
}

/** Credentials stored for ONE Zero accounts. */
export interface OneZeroCredentials {
  email: string;
  password: string;
  otpLongTermToken?: string;
}

/** Credentials stored for Isracard accounts. */
export interface IsracardCredentials {
  id: string;
  card6Digits: string;
  password: string;
}
