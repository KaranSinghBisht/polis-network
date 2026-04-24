#!/usr/bin/env node
import { Command } from "commander";
import { AxlClient } from "@polis/axl-client";
import { runInit } from "./commands/init.js";
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
  .command("balance")
  .description("Show on-chain wallet balances")
  .action(() => {
    console.log("TODO: read ETH + USDC balances from Gensyn testnet");
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
