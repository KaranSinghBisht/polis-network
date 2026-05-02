/**
 * Aggregates a per-peer leaderboard from local archived signals + digests.
 *
 * Score formula (transparent, copy-pasteable):
 *   score = signalCount * 5 + briefInclusions * 20
 *
 * The numbers behind it:
 *   - signalCount: how many archived TownMessages this peer has filed
 *   - briefInclusions: how many compiled digests credit this peer in
 *     economics.contributorShares
 *   - beats: distinct beat values across this peer's signals
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getAgentClaim, getUserByWallet, isKvConfigured } from "@/lib/kv";
import { loadArchivedSignals } from "@/lib/signals";

export const SCORE_FORMULA = "signals × 5 + brief inclusions × 20";

export interface Correspondent {
  rank: number;
  peer: string;
  handle?: string;
  wallet?: `0x${string}`;
  walletShort?: string;
  beats: string[];
  signalCount: number;
  briefInclusions: number;
  score: number;
  latestSignalTs?: number;
}

interface PerPeerAgg {
  peer: string;
  signalCount: number;
  beats: Set<string>;
  briefInclusions: number;
  latestSignalTs: number;
}

interface CompiledDigestSummary {
  contributorShares: Array<{ from: string; signalCount: number; shareBps: number }>;
}

export function digestDir(): string {
  return process.env.POLIS_DIGEST_DIR ?? join(homedir(), ".polis", "digests");
}

/** Build the leaderboard. Resolves handles via KV when configured. */
export async function buildCorrespondents(opts: { limit?: number } = {}): Promise<Correspondent[]> {
  const signals = loadArchivedSignals({ limit: 5_000 });
  const digests = loadDigestSummaries();

  const aggMap = new Map<string, PerPeerAgg>();
  for (const s of signals) {
    const agg = aggMap.get(s.from) ?? {
      peer: s.from,
      signalCount: 0,
      beats: new Set<string>(),
      briefInclusions: 0,
      latestSignalTs: 0,
    };
    agg.signalCount += 1;
    if (s.beat) agg.beats.add(s.beat);
    if (s.ts > agg.latestSignalTs) agg.latestSignalTs = s.ts;
    aggMap.set(s.from, agg);
  }

  for (const digest of digests) {
    for (const share of digest.contributorShares) {
      const agg = aggMap.get(share.from) ?? {
        peer: share.from,
        signalCount: 0,
        beats: new Set<string>(),
        briefInclusions: 0,
        latestSignalTs: 0,
      };
      agg.briefInclusions += 1;
      aggMap.set(share.from, agg);
    }
  }

  const ranked = Array.from(aggMap.values())
    .map((agg) => ({
      peer: agg.peer,
      signalCount: agg.signalCount,
      beats: Array.from(agg.beats).sort(),
      briefInclusions: agg.briefInclusions,
      score: agg.signalCount * 5 + agg.briefInclusions * 20,
      latestSignalTs: agg.latestSignalTs || undefined,
    }))
    .sort((a, b) => b.score - a.score || (b.latestSignalTs ?? 0) - (a.latestSignalTs ?? 0));

  const limited = typeof opts.limit === "number" ? ranked.slice(0, opts.limit) : ranked;

  if (!isKvConfigured()) {
    return limited.map((entry, i) => ({ rank: i + 1, ...entry }));
  }

  const enriched = await Promise.all(
    limited.map(async (entry, i) => {
      try {
        const claim = await getAgentClaim(entry.peer);
        if (!claim) return { rank: i + 1, ...entry };
        const wallet = claim.ownerWallet;
        const user = await getUserByWallet(wallet);
        return {
          rank: i + 1,
          ...entry,
          handle: user?.handle,
          wallet,
          walletShort: `${wallet.slice(0, 6)}…${wallet.slice(-4)}`,
        };
      } catch {
        return { rank: i + 1, ...entry };
      }
    }),
  );

  return enriched;
}

function loadDigestSummaries(): CompiledDigestSummary[] {
  const dir = digestDir();
  if (!existsSync(dir)) return [];
  const out: CompiledDigestSummary[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const parsed = JSON.parse(readFileSync(join(dir, name), "utf8")) as Record<string, unknown>;
      const economics = parsed.economics as Record<string, unknown> | undefined;
      if (!economics || typeof economics !== "object") continue;
      const shares = economics.contributorShares;
      if (!Array.isArray(shares)) continue;
      const validShares: CompiledDigestSummary["contributorShares"] = [];
      for (const raw of shares) {
        if (typeof raw !== "object" || raw === null) continue;
        const r = raw as Record<string, unknown>;
        if (typeof r.from !== "string") continue;
        validShares.push({
          from: r.from,
          signalCount: typeof r.signalCount === "number" ? r.signalCount : 0,
          shareBps: typeof r.shareBps === "number" ? r.shareBps : 0,
        });
      }
      out.push({ contributorShares: validShares });
    } catch {
      continue;
    }
  }
  return out;
}
