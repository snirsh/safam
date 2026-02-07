"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  INSTITUTIONS,
  CREDENTIAL_LABELS,
  type InstitutionKey,
} from "@/lib/constants/institutions";
import { toast } from "sonner";

export function AddAccountDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [institution, setInstitution] = useState<InstitutionKey | "">("");
  const [accountType, setAccountType] = useState<"bank" | "credit_card">(
    "bank",
  );
  const [name, setName] = useState("");
  const [lastFourDigits, setLastFourDigits] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleCredentialChange(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setName("");
    setInstitution("");
    setAccountType("bank");
    setLastFourDigits("");
    setCredentials({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        name,
        institution,
        accountType,
      };
      if (lastFourDigits) body["lastFourDigits"] = lastFourDigits;
      if (Object.keys(credentials).length > 0) body["credentials"] = credentials;

      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create account");
      }

      toast.success("Account added successfully");
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add account";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const credentialFields =
    institution !== "" ? INSTITUTIONS[institution].credentials : [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Account</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Financial Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="institution">Institution</Label>
            <Select
              value={institution}
              onValueChange={(v) => {
                setInstitution(v as InstitutionKey);
                setCredentials({});
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select institution" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INSTITUTIONS).map(([key, inst]) => (
                  <SelectItem key={key} value={key}>
                    {inst.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Account Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Checking Account"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accountType">Account Type</Label>
            <Select
              value={accountType}
              onValueChange={(v) =>
                setAccountType(v as "bank" | "credit_card")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank Account</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lastFour">Last 4 Digits</Label>
            <Input
              id="lastFour"
              value={lastFourDigits}
              onChange={(e) => setLastFourDigits(e.target.value.slice(0, 4))}
              placeholder="1234"
              maxLength={4}
              inputMode="numeric"
              pattern="[0-9]*"
            />
          </div>

          {credentialFields.length > 0 && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                Credentials (optional — needed for auto-sync)
              </p>
              {credentialFields.map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label htmlFor={`cred-${field}`}>
                    {CREDENTIAL_LABELS[field] ?? field}
                  </Label>
                  <Input
                    id={`cred-${field}`}
                    type={field.toLowerCase().includes("password") ? "password" : "text"}
                    value={credentials[field] ?? ""}
                    onChange={(e) =>
                      handleCredentialChange(field, e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name || institution === ""}
            >
              {isSubmitting ? "Adding..." : "Add Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
