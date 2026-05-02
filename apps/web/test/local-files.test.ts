import assert from "node:assert/strict";
import test from "node:test";
import { canReadLocalFilesFromParts } from "../lib/local-files";

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

test("local-file gate allows localhost by default and rejects public hosts", () => {
  withEnv({ NODE_ENV: "test", POLIS_WEB_LOCAL_READ_TOKEN: undefined, POLIS_WEB_EXPOSE_LOCAL_FILES: undefined }, () => {
    assert.equal(canReadLocalFilesFromParts({ host: "localhost:3000" }), true);
    assert.equal(canReadLocalFilesFromParts({ host: "127.0.0.1:3000" }), true);
    assert.equal(canReadLocalFilesFromParts({ host: "[::1]:3000" }), true);
    assert.equal(canReadLocalFilesFromParts({ host: "polis-web.vercel.app" }), false);
  });
});

test("local-file gate does not trust localhost Host headers in production", () => {
  withEnv({ NODE_ENV: "production", POLIS_WEB_LOCAL_READ_TOKEN: undefined, POLIS_WEB_EXPOSE_LOCAL_FILES: undefined }, () => {
    assert.equal(canReadLocalFilesFromParts({ host: "localhost:3000" }), false);
    assert.equal(canReadLocalFilesFromParts({ host: "127.0.0.1:3000" }), false);
    assert.equal(canReadLocalFilesFromParts({ host: "[::1]:3000" }), false);
  });
});

test("local-file gate requires the demo token when configured", () => {
  withEnv({ POLIS_WEB_LOCAL_READ_TOKEN: "secret", POLIS_WEB_EXPOSE_LOCAL_FILES: undefined }, () => {
    assert.equal(canReadLocalFilesFromParts({ host: "localhost:3000" }), false);
    assert.equal(canReadLocalFilesFromParts({ host: "polis-web.vercel.app", token: "wrong" }), false);
    assert.equal(canReadLocalFilesFromParts({ host: "polis-web.vercel.app", token: "secret" }), true);
  });
});
