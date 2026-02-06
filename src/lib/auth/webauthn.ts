import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticatorTransportFuture,
  Base64URLString,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { challenges, webauthnCredentials } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

// ─── RP config from env ─────────────────────────────────

function getRpConfig() {
  const rpID = process.env["WEBAUTHN_RP_ID"];
  const rpName = process.env["WEBAUTHN_RP_NAME"];
  const origin = process.env["WEBAUTHN_ORIGIN"];
  if (!rpID || !rpName || !origin) {
    throw new Error("Missing WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME, or WEBAUTHN_ORIGIN env vars");
  }
  return { rpID, rpName, origin };
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Registration ───────────────────────────────────────

export async function getRegistrationOptions(
  displayName: string,
  existingCredentialIds: Base64URLString[],
): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; challengeId: string }> {
  const { rpID, rpName } = getRpConfig();

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: displayName,
    userDisplayName: displayName,
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
    excludeCredentials: existingCredentialIds.map((id) => ({ id })),
  });

  // Store challenge in DB
  const [row] = await db
    .insert(challenges)
    .values({
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    })
    .returning({ id: challenges.id });

  if (!row) throw new Error("Failed to store challenge");

  return { options, challengeId: row.id };
}

export async function verifyRegistration(
  response: RegistrationResponseJSON,
  challengeId: string,
): Promise<{
  credentialId: Base64URLString;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}> {
  const { rpID, origin } = getRpConfig();

  // Look up challenge
  const [row] = await db
    .select()
    .from(challenges)
    .where(
      and(
        eq(challenges.id, challengeId),
        gt(challenges.expiresAt, new Date()),
      ),
    );

  if (!row) throw new Error("Challenge not found or expired");

  // Delete challenge (one-time use)
  await db.delete(challenges).where(eq(challenges.id, challengeId));

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: row.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration verification failed");
  }

  const { credential } = verification.registrationInfo;

  return {
    credentialId: credential.id,
    publicKey: credential.publicKey as Uint8Array,
    counter: credential.counter,
    ...(credential.transports && { transports: credential.transports }),
  };
}

// ─── Authentication ─────────────────────────────────────

export async function getAuthenticationOptions(): Promise<{
  options: PublicKeyCredentialRequestOptionsJSON;
  challengeId: string;
}> {
  const { rpID } = getRpConfig();

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    // Empty allowCredentials = discoverable credentials (passkey auto-fill)
  });

  const [row] = await db
    .insert(challenges)
    .values({
      challenge: options.challenge,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    })
    .returning({ id: challenges.id });

  if (!row) throw new Error("Failed to store challenge");

  return { options, challengeId: row.id };
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  challengeId: string,
): Promise<{ userId: string }> {
  const { rpID, origin } = getRpConfig();

  // Look up challenge
  const [challengeRow] = await db
    .select()
    .from(challenges)
    .where(
      and(
        eq(challenges.id, challengeId),
        gt(challenges.expiresAt, new Date()),
      ),
    );

  if (!challengeRow) throw new Error("Challenge not found or expired");

  // Delete challenge (one-time use)
  await db.delete(challenges).where(eq(challenges.id, challengeId));

  // Look up credential by response.id
  const [credRow] = await db
    .select()
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.id, response.id));

  if (!credRow) throw new Error("Credential not found");

  // Decode stored publicKey from base64
  const publicKey = Buffer.from(credRow.publicKey, "base64");

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeRow.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: credRow.id,
      publicKey,
      counter: credRow.counter,
      ...(credRow.transports && {
        transports: credRow.transports as AuthenticatorTransportFuture[],
      }),
    },
  });

  if (!verification.verified) {
    throw new Error("Authentication verification failed");
  }

  // Update counter for clone detection
  await db
    .update(webauthnCredentials)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(webauthnCredentials.id, credRow.id));

  return { userId: credRow.userId };
}
