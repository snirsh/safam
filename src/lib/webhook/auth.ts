import { timingSafeEqual } from "node:crypto";

/** Validate Bearer token from Authorization header against WEBHOOK_API_KEY. */
export function validateWebhookKey(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }

  const providedKey = authHeader.slice(7);
  const expectedKey = process.env["WEBHOOK_API_KEY"];

  if (!expectedKey) {
    throw new Error("Missing WEBHOOK_API_KEY env var");
  }

  // Constant-time comparison to prevent timing attacks
  if (providedKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(
    Buffer.from(providedKey, "utf8"),
    Buffer.from(expectedKey, "utf8"),
  );
}
