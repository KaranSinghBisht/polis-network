import assert from "node:assert/strict";
import test from "node:test";
import { ensMetadataUri, peerIdFromEns } from "../src/ens.js";

const PEER = "a".repeat(64);

test("peerIdFromEns normalizes 0x-prefixed ENS peer text", () => {
  assert.equal(peerIdFromEns({ name: "agent.eth", peerText: `0x${PEER.toUpperCase()}` }), PEER);
});

test("peerIdFromEns rejects missing or malformed peer text", () => {
  assert.throws(() => peerIdFromEns({ name: "agent.eth" }), /missing ENS text record/);
  assert.throws(
    () => peerIdFromEns({ name: "agent.eth", peerText: "not-a-peer" }),
    /64-character AXL peer hex/,
  );
});

test("ensMetadataUri carries the ENS name and AXL peer id", () => {
  assert.equal(ensMetadataUri({ name: "agent.eth" }, PEER), `ens://agent.eth?peer=${PEER}`);
});
