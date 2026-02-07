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

type Step = "details" | "otp_phone" | "otp_code";

export function AddAccountDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("details");
  const [institution, setInstitution] = useState<InstitutionKey | "">("");
  const [accountType, setAccountType] = useState<"bank" | "credit_card">(
    "bank",
  );
  const [name, setName] = useState("");
  const [lastFourDigits, setLastFourDigits] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // OTP state
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("+972");
  const [otpCode, setOtpCode] = useState("");

  function handleCredentialChange(key: string, value: string) {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setName("");
    setInstitution("");
    setAccountType("bank");
    setLastFourDigits("");
    setCredentials({});
    setStep("details");
    setCreatedAccountId(null);
    setPhoneNumber("+972");
    setOtpCode("");
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

      const data = (await response.json()) as { account: { id: string } };

      // Check if this institution needs OTP setup
      const inst = institution !== "" ? INSTITUTIONS[institution] : null;
      if (inst?.requiresOtp) {
        setCreatedAccountId(data.account.id);
        setStep("otp_phone");
        toast.success("Account created. Now set up OTP verification.");
      } else {
        toast.success("Account added successfully");
        setOpen(false);
        resetForm();
        router.refresh();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add account";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!createdAccountId) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/accounts/${createdAccountId}/otp/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to send OTP");
      }

      toast.success("OTP code sent to your phone");
      setStep("otp_code");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send OTP";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!createdAccountId) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/accounts/${createdAccountId}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpCode }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "OTP verification failed");
      }

      toast.success("Account verified and ready for syncing");
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "OTP verification failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const credentialFields =
    institution !== "" ? INSTITUTIONS[institution].credentials : [];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>Add Account</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "details" && "Add Financial Account"}
            {step === "otp_phone" && "Verify Phone Number"}
            {step === "otp_code" && "Enter OTP Code"}
          </DialogTitle>
        </DialogHeader>

        {step === "details" && (
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
                  Credentials (needed for auto-sync)
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
        )}

        {step === "otp_phone" && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              ONE Zero requires phone verification. Enter your phone number to receive an SMS code.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+972501234567"
                required
              />
              <p className="text-xs text-muted-foreground">
                Must include country code (e.g. +972)
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                Skip for now
              </Button>
              <Button type="submit" disabled={isSubmitting || !phoneNumber}>
                {isSubmitting ? "Sending..." : "Send OTP Code"}
              </Button>
            </div>
          </form>
        )}

        {step === "otp_code" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the verification code sent to {phoneNumber}.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="otpCode">OTP Code</Label>
              <Input
                id="otpCode"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
                autoFocus
                required
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("otp_phone")}
              >
                Resend
              </Button>
              <Button type="submit" disabled={isSubmitting || !otpCode}>
                {isSubmitting ? "Verifying..." : "Verify"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
