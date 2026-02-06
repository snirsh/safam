"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Status = "idle" | "loading" | "error";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;

    setStatus("loading");
    setError("");

    try {
      // 1. Get registration options
      const optionsRes = await fetch("/api/auth/register/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });

      if (!optionsRes.ok) {
        const data = (await optionsRes.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to get registration options");
      }

      const { options, challengeId } = (await optionsRes.json()) as {
        options: {
          challenge: string;
          rp: { name: string; id?: string };
          user: { id: string; name: string; displayName: string };
          pubKeyCredParams: PublicKeyCredentialParameters[];
          timeout?: number;
          attestation?: AttestationConveyancePreference;
          authenticatorSelection?: AuthenticatorSelectionCriteria;
          excludeCredentials?: { id: string; type: string; transports?: string[] }[];
        };
        challengeId: string;
      };

      // 2. Create credential via browser WebAuthn API
      const publicKeyOptions: PublicKeyCredentialCreationOptions = {
        challenge: base64urlToBuffer(options.challenge),
        rp: options.rp,
        user: {
          ...options.user,
          id: base64urlToBuffer(options.user.id),
        },
        pubKeyCredParams: options.pubKeyCredParams,
      };

      if (options.timeout !== undefined) publicKeyOptions.timeout = options.timeout;
      if (options.attestation) publicKeyOptions.attestation = options.attestation;
      if (options.authenticatorSelection) {
        publicKeyOptions.authenticatorSelection = options.authenticatorSelection;
      }
      if (options.excludeCredentials) {
        publicKeyOptions.excludeCredentials = options.excludeCredentials.map(
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

      const credential = (await navigator.credentials.create({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential | null;

      if (!credential) throw new Error("Credential creation cancelled");

      // 3. Encode response for server
      const attestationResponse =
        credential.response as AuthenticatorAttestationResponse;

      const registrationResponse = {
        id: credential.id,
        rawId: bufferToBase64url(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64url(
            attestationResponse.clientDataJSON,
          ),
          attestationObject: bufferToBase64url(
            attestationResponse.attestationObject,
          ),
          transports: attestationResponse.getTransports?.() ?? [],
        },
        clientExtensionResults: credential.getClientExtensionResults(),
        authenticatorAttachment: credential.authenticatorAttachment,
      };

      // 4. Verify with server
      const verifyRes = await fetch("/api/auth/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          response: registrationResponse,
          challengeId,
          displayName: displayName.trim(),
        }),
      });

      if (!verifyRes.ok) {
        const data = (await verifyRes.json()) as { error?: string };
        throw new Error(data.error ?? "Registration failed");
      }

      // 5. Success — redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Registration failed",
      );
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="font-mono text-lg font-medium text-foreground">
        Create Account
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Register with a passkey — no password needed.
      </p>

      <form onSubmit={handleRegister} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="displayName"
            className="block text-xs font-medium text-muted-foreground"
          >
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            required
            maxLength={100}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
          />
        </div>

        {error ? (
          <p className="text-xs text-red-500">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={status === "loading" || !displayName.trim()}
          className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {status === "loading" ? "Creating passkey..." : "Register with Passkey"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Already registered?{" "}
        <Link
          href="/login"
          className="text-foreground underline underline-offset-2"
        >
          Login
        </Link>
      </p>
    </div>
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
