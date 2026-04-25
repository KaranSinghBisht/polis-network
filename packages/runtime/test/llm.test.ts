import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLlmClient,
  ReplayMissError,
  ReplayOnlyLlmClient,
  wrapWithReplay,
} from "../src/index.js";

test("createLlmClient returns a replay-only Groq client without keys in replay mode", () => {
  const client = createLlmClient({ env: { POLIS_MODE: "replay" } });

  assert.equal(client.provider, "groq");
  assert.equal(client.defaultModel, "llama-3.3-70b-versatile");
  assert.ok(client instanceof ReplayOnlyLlmClient);
});

test("createLlmClient honors explicit replay provider without requiring that provider key", () => {
  const client = createLlmClient({
    env: {
      POLIS_MODE: "replay",
      POLIS_LLM_PROVIDER: "anthropic",
      ANTHROPIC_MODEL: "claude-test",
    },
  });

  assert.equal(client.provider, "anthropic");
  assert.equal(client.defaultModel, "claude-test");
});

test("replay wrapper fails with ReplayMissError before a replay-only client calls live", async () => {
  const client = createLlmClient({ env: { POLIS_MODE: "replay" } });
  const wrapped = wrapWithReplay(client, {
    mode: "replay",
    transcriptPath: "/tmp/polis-missing-transcript.jsonl",
  });

  await assert.rejects(
    () =>
      wrapped.complete({
        model: client.defaultModel,
        maxTokens: 100,
        system: "x",
        userMessage: "y",
      }),
    (err: unknown) => err instanceof ReplayMissError,
  );
});

test("createLlmClient rejects invalid provider values", () => {
  assert.throws(
    () => createLlmClient({ env: { POLIS_LLM_PROVIDER: "ollama" } }),
    /POLIS_LLM_PROVIDER must be groq or anthropic/,
  );
});
