import { createHash } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type Anthropic from "@anthropic-ai/sdk";

export type ReplayMode = "live" | "record" | "replay";

export interface ReplayConfig {
  mode: ReplayMode;
  /** Path to a JSONL transcript. Created on first record. */
  transcriptPath: string;
}

/**
 * Structural subset of Anthropic that the Agent runtime actually uses.
 * Keeps the replay wrapper free to implement only what's needed.
 */
export interface AnthropicMessages {
  messages: {
    create: Anthropic["messages"]["create"];
  };
}

interface TranscriptEntry {
  v: 1;
  hash: string;
  model: string;
  output: Anthropic.Message;
}

export class ReplayMissError extends Error {
  constructor(public readonly hash: string) {
    super(
      `replay miss for prompt hash ${hash}; re-record with POLIS_MODE=record before re-running in replay`,
    );
    this.name = "ReplayMissError";
  }
}

/**
 * Wrap a real Anthropic client (or any AnthropicMessages-shaped object) with
 * record/replay behaviour. When mode === "live", returns the real client
 * unchanged. Otherwise returns a wrapper whose `messages.create` either
 * appends each (request → response) pair to a JSONL transcript or replays
 * the cached response keyed by a deterministic hash of the request.
 */
export function createMessageClient(
  real: AnthropicMessages,
  cfg?: ReplayConfig,
): AnthropicMessages {
  if (!cfg || cfg.mode === "live") return real;

  const cache = cfg.mode === "replay" ? loadTranscript(cfg.transcriptPath) : new Map<string, Anthropic.Message>();

  const create = async (
    params: Parameters<Anthropic["messages"]["create"]>[0],
  ): Promise<Anthropic.Message> => {
    const hash = hashRequest(params);
    if (cfg.mode === "replay") {
      const cached = cache.get(hash);
      if (!cached) throw new ReplayMissError(hash);
      return cached;
    }
    const response = (await real.messages.create(params)) as Anthropic.Message;
    appendTranscript(cfg.transcriptPath, hash, params, response);
    cache.set(hash, response);
    return response;
  };

  return {
    messages: { create: create as Anthropic["messages"]["create"] },
  };
}

/**
 * Resolve the replay configuration from env, or undefined (= live mode).
 * POLIS_MODE controls behaviour; POLIS_REPLAY_TRANSCRIPT overrides the path.
 * Defaults to ~/.polis/replay/transcript.jsonl which is fine for solo runs.
 */
export function replayConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ReplayConfig | undefined {
  const mode = env.POLIS_MODE;
  if (!mode || mode === "live") return undefined;
  if (mode !== "record" && mode !== "replay") {
    throw new Error(`POLIS_MODE must be live, record, or replay (got '${mode}')`);
  }
  const transcriptPath =
    env.POLIS_REPLAY_TRANSCRIPT ??
    `${env.HOME ?? "."}/.polis/replay/transcript.jsonl`;
  return { mode, transcriptPath };
}

function loadTranscript(path: string): Map<string, Anthropic.Message> {
  const cache = new Map<string, Anthropic.Message>();
  if (!existsSync(path)) return cache;
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (line.length === 0) continue;
    const entry = JSON.parse(line) as TranscriptEntry;
    if (entry.v !== 1) continue;
    cache.set(entry.hash, entry.output);
  }
  return cache;
}

function appendTranscript(
  path: string,
  hash: string,
  params: Parameters<Anthropic["messages"]["create"]>[0],
  output: Anthropic.Message,
): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const entry: TranscriptEntry = {
    v: 1,
    hash,
    model: typeof params.model === "string" ? params.model : String(params.model),
    output,
  };
  appendFileSync(path, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
}

/**
 * Deterministic hash of the parts of an Anthropic message-create request
 * that influence the response. Skips streaming / metadata fields and
 * normalises object key order to keep hashes stable across runs.
 */
function hashRequest(
  params: Parameters<Anthropic["messages"]["create"]>[0],
): string {
  const subset = {
    model: params.model,
    max_tokens: params.max_tokens,
    system: params.system,
    messages: params.messages,
    temperature: params.temperature,
    top_p: params.top_p,
    top_k: params.top_k,
    stop_sequences: params.stop_sequences,
  };
  return createHash("sha256").update(stableJson(subset)).digest("hex");
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value !== "object" || value === null) return value;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return Object.fromEntries(entries.map(([key, item]) => [key, sortValue(item)]));
}
