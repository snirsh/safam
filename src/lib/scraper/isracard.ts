import type { IsracardCredentials, RawTransaction, ScrapeResult } from "./types";

const BASE_URL = "https://digital.isracard.co.il";
const SERVICES_URL = `${BASE_URL}/services/ProxyRequestHandler.ashx`;
const COMPANY_CODE = "11";
const COUNTRY_CODE = "212";
const ID_TYPE = "1";
const DATE_FORMAT_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

// ---------- Helpers ----------

function parseIsracardDate(ddmmyyyy: string): string {
  const match = DATE_FORMAT_REGEX.exec(ddmmyyyy);
  if (!match) return ddmmyyyy;
  return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00Z`).toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Cookie jar ----------

/** Minimal cookie jar — extracts Set-Cookie headers and sends them on subsequent requests. */
class CookieJar {
  private cookies = new Map<string, string>();

  addFromResponse(response: Response) {
    const setCookies = response.headers.getSetCookie();
    for (const header of setCookies) {
      const nameValue = header.split(";")[0];
      if (!nameValue) continue;
      const eqIdx = nameValue.indexOf("=");
      if (eqIdx === -1) continue;
      this.cookies.set(nameValue.slice(0, eqIdx).trim(), nameValue.slice(eqIdx + 1).trim());
    }
  }

  toString() {
    return Array.from(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

// ---------- HTTP helpers ----------

const COMMON_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
} as const;

function parseResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Isracard returned non-JSON response: ${text.slice(0, 100)}`);
  }
}

async function apiPost(jar: CookieJar, reqName: string, data: Record<string, string>): Promise<unknown> {
  const body = new URLSearchParams(data).toString();

  const response = await fetch(`${SERVICES_URL}?reqName=${reqName}`, {
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Cookie": jar.toString(),
      "Referer": `${BASE_URL}/personalarea/Login`,
      "Origin": BASE_URL,
    },
    body,
    redirect: "follow",
  });

  jar.addFromResponse(response);

  if (response.status === 204) return null;
  const text = await response.text();
  return parseResponse(text);
}

async function apiGet(jar: CookieJar, url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      ...COMMON_HEADERS,
      "Cookie": jar.toString(),
      "Referer": `${BASE_URL}/personalarea/Login`,
    },
    redirect: "follow",
  });

  jar.addFromResponse(response);

  if (response.status === 204) return null;
  const text = await response.text();
  return parseResponse(text);
}

// ---------- Login ----------

interface ValidateResult {
  Header?: { Status: string };
  ValidateIdDataBean?: { returnCode: string; userName: string };
}

interface LoginResult {
  status?: string;
}

async function login(jar: CookieJar, credentials: IsracardCredentials): Promise<void> {
  // Step 0: GET login page to establish session cookies
  const pageRes = await fetch(`${BASE_URL}/personalarea/Login`, {
    headers: COMMON_HEADERS,
    redirect: "follow",
  });
  jar.addFromResponse(pageRes);
  // Drain body
  await pageRes.text();

  // Step 1: ValidateIdData
  const validateResult = (await apiPost(jar, "ValidateIdData", {
    id: credentials.id,
    cardSuffix: credentials.card6Digits,
    countryCode: COUNTRY_CODE,
    idType: ID_TYPE,
    checkLevel: "1",
    companyCode: COMPANY_CODE,
  })) as ValidateResult;

  if (
    !validateResult?.Header ||
    validateResult.Header.Status !== "1" ||
    !validateResult.ValidateIdDataBean
  ) {
    throw new Error("Isracard login: ValidateIdData failed");
  }

  const { returnCode, userName } = validateResult.ValidateIdDataBean;
  if (returnCode === "4") throw new Error("Isracard: password change required");
  if (returnCode !== "1") throw new Error(`Isracard: ValidateIdData returnCode=${returnCode}`);

  // Step 2: performLogonI
  const loginResult = (await apiPost(jar, "performLogonI", {
    KodMishtamesh: userName,
    MisparZihuy: credentials.id,
    Sisma: credentials.password,
    cardSuffix: credentials.card6Digits,
    countryCode: COUNTRY_CODE,
    idType: ID_TYPE,
  })) as LoginResult;

  if (loginResult?.status === "3") throw new Error("Isracard: password change required");
  if (loginResult?.status !== "1") throw new Error("Isracard: invalid password or login failed");
}

// ---------- Transaction fetching ----------

