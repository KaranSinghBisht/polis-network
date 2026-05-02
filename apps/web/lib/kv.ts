/**
 * Upstash Redis client + typed accessors for the Polis identity layer.
 *
 * Storage layout
 *  user:<emailLower>          → PolisUser JSON
 *  handle:<handleLower>       → emailLower (reverse lookup, lowercase)
 *  agent:<peer>               → AgentClaim JSON
 *  magic:<token>              → emailLower (15-min TTL)
 *  code:<emailLower>          → 8-char claim token (no TTL)
 *  email-by-code:<code>       → emailLower (reverse, no TTL)
 *
 * Lowercase normalisation everywhere so claims/lookups stay stable across
 * casing variants the user might type.
 */

import { Redis } from "@upstash/redis";
import type { AgentClaim, PolisUser } from "./types";

const MAGIC_TTL_SECONDS = 15 * 60;

let cached: Redis | null = null;

function client(): Redis {
  if (cached) return cached;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN (provision Upstash via Vercel Marketplace).",
    );
  }
  cached = new Redis({ url, token });
  return cached;
}

export function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

const norm = (value: string) => value.trim().toLowerCase();

// ---------- User ----------

export async function getUserByEmail(email: string): Promise<PolisUser | null> {
  const redis = client();
  const v = await redis.get<PolisUser>(`user:${norm(email)}`);
  return v ?? null;
}

export async function setUser(user: PolisUser): Promise<void> {
  const redis = client();
  const emailKey = norm(user.email);
  await redis.set(`user:${emailKey}`, user);
  await redis.set(`handle:${norm(user.handle)}`, emailKey);
}

export async function getEmailByHandle(handle: string): Promise<string | null> {
  const redis = client();
  return (await redis.get<string>(`handle:${norm(handle)}`)) ?? null;
}

// ---------- Magic links ----------

export async function setMagicToken(token: string, email: string): Promise<void> {
  const redis = client();
  await redis.set(`magic:${token}`, norm(email), { ex: MAGIC_TTL_SECONDS });
}

export async function consumeMagicToken(token: string): Promise<string | null> {
  const redis = client();
  const email = await redis.get<string>(`magic:${token}`);
  if (!email) return null;
  await redis.del(`magic:${token}`);
  return email;
}

// ---------- Claim codes ----------

export async function setClaimCode(email: string, code: string): Promise<void> {
  const redis = client();
  const emailKey = norm(email);
  // Clear any prior code → email reverse-lookup before re-pointing.
  const prior = await redis.get<string>(`code:${emailKey}`);
  if (prior && typeof prior === "string") {
    await redis.del(`email-by-code:${prior}`);
  }
  await redis.set(`code:${emailKey}`, code);
  await redis.set(`email-by-code:${code}`, emailKey);
}

export async function getClaimCode(email: string): Promise<string | null> {
  const redis = client();
  return (await redis.get<string>(`code:${norm(email)}`)) ?? null;
}

export async function getEmailByClaimCode(code: string): Promise<string | null> {
  const redis = client();
  return (await redis.get<string>(`email-by-code:${code}`)) ?? null;
}

// ---------- Agent claims ----------

export async function setAgentClaim(claim: AgentClaim): Promise<void> {
  const redis = client();
  await redis.set(`agent:${claim.peer}`, claim);
  // Also push the peer onto the owner's agents[] list.
  const user = await getUserByEmail(claim.ownerEmail);
  if (user) {
    const agents = Array.from(new Set([...user.agents, claim.peer]));
    await setUser({ ...user, agents });
  }
}

export async function getAgentClaim(peer: string): Promise<AgentClaim | null> {
  const redis = client();
  return (await redis.get<AgentClaim>(`agent:${peer}`)) ?? null;
}
