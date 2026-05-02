import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { DEMO_PEER, demoDigestSummary } from "@/lib/demo-snapshot";
import { canReadLocalFiles } from "@/lib/local-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DigestSummary {
  id: string;
  generatedAt: string;
  signalCount: number;
  splits: { contributors: number; reviewers: number; treasury: number; referrals: number };
  ours?: { signalCount: number; shareBps: number };
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const peerFilter = url.searchParams.get("peer") ?? undefined;

  if (!canReadLocalFiles(request)) {
    const digest = demoDigestSummary();
    const ours =
      peerFilter === DEMO_PEER
        ? {
            signalCount: digest.signalCount,
            shareBps: 7000,
          }
        : undefined;
    const digests: DigestSummary[] = [
      {
        id: digest.id,
        generatedAt: digest.generatedAt,
        signalCount: digest.signalCount,
        splits: { contributors: 7000, reviewers: 1500, treasury: 1000, referrals: 500 },
        ...(ours ? { ours } : {}),
      },
    ];
    return NextResponse.json({
      digests,
      total: digests.length,
      totalShareBps: ours ? ours.shareBps : 0,
      source: "demo-snapshot",
      digestDir: "public testnet proof snapshot",
    });
  }

  const dir = process.env.POLIS_DIGEST_DIR ?? join(homedir(), ".polis", "digests");
  if (!existsSync(dir)) {
    return NextResponse.json({ digests: [], source: "no-dir", digestDir: displayDir(dir) });
  }

  const digests: DigestSummary[] = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, name), "utf8"));
    } catch {
      continue;
    }
    const summary = toDigestSummary(parsed, peerFilter);
    if (summary) digests.push(summary);
  }

  digests.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));

  let totalShareBps = 0;
  for (const d of digests) {
    if (d.ours) totalShareBps += d.ours.shareBps;
  }

  return NextResponse.json({
    digests,
    total: digests.length,
    totalShareBps,
    source: "digests",
    digestDir: displayDir(dir),
  });
}

function toDigestSummary(value: unknown, peerFilter: string | undefined): DigestSummary | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") return null;
  if (typeof v.generatedAt !== "string") return null;
  if (typeof v.signalCount !== "number") return null;
  const economics = v.economics as Record<string, unknown> | undefined;
  if (!economics || typeof economics !== "object") return null;
  const splitBps = economics.splitBps as Record<string, unknown> | undefined;
  if (!splitBps || typeof splitBps !== "object") return null;
  const splits = {
    contributors: numberOr(splitBps.contributors, 7000),
    reviewers: numberOr(splitBps.reviewers, 1500),
    treasury: numberOr(splitBps.treasury, 1000),
    referrals: numberOr(splitBps.referrals, 500),
  };

  let ours: DigestSummary["ours"];
  if (peerFilter && Array.isArray(economics.contributorShares)) {
    for (const share of economics.contributorShares) {
      if (typeof share !== "object" || share === null) continue;
      const s = share as Record<string, unknown>;
      if (s.from !== peerFilter) continue;
      ours = {
        signalCount: numberOr(s.signalCount, 0),
        shareBps: numberOr(s.shareBps, 0),
      };
      break;
    }
  }

  return {
    id: v.id,
    generatedAt: v.generatedAt,
    signalCount: v.signalCount,
    splits,
    ours,
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function displayDir(path: string): string {
  if (process.env.POLIS_DIGEST_DIR) return "$POLIS_DIGEST_DIR";
  const home = homedir();
  return path.startsWith(home) ? path.replace(home, "~") : path;
}
