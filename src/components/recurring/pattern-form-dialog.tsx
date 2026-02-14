"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";

const FREQUENCY_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "bi_weekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "bi_monthly", label: "Bi-monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "semi_annual", label: "Semi-annual" },
  { value: "yearly", label: "Yearly" },
] as const;

interface CategoryOption {
  id: string;
  name: string;
  icon: string | null;
  parentId: string | null;
}

interface AccountOption {
  id: string;
  name: string;
  accountType: string;
}

interface PatternData {
  id: string;
  description: string;
  expectedAmount: string;
  frequency: string;
  categoryId: string | null;
  accountId: string | null;
  nextExpectedDate: Date | null;
}

export function PatternFormDialog({
  mode,
  pattern,
  categories,
  accounts,
}: {
  mode: "create" | "edit";
  pattern?: PatternData;
  categories: CategoryOption[];
  accounts: AccountOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const [description, setDescription] = useState(pattern?.description ?? "");
  const [amount, setAmount] = useState(pattern?.expectedAmount ?? "");
  const [frequency, setFrequency] = useState(pattern?.frequency ?? "monthly");
  const [categoryId, setCategoryId] = useState(pattern?.categoryId ?? "");
  const [accountId, setAccountId] = useState(pattern?.accountId ?? "");
  const [nextDate, setNextDate] = useState(
    pattern?.nextExpectedDate
      ? new Date(pattern.nextExpectedDate).toISOString().slice(0, 10)
      : "",
  );

  function resetForm() {
    if (mode === "create") {
      setDescription("");
      setAmount("");
      setFrequency("monthly");
      setCategoryId("");
      setAccountId("");
      setNextDate("");
    }
  }

  // Group categories by parent
  const parentCategories = categories.filter((c) => !c.parentId);
  const childCategories = categories.filter((c) => c.parentId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim() || !amount || !frequency) return;

    setPending(true);
    try {
      const payload: Record<string, unknown> = {
        description: description.trim(),
        expectedAmount: Number(amount),
        frequency,
      };
      if (categoryId) payload.categoryId = categoryId;
      else payload.categoryId = null;
      if (accountId) payload.accountId = accountId;
      else payload.accountId = null;
      if (nextDate) payload.nextExpectedDate = nextDate;
      else payload.nextExpectedDate = null;

      const url =
        mode === "create"
          ? "/api/recurring"
          : `/api/recurring/${pattern!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error);
      }

      toast.success(
        mode === "create" ? "Pattern created" : "Pattern updated",
      );
      resetForm();
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button variant="outline" size="sm">
            <PlusIcon /> Add
          </Button>
        ) : (
          <Button variant="ghost" size="icon-xs" title="Edit pattern">
            <PencilIcon />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Recurring Pattern" : "Edit Pattern"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Salary, Netflix, Rent"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {parentCategories.map((parent) => {
                    const children = childCategories.filter(
                      (c) => c.parentId === parent.id,
                    );
                    if (children.length === 0) {
                      return (
                        <SelectItem key={parent.id} value={parent.id}>
                          {parent.icon} {parent.name}
                        </SelectItem>
                      );
                    }
                    return (
                      <SelectGroup key={parent.id}>
                        <SelectLabel>
                          {parent.icon} {parent.name}
                        </SelectLabel>
                        {children.map((child) => (
                          <SelectItem key={child.id} value={child.id}>
                            {child.icon} {child.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nextDate">Next Expected Date</Label>
            <Input
              id="nextDate"
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving..."
                : mode === "create"
                  ? "Create"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
