import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type LlmProvider = "anthropic" | "groq";

export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

/**
 * Provider-agnostic completion request. All providers receive the same shape;
 * adapters translate to the underlying SDK call.
 */
export interface LlmRequest {
  system: string;
  userMessage: string;
  model: string;
  maxTokens: number;
}

export interface LlmResponse {
  text: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Minimal LLM client interface. Replay wraps this; the Agent runtime depends
 * only on this. Adding a new provider = one more class.
 */
export interface LlmClient {
  readonly provider: LlmProvider;
  readonly defaultModel: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}

export interface CreateLlmClientOptions {
  env?: NodeJS.ProcessEnv;
  /** Force a specific provider regardless of env detection. */
  provider?: LlmProvider;
}

/**
 * Resolve a client from environment. Auto-detection order:
 *   1. POLIS_LLM_PROVIDER (explicit override) wins.
 *   2. GROQ_API_KEY present → Groq (cheapest for dev/test).
 *   3. ANTHROPIC_API_KEY present → Anthropic.
 * Throws a clear error if nothing usable is configured.
 */
export function createLlmClient(opts: CreateLlmClientOptions = {}): LlmClient {
  const env = opts.env ?? process.env;
  const explicit = parseProvider(opts.provider ?? env.POLIS_LLM_PROVIDER);
  const replayOnly = env.POLIS_MODE === "replay";

  const wantGroq = explicit === "groq" || (!explicit && env.GROQ_API_KEY);
  if (wantGroq) {
    if (!env.GROQ_API_KEY) {
      if (replayOnly) return new ReplayOnlyLlmClient("groq", env.GROQ_MODEL);
      throw new Error("POLIS_LLM_PROVIDER=groq but GROQ_API_KEY is not set");
    }
    return new GroqLlmClient(env.GROQ_API_KEY, env.GROQ_MODEL);
  }

  const wantAnthropic = explicit === "anthropic" || env.ANTHROPIC_API_KEY;
  if (wantAnthropic) {
    if (!env.ANTHROPIC_API_KEY) {
      if (replayOnly) return new ReplayOnlyLlmClient("anthropic", env.ANTHROPIC_MODEL);
      throw new Error("POLIS_LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set");
    }
    return new AnthropicLlmClient(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL);
  }

  if (replayOnly) return new ReplayOnlyLlmClient("groq", env.GROQ_MODEL);

  throw new Error(
    "no LLM provider configured — set GROQ_API_KEY or ANTHROPIC_API_KEY (see .env.example)",
  );
}

function parseProvider(value: string | undefined): LlmProvider | undefined {
  if (!value) return undefined;
  if (value === "groq" || value === "anthropic") return value;
  throw new Error(`POLIS_LLM_PROVIDER must be groq or anthropic (got '${value}')`);
}

// ─── Anthropic adapter ─────────────────────────────────────────────────

export class AnthropicLlmClient implements LlmClient {
  readonly provider = "anthropic" as const;
  readonly defaultModel: string;
  private readonly client: Anthropic;

  constructor(apiKey: string, defaultModel?: string) {
    this.client = new Anthropic({ apiKey });
    this.defaultModel = defaultModel || DEFAULT_ANTHROPIC_MODEL;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const res = await this.client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      system: [
        { type: "text", text: req.system, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: req.userMessage }],
    });
    const textBlock = res.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    return {
      text: textBlock?.text ?? "",
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      },
    };
  }
}

// ─── Groq adapter (uses OpenAI-compatible endpoint) ────────────────────

export class GroqLlmClient implements LlmClient {
  readonly provider = "groq" as const;
  readonly defaultModel: string;
  private readonly client: OpenAI;

  constructor(apiKey: string, defaultModel?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
    this.defaultModel = defaultModel || DEFAULT_GROQ_MODEL;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const res = await this.client.chat.completions.create({
      model: req.model,
      max_tokens: req.maxTokens,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.userMessage },
      ],
    });
    const text = res.choices[0]?.message?.content ?? "";
    return {
      text,
      usage: res.usage
        ? {
            inputTokens: res.usage.prompt_tokens,
            outputTokens: res.usage.completion_tokens,
          }
        : undefined,
    };
  }
}

// ─── Replay-only adapter ───────────────────────────────────────────────

export class ReplayOnlyLlmClient implements LlmClient {
  readonly provider: LlmProvider;
  readonly defaultModel: string;

  constructor(provider: LlmProvider, defaultModel?: string) {
    this.provider = provider;
    this.defaultModel =
      defaultModel ?? (provider === "groq" ? DEFAULT_GROQ_MODEL : DEFAULT_ANTHROPIC_MODEL);
  }

  async complete(): Promise<LlmResponse> {
    throw new Error(
      "replay-only LLM client cannot call a live provider; record a transcript or set an API key",
    );
  }
}
