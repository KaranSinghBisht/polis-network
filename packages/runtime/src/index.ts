import Anthropic from "@anthropic-ai/sdk";
import { AxlClient } from "@polis/axl-client";
import { encodeMessage, parseMessage, type TownMessage } from "./message.js";

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
  /** Haiku by default; Opus only for Editor agents. */
  model?: string;
  /** Hard cap on reply length to keep costs bounded. */
  maxTokens?: number;
  /** Called before a reply is sent so callers can attach archive/provenance metadata. */
  beforeSendReply?: (reply: TownMessage, incoming: TownMessage) => Promise<TownMessage>;
}

export interface AgentDeps {
  axl?: AxlClient;
  anthropic?: Anthropic;
}

export type { TownMessage };

/**
 * Agent runtime — polls AXL `/recv`, asks Claude whether to reply,
 * and emits replies back over `/send`.
 *
 * System prompt is cached ephemerally so the persona + role block hits
 * the cache on every subsequent call (~5 min TTL). Practically this
 * means the 200-400 token persona only gets fully billed once per
 * cache window regardless of how many messages the agent handles.
 */
export class Agent {
  private readonly cfg: AgentConfig;
  private readonly axl: AxlClient;
  private readonly anthropic: Anthropic;
  private running = false;

  constructor(cfg: AgentConfig, deps: AgentDeps = {}) {
    this.cfg = cfg;
    this.axl = deps.axl ?? new AxlClient();
    this.anthropic = deps.anthropic ?? new Anthropic();
  }

  async start(): Promise<void> {
    this.running = true;
    console.log(`[${this.cfg.name}] runtime started as ${this.cfg.role}`);
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

  /** Exposed for tests — lets callers drive a single message without a live AXL. */
  async handle(msg: {
    fromPeerId: string;
    body: Uint8Array;
  }): Promise<TownMessage | null> {
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
    const response = await this.anthropic.messages.create({
      model: this.cfg.model ?? "claude-haiku-4-5-20251001",
      max_tokens: this.cfg.maxTokens ?? 400,
      system: [
        {
          type: "text",
          text: systemPrompt(this.cfg),
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content:
            `[topic: ${incoming.topic}] ${incoming.from.slice(0, 8)}… says:\n\n` +
            incoming.content,
        },
      ],
    });

    const text = extractText(response);
    if (!text) return null;

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

function extractText(
  response: Anthropic.Message,
): string | null {
  const block = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!block) return null;
  const text = block.text.trim();
  if (!text || text === "<<IGNORE>>") return null;
  return text;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
