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

type Step = "phone" | "code";

export function ReauthDialog({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("+972");
  const [otpCode, setOtpCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setStep("phone");
    setPhoneNumber("+972");
    setOtpCode("");
    setIsSubmitting(false);
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/accounts/${accountId}/otp/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to send OTP");
      }

      toast.success("OTP code sent");
      setStep("code");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send OTP";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/accounts/${accountId}/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpCode }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Verification failed");
      }

      toast.success("Re-authenticated successfully");
      setOpen(false);
      reset();
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verification failed";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Re-authenticate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Re-authenticate {accountName}</DialogTitle>
        </DialogHeader>

        {step === "phone" && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your ONE Zero token has expired. Enter your phone number to receive a new verification code.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="reauth-phone">Phone Number</Label>
              <Input
                id="reauth-phone"
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
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !phoneNumber}>
                {isSubmitting ? "Sending..." : "Send OTP Code"}
              </Button>
            </div>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the verification code sent to {phoneNumber}.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="reauth-otp">OTP Code</Label>
              <Input
                id="reauth-otp"
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
                onClick={() => setStep("phone")}
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
