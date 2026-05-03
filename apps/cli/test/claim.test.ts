import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRequestedAgentName } from "../src/commands/claim.js";

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

test("CLI claim names expand short labels under the default Polis ENS parent", () => {
  assert.equal(normalizeRequestedAgentName("Scout-7"), "scout-7.polis-agent.eth");
  assert.equal(
    normalizeRequestedAgentName("Scout-7.Polis-Agent.eth"),
    "scout-7.polis-agent.eth",
  );
});

test("CLI claim names honor POLIS_ENS_PARENT_NAME", () => {
  withEnv({ POLIS_ENS_PARENT_NAME: "agents.polis.eth" }, () => {
    assert.equal(normalizeRequestedAgentName("Treasurer-2"), "treasurer-2.agents.polis.eth");
    assert.equal(
      normalizeRequestedAgentName("Treasurer-2.Agents.Polis.eth"),
      "treasurer-2.agents.polis.eth",
    );
    assert.throws(
      () => normalizeRequestedAgentName("treasurer-2.polis-agent.eth"),
      /subname under agents\.polis\.eth/,
    );
  });
});

test("CLI claim names reject empty, malformed, or external ENS names", () => {
  assert.throws(() => normalizeRequestedAgentName(""), /cannot be empty/);
  assert.throws(() => normalizeRequestedAgentName("-scout"), /cannot start\/end with a hyphen/);
  assert.throws(() => normalizeRequestedAgentName("scout-"), /cannot start\/end with a hyphen/);
  assert.throws(() => normalizeRequestedAgentName("vitalik.eth"), /subname under polis-agent\.eth/);
  assert.throws(() => normalizeRequestedAgentName("scout.polis-agent.xyz"), /\.eth subname/);
});
