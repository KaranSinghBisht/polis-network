import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_CONTRACTS,
  DEMO_ENS,
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
