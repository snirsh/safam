import { db } from "@/lib/db";
import { financialAccounts, syncLogs } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { eq, sql } from "drizzle-orm";
import { INSTITUTIONS, type InstitutionKey } from "@/lib/constants/institutions";
import { AddAccountDialog } from "@/components/accounts/add-account-dialog";
import { AccountToggle } from "@/components/accounts/account-toggle";
import { DeleteAccountButton } from "@/components/accounts/delete-account-button";
import { ReauthDialog } from "@/components/accounts/reauth-dialog";
import { SyncButton } from "@/components/accounts/sync-button";
import { AdjustBalanceDialog } from "@/components/accounts/adjust-balance-dialog";
import { SetBillingDayDialog } from "@/components/accounts/set-billing-day-dialog";
import { calculateBankBalance } from "@/lib/balance/calculate";
import { formatILS } from "@/lib/format";

export default async function AccountsPage() {
  const session = await requireAuth();

  const accounts = await db
    .select({
      id: financialAccounts.id,
      name: financialAccounts.name,
      institution: financialAccounts.institution,
      accountType: financialAccounts.accountType,
      lastFourDigits: financialAccounts.lastFourDigits,
      isActive: financialAccounts.isActive,
      lastSyncedAt: financialAccounts.lastSyncedAt,
      billingDay: financialAccounts.billingDay,
      hasCredentials: sql<boolean>`${financialAccounts.encryptedCredentials} IS NOT NULL`,
    })
    .from(financialAccounts)
    .where(eq(financialAccounts.householdId, session.householdId))
    .orderBy(financialAccounts.name);

  const latestSyncs = await db
    .select({
      accountId: syncLogs.accountId,
      status: syncLogs.status,
      errorMessage: syncLogs.errorMessage,
      transactionsAdded: syncLogs.transactionsAdded,
      completedAt: syncLogs.completedAt,
    })
    .from(syncLogs)
    .where(
      sql`${syncLogs.id} IN (
        SELECT DISTINCT ON (account_id) id
        FROM sync_logs
        ORDER BY account_id, completed_at DESC
      )`,
    );

  const syncMap = new Map(latestSyncs.map((s) => [s.accountId, s]));

  // Get bank balances
  const { accounts: bankBalances } = await calculateBankBalance(
    session.householdId,
  );
  const balanceMap = new Map(
    bankBalances.map((b) => [b.accountId, b.balance]),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xl font-bold text-foreground">
          Accounts
        </h1>
        <AddAccountDialog />
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No accounts connected. Add a bank or credit card to start syncing.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {accounts.map((acct) => {
            const label =
              INSTITUTIONS[acct.institution as InstitutionKey]?.label ??
              acct.institution;
            const sync = syncMap.get(acct.id);
            const needsReauth =
              acct.institution === "one_zero" &&
              sync?.status === "error" &&
              /token|otp/i.test(sync.errorMessage ?? "");
            const bankBalance = balanceMap.get(acct.id);
            return (
              <div
                key={acct.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-foreground">{acct.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {label}
                      {acct.lastFourDigits
                        ? ` ••••${acct.lastFourDigits}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full ${acct.isActive ? "bg-green-500" : "bg-red-500"}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {acct.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-4 border-t border-border pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="text-sm text-foreground">
                      {acct.accountType === "bank"
                        ? "Bank Account"
                        : "Credit Card"}
                    </p>
                  </div>
                  {bankBalance !== undefined ? (
                    <div>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p
                        className={`font-mono text-sm font-medium ${bankBalance >= 0 ? "text-green-500" : "text-red-500"}`}
                      >
                        {formatILS(bankBalance)}
                      </p>
                    </div>
                  ) : null}
                  <div className="ml-auto text-right">
                    <p className="text-xs text-muted-foreground">Last sync</p>
                    <p className="font-mono text-sm text-foreground">
                      {sync?.completedAt
                        ? new Date(sync.completedAt).toLocaleDateString(
                            "he-IL",
                          )
                        : "Never"}
                    </p>
                    {sync?.status === "error" && sync.errorMessage ? (
                      <p className="max-w-[200px] truncate text-xs text-destructive" title={sync.errorMessage}>
                        Sync failed
                      </p>
                    ) : sync ? (
                      <p className="text-xs text-muted-foreground">
                        +{sync.transactionsAdded} txns
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <AccountToggle
                    accountId={acct.id}
                    isActive={acct.isActive}
                  />
                  {needsReauth && (
                    <ReauthDialog accountId={acct.id} accountName={acct.name} />
                  )}
                  <SyncButton
                    accountId={acct.id}
                    disabled={!acct.hasCredentials || !acct.isActive}
                  />
                  {acct.accountType === "bank" && (
                    <AdjustBalanceDialog
                      accountId={acct.id}
                      accountName={acct.name}
                    />
                  )}
                  {acct.accountType === "credit_card" && (
                    <SetBillingDayDialog
                      accountId={acct.id}
                      accountName={acct.name}
                      currentBillingDay={acct.billingDay}
                    />
                  )}
                  <DeleteAccountButton accountId={acct.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
