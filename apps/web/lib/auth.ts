/**
 * Magic-link auth + JWT session helpers.
 *
 * - Magic-link tokens are random 32-byte url-safe strings stored in KV with
 *   a 15-minute TTL. Hitting `/auth/callback?token=…` consumes the token,
 *   resolves to an email, and sets a signed session cookie.
 * - The session cookie is an HS256 JWT (jose) with `{ email, iat, exp }`,
 *   signed by POLIS_AUTH_SECRET. Cookie is httpOnly + secure + sameSite=lax.
 */

import { randomBytes, randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { SessionPayload } from "./types";

export const SESSION_COOKIE = "polis_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secretKey(): Uint8Array {
  const raw = process.env.POLIS_AUTH_SECRET;
  if (!raw) throw new Error("POLIS_AUTH_SECRET not configured");
  return new TextEncoder().encode(raw);
}

export function generateMagicToken(): string {
  return randomBytes(32).toString("base64url");
}

export function generateClaimCode(): string {
  // 8-char base32-ish handle: easy to copy/type, avoid confusables.
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(8);
  let out = "";
  for (const byte of buf) out += chars[byte % chars.length];
  return out;
}

export function generateRequestId(): string {
  return randomUUID();
}

export async function createSessionToken(email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + SESSION_TTL_SECONDS)
    .setIssuer("polis-web")
    .setAudience("polis-web")
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: "polis-web",
      audience: "polis-web",
    });
    if (typeof payload.email !== "string" || typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      return null;
    }
    return { email: payload.email, iat: payload.iat, exp: payload.exp };
  } catch {
    return null;
  }
}

export function sessionCookieAttributes(maxAgeSeconds: number): string {
  const parts = [
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Max-Age=${Math.max(0, maxAgeSeconds)}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function sessionMaxAge(): number {
  return SESSION_TTL_SECONDS;
}

/**
 * Construct the signed-message body the CLI must sign to claim an agent.
 * Format intentionally human-readable so an operator can verify what's
 * being signed before approving. Email is intentionally NOT in the message:
 * the server resolves it from the claim code, which is the single source of
 * truth for the (code → email) mapping.
 */
export function claimMessage({
  peer,
  code,
  timestamp,
}: {
  peer: string;
  code: string;
  timestamp: number;
}): string {
  return [
    "polis:claim:v1",
    `peer=${peer.toLowerCase()}`,
    `code=${code.toUpperCase()}`,
    `ts=${timestamp}`,
  ].join("\n");
}

export const CLAIM_FRESHNESS_SECONDS = 5 * 60;
