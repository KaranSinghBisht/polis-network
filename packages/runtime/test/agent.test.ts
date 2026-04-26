import { test } from "node:test";
import assert from "node:assert/strict";
import { Agent, encodeMessage, type TownMessage } from "../src/index.js";
import type { LlmClient } from "../src/llm.js";

const OWN = "1".repeat(64);
const PEER_A = "a".repeat(64);
const PEER_B = "b".repeat(64);

function llm(text: string): LlmClient {
  return {
    provider: "groq",
    defaultModel: "test-model",
    complete: async () => ({ text }),
  };
}

function fakeAxl() {
  const sends: Array<{ peer: string; body: Uint8Array }> = [];
  return {
    sends,
    axl: {
      recv: async () => null,
      send: async (peer: string, body: Uint8Array) => {
        sends.push({ peer, body });
        return body.byteLength;
      },
      topology: async () => ({
        our_ipv6: "::1",
        our_public_key: OWN,
        peers: [
          { uri: "tls://a", up: true, inbound: false, public_key: PEER_A },
          { uri: "tls://b", up: true, inbound: false, public_key: PEER_B },
          { uri: "tls://own", up: true, inbound: false, public_key: OWN },
        ],
        tree: [],
      }),
    },
  };
}

function message(overrides: Partial<TownMessage> = {}): TownMessage {
  return {
    v: 1,
    kind: "post",
    topic: "town.general",
    from: PEER_A,
    content: "hello",
    ts: 1,
    ttl: 2,
    ...overrides,
  };
}

test("agent rejects spoofed TownMessage sender identity", async () => {
  const { axl, sends } = fakeAxl();
  const agent = new Agent(
    { name: "analyst-1", role: "analyst", persona: "test", peerIdHex: OWN },
    { axl: axl as never, llm: llm("reply") },
  );

  const result = await agent.handle({ fromPeerId: PEER_B, body: encodeMessage(message()) });

  assert.equal(result, null);
  assert.equal(sends.length, 0);
});

test("agent fans replies out to topology peers with ttl and parentId", async () => {
  const { axl, sends } = fakeAxl();
  const agent = new Agent(
    { name: "analyst-1", role: "analyst", persona: "test", peerIdHex: OWN },
    { axl: axl as never, llm: llm("reply") },
  );

  const result = await agent.handle({ fromPeerId: PEER_A, body: encodeMessage(message()) });

  assert.ok(result);
  assert.equal(result.kind, "reply");
  assert.equal(result.ttl, 1);
  assert.match(result.parentId ?? "", /^[0-9a-f]{64}$/);
  assert.deepEqual(sends.map((send) => send.peer).sort(), [PEER_A, PEER_B].sort());
});
