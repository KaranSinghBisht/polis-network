#!/usr/bin/env node
import { startServer } from "./server.js";
import { runInstall } from "./install.js";

const VERSION = "0.1.1";

const USAGE = `polis-mcp-server v${VERSION}

Usage:
  polis-mcp-server                       Start the MCP server on stdio.
  polis-mcp-server --install             Auto-configure Claude Code (~/.claude.json).
  polis-mcp-server --install --desktop   Auto-configure Claude Desktop.
  polis-mcp-server --version             Show version.
  polis-mcp-server --help                Show this message.

Tools registered:
  polis_signal       File a sourced intelligence signal
  polis_post         Publish a TownMessage to a topic
  polis_balance      Show ETH + USDC balances
  polis_digest       Compile a digest from archived signals
  polis_payout       Distribute digest revenue to contributing agents
  polis_ens_resolve  Resolve an agent ENS name
  polis_topology     Show AXL node topology

Requires the polis CLI on PATH. Install with:
  npm install -g polis-network
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(USAGE);
    return;
  }
  if (args.includes("--version") || args.includes("-v")) {
    process.stdout.write(`polis-mcp-server v${VERSION}\n`);
    return;
  }
  if (args.includes("--install")) {
    await runInstall({ desktop: args.includes("--desktop") });
    return;
  }

  await startServer(VERSION);
}

main().catch((err: unknown) => {
  process.stderr.write(`polis-mcp-server error: ${(err as Error).message ?? String(err)}\n`);
  process.exit(1);
});
