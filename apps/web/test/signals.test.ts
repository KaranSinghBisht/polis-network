import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadArchivedSignals } from "../lib/signals";

function tempDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "polis-web-signals-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    v: 1,
    kind: "signal",
    topic: "town.openagents-market",
    from: "a".repeat(64),
    content: [
      "SIGNAL",
      "headline: Agents are publishing sourced intelligence",
      "beat: openagents-market",
      "confidence: high",
      "tags: gensyn, 0g",
      "sources:",
      "- https://ethglobal.com/events/openagents/prizes",
      "analysis:",
      "Most teams have chatty swarms; Polis turns signals into a digest.",
    ].join("\n"),
    ts: 1_777_777_777_000,
    ...overrides,
  };
}

test("loadArchivedSignals only returns signal records and synthesizes local archive URIs", () => {
  const { dir, cleanup } = tempDir();
  const prior = process.env.POLIS_ARCHIVE_DIR;
  process.env.POLIS_ARCHIVE_DIR = dir;
  try {
    const cid = "b".repeat(64);
    writeJson(join(dir, `${cid}.json`), record());
    writeJson(join(dir, "reply.json"), record({ kind: "reply", content: "not a signal" }));
    writeJson(join(dir, "post.json"), record({ kind: "post", content: "not a signal" }));

    const signals = loadArchivedSignals();

    assert.equal(signals.length, 1);
    assert.equal(signals[0]?.id, cid);
    assert.equal(signals[0]?.kind, "signal");
    assert.equal(signals[0]?.headline, "Agents are publishing sourced intelligence");
    assert.equal(signals[0]?.beat, "openagents-market");
    assert.equal(signals[0]?.archiveUri, `polis-local://sha256/${cid}`);
  } finally {
    if (prior === undefined) delete process.env.POLIS_ARCHIVE_DIR;
    else process.env.POLIS_ARCHIVE_DIR = prior;
    cleanup();
  }
});

test("loadArchivedSignals preserves 0G archive annotations when present", () => {
  const { dir, cleanup } = tempDir();
  const prior = process.env.POLIS_ARCHIVE_DIR;
  process.env.POLIS_ARCHIVE_DIR = dir;
  try {
    const root = `0x${"c".repeat(64)}`;
    writeJson(join(dir, `${root}.json`), record({
      archiveUri: `0g://${root}`,
      archiveTxHash: `0x${"d".repeat(64)}`,
    }));

    const [signal] = loadArchivedSignals();

    assert.equal(signal?.archiveUri, `0g://${root}`);
    assert.equal(signal?.archiveTxHash, `0x${"d".repeat(64)}`);
  } finally {
    if (prior === undefined) delete process.env.POLIS_ARCHIVE_DIR;
    else process.env.POLIS_ARCHIVE_DIR = prior;
    cleanup();
  }
});
