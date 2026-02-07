import { NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { financialAccounts, transactions, syncLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateWebhookKey } from "@/lib/webhook/auth";
import { encrypt } from "@/lib/crypto/encryption";
import { classifyTransactions } from "@/lib/classification/classify";

interface TransactionPayload {
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

interface WebhookBody {
  accountId: string;
  scrapeDate: string;
  transactions: TransactionPayload[];
}

export async function POST(request: Request) {
  const startedAt = new Date();
  let accountId: string | undefined;

  try {
    if (!validateWebhookKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as WebhookBody;
    accountId = body.accountId;

    if (!body.accountId || !body.transactions || !Array.isArray(body.transactions)) {
      return NextResponse.json(
        { error: "accountId and transactions array are required" },
        { status: 400 },
      );
    }

    // Verify account exists and is active
    const [account] = await db
      .select({
        id: financialAccounts.id,
        householdId: financialAccounts.householdId,
        isActive: financialAccounts.isActive,
      })
      .from(financialAccounts)
      .where(eq(financialAccounts.id, body.accountId));

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!account.isActive) {
      return NextResponse.json(
        { error: "Account is inactive" },
        { status: 400 },
      );
    }

    let added = 0;
    let duplicates = 0;
    const newlyInserted: {
      id: string;
      description: string;
      amount: string;
      transactionType: "income" | "expense";
    }[] = [];

    for (const tx of body.transactions) {
      try {
        const encryptedPayload = encrypt(JSON.stringify(tx));

        const result = await db
          .insert(transactions)
          .values({
            householdId: account.householdId,
            accountId: body.accountId,
            externalId: tx.externalId,
            date: new Date(tx.date),
            processedDate: tx.processedDate
              ? new Date(tx.processedDate)
              : null,
            description: tx.description,
            originalDescription: tx.originalDescription ?? null,
            amount: tx.amount.toString(),
            currency: tx.currency ?? "ILS",
            transactionType: tx.type,
            encryptedRawPayload: encryptedPayload,
            memo: tx.memo ?? null,
          })
          .onConflictDoNothing({
            target: [transactions.accountId, transactions.externalId],
          })
          .returning({ id: transactions.id });

        if (result.length > 0) {
          added++;
          const inserted = result[0];
          if (inserted) {
            newlyInserted.push({
              id: inserted.id,
              description: tx.description,
              amount: tx.amount.toString(),
              transactionType: tx.type,
            });
          }
        } else {
          duplicates++;
        }
      } catch (txError) {
        console.error("Transaction insert error:", txError);
        duplicates++;
      }
    }

    // Update account lastSyncedAt
    await db
      .update(financialAccounts)
      .set({ lastSyncedAt: new Date(body.scrapeDate) })
      .where(eq(financialAccounts.id, body.accountId));

    // Create sync log
    await db.insert(syncLogs).values({
      accountId: body.accountId,
      status: "success",
      transactionsAdded: added,
      transactionsDuplicate: duplicates,
      startedAt,
      completedAt: new Date(),
    });

    // Classify newly inserted transactions after response is sent
    if (newlyInserted.length > 0) {
      after(async () => {
        try {
          await classifyTransactions(account.householdId, newlyInserted);
        } catch (error) {
          console.error("Post-response classification failed:", error);
        }
      });
    }

    return NextResponse.json({ added, duplicates });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Webhook processing failed";
    console.error("POST /api/webhook/transactions error:", error);

    // Try to log the error in sync_logs
    if (accountId) {
      try {
        await db.insert(syncLogs).values({
          accountId,
          status: "error",
          transactionsAdded: 0,
          transactionsDuplicate: 0,
          errorMessage: message,
          startedAt,
          completedAt: new Date(),
        });
      } catch {
        // Ignore logging errors
      }
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
