/**
 * SIWE wallet auth + JWT session helpers.
 *
 * - Login flow: POST /api/auth/nonce returns a random nonce; the browser signs
 *   `loginMessage({ wallet, nonce, timestamp })` via personal_sign and POSTs
 *   the signature to /api/auth/verify, which validates and sets the session
 *   cookie.
 * - The session cookie is an HS256 JWT (jose) with `{ wallet, iat, exp }`,
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

export function generateLoginNonce(): string {
  return randomBytes(16).toString("hex");
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

export async function createSessionToken(wallet: `0x${string}`): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ wallet: wallet.toLowerCase() })
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
    if (
      typeof payload.wallet !== "string" ||
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      !/^0x[0-9a-f]{40}$/.test(payload.wallet)
    ) {
      return null;
    }
    return {
      wallet: payload.wallet as `0x${string}`,
      iat: payload.iat,
      exp: payload.exp,
    };
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
 * Login message signed by the wallet. Human-readable so users can verify what
 * they're authorizing in their wallet UI.
 */
export function loginMessage({
  wallet,
  nonce,
  timestamp,
}: {
  wallet: `0x${string}`;
  nonce: string;
  timestamp: number;
}): string {
  return [
    "polis:login:v1",
    `wallet=${wallet.toLowerCase()}`,
    `nonce=${nonce}`,
    `ts=${timestamp}`,
  ].join("\n");
}

export const LOGIN_FRESHNESS_SECONDS = 5 * 60;

/**
 * Construct the signed-message body the CLI must sign to claim an agent.
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
