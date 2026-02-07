import { getRequiredEnv } from "./config.js";

interface AccountConfig {
  id: string;
  institution: string;
  encryptedCredentials: string;
}

interface WebhookTransaction {
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

interface WebhookResult {
  added: number;
  duplicates: number;
}

function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getRequiredEnv("WEBHOOK_API_KEY")}`,
    "Content-Type": "application/json",
  };
}

function getBaseUrl(): string {
  return getRequiredEnv("WEBHOOK_URL");
}

/** Fetch active accounts with encrypted credentials from the app. */
export async function fetchAccounts(): Promise<AccountConfig[]> {
  const url = `${getBaseUrl()}/api/webhook/accounts`;
  const response = await fetch(url, { headers: getHeaders() });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch accounts (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { accounts: AccountConfig[] };
  return data.accounts;
}

/** Push scraped transactions to the webhook endpoint. */
export async function pushTransactions(
  accountId: string,
  transactions: WebhookTransaction[],
): Promise<WebhookResult> {
  const url = `${getBaseUrl()}/api/webhook/transactions`;
  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      accountId,
      scrapeDate: new Date().toISOString(),
      transactions,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to push transactions (${response.status}): ${text}`,
    );
  }

  return (await response.json()) as WebhookResult;
}
