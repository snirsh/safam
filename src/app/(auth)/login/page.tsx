"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MotionPage } from "@/components/motion";

type Status = "idle" | "loading" | "error";

export default function LoginPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleLogin() {
    setStatus("loading");
    setError("");

    try {
      // 1. Get authentication options
      const optionsRes = await fetch("/api/auth/login/options", {
        method: "POST",
      });

      if (!optionsRes.ok) {
        const data = (await optionsRes.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to get login options");
      }

      const { options, challengeId } = (await optionsRes.json()) as {
        options: {
          challenge: string;
          rpId?: string;
          timeout?: number;
          userVerification?: UserVerificationRequirement;
          allowCredentials?: { id: string; type: string; transports?: string[] }[];
        };
        challengeId: string;
      };

      // 2. Get credential via browser WebAuthn API
      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge: base64urlToBuffer(options.challenge),
      };

      if (options.rpId) publicKeyOptions.rpId = options.rpId;
      if (options.timeout !== undefined) publicKeyOptions.timeout = options.timeout;
      if (options.userVerification) {
        publicKeyOptions.userVerification = options.userVerification;
      }
      if (options.allowCredentials) {
        publicKeyOptions.allowCredentials = options.allowCredentials.map(
          (c) => {
            const desc: PublicKeyCredentialDescriptor = {
              id: base64urlToBuffer(c.id),
              type: "public-key",
            };
            if (c.transports) {
              desc.transports = c.transports as AuthenticatorTransport[];
            }
            return desc;
          },
        );
      }

      const credential = (await navigator.credentials.get({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential | null;

      if (!credential) throw new Error("Authentication cancelled");

      // 3. Encode response for server
      const assertionResponse =
        credential.response as AuthenticatorAssertionResponse;

      const authenticationResponse = {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64url(
            assertionResponse.clientDataJSON,
          ),
          authenticatorData: bufferToBase64url(
            assertionResponse.authenticatorData,
          ),
          signature: bufferToBase64url(assertionResponse.signature),
          userHandle: assertionResponse.userHandle
            ? bufferToBase64url(assertionResponse.userHandle)
            : undefined,
        },
        clientExtensionResults: credential.getClientExtensionResults(),
        authenticatorAttachment: credential.authenticatorAttachment,
      };

      // 4. Verify with server
      const verifyRes = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: authenticationResponse,
          challengeId,
        }),
      });

      if (!verifyRes.ok) {
        const data = (await verifyRes.json()) as { error?: string };
        throw new Error(data.error ?? "Login failed");
      }

      // 5. Success — redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Login failed",
      );
    }
  }

  return (
    <MotionPage className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-mono text-lg font-medium text-foreground">
        Welcome back
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Sign in with your passkey.
      </p>

      <div className="mt-6 space-y-4">
        {error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : null}

        <button
          type="button"
          onClick={handleLogin}
          disabled={status === "loading"}
          className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === "loading" ? "Verifying..." : "Login with Passkey"}
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        No account?{" "}
        <Link
          href="/register"
          className="text-foreground underline underline-offset-2"
        >
          Register
        </Link>
      </p>
    </MotionPage>
  );
}

// ─── Base64URL helpers ──────────────────────────────────

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
