import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { LlmClient, LlmRequest, LlmResponse } from "./llm.js";

export type ReplayMode = "live" | "record" | "replay";

export interface ReplayConfig {
  mode: ReplayMode;
  /** Path to a JSONL transcript. Created on first record. */
  transcriptPath: string;
}

interface TranscriptEntry {
  v: 1;
  hash: string;
  provider: string;
  model: string;
  output: LlmResponse;
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
 * Wrap an LlmClient with record/replay behaviour. Live mode is a passthrough.
 * Record mode appends each (request → response) pair to a JSONL transcript
 * keyed by sha256 of the canonical request. Replay mode looks up the cached
 * response or throws ReplayMissError.
 */
export function wrapWithReplay(client: LlmClient, cfg?: ReplayConfig): LlmClient {
  if (!cfg || cfg.mode === "live") return client;

  const cache =
    cfg.mode === "replay" ? loadTranscript(cfg.transcriptPath) : new Map<string, LlmResponse>();

  return {
    provider: client.provider,
    defaultModel: client.defaultModel,
    async complete(req: LlmRequest): Promise<LlmResponse> {
      const hash = hashRequest(client.provider, req);
      if (cfg.mode === "replay") {
        const cached = cache.get(hash);
        if (!cached) throw new ReplayMissError(hash);
        return cached;
      }
      const response = await client.complete(req);
      appendTranscript(cfg.transcriptPath, hash, client.provider, req, response);
      cache.set(hash, response);
      return response;
    },
  };
}

/**
 * Resolve replay configuration from env. Returns undefined for live mode.
 *   POLIS_MODE         = live | record | replay (default: live)
 *   POLIS_REPLAY_TRANSCRIPT = override transcript path
 */
export function replayConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ReplayConfig | undefined {
  const mode = env.POLIS_MODE;
  if (!mode || mode === "live") return undefined;
  if (mode !== "record" && mode !== "replay") {
    throw new Error(`POLIS_MODE must be live, record, or replay (got '${mode}')`);
  }
  const transcriptPath =
    env.POLIS_REPLAY_TRANSCRIPT ?? `${env.HOME ?? "."}/.polis/replay/transcript.jsonl`;
  return { mode, transcriptPath };
}

function loadTranscript(path: string): Map<string, LlmResponse> {
  const cache = new Map<string, LlmResponse>();
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
  provider: string,
  req: LlmRequest,
  output: LlmResponse,
): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const entry: TranscriptEntry = {
    v: 1,
    hash,
    provider,
    model: req.model,
    output,
  };
  appendFileSync(path, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
}

function hashRequest(provider: string, req: LlmRequest): string {
  const subset = {
    provider,
    model: req.model,
    maxTokens: req.maxTokens,
    system: req.system,
    userMessage: req.userMessage,
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
  return Object.fromEntries(entries.map(([k, v]) => [k, sortValue(v)]));
}
