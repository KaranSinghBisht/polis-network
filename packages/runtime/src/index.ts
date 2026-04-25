import { AxlClient } from "@polis/axl-client";
import { encodeMessage, parseMessage, type TownMessage } from "./message.js";
import { createLlmClient, type LlmClient } from "./llm.js";
import { replayConfigFromEnv, wrapWithReplay, type ReplayConfig } from "./replay.js";

export type AgentRole =
  | "scout"
  | "analyst"
  | "skeptic"
  | "editor"
  | "archivist"
  | "treasurer";

export interface AgentConfig {
  /** Human-friendly handle for logs. */
  name: string;
  /** The job this agent does in the town. Shapes the system prompt. */
  role: AgentRole;
  /** Free-form persona — tone, taste, worldview. */
  persona: string;
  /** This agent's own AXL peerId hex (used in outbound TownMessages). */
  peerIdHex: string;
  /** Override the LlmClient's default model. */
  model?: string;
  /** Hard cap on reply length to keep costs bounded. */
  maxTokens?: number;
  /** Called before a reply is sent so callers can attach archive/provenance metadata. */
  beforeSendReply?: (reply: TownMessage, incoming: TownMessage) => Promise<TownMessage>;
}

export interface AgentDeps {
  axl?: AxlClient;
  /** Inject a specific LlmClient. If omitted, one is built from env. */
  llm?: LlmClient;
  /**
   * Optional replay configuration. If omitted, falls back to
   * `replayConfigFromEnv()` so POLIS_MODE/POLIS_REPLAY_TRANSCRIPT
   * environment variables transparently activate record/replay.
   */
  replay?: ReplayConfig;
}

export type { TownMessage };
export { encodeMessage, parseMessage, isTownMessage } from "./message.js";
export {
  createLlmClient,
  AnthropicLlmClient,
  GroqLlmClient,
  ReplayOnlyLlmClient,
  type LlmClient,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
} from "./llm.js";
export {
  wrapWithReplay,
  replayConfigFromEnv,
  ReplayMissError,
  type ReplayConfig,
  type ReplayMode,
} from "./replay.js";

/**
 * Agent runtime — polls AXL `/recv`, asks the LLM whether to reply,
 * and emits replies back over `/send`.
 *
 * Provider-agnostic via LlmClient. Anthropic and Groq are both supported;
 * the runtime auto-detects from env (GROQ_API_KEY beats ANTHROPIC_API_KEY
 * unless POLIS_LLM_PROVIDER overrides).
 */
export class Agent {
  private readonly cfg: AgentConfig;
  private readonly axl: AxlClient;
  private readonly llm: LlmClient;
  private running = false;

  constructor(cfg: AgentConfig, deps: AgentDeps = {}) {
    this.cfg = cfg;
    this.axl = deps.axl ?? new AxlClient();
    const baseLlm = deps.llm ?? createLlmClient();
    const replayCfg = deps.replay ?? replayConfigFromEnv();
    this.llm = wrapWithReplay(baseLlm, replayCfg);
  }

  async start(): Promise<void> {
    this.running = true;
    console.log(
      `[${this.cfg.name}] runtime started as ${this.cfg.role} (llm=${this.llm.provider}/${this.cfg.model ?? this.llm.defaultModel})`,
    );
    while (this.running) {
      const msg = await this.axl.recv();
      if (!msg) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      try {
        await this.handle(msg);
      } catch (err) {
        console.error(`[${this.cfg.name}] handle error:`, err);
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  /** Exposed for tests — drives a single message without a live AXL. */
  async handle(msg: { fromPeerId: string; body: Uint8Array }): Promise<TownMessage | null> {
    const incoming = parseMessage(msg.body);
    if (!incoming) {
      console.log(
        `[${this.cfg.name}] dropped non-TownMessage from ${msg.fromPeerId.slice(0, 8)}…`,
      );
      return null;
    }
    if (incoming.from === this.cfg.peerIdHex) return null;
    if (incoming.kind === "reply") {
      console.log(
        `[${this.cfg.name}] observed reply from ${msg.fromPeerId.slice(0, 8)}…`,
      );
      return null;
    }

    let reply = await this.think(incoming);
    if (!reply) return null;
    if (this.cfg.beforeSendReply) {
      reply = await this.cfg.beforeSendReply(reply, incoming);
    }

    await this.axl.send(msg.fromPeerId, encodeMessage(reply));
    console.log(
      `[${this.cfg.name}] replied to ${msg.fromPeerId.slice(0, 8)}…: ${truncate(reply.content, 80)}`,
    );
    return reply;
  }

  private async think(incoming: TownMessage): Promise<TownMessage | null> {
    const response = await this.llm.complete({
      model: this.cfg.model ?? this.llm.defaultModel,
      maxTokens: this.cfg.maxTokens ?? 400,
      system: systemPrompt(this.cfg),
      userMessage:
        `[topic: ${incoming.topic}] ${incoming.from.slice(0, 8)}… says:\n\n` + incoming.content,
    });
    const text = response.text.trim();
    if (!text || text === "<<IGNORE>>") return null;
    return {
      v: 1,
      kind: "reply",
      topic: incoming.topic,
      from: this.cfg.peerIdHex,
      content: text,
      ts: Date.now(),
    };
  }
}

function systemPrompt(cfg: AgentConfig): string {
  return [
    `You are a ${cfg.role} agent in Polis, an open work town for AI agents.`,
    `Your name is ${cfg.name}. Your persona: ${cfg.persona}`,
    "",
    "Rules:",
    "- Keep replies short (≤ 3 sentences unless asked for more).",
    "- Stay in role. Do not pretend to be the user.",
    "- If the incoming message isn't worth a reply, respond with exactly the token <<IGNORE>>.",
    "- Never give personalised financial, legal, or tax advice.",
    "- Assume your reply will be seen by other agents and may be cited in a published digest.",
  ].join("\n");
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
