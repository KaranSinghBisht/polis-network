import { AxlClient } from "@polis/axl-client";
import { Agent, type AgentRole, type TownMessage } from "@polis/runtime";
import { putJson, type StorageProvider } from "@polis/storage";
import { readConfig } from "../config.js";
import {
  shortenPeer,
  sleep,
  startAxlNode,
  waitForAxl,
  type StartAxlNodeOptions,
} from "../axl-node.js";
import { parseMessage } from "@polis/runtime";

export interface RunOptions extends StartAxlNodeOptions {
  noSpawn: boolean;
  pollMs: number;
  agent?: AgentRole;
  name?: string;
  persona?: string;
  model?: string;
  maxTokens?: number;
  storage?: StorageProvider;
}

export async function runNode(opts: RunOptions): Promise<void> {
  if (!Number.isFinite(opts.pollMs) || opts.pollMs < 100) {
    throw new Error("--poll-ms must be a number >= 100");
  }
  if (
    opts.agent &&
    process.env.POLIS_MODE !== "replay" &&
    !process.env.GROQ_API_KEY &&
    !process.env.ANTHROPIC_API_KEY
  ) {
    throw new Error(
      "--agent requires GROQ_API_KEY or ANTHROPIC_API_KEY unless POLIS_MODE=replay (see .env.example)",
    );
  }

  const cfg = readConfig();
  const client = new AxlClient({ baseUrl: cfg.axl.apiUrl });
  const child = opts.noSpawn ? null : startAxlNode(cfg, opts);
  let onChildError: ((err: Error) => void) | undefined;
  let onChildExit: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;
  const childFailure = child
    ? new Promise<never>((_, reject) => {
        onChildError = (err) => reject(err);
        onChildExit = (code, signal) => {
          reject(
            new Error(
              `AXL node exited before ready (code=${code ?? "null"} signal=${signal ?? "null"})`,
            ),
          );
        };
        child.once("error", onChildError);
        child.once("exit", onChildExit);
      })
    : undefined;

  const shutdown = (): void => {
    if (child && !child.killed) child.kill("SIGTERM");
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await (childFailure ? Promise.race([waitForAxl(client), childFailure]) : waitForAxl(client));
  if (child && onChildError && onChildExit) {
    child.off("error", onChildError);
    child.off("exit", onChildExit);
    child.once("exit", (code, signal) => {
      console.error(`AXL node exited (code=${code ?? "null"} signal=${signal ?? "null"})`);
      process.exit(code ?? 1);
    });
  }
  const topology = await client.topology();
  console.log(`polis node ready: ${shortenPeer(topology.our_public_key)}`);
  console.log(`AXL API: ${cfg.axl.apiUrl}`);

  if (opts.agent) {
    const agent = new Agent(
      {
        name: opts.name ?? `${opts.agent}-${shortenPeer(topology.our_public_key)}`,
        role: opts.agent,
        persona: opts.persona ?? defaultPersona(opts.agent),
        peerIdHex: topology.our_public_key,
        model: opts.model,
        maxTokens: opts.maxTokens,
        beforeSendReply: async (reply) => archiveReply(reply, opts.storage),
      },
      { axl: client },
    );
    console.log(`agent mode: ${opts.agent}`);
    console.log("LLM replies are enabled. Ctrl-C to stop.");
    await agent.start();
    return;
  }

  console.log("listening for TownMessage v1 packets. Ctrl-C to stop.");

  for (;;) {
    const msg = await client.recv();
    if (!msg) {
      await sleep(opts.pollMs);
      continue;
    }

    const town = parseMessage(msg.body);
    if (town) {
      const archive = town.archiveUri ? ` archive=${town.archiveUri}` : "";
      console.log(
        `[${town.topic}] ${town.kind} from ${shortenPeer(town.from)}: ${town.content}${archive}`,
      );
    } else {
      console.log(
        `[raw] ${msg.body.byteLength} bytes from ${shortenPeer(msg.fromPeerId)}`,
      );
    }
  }
}

async function archiveReply(
  reply: TownMessage,
  explicitStorage?: StorageProvider,
): Promise<TownMessage> {
  const cfg = readConfig();
  const storageProvider = explicitStorage ?? cfg.storage?.provider ?? "local";
  const archive = await putJson(reply, {
    provider: storageProvider,
    archiveDir: cfg.storage?.archiveDir ?? `${process.env.HOME ?? "."}/.polis/archive`,
    zeroG: {
      rpcUrl: cfg.storage?.zeroGRpcUrl ?? process.env.ZERO_G_RPC ?? "",
      indexerRpcUrl: cfg.storage?.zeroGIndexerRpcUrl ?? process.env.ZERO_G_INDEXER_RPC ?? "",
      privateKey: process.env.ZERO_G_PRIVATE_KEY ?? cfg.privateKey,
    },
  });
  if (!archive) return reply;
  console.log(`archived reply: ${archive.uri}${archive.txHash ? ` tx=${archive.txHash}` : ""}`);
  return {
    ...reply,
    archiveUri: archive.uri,
    archiveTxHash: archive.txHash,
  };
}

function defaultPersona(role: AgentRole): string {
  switch (role) {
    case "scout":
      return "You find useful raw signals and summarize why they may matter.";
    case "analyst":
      return "You turn raw signals into concise implications, tradeoffs, and next actions.";
    case "skeptic":
      return "You attack weak claims, missing evidence, and hallucinated assumptions.";
    case "editor":
      return "You decide what is worth publishing and ask for sharper evidence.";
    case "archivist":
      return "You preserve provenance, source trails, and archive quality.";
    case "treasurer":
      return "You care about budgets, payments, fees, and sustainable incentives.";
  }
}
