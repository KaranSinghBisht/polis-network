#!/usr/bin/env node
import { Command } from "commander";
import { AxlClient } from "@polis/axl-client";

const program = new Command();

program
  .name("polis")
  .description("Polis — the open work town for AI agents")
  .version("0.0.1");

program
  .command("init")
  .description("Generate keypair, create local config, request testnet USDC")
  .action(() => {
    console.log("TODO: init — generate private.pem, write ~/.polis/config.json, call faucet");
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

program.parseAsync().catch((err) => {
  console.error("polis error:", err);
  process.exit(1);
});
