import type { Browser, Page } from "rebrowser-playwright";
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

/** Random delay to simulate human-like timing. Based on israeli-bank-scrapers PR #1027. */
function randomDelay(minMs = 2500, maxMs = 3000): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/** Launch a browser appropriate for the current environment. */
async function launchBrowser(): Promise<Browser> {
  // rebrowser-playwright patches CDP Runtime.Enable detection
  const { chromium } = await import("rebrowser-playwright");

  // Local dev: use system Chrome/Chromium
  if (process.env.NODE_ENV === "development") {
    const localPath =
      process.env["CHROME_PATH"] ??
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    return chromium.launch({
      executablePath: localPath,
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    });
  }

  // Vercel serverless: use @sparticuz/chromium-min
  const chromiumMin = await import("@sparticuz/chromium-min");
  const executablePath = await chromiumMin.default.executablePath(
    "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar",
  );
  return chromium.launch({
    executablePath,
    args: [
      ...chromiumMin.default.args,
      "--disable-blink-features=AutomationControlled",
    ],
    headless: true,
  });
}

// ---------- In-page fetch helpers ----------

function parseResponse(raw: unknown): unknown {
  if (!raw) return null;
  const text = raw as string;
  try {
    return JSON.parse(text);
  } catch {
    // Check for bot detection response
    if (/block automation|bot detection/i.test(text)) {
      throw new Error("Isracard: automation detected and blocked");
    }
    throw new Error(`Isracard returned non-JSON response: ${text.slice(0, 200)}`);
  }
}

async function fetchPostInPage(page: Page, url: string, data: unknown): Promise<unknown> {
  const raw = await page.evaluate(
    async ([innerUrl, innerData]: [string, unknown]) => {
      const res = await fetch(innerUrl, {
        method: "POST",
        body: JSON.stringify(innerData),
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
      });
      if (res.status === 204) return null;
      return res.text();
    },
    [url, data] as [string, unknown],
  );
  return parseResponse(raw);
}

async function fetchGetInPage(page: Page, url: string): Promise<unknown> {
  const raw = await page.evaluate(async (innerUrl: string) => {
    const res = await fetch(innerUrl, { credentials: "include" });
    if (res.status === 204) return null;
    return res.text();
  }, url);
  return parseResponse(raw);
}

// ---------- Login ----------

interface ValidateResult {
  Header?: { Status: string };
  ValidateIdDataBean?: { returnCode: string; userName: string };
}

interface LoginResult {
  status?: string;
}

async function login(page: Page, credentials: IsracardCredentials): Promise<void> {
  // Block Isracard's bot detection script
  await page.route("**/detector-dom.min.js", (route) => route.abort());

  await page.goto(`${BASE_URL}/personalarea/Login`, {
    waitUntil: "networkidle",
    timeout: 30_000,
  });

  // Human-like delay before first API call (per israeli-bank-scrapers PR #1027)
  await randomDelay(2500, 3500);

  // Step 1: ValidateIdData
  const validateResult = (await fetchPostInPage(page, `${SERVICES_URL}?reqName=ValidateIdData`, {
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

  // Human-like delay between login steps
  await randomDelay(2500, 3000);

  // Step 2: performLogonI
  const loginResult = (await fetchPostInPage(page, `${SERVICES_URL}?reqName=performLogonI`, {
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
  page: Page,
  month: number,
  year: number,
): Promise<{ transactions: IsracardTxn[]; processedDate: string }> {
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const url = new URL(SERVICES_URL);
  url.searchParams.set("reqName", "CardsTransactionsList");
  url.searchParams.set("month", monthStr);
  url.searchParams.set("year", `${year}`);
  url.searchParams.set("requiredDate", "N");

  // Human-like delay before each month fetch
  await randomDelay(2500, 3000);

  const result = (await fetchGetInPage(page, url.toString())) as Record<string, unknown>;
  if (!result) return { transactions: [], processedDate: "" };

  const bean = result["CardsTransactionsListBean"] as Record<string, unknown> | undefined;
  if (!bean) return { transactions: [], processedDate: "" };

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

/** Scrape Isracard credit card transactions. */
export async function scrapeIsracard(
  credentials: IsracardCredentials,
  startDate?: Date,
): Promise<ScrapeResult> {
  let browser: Browser | undefined;

  try {
    browser = await launchBrowser();
    const context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      locale: "he-IL",
      timezoneId: "Asia/Jerusalem",
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    await login(page, credentials);

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
      const { transactions: txns, processedDate } = await fetchTransactionsForMonth(page, month, year);

      for (const txn of txns) {
        const converted = convertTransaction(txn, processedDate);
        if (converted && new Date(converted.date) >= start) {
          allTransactions.push(converted);
        }
      }
    }

    await browser.close();
    return { success: true, transactions: allTransactions };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Isracard error";
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
    return { success: false, transactions: [], error: message };
  }
}
