import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ReplayMissError,
  replayConfigFromEnv,
  wrapWithReplay,
} from "../src/replay.js";
import type { LlmClient, LlmRequest, LlmResponse } from "../src/llm.js";

function freshTranscriptDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "polis-replay-test-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function fakeResponse(text: string): LlmResponse {
  return { text, usage: { inputTokens: 1, outputTokens: 1 } };
}

function fakeClient(handler: (req: LlmRequest) => LlmResponse): {
  client: LlmClient;
  calls: LlmRequest[];
} {
  const calls: LlmRequest[] = [];
  const client: LlmClient = {
    provider: "groq",
    defaultModel: "test-model",
    complete: async (req) => {
      calls.push(req);
      return handler(req);
    },
  };
  return { client, calls };
}

const REQUEST: LlmRequest = {
  model: "llama-3.3-70b-versatile",
  maxTokens: 100,
  system: "you are a tester",
  userMessage: "hello",
};

test("live mode returns the real client unchanged", () => {
  const { dir, cleanup } = freshTranscriptDir();
  try {
    const { client } = fakeClient(() => fakeResponse("hi"));
    const wrapped = wrapWithReplay(client, {
      mode: "live",
      transcriptPath: join(dir, "transcript.jsonl"),
    });
    assert.equal(wrapped, client);
  } finally {
    cleanup();
  }
});

test("record mode writes a transcript line and returns the real response", async () => {
  const { dir, cleanup } = freshTranscriptDir();
  const path = join(dir, "transcript.jsonl");
  try {
    const { client, calls } = fakeClient(() => fakeResponse("recorded reply"));
    const wrapped = wrapWithReplay(client, { mode: "record", transcriptPath: path });

    const response = await wrapped.complete(REQUEST);
    assert.equal(response.text, "recorded reply");
    assert.equal(calls.length, 1);
    assert.ok(existsSync(path), "transcript file should exist after record");

    const lines = readFileSync(path, "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]!);
    assert.equal(entry.v, 1);
    assert.match(entry.hash, /^[0-9a-f]{64}$/);
    assert.equal(entry.model, REQUEST.model);
    assert.equal(entry.provider, "groq");
    assert.equal(entry.output.text, "recorded reply");
  } finally {
    cleanup();
  }
});

test("replay mode loads the transcript and returns cached responses without hitting the real client", async () => {
  const { dir, cleanup } = freshTranscriptDir();
  const path = join(dir, "transcript.jsonl");
  try {
    const { client: recordClient } = fakeClient(() => fakeResponse("from-recording"));
    const recorder = wrapWithReplay(recordClient, { mode: "record", transcriptPath: path });
    await recorder.complete(REQUEST);

    const { client: liveClient, calls } = fakeClient(() => {
      throw new Error("real client must not be called in replay mode");
    });
    const replayer = wrapWithReplay(liveClient, { mode: "replay", transcriptPath: path });

    const response = await replayer.complete(REQUEST);
    assert.equal(calls.length, 0);
    assert.equal(response.text, "from-recording");
  } finally {
    cleanup();
  }
});

test("replay mode throws ReplayMissError when the transcript has no entry", async () => {
  const { dir, cleanup } = freshTranscriptDir();
  const path = join(dir, "transcript.jsonl");
  try {
    const { client } = fakeClient(() => fakeResponse("ignored"));
    const replayer = wrapWithReplay(client, { mode: "replay", transcriptPath: path });
    await assert.rejects(
      () => replayer.complete(REQUEST),
      (err: unknown) => err instanceof ReplayMissError,
    );
  } finally {
    cleanup();
  }
});

test("hash is stable across object key order in the request", async () => {
  const { dir, cleanup } = freshTranscriptDir();
  const path = join(dir, "transcript.jsonl");
  try {
    const { client: a } = fakeClient(() => fakeResponse("once"));
    const recorder = wrapWithReplay(a, { mode: "record", transcriptPath: path });
    await recorder.complete(REQUEST);

    const reordered: LlmRequest = {
      userMessage: REQUEST.userMessage,
      maxTokens: REQUEST.maxTokens,
      system: REQUEST.system,
      model: REQUEST.model,
    };

    const { client: b, calls } = fakeClient(() => {
      throw new Error("must hit cache");
    });
    const replayer = wrapWithReplay(b, { mode: "replay", transcriptPath: path });
    const response = await replayer.complete(reordered);
    assert.equal(calls.length, 0);
    assert.equal(response.text, "once");
  } finally {
    cleanup();
  }
});

test("replayConfigFromEnv returns undefined for live or unset POLIS_MODE", () => {
  assert.equal(replayConfigFromEnv({}), undefined);
  assert.equal(replayConfigFromEnv({ POLIS_MODE: "live" }), undefined);
});

test("replayConfigFromEnv accepts record/replay and respects POLIS_REPLAY_TRANSCRIPT", () => {
  const recCfg = replayConfigFromEnv({ POLIS_MODE: "record", POLIS_REPLAY_TRANSCRIPT: "/tmp/x.jsonl" });
  assert.deepEqual(recCfg, { mode: "record", transcriptPath: "/tmp/x.jsonl" });
  const repCfg = replayConfigFromEnv({ POLIS_MODE: "replay", HOME: "/tmp/h" });
  assert.deepEqual(repCfg, { mode: "replay", transcriptPath: "/tmp/h/.polis/replay/transcript.jsonl" });
});

test("replayConfigFromEnv rejects an invalid mode value", () => {
  assert.throws(() => replayConfigFromEnv({ POLIS_MODE: "garbage" }));
});
