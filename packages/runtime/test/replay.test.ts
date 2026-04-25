import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import {
  createMessageClient,
  ReplayMissError,
  replayConfigFromEnv,
  type AnthropicMessages,
} from "../src/replay.js";

function freshTranscriptDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "polis-replay-test-"));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function fakeMessage(text: string): Anthropic.Message {
  // Cast through `unknown` because the SDK's Message type evolves frequently
  // (new fields like `container` / `stop_details` get added between minor
  // versions); the runtime only reads `content[0].text`, so the structural
  // mismatch on optional fields doesn't matter for these tests.
  return {
    id: "msg_fake",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5-test",
    content: [{ type: "text", text, citations: [] }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 1,
      output_tokens: 1,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    },
  } as unknown as Anthropic.Message;
}

function fakeAnthropic(handler: (params: unknown) => Anthropic.Message): {
  client: AnthropicMessages;
  calls: unknown[];
} {
  const calls: unknown[] = [];
  const client: AnthropicMessages = {
    messages: {
      create: (async (params: unknown) => {
        calls.push(params);
        return handler(params);
      }) as AnthropicMessages["messages"]["create"],
    },
  };
  return { client, calls };
}

const REQUEST = {
  model: "claude-haiku-4-5-20251001",
  max_tokens: 100,
  system: "you are a tester",
  messages: [{ role: "user" as const, content: "hello" }],
};

test("live mode returns the real client unchanged", () => {
  const { dir, cleanup } = freshTranscriptDir();
  try {
    const { client } = fakeAnthropic(() => fakeMessage("hi"));
    const wrapped = createMessageClient(client, {
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
    const { client, calls } = fakeAnthropic(() => fakeMessage("recorded reply"));
    const wrapped = createMessageClient(client, { mode: "record", transcriptPath: path });

    const response = await wrapped.messages.create(REQUEST as never);
    const text = (response.content[0] as { text: string }).text;

    assert.equal(text, "recorded reply");
    assert.equal(calls.length, 1);
    assert.ok(existsSync(path), "transcript file should exist after record");

    const lines = readFileSync(path, "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]!);
    assert.equal(entry.v, 1);
    assert.match(entry.hash, /^[0-9a-f]{64}$/);
    assert.equal(entry.model, REQUEST.model);
    assert.equal(entry.output.id, "msg_fake");
  } finally {
    cleanup();
  }
});

test("replay mode loads the transcript and returns cached responses without hitting the real client", async () => {
  const { dir, cleanup } = freshTranscriptDir();
  const path = join(dir, "transcript.jsonl");
  try {
    // Phase 1: record once.
    const { client: recordClient } = fakeAnthropic(() => fakeMessage("from-recording"));
    const recorder = createMessageClient(recordClient, { mode: "record", transcriptPath: path });
    await recorder.messages.create(REQUEST as never);

    // Phase 2: replay against a strict client that explodes if called.
    const { client: liveClient, calls } = fakeAnthropic(() => {
      throw new Error("real client must not be called in replay mode");
    });
    const replayer = createMessageClient(liveClient, { mode: "replay", transcriptPath: path });

    const response = await replayer.messages.create(REQUEST as never);
    assert.equal(calls.length, 0);
    assert.equal((response.content[0] as { text: string }).text, "from-recording");
  } finally {
    cleanup();
  }
});

test("replay mode throws ReplayMissError when the transcript has no entry", async () => {
  const { dir, cleanup } = freshTranscriptDir();
  const path = join(dir, "transcript.jsonl");
  try {
    const { client } = fakeAnthropic(() => fakeMessage("ignored"));
    const replayer = createMessageClient(client, { mode: "replay", transcriptPath: path });

    await assert.rejects(
      () => replayer.messages.create(REQUEST as never),
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
    const { client: a } = fakeAnthropic(() => fakeMessage("once"));
    const recorder = createMessageClient(a, { mode: "record", transcriptPath: path });
    await recorder.messages.create(REQUEST as never);

    const reordered = {
      messages: REQUEST.messages,
      max_tokens: REQUEST.max_tokens,
      system: REQUEST.system,
      model: REQUEST.model,
    };

    const { client: b, calls } = fakeAnthropic(() => {
      throw new Error("must hit cache");
    });
    const replayer = createMessageClient(b, { mode: "replay", transcriptPath: path });
    const response = await replayer.messages.create(reordered as never);
    assert.equal(calls.length, 0);
    assert.equal((response.content[0] as { text: string }).text, "once");
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
