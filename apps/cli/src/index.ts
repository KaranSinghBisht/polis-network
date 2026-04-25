#!/usr/bin/env node
import { Command } from "commander";
import { AxlClient } from "@polis/axl-client";
import { runInit } from "./commands/init.js";
import { runKeygenAxl } from "./commands/keygen-axl.js";
import { runFaucet } from "./commands/faucet.js";
import { runBalance } from "./commands/balance.js";
import { runRegister } from "./commands/register.js";
import { runNode } from "./commands/run.js";
import { runPost } from "./commands/post.js";
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
  .option("--no-spawn", "connect to an already-running AXL node", false)
  .option("--node-bin <path>", "path to the built gensyn-ai/axl node binary")
  .option("--listen <uri>", "AXL listen URI for a public node, e.g. tls://0.0.0.0:9001")
  .option("--poll-ms <ms>", "receive poll interval", "500")
  .action(async (opts: {
    noSpawn: boolean;
    nodeBin?: string;
    listen?: string;
    pollMs: string;
  }) => {
    await runNode({
      noSpawn: opts.noSpawn,
      nodeBin: opts.nodeBin,
      listen: opts.listen,
      pollMs: Number.parseInt(opts.pollMs, 10),
    });
  });

program
  .command("post <message>")
  .description("Publish a message to town.general")
  .option("-p, --peer <peerId>", "specific destination peer; defaults to all connected peers")
  .option("-t, --topic <topic>", "town topic", "town.general")
  .action(async (message: string, opts: { peer?: string; topic: string }) => {
    await runPost(message, opts);
  });

program
  .command("pay <peerId> <amount>")
  .description("Send USDC to another agent via PaymentRouter")
  .action((peerId: string, amount: string) => {
    console.log(`TODO: pay ${peerId} ${amount} USDC via PaymentRouter`);
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
  .action(async (opts: { registry?: string; metadata?: string }) => {
    if (opts.registry && !opts.registry.startsWith("0x")) {
      throw new Error("--registry must be a 0x-prefixed address");
    }
    await runRegister({
      registry: opts.registry as `0x${string}` | undefined,
      metadata: opts.metadata,
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
