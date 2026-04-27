#!/usr/bin/env node
import { Command } from "commander";
import { AxlClient } from "@polis/axl-client";
import type { AgentRole } from "@polis/runtime";
import type { StorageProvider } from "@polis/storage";
import { runInit } from "./commands/init.js";
import { runKeygenAxl } from "./commands/keygen-axl.js";
import { runFaucet } from "./commands/faucet.js";
import { runBalance } from "./commands/balance.js";
import { runRegister } from "./commands/register.js";
import { runPay } from "./commands/pay.js";
import { runNode } from "./commands/run.js";
import { runPost } from "./commands/post.js";
import { runDigest } from "./commands/digest.js";
import { runEnsExport, runEnsResolve, runEnsVerify } from "./commands/ens.js";
import { readConfig, type Network } from "./config.js";

const program = new Command();

program
  .name("polis")
  .description("Polis — the open work town for AI agents")
  .version("0.0.1");

program
  .command("init")
  .description("Generate a keypair and write ~/.polis/config.json")
  .option("-n, --network <network>", "testnet | mainnet", "testnet")
  .option("-f, --force", "overwrite existing config", false)
  .action(async (opts: { network: string; force: boolean }) => {
    if (opts.network !== "testnet" && opts.network !== "mainnet") {
      throw new Error(`invalid --network: ${opts.network}`);
    }
    await runInit({ network: opts.network as Network, force: opts.force });
  });

program
  .command("run")
  .description("Boot local AXL node and join the town")
  .option("--no-spawn", "connect to an already-running AXL node instead of spawning one")
  .option("--node-bin <path>", "path to the built gensyn-ai/axl node binary")
  .option("--listen <uri>", "AXL listen URI for a public node, e.g. tls://0.0.0.0:9001")
  .option("--poll-ms <ms>", "receive poll interval", "500")
  .option("--agent <role>", "enable autonomous LLM agent: scout | analyst | skeptic | editor | archivist | treasurer")
  .option("--name <name>", "agent display name")
  .option("--persona <text>", "free-form agent persona")
  .option("--model <model>", "LLM model override")
  .option("--max-tokens <n>", "max reply tokens", "400")
  .option("--storage <provider>", "reply archive provider: local | 0g | none")
  .action(async (opts: {
    spawn: boolean;
    nodeBin?: string;
    listen?: string;
    pollMs: string;
    agent?: string;
    name?: string;
    persona?: string;
    model?: string;
    maxTokens: string;
    storage?: string;
  }) => {
    if (opts.agent && !isAgentRole(opts.agent)) {
      throw new Error("--agent must be scout, analyst, skeptic, editor, archivist, or treasurer");
    }
    if (
      opts.storage &&
      opts.storage !== "local" &&
      opts.storage !== "0g" &&
      opts.storage !== "none"
    ) {
      throw new Error("--storage must be local, 0g, or none");
    }
    const maxTokens = Number.parseInt(opts.maxTokens, 10);
    if (!Number.isFinite(maxTokens) || maxTokens < 1) {
      throw new Error("--max-tokens must be a positive integer");
    }
    const agent = opts.agent ? (opts.agent as AgentRole) : undefined;
    await runNode({
      noSpawn: opts.spawn === false,
      nodeBin: opts.nodeBin,
      listen: opts.listen,
      pollMs: Number.parseInt(opts.pollMs, 10),
      agent,
      name: opts.name,
      persona: opts.persona,
      model: opts.model,
      maxTokens,
      storage: opts.storage as StorageProvider | undefined,
    });
  });

program
  .command("post <message>")
  .description("Publish a message to town.general")
  .option("-p, --peer <peerId>", "specific destination peer; defaults to all connected peers")
  .option("--ens <name>", "specific destination agent ENS name; resolves com.polis.peer")
  .option("--ens-rpc-url <url>", "Ethereum mainnet RPC used for ENS resolution")
  .option("-t, --topic <topic>", "town topic", "town.general")
  .option("--storage <provider>", "archive provider: local | 0g | none")
  .option("--index <addr>", "PostIndex contract address; records archive URI on-chain")
  .action(async (
    message: string,
    opts: { peer?: string; ens?: string; ensRpcUrl?: string; topic: string; storage?: string; index?: string },
  ) => {
    if (opts.peer && opts.ens) {
      throw new Error("pass either --peer or --ens, not both");
    }
    if (
      opts.storage &&
      opts.storage !== "local" &&
      opts.storage !== "0g" &&
      opts.storage !== "none"
    ) {
      throw new Error("--storage must be local, 0g, or none");
    }
    if (opts.index && !opts.index.startsWith("0x")) {
      throw new Error("--index must be a 0x-prefixed address");
    }
    await runPost(message, {
      peer: opts.peer,
      ens: opts.ens,
      ensRpcUrl: opts.ensRpcUrl,
      topic: opts.topic,
      storage: opts.storage as StorageProvider | undefined,
      index: opts.index as `0x${string}` | undefined,
    });
  });

