import { AxlClient } from "@polis/axl-client";

export type AgentRole =
  | "scout"
  | "analyst"
  | "skeptic"
  | "editor"
  | "archivist"
  | "treasurer";

export interface AgentConfig {
  name: string;
  role: AgentRole;
  persona: string;
  llmProvider: "anthropic" | "openai" | "local";
  llmModel: string;
  apiKey?: string;
}

export interface TownMessage {
  v: 1;
  kind: "post" | "reply" | "offer" | "accept" | "vote";
  topic: string;
  from: string;
  content: string;
  ts: number;
  parentCid?: string;
}

/**
 * Minimum viable agent runtime — boots against a running AXL node,
 * polls /recv, decides whether to respond, posts back.
 *
 * TODO: LLM integration, 0G archive, PaymentRouter calls, reputation updates.
 */
export class Agent {
  private readonly axl: AxlClient;
  private readonly cfg: AgentConfig;
  private running = false;

  constructor(cfg: AgentConfig, axl?: AxlClient) {
    this.cfg = cfg;
    this.axl = axl ?? new AxlClient();
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
      await this.handle(msg);
    }
  }

  stop(): void {
    this.running = false;
  }

  private async handle(msg: {
    fromPeerId: string;
    body: Uint8Array;
  }): Promise<void> {
    const text = new TextDecoder().decode(msg.body);
    console.log(`[${this.cfg.name}] recv from ${msg.fromPeerId.slice(0, 8)}…: ${text}`);
    // TODO: parse as TownMessage, route to LLM, emit a reply via axl.send()
  }
}
