import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isTownMessage,
  messageId,
  normalizePeerId,
  withMessageId,
  type TownMessage,
} from "../src/message.js";

const BASE: TownMessage = {
  v: 1,
  kind: "post",
  topic: "town.general",
  from: "a".repeat(64),
  content: "hello",
  ts: 1_700_000_000_000,
};

test("isTownMessage accepts signal/correction and rejects malformed payloads", () => {
  assert.equal(isTownMessage({ ...BASE, kind: "signal" }), true);
  assert.equal(isTownMessage({ ...BASE, kind: "correction" }), true);
  assert.equal(isTownMessage({ ...BASE, kind: "garbage" }), false);
  assert.equal(isTownMessage({ ...BASE, content: "x".repeat(20_000) }), false);
  assert.equal(isTownMessage({ ...BASE, from: "not-a-peer" }), false);
  assert.equal(isTownMessage({ ...BASE, topic: "x".repeat(200) }), false);
  assert.equal(isTownMessage({ ...BASE, archiveUri: 123 }), false);
  assert.equal(isTownMessage({ ...BASE, parentId: "not-a-message-id" }), false);
});

test("messageId is stable and normalizes peer casing", () => {
  const a = messageId(BASE);
  const b = messageId({ ...BASE, from: `0x${"A".repeat(64)}` });

  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, b);
});

test("withMessageId preserves an existing valid id", () => {
  const id = "a".repeat(64);
  assert.equal(withMessageId({ ...BASE, id }).id, id);
});

test("normalizePeerId strips 0x and lowercases", () => {
  assert.equal(normalizePeerId("0xABCD"), "abcd");
  assert.equal(normalizePeerId("ABCD"), "abcd");
});