interface IsracardTxn {
  dealSumType?: string;
  voucherNumberRatz?: string;
  voucherNumberRatzOutbound?: string;
  dealSum: number;
  paymentSum: number;
  dealSumOutbound?: number;
  paymentSumOutbound?: number;
  fullPurchaseDate: string;
  fullPurchaseDateOutbound?: string;
  fullPaymentDate?: string;
  fullSupplierNameHeb: string;
  fullSupplierNameOutbound?: string;
  currencyId?: string;
  currentPaymentCurrency?: string;
  moreInfo?: string;
}

function convertTransaction(txn: IsracardTxn, processedDate: string): RawTransaction | null {
  // Filter invalid transactions
  if (txn.dealSumType === "1") return null;
  if (txn.voucherNumberRatz === "000000000" && txn.voucherNumberRatzOutbound === "000000000") {
    return null;
  }

  const isOutbound = Boolean(txn.dealSumOutbound);
  const dateStr = isOutbound ? txn.fullPurchaseDateOutbound! : txn.fullPurchaseDate;
  const identifier = isOutbound ? txn.voucherNumberRatzOutbound! : txn.voucherNumberRatz!;
  const description = isOutbound ? (txn.fullSupplierNameOutbound ?? "") : txn.fullSupplierNameHeb;
  const currentProcessedDate = txn.fullPaymentDate
    ? parseIsracardDate(txn.fullPaymentDate)
    : processedDate;

  const raw: RawTransaction = {
    identifier: parseInt(identifier, 10),
    date: parseIsracardDate(dateStr),
    processedDate: currentProcessedDate,
    description,
    originalAmount: isOutbound ? -(txn.dealSumOutbound!) : -txn.dealSum,
    originalCurrency: txn.currentPaymentCurrency ?? txn.currencyId ?? "ILS",
    chargedAmount: isOutbound ? -(txn.paymentSumOutbound!) : -txn.paymentSum,
    chargedCurrency: txn.currencyId ?? "ILS",
  };
  if (txn.moreInfo) raw.memo = txn.moreInfo;
  return raw;
}

async function fetchTransactionsForMonth(
  jar: CookieJar,
  month: number,
  year: number,
): Promise<{ transactions: IsracardTxn[]; processedDate: string }> {
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const url = new URL(SERVICES_URL);
  url.searchParams.set("reqName", "CardsTransactionsList");
  url.searchParams.set("month", monthStr);
  url.searchParams.set("year", `${year}`);
  url.searchParams.set("requiredDate", "N");

  const result = (await apiGet(jar, url.toString())) as Record<string, unknown>;
  if (!result) return { transactions: [], processedDate: "" };

  const bean = result["CardsTransactionsListBean"] as Record<string, unknown> | undefined;
  if (!bean) return { transactions: [], processedDate: "" };

  // Find card data — keys are like "Index0", "Index1", etc.
  const allTxns: IsracardTxn[] = [];
  let processedDate = new Date().toISOString();

  for (const key of Object.keys(bean)) {
    if (!key.startsWith("Index")) continue;
    const cardData = bean[key] as { CurrentCardTransactions?: Array<{ txnIsrael?: IsracardTxn[]; txnAbroad?: IsracardTxn[] }> } | undefined;
    if (!cardData?.CurrentCardTransactions) continue;

    for (const group of cardData.CurrentCardTransactions) {
      if (group.txnIsrael) allTxns.push(...group.txnIsrael);
      if (group.txnAbroad) allTxns.push(...group.txnAbroad);
    }
  }

  return { transactions: allTxns, processedDate };
}

// ---------- Main scrape function ----------

/** Scrape Isracard credit card via direct HTTP (no browser needed). */
export async function scrapeIsracard(
  credentials: IsracardCredentials,
  startDate?: Date,
): Promise<ScrapeResult> {
  try {
    const jar = new CookieJar();

    await login(jar, credentials);

    // Determine months to scrape
    const start = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const months: Array<{ month: number; year: number }> = [];

    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= now) {
      months.push({ month: cursor.getMonth() + 1, year: cursor.getFullYear() });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const allTransactions: RawTransaction[] = [];

    for (const { month, year } of months) {
      const { transactions: txns, processedDate } = await fetchTransactionsForMonth(jar, month, year);

      for (const txn of txns) {
        const converted = convertTransaction(txn, processedDate);
        if (converted && new Date(converted.date) >= start) {
          allTransactions.push(converted);
        }
      }

      // Rate limiting: 1s between months
      if (months.length > 1) await sleep(1000);
    }

    return { success: true, transactions: allTransactions };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Isracard error";
    return { success: false, transactions: [], error: message };
  }
}
