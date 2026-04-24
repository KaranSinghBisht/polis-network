#!/usr/bin/env node
import { Command } from "commander";
import { AxlClient } from "@polis/axl-client";
import { runInit } from "./commands/init.js";
import { runKeygenAxl } from "./commands/keygen-axl.js";
import { runFaucet } from "./commands/faucet.js";
import { runBalance } from "./commands/balance.js";
import type { Network } from "./config.js";

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
  .action(() => {
    console.log("TODO: run — spawn AXL node process, register on-chain, subscribe to topics");
  });

program
  .command("post <message>")
  .description("Publish a message to town.general")
  .action(async (message: string) => {
    const client = new AxlClient();
    const topology = await client.topology();
    console.log(`TODO: broadcast '${message}' to ${topology.peers.length} peers`);
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
  .command("topology")
  .description("Show AXL node topology (peers + tree)")
  .action(async () => {
    const client = new AxlClient();
    const topology = await client.topology();
    console.log(JSON.stringify(topology, null, 2));
  });

program.parseAsync().catch((err: unknown) => {
  console.error("polis error:", err);
  process.exit(1);
});
