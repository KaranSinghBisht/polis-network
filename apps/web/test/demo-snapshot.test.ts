import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_CONTRACTS,
  DEMO_ENS,
  DEMO_MARKET_ROUND,
  DEMO_PEER,
  DEMO_WALLET,
  demoDigestSummary,
  demoEnsIdentity,
  demoOperators,
  demoSignalsFor,
} from "../lib/demo-snapshot";

test("demo ENS proof snapshot is internally consistent for proof pages", () => {
  const identity = demoEnsIdentity();

  assert.equal(identity.ens.name, DEMO_ENS);
  assert.equal(identity.ens.resolvedAddress, DEMO_WALLET);
  assert.equal(identity.records.peer, DEMO_PEER);
  assert.equal(identity.peer.hex, DEMO_PEER);
  assert.equal(identity.peer.bytes32, `0x${DEMO_PEER}`);
  assert.equal(identity.peer.matchesEns, true);
  assert.equal(identity.registry?.metadataURI, `ens://${DEMO_ENS}?peer=${DEMO_PEER}`);
  assert.equal(identity.registry?.matchesWallet, true);
  assert.equal(identity.archive?.uri.startsWith("0g://"), true);
  assert.deepEqual(identity.chain.steps.map((step) => step.ok), [true, true, true, true]);

  const signals = demoSignalsFor({ peer: DEMO_PEER, limit: 20 });
  assert.ok(signals.some((signal) => signal.archiveUri === identity.archive?.uri));

  const digest = demoDigestSummary();
  assert.ok(digest.signals.some((signal) => signal.archiveUri === identity.archive?.uri));

  const [operator] = demoOperators();
  assert.equal(operator?.peer, DEMO_PEER);
  assert.equal(operator?.wallet, DEMO_WALLET);
  assert.equal(operator?.handle, "polis-agent");
});

test("demo market round ties each AXL step to 0G and PostIndex receipts", () => {
  assert.equal(DEMO_MARKET_ROUND.nodes.length, 3);
  assert.match(DEMO_MARKET_ROUND.source, /^https:\/\/app\.delphi\.fyi/);

  for (const node of DEMO_MARKET_ROUND.nodes) {
    assert.match(node.peer, /^[0-9a-f]{64}$/);
    assert.match(node.wallet, /^0x[0-9a-fA-F]{40}$/);
    assert.ok(node.bytes > 0);
    assert.equal(node.archive.uri.startsWith("0g://"), true);
    assert.match(node.archive.tx, /^0x[0-9a-f]{64}$/);
    assert.match(node.archive.postIndexTx, /^0x[0-9a-f]{64}$/);
  }

  const digest = demoDigestSummary();
  assert.equal(digest.id, DEMO_MARKET_ROUND.outcome.digestId);
});

test("ENS route resolver falls back to the public demo proof snapshot when RPC is unavailable", async () => {
  const priorFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("offline ENS RPC");
  };
  try {
    const { resolveAgentEnsRoute } = await import("../lib/ens-route");
    const route = await resolveAgentEnsRoute(DEMO_ENS);

    assert.equal(route?.source, "demo-snapshot");
    assert.equal(route?.name, DEMO_ENS);
    assert.equal(route?.peer, DEMO_PEER);
    assert.equal(route?.resolvedAddress, DEMO_WALLET);
    assert.equal(route?.records.registry, DEMO_CONTRACTS.agentRegistry);
    assert.equal(route?.records.endpoint, `axl://gensyn-testnet/${DEMO_PEER}`);
  } finally {
    globalThis.fetch = priorFetch;
  }
});
