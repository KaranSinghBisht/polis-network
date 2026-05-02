/**
 * Upstash Redis client + typed accessors for the Polis identity layer.
 *
 * Storage layout (SIWE wallet-keyed)
 *  user:<walletLower>         → PolisUser JSON
 *  handle:<handleLower>       → walletLower (reverse lookup)
 *  agent:<peer>               → AgentClaim JSON
 *  nonce:<walletLower>        → random hex nonce (5-min TTL)
 *  code:<walletLower>         → 8-char claim token
 *  wallet-by-code:<code>      → walletLower (reverse, no TTL)
 *
 * Lowercase normalisation everywhere so claims/lookups stay stable.
 */

import { Redis } from "@upstash/redis";
import type { AgentClaim, PolisUser } from "./types";

const NONCE_TTL_SECONDS = 5 * 60;

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

export async function getUserByWallet(wallet: string): Promise<PolisUser | null> {
  const redis = client();
  const v = await redis.get<PolisUser>(`user:${norm(wallet)}`);
  return v ?? null;
}

export async function setUser(user: PolisUser): Promise<void> {
  const redis = client();
  const walletKey = norm(user.wallet);
  await redis.set(`user:${walletKey}`, user);
  await redis.set(`handle:${norm(user.handle)}`, walletKey);
}

export async function getWalletByHandle(handle: string): Promise<string | null> {
  const redis = client();
  return (await redis.get<string>(`handle:${norm(handle)}`)) ?? null;
}

// ---------- SIWE nonces ----------

export async function setLoginNonce(wallet: string, nonce: string): Promise<void> {
  const redis = client();
  await redis.set(`nonce:${norm(wallet)}`, nonce, { ex: NONCE_TTL_SECONDS });
}

export async function consumeLoginNonce(wallet: string): Promise<string | null> {
  const redis = client();
  const key = `nonce:${norm(wallet)}`;
  return (await redis.getdel<string>(key)) ?? null;
}

// ---------- Claim codes ----------

export async function setClaimCode(wallet: string, code: string): Promise<void> {
  const redis = client();
  const walletKey = norm(wallet);
  const codeKey = code.trim().toUpperCase();
  // Clear any prior code → wallet reverse-lookup before re-pointing.
  const prior = await redis.get<string>(`code:${walletKey}`);
  if (prior && typeof prior === "string") {
    await redis.del(`wallet-by-code:${prior.trim().toUpperCase()}`);
  }
  await redis.set(`code:${walletKey}`, codeKey);
  await redis.set(`wallet-by-code:${codeKey}`, walletKey);
}

export async function getClaimCode(wallet: string): Promise<string | null> {
  const redis = client();
  return (await redis.get<string>(`code:${norm(wallet)}`)) ?? null;
}

export async function getWalletByClaimCode(code: string): Promise<string | null> {
  const redis = client();
  return (await redis.get<string>(`wallet-by-code:${code.trim().toUpperCase()}`)) ?? null;
}

// ---------- Agent claims ----------

export async function setAgentClaim(claim: AgentClaim): Promise<void> {
  const redis = client();
  await redis.set(`agent:${claim.peer}`, claim);
  // Also push the peer onto the owner's agents[] list.
  const user = await getUserByWallet(claim.ownerWallet);
  if (user) {
    const agents = Array.from(new Set([...user.agents, claim.peer]));
    await setUser({ ...user, agents });
  }
}

export async function getAgentClaim(peer: string): Promise<AgentClaim | null> {
  const redis = client();
  return (await redis.get<AgentClaim>(`agent:${peer}`)) ?? null;
}
