import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { putJson, type PutOptions } from "../src/index.js";

function freshArchiveDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "polis-storage-test-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function localOpts(archiveDir: string): PutOptions {
  return { provider: "local", archiveDir };
}

test("provider 'none' returns null and writes nothing", async () => {
  const { dir, cleanup } = freshArchiveDir();
  try {
    const result = await putJson({ hello: "world" }, { provider: "none", archiveDir: dir });
    assert.equal(result, null);
  } finally {
    cleanup();
  }
});

test("local provider writes a sha256-named JSON file with stable contents", async () => {
  const { dir, cleanup } = freshArchiveDir();
  try {
    const payload = { v: 1, kind: "post", topic: "town.general", from: "abc", content: "hi", ts: 1 };
    const result = await putJson(payload, localOpts(dir));
    assert.ok(result, "expected a non-null result");
    assert.equal(result.provider, "local");
    assert.equal(result.uri, `polis-local://sha256/${result.cid}`);
    assert.match(result.cid, /^[0-9a-f]{64}$/);
    assert.equal(result.path, join(dir, `${result.cid}.json`));

    const onDisk = readFileSync(result.path!, "utf8");
    assert.ok(onDisk.endsWith("\n"), "stableJson should end with a trailing newline");
    const parsed = JSON.parse(onDisk);
    assert.deepEqual(parsed, payload);
  } finally {
    cleanup();
  }
});

test("local provider produces deterministic CIDs across re-runs", async () => {
  const { dir, cleanup } = freshArchiveDir();
  try {
    const payload = { topic: "x", content: "y", from: "z", ts: 7, v: 1, kind: "post" };
    const a = await putJson(payload, localOpts(dir));
    const b = await putJson(payload, localOpts(dir));
    assert.ok(a && b);
    assert.equal(a.cid, b.cid, "same payload must hash to the same CID");
  } finally {
    cleanup();
  }
});

test("local provider sorts object keys before hashing", async () => {
  const { dir, cleanup } = freshArchiveDir();
  try {
    const ordered = { a: 1, b: 2, c: 3 };
    const reversed = { c: 3, b: 2, a: 1 };
    const a = await putJson(ordered, localOpts(dir));
    const b = await putJson(reversed, localOpts(dir));
    assert.ok(a && b);
    assert.equal(a.cid, b.cid, "key order must not affect the CID");
  } finally {
    cleanup();
  }
});

test("local provider sorts nested object keys recursively", async () => {
  const { dir, cleanup } = freshArchiveDir();
  try {
    const ordered = { outer: { x: 1, y: { p: 1, q: 2 } } };
    const reversed = { outer: { y: { q: 2, p: 1 }, x: 1 } };
    const a = await putJson(ordered, localOpts(dir));
    const b = await putJson(reversed, localOpts(dir));
    assert.ok(a && b);
    assert.equal(a.cid, b.cid, "nested key order must not affect the CID");
  } finally {
    cleanup();
  }
});

test("local provider preserves array order (arrays are content-positional)", async () => {
  const { dir, cleanup } = freshArchiveDir();
  try {
    const a = await putJson({ items: [1, 2, 3] }, localOpts(dir));
    const b = await putJson({ items: [3, 2, 1] }, localOpts(dir));
    assert.ok(a && b);
    assert.notEqual(a.cid, b.cid, "different array order should produce different CIDs");
  } finally {
    cleanup();
  }
});
