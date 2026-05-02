import assert from "node:assert/strict";
import test from "node:test";
import { claimMessage, loginMessage } from "../lib/auth";

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
