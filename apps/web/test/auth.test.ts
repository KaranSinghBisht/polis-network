import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRequestedAgentName } from "../lib/agent-name";
import { claimMessage, loginMessage } from "../lib/auth";
import { isKvConfigured } from "../lib/kv";

function withEnv<T>(patch: Record<string, string | undefined>, fn: () => T): T {
  const prior: Record<string, string | undefined> = {};
  for (const key of Object.keys(patch)) {
    prior[key] = process.env[key];
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("loginMessage binds the signature to the deployment origin and Gensyn chain", () => {
  const message = loginMessage({
    domain: "polis-web.vercel.app",
    uri: "https://polis-web.vercel.app",
    wallet: "0x7e3edad28b4abe55c8c40d9b1bc82280cc05933d",
    nonce: "0123456789abcdef0123456789abcdef",
    timestamp: 1_777_777_777,
  });

  assert.match(message, /^polis-web\.vercel\.app wants you to sign in with your Ethereum account:/);
  assert.match(message, /URI: https:\/\/polis-web\.vercel\.app/);
  assert.match(message, /Chain ID: 685685/);
  assert.match(message, /Nonce: 0123456789abcdef0123456789abcdef/);
  assert.match(message, /Request ID: polis-login-v1/);
});

test("claimMessage binds CLI agent claims to the same web deployment", () => {
  const message = claimMessage({
    domain: "polis-web.vercel.app",
    uri: "https://polis-web.vercel.app",
    peer: "A".repeat(64),
    code: "ab23cd45",
    timestamp: 1_777_777_777,
  });

  assert.equal(
    message,
    [
      "polis:claim:v1",
      "domain=polis-web.vercel.app",
      "uri=https://polis-web.vercel.app",
      `peer=${"a".repeat(64)}`,
      "code=AB23CD45",
      "ts=1777777777",
    ].join("\n"),
  );
});

test("claimMessage binds requested ENS agent names into the signature", () => {
  const message = claimMessage({
    domain: "polis-web.vercel.app",
    uri: "https://polis-web.vercel.app",
    peer: "b".repeat(64),
    code: "QWERTY23",
    ensName: "Scout-7.Polis-Agent.eth",
    timestamp: 1_777_777_888,
  });

  assert.equal(
    message,
    [
      "polis:claim:v1",
      "domain=polis-web.vercel.app",
      "uri=https://polis-web.vercel.app",
      `peer=${"b".repeat(64)}`,
      "code=QWERTY23",
      "ens=scout-7.polis-agent.eth",
      "ts=1777777888",
    ].join("\n"),
  );
});

test("claimMessage canonicalizes 0x-prefixed peer ids to the CLI-signed form", () => {
  const peer = "c".repeat(64);
  const message = claimMessage({
    domain: "polis-web.vercel.app",
    uri: "https://polis-web.vercel.app",
    peer: `0x${peer}`,
    code: "QWERTY23",
    timestamp: 1_777_777_888,
  });

  assert.match(message, new RegExp(`\\npeer=${peer}\\n`));
  assert.doesNotMatch(message, /\npeer=0x/);
});

test("agent claim names are restricted to Polis-owned ENS subnames", () => {
  assert.equal(normalizeRequestedAgentName("Scout-7"), "scout-7.polis-agent.eth");
  assert.equal(
    normalizeRequestedAgentName("Scout-7.Polis-Agent.eth"),
    "scout-7.polis-agent.eth",
  );
  assert.throws(
    () => normalizeRequestedAgentName("vitalik.eth"),
    /subname under polis-agent\.eth/,
  );
});

test("agent claim names honor a configured ENS parent and reject bad labels", () => {
  withEnv({ POLIS_ENS_PARENT_NAME: "agents.polis.eth" }, () => {
    assert.equal(normalizeRequestedAgentName("Skeptic-9"), "skeptic-9.agents.polis.eth");
    assert.equal(
      normalizeRequestedAgentName("Skeptic-9.Agents.Polis.eth"),
      "skeptic-9.agents.polis.eth",
    );
    assert.throws(
      () => normalizeRequestedAgentName("skeptic-9.polis-agent.eth"),
      /subname under agents\.polis\.eth/,
    );
    assert.throws(
      () => normalizeRequestedAgentName("-skeptic"),
      /ENS labels must use lowercase letters/,
    );
  });
});

test("web auth accepts both Vercel KV and Upstash Redis env names", () => {
  const empty = {
    KV_REST_API_URL: undefined,
    KV_REST_API_TOKEN: undefined,
    UPSTASH_REDIS_REST_URL: undefined,
    UPSTASH_REDIS_REST_TOKEN: undefined,
  };

  withEnv(empty, () => {
    assert.equal(isKvConfigured(), false);
  });
  withEnv({ ...empty, KV_REST_API_URL: "https://kv.example", KV_REST_API_TOKEN: "token" }, () => {
    assert.equal(isKvConfigured(), true);
  });
  withEnv(
    {
      ...empty,
      UPSTASH_REDIS_REST_URL: "https://upstash.example",
      UPSTASH_REDIS_REST_TOKEN: "token",
    },
    () => {
      assert.equal(isKvConfigured(), true);
    },
  );
});
