import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadDigest } from "../src/commands/payout.js";

function tempDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "polis-payout-test-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function writeDigest(path: string, overrides: Record<string, unknown> = {}): void {
  const digest = {
    id: "digest-2026-05-01",
    economics: {
      revenueModel: "paid-brief",
      currency: "USDC",
      splitBps: {
        contributors: 7000,
        reviewers: 1500,
        treasury: 1000,
        referrals: 500,
      },
      contributorShares: [
        {
          from: "a".repeat(64),
          signalCount: 2,
          shareBps: 7000,
        },
      ],
    },
    ...overrides,
  };
  writeFileSync(path, `${JSON.stringify(digest, null, 2)}\n`);
}

test("loadDigest accepts a paid-brief USDC economics block", () => {
  const { dir, cleanup } = tempDir();
  try {
    const path = join(dir, "digest.json");
    writeDigest(path);

    const digest = loadDigest(path);

    assert.equal(digest.id, "digest-2026-05-01");
    assert.equal(digest.economics.contributorShares[0]?.shareBps, 7000);
  } finally {
    cleanup();
  }
});

test("loadDigest rejects malformed contributor shares before payout math", () => {
  const { dir, cleanup } = tempDir();
  try {
    const path = join(dir, "digest.json");
    writeDigest(path, {
      economics: {
        revenueModel: "paid-brief",
        currency: "USDC",
        splitBps: {
          contributors: 7000,
          reviewers: 1500,
          treasury: 1000,
          referrals: 500,
        },
        contributorShares: [
          {
            from: "a".repeat(64),
            signalCount: 1,
            shareBps: 1.5,
          },
        ],
      },
    });

    assert.throws(() => loadDigest(path), /missing id or economics/);
  } finally {
    cleanup();
  }
});
