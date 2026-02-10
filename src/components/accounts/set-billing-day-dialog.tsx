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

type SetBillingDayDialogProps = {
  accountId: string;
  accountName: string;
  currentBillingDay: number | null;
};

export const SetBillingDayDialog = ({
  accountId,
  accountName,
  currentBillingDay,
}: SetBillingDayDialogProps) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(currentBillingDay?.toString() ?? "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const value = Number(day);
    if (!Number.isInteger(value) || value < 1 || value > 31) {
      toast.error("Please enter a day between 1 and 31");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingDay: value }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to set billing day");
      }

      toast.success("Billing day updated");
      setOpen(false);
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to set billing day";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-10 sm:h-8">
          {currentBillingDay ? `Billing: ${currentBillingDay}` : "Set Billing Day"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Billing Day — {accountName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="billingDay">
              Day of month the CC bills your bank
            </Label>
            <Input
              id="billingDay"
              type="number"
              min={1}
              max={31}
              step={1}
              placeholder="e.g. 2"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Enter the day of the month when this credit card charges your bank
              account. Check your bank statement for the recurring CC debit date.
            </p>
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