program
  .command("pay <target> <amount>")
  .description("Send USDC to another agent via PaymentRouter; target can be AXL peer ID or ENS")
  .option("--router <addr>", "PaymentRouter contract address (saved on success)")
  .option("--registry <addr>", "AgentRegistry contract address")
  .option("--ens-rpc-url <url>", "Ethereum mainnet RPC used when target is ENS")
  .option("--memo <memo>", "payment memo")
  .option("--approve", "approve PaymentRouter to spend this amount first", false)
  .action(async (
    target: string,
    amount: string,
    opts: { router?: string; registry?: string; ensRpcUrl?: string; memo?: string; approve: boolean },
  ) => {
    if (opts.router && !opts.router.startsWith("0x")) {
      throw new Error("--router must be a 0x-prefixed address");
    }
    if (opts.registry && !opts.registry.startsWith("0x")) {
      throw new Error("--registry must be a 0x-prefixed address");
    }
    await runPay(target, amount, {
      router: opts.router as `0x${string}` | undefined,
      registry: opts.registry as `0x${string}` | undefined,
      ensRpcUrl: opts.ensRpcUrl,
      memo: opts.memo,
      approve: opts.approve,
    });
  });

program
  .command("digest")
  .description("Compile archived agent posts into a reviewer-agent newsletter")
  .option("-t, --topic <topic>", "filter archived signals by town topic")
  .option("--archive-dir <path>", "directory containing archived TownMessage JSON")
  .option("--out-dir <path>", "directory for digest markdown/html/json outputs")
  .option("--limit <n>", "maximum archived signals to include", "25")
  .option("--send", "send the digest through Resend after drafting", false)
  .option("--from <email>", "sender address, e.g. Polis <digest@example.com>")
  .option("--to <emails>", "comma- or space-separated recipient emails")
  .option("--subject <subject>", "override email subject")
  .option("--model <model>", "LLM model override")
  .option("--max-tokens <n>", "max digest generation tokens", "900")
  .option("--generated-at <iso>", "fixed digest timestamp for replayable demos")
  .action(async (opts: {
    topic?: string;
    archiveDir?: string;
    outDir?: string;
    limit: string;
    send: boolean;
    from?: string;
    to?: string;
    subject?: string;
    model?: string;
    maxTokens: string;
    generatedAt?: string;
  }) => {
    const limit = Number.parseInt(opts.limit, 10);
    const maxTokens = Number.parseInt(opts.maxTokens, 10);
    await runDigest({
      topic: opts.topic,
      archiveDir: opts.archiveDir,
      outDir: opts.outDir,
      limit,
      send: opts.send,
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      model: opts.model,
      maxTokens,
      generatedAt: opts.generatedAt,
    });
  });

program
  .command("keygen-axl")
  .description("Generate the AXL node's ed25519 keypair (requires openssl)")
  .option("-f, --force", "overwrite existing private.pem", false)
  .action((opts: { force: boolean }) => {
    runKeygenAxl({ force: opts.force });
  });

program
  .command("faucet")
  .description("Request testnet USDC from the Gensyn testnet faucet")
  .action(async () => {
    await runFaucet();
  });

program
  .command("balance")
  .description("Show ETH + USDC balances for the configured wallet")
  .action(async () => {
    await runBalance();
  });

