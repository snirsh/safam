"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function AdjustBalanceDialog({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const value = Number(balance);
    if (Number.isNaN(value)) {
      toast.error("Please enter a valid number");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentBalance: value }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to adjust balance");
      }

      toast.success("Balance adjusted");
      setOpen(false);
      setBalance("");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to adjust balance";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-10 sm:h-8">
          Adjust Balance
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Balance — {accountName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="balance">Current bank balance (ILS)</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              placeholder="e.g. 32500"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Enter the balance shown in your bank app right now.
              We&apos;ll calculate the starting balance from your transaction history.
            </p>
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
