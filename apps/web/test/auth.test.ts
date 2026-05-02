import assert from "node:assert/strict";
import test from "node:test";
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