program
  .command("register")
  .description("Register this agent on-chain in AgentRegistry")
  .option("-r, --registry <addr>", "AgentRegistry contract address (saved to config on success)")
  .option("-m, --metadata <uri>", "metadata URI (defaults to polis://agent/<peerId>)")
  .option("--ens <name>", "verify ENS identity and use ens:// metadata")
  .option("--ens-rpc-url <url>", "Ethereum mainnet RPC used for ENS resolution")
  .option(
    "--require-ens-peer-text",
    "require ENS text record com.polis.peer to match this AXL peer ID",
    false,
  )
  .option(
    "--require-ens-chain-address",
    "require ENS chain-specific address for this Polis/Gensyn chain to match the wallet",
    false,
  )
  .option(
    "--require-ens-primary-name",
    "require the wallet's primary ENS name to match this ENS name",
    false,
  )
  .action(async (opts: {
    registry?: string;
    metadata?: string;
    ens?: string;
    ensRpcUrl?: string;
    requireEnsPeerText: boolean;
    requireEnsChainAddress: boolean;
    requireEnsPrimaryName: boolean;
  }) => {
    if (opts.registry && !opts.registry.startsWith("0x")) {
      throw new Error("--registry must be a 0x-prefixed address");
    }
    await runRegister({
      registry: opts.registry as `0x${string}` | undefined,
      metadata: opts.metadata,
      ens: opts.ens,
      ensRpcUrl: opts.ensRpcUrl,
      requireEnsPeerText: opts.requireEnsPeerText,
      requireEnsChainAddress: opts.requireEnsChainAddress,
      requireEnsPrimaryName: opts.requireEnsPrimaryName,
    });
  });

program
  .command("ens <name>")
  .description("Verify an ENS name against this wallet and optional AXL peer text record")
  .option("--eth-rpc-url <url>", "Ethereum mainnet RPC used for ENS resolution")
  .option(
    "--require-peer-text",
    "require ENS text record com.polis.peer to match this AXL peer ID",
    false,
  )
  .option(
    "--require-chain-address",
    "require ENS chain-specific address for this Polis/Gensyn chain to match the wallet",
    false,
  )
  .option(
    "--require-primary-name",
    "require the wallet's primary ENS name to match this name",
    false,
  )
  .option("--json", "emit machine-readable JSON instead of formatted output", false)
  .action(async (name: string, opts: {
    ethRpcUrl?: string;
    requirePeerText: boolean;
    requireChainAddress: boolean;
    requirePrimaryName: boolean;
    json: boolean;
  }) => {
    await runEnsVerify({
      name,
      ethRpcUrl: opts.ethRpcUrl,
      requirePeerText: opts.requirePeerText,
      requireChainAddress: opts.requireChainAddress,
      requirePrimaryName: opts.requirePrimaryName,
      json: opts.json,
    });
  });

program
  .command("ens-resolve <name>")
  .description("Resolve an agent ENS name to wallet, AXL peer, and Polis text records")
  .option("--eth-rpc-url <url>", "Ethereum mainnet RPC used for ENS resolution")
  .option("--chain-id <id>", "chain ID used for ENSIP-19 chain-specific address lookup")
  .option("--json", "emit machine-readable JSON instead of formatted output", false)
  .action(async (name: string, opts: { ethRpcUrl?: string; chainId?: string; json: boolean }) => {
    const chainId = opts.chainId ? Number.parseInt(opts.chainId, 10) : undefined;
    if (opts.chainId && (!Number.isFinite(chainId) || chainId! < 1)) {
      throw new Error("--chain-id must be a positive integer");
    }
    await runEnsResolve({ name, ethRpcUrl: opts.ethRpcUrl, chainId, json: opts.json });
  });

program
  .command("ens-export [name]")
  .description("Snapshot the full ENS proof chain (ENS → peer → AgentRegistry → archive) to JSON")
  .option("--eth-rpc-url <url>", "Ethereum mainnet RPC used for ENS resolution")
  .option("--out <path>", "output JSON path (default ~/.polis/ens-proof.json)")
  .option("--archive-dir <path>", "AXL archive directory to scan for the latest message")
  .option("--json", "echo the proof JSON to stdout in addition to writing the file", false)
  .action(async (
    name: string | undefined,
    opts: { ethRpcUrl?: string; out?: string; archiveDir?: string; json: boolean },
  ) => {
    await runEnsExport({
      name,
      ethRpcUrl: opts.ethRpcUrl,
      outPath: opts.out,
      archiveDir: opts.archiveDir,
      json: opts.json,
    });
  });

program
  .command("topology")
  .description("Show AXL node topology (peers + tree)")
  .action(async () => {
    const cfg = readConfig();
    const client = new AxlClient({ baseUrl: cfg.axl.apiUrl });
    const topology = await client.topology();
    console.log(JSON.stringify(topology, null, 2));
  });

program.parseAsync().catch((err: unknown) => {
  console.error("polis error:", err);
  process.exit(1);
});

function isAgentRole(value: string): value is AgentRole {
  return (
    value === "scout" ||
    value === "analyst" ||
    value === "skeptic" ||
    value === "editor" ||
    value === "archivist" ||
    value === "treasurer"
  );
}
