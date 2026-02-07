import { sanitizeHebrew } from "./hebrew";
import type { OneZeroCredentials, RawTransaction, ScrapeResult } from "./types";

const IDENTITY_URL = "https://identity.tfd-bank.com/v1";
const GRAPHQL_URL = "https://mobile.tfd-bank.com/mobile-graph/graphql";

const JSON_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

// ---------- Low-level HTTP helpers ----------

async function post<T>(url: string, body: unknown, extra: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { ...JSON_HEADERS, ...extra },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`POST ${url} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

async function graphql<T>(query: string, variables: Record<string, unknown>, accessToken: string): Promise<T> {
  const result = await post<{ data: T; errors?: Array<{ message: string }> }>(
    GRAPHQL_URL,
    { operationName: null, query, variables },
    { Authorization: `Bearer ${accessToken}` },
  );
  if (result.errors?.length) {
    throw new Error(`GraphQL error: ${result.errors[0]!.message}`);
  }
  return result.data;
}

// ---------- Identity / Auth ----------

interface DeviceTokenResponse {
  resultData: { deviceToken: string };
}

interface OtpPrepareResponse {
  resultData: { otpContext: string };
}

interface OtpVerifyResponse {
  resultData: { otpToken: string };
}

interface IdTokenResponse {
  resultData: { idToken: string };
}

interface SessionTokenResponse {
  resultData: { accessToken: string };
}

/** Step 1 of OTP setup: trigger SMS to phone. Returns context needed for verify. */
export async function triggerOtp(phoneNumber: string): Promise<{ deviceToken: string; otpContext: string }> {
  if (!phoneNumber.startsWith("+")) {
    throw new Error("Phone number must start with + and include country code");
  }

  const { resultData: { deviceToken } } = await post<DeviceTokenResponse>(
    `${IDENTITY_URL}/devices/token`,
    { extClientId: "mobile", os: "Android" },
  );

  const { resultData: { otpContext } } = await post<OtpPrepareResponse>(
    `${IDENTITY_URL}/otp/prepare`,
    { factorValue: phoneNumber, deviceToken, otpChannel: "SMS_OTP" },
  );

  return { deviceToken, otpContext };
}

/** Step 2 of OTP setup: verify code, get long-term token. */
export async function verifyOtp(otpContext: string, otpCode: string): Promise<string> {
  const { resultData: { otpToken } } = await post<OtpVerifyResponse>(
    `${IDENTITY_URL}/otp/verify`,
    { otpContext, otpCode },
  );
  return otpToken;
}

/** Authenticate with ONE Zero using email + password + longTermToken. Returns access token. */
async function authenticate(credentials: OneZeroCredentials): Promise<string> {
  if (!credentials.otpLongTermToken) {
    throw new Error("otpLongTermToken is required for ONE Zero authentication");
  }

  const { resultData: { idToken } } = await post<IdTokenResponse>(
    `${IDENTITY_URL}/getIdToken`,
    {
      otpSmsToken: credentials.otpLongTermToken,
      email: credentials.email,
      pass: credentials.password,
      pinCode: "",
    },
  );

  const { resultData: { accessToken } } = await post<SessionTokenResponse>(
    `${IDENTITY_URL}/sessions/token`,
    { idToken, pass: credentials.password },
  );

  return accessToken;
}

/** Validate that credentials + OTP token work. Used during OTP setup. */
export async function validateCredentials(
  email: string,
  password: string,
  otpLongTermToken: string,
): Promise<boolean> {
  await authenticate({ email, password, otpLongTermToken });
  return true; // throws if invalid
}

// ---------- GraphQL Queries ----------

const GET_CUSTOMER = `query GetCustomer {
  customer {
    portfolios {
      portfolioId
      portfolioNum
      accounts {
        accountId
      }
    }
  }
}`;

const GET_MOVEMENTS = `query GetMovements(
  $portfolioId: String!
  $accountId: String!
  $pagination: PaginationInput!
  $language: BffLanguage!
) {
  movements(
    portfolioId: $portfolioId
    accountId: $accountId
    pagination: $pagination
    language: $language
  ) {
    movements {
      movementId
      movementAmount
      movementCurrency
      movementTimestamp
      creditDebit
      description
      valueDate
      runningBalance
      transaction {
        enrichment {
          recurrences {
            isRecurrent
          }
        }
      }
    }
    pagination {
      cursor
      hasMore
    }
  }
}`;

// ---------- Response types ----------

interface Portfolio {
  portfolioId: string;
  portfolioNum: string;
  accounts: Array<{ accountId: string }>;
}

interface Movement {
  movementId: string;
  movementAmount: string;
  movementCurrency: string;
  movementTimestamp: string;
  creditDebit: "DEBIT" | "CREDIT";
  description: string;
  valueDate: string;
  runningBalance: string;
  transaction?: {
    enrichment?: {
      recurrences?: Array<{ isRecurrent: boolean }>;
    };
  };
}

interface MovementsResponse {
  movements: {
    movements: Movement[];
    pagination: { cursor: string | null; hasMore: boolean };
  };
}

// ---------- Data Fetching ----------

async function fetchPortfolioMovements(
  portfolio: Portfolio,
  startDate: Date,
  accessToken: string,
): Promise<RawTransaction[]> {
  const account = portfolio.accounts[0];
  if (!account) return [];

  const allMovements: Movement[] = [];
  let cursor: string | null = null;

  // Paginate through movements until we pass the start date or no more pages
  let hasMore = true;
  while (hasMore) {
    const data: MovementsResponse = await graphql<MovementsResponse>(GET_MOVEMENTS, {
      portfolioId: portfolio.portfolioId,
      accountId: account.accountId,
      language: "HEBREW",
      pagination: { cursor, limit: 50 },
    }, accessToken);

    const { movements, pagination } = data.movements;
    allMovements.push(...movements);
    cursor = pagination.cursor;
    hasMore = pagination.hasMore;

    // Stop if oldest fetched movement is before our start date
    const oldest = movements[movements.length - 1];
    if (oldest && new Date(oldest.movementTimestamp) < startDate) break;
  }

  // Filter to only movements after startDate and convert
  return allMovements
    .filter((m) => new Date(m.movementTimestamp) >= startDate)
    .map((m): RawTransaction => {
      const modifier = m.creditDebit === "DEBIT" ? -1 : 1;
      const amount = parseFloat(m.movementAmount) * modifier;

      return {
        identifier: m.movementId,
        date: m.valueDate,
        processedDate: m.movementTimestamp,
        description: sanitizeHebrew(m.description),
        originalAmount: amount,
        originalCurrency: m.movementCurrency,
        chargedAmount: amount,
        chargedCurrency: m.movementCurrency,
      };
    });
}

/** Scrape ONE Zero bank account. Requires otpLongTermToken in credentials. */
export async function scrapeOneZero(
  credentials: OneZeroCredentials,
  startDate?: Date,
): Promise<ScrapeResult> {
  try {
    const accessToken = await authenticate(credentials);
    const effectiveStart = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const data = await graphql<{ customer: Array<{ portfolios: Portfolio[] }> }>(
      GET_CUSTOMER,
      {},
      accessToken,
    );

    const portfolios = data.customer.flatMap((c) => c.portfolios ?? []);
    const allTransactions: RawTransaction[] = [];

    for (const portfolio of portfolios) {
      const txns = await fetchPortfolioMovements(portfolio, effectiveStart, accessToken);
      allTransactions.push(...txns);
    }

    return { success: true, transactions: allTransactions };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ONE Zero error";
    return { success: false, transactions: [], error: message };
  }
}
