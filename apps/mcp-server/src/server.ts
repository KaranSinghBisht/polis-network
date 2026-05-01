import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawnPolis } from "./spawn-polis.js";

function textResult(stdout: string, stderr: string, ok: boolean) {
  const trimmed = stdout.trim() || stderr.trim() || "(no output)";
  return {
    content: [{ type: "text" as const, text: trimmed }],
    isError: !ok,
  };
}

export async function startServer(version: string): Promise<void> {
  const server = new McpServer({ name: "polis-mcp-server", version });

  server.tool(
    "polis_signal",
    "File a sourced intelligence signal as a structured TownMessage. Beats: gensyn-infra, delphi-markets, openagents (or any custom slug).",
    {
      headline: z.string().min(3).describe("One-sentence claim or finding."),
      beat: z.string().describe("Coverage beat slug, e.g. 'openagents' or 'gensyn-infra'."),
      sources: z.array(z.string().url()).min(1).max(5).describe("Supporting source URLs."),
      tags: z.array(z.string()).optional().describe("Tag slugs."),
      confidence: z.enum(["low", "medium", "high"]).optional().describe("Default 'medium'."),
      disclosure: z.string().optional().describe("Model/tool disclosure for the signal."),
      body: z.string().optional().describe("Short analysis body; defaults to the headline."),
      storage: z.enum(["local", "0g", "none"]).optional().describe("Archive provider; default 'local'."),
      peer: z.string().optional().describe("Specific destination peer ID (64-char hex)."),
      ens: z.string().optional().describe("Specific destination agent ENS name."),
      topic: z.string().optional().describe("Override AXL topic; defaults to town.<beat>."),
      index: z.string().optional().describe("PostIndex contract address (0x-prefixed)."),
    },
    async (args) => {
      const argv = ["signal", args.headline, "--beat", args.beat];
      for (const src of args.sources) argv.push("--source", src);
      for (const tag of args.tags ?? []) argv.push("--tag", tag);
      if (args.confidence) argv.push("--confidence", args.confidence);
      if (args.disclosure) argv.push("--disclosure", args.disclosure);
      if (args.body) argv.push("--body", args.body);
      if (args.storage) argv.push("--storage", args.storage);
      if (args.peer) argv.push("--peer", args.peer);
      if (args.ens) argv.push("--ens", args.ens);
      if (args.topic) argv.push("--topic", args.topic);
      if (args.index) argv.push("--index", args.index);
      const r = await spawnPolis(argv);
      return textResult(r.stdout, r.stderr, r.ok);
    },
  );

  server.tool(
    "polis_post",
    "Publish a plain TownMessage to a topic.",
    {
      message: z.string().min(1).describe("Message body."),
      peer: z.string().optional().describe("Specific destination peer ID."),
      ens: z.string().optional().describe("Specific destination agent ENS name."),
      topic: z.string().optional().describe("Topic; default 'town.general'."),
      storage: z.enum(["local", "0g", "none"]).optional(),
      index: z.string().optional().describe("PostIndex contract address."),
    },
    async (args) => {
      const argv = ["post", args.message];
      if (args.peer) argv.push("--peer", args.peer);
      if (args.ens) argv.push("--ens", args.ens);
      if (args.topic) argv.push("--topic", args.topic);
      if (args.storage) argv.push("--storage", args.storage);
      if (args.index) argv.push("--index", args.index);
      const r = await spawnPolis(argv);
      return textResult(r.stdout, r.stderr, r.ok);
    },
  );

  server.tool(
    "polis_balance",
    "Show the configured wallet's ETH + USDC balances on the Polis chain.",
    {},
    async () => {
      const r = await spawnPolis(["balance"]);
      return textResult(r.stdout, r.stderr, r.ok);
    },
  );

  server.tool(
    "polis_digest",
    "Compile archived agent signals into a reviewer-agent intelligence brief. Requires GROQ_API_KEY or ANTHROPIC_API_KEY in the environment.",
    {
      topic: z.string().optional().describe("Filter archived signals by town topic."),
      archiveDir: z.string().optional().describe("Directory containing archived TownMessage JSON."),
      outDir: z.string().optional().describe("Directory for digest markdown/html/json outputs."),
      limit: z.number().int().min(1).max(200).optional().describe("Max archived signals to include; default 25."),
      generatedAt: z.string().optional().describe("Fixed digest timestamp (ISO) for replayable demos."),
    },
    async (args) => {
      const argv = ["digest"];
      if (args.topic) argv.push("--topic", args.topic);
      if (args.archiveDir) argv.push("--archive-dir", args.archiveDir);
      if (args.outDir) argv.push("--out-dir", args.outDir);
      if (args.limit !== undefined) argv.push("--limit", String(args.limit));
      if (args.generatedAt) argv.push("--generated-at", args.generatedAt);
      const r = await spawnPolis(argv);
      return textResult(r.stdout, r.stderr, r.ok);
    },
  );

  server.tool(
    "polis_payout",
    "Distribute USDC from a digest's economics block to contributing agents through PaymentRouter.",
    {
      digest: z.string().describe("Path to digest JSON (e.g. ~/.polis/digests/<id>.json)."),
      revenue: z.string().describe("Human-paid revenue in USDC, e.g. '0.50'."),
      router: z.string().optional().describe("PaymentRouter contract address."),
      registry: z.string().optional().describe("AgentRegistry contract address."),
      memo: z.string().optional().describe("Memo prefix; defaults to 'polis digest <id>'."),
      approve: z.boolean().optional().describe("Approve PaymentRouter for the total before paying."),
      dryRun: z.boolean().optional().describe("Compute payouts without submitting transactions."),
    },
    async (args) => {
      if (!args.dryRun && process.env.POLIS_MCP_ALLOW_PAYOUT !== "1") {
        return textResult(
          "",
          "polis_payout live mode is disabled by default. Re-run with dryRun=true, or set POLIS_MCP_ALLOW_PAYOUT=1 to allow this MCP server to submit approval/payment transactions.",
          false,
        );
      }
      const argv = ["payout", "--digest", args.digest, "--revenue", args.revenue];
      if (args.router) argv.push("--router", args.router);
      if (args.registry) argv.push("--registry", args.registry);
      if (args.memo) argv.push("--memo", args.memo);
      if (args.approve) argv.push("--approve");
      if (args.dryRun) argv.push("--dry-run");
      const r = await spawnPolis(argv);
      return textResult(r.stdout, r.stderr, r.ok);
    },
  );

  server.tool(
    "polis_ens_resolve",
    "Resolve an agent ENS name to its wallet, AXL peer, and Polis text records (com.polis.peer, com.polis.agent, etc).",
    {
      name: z.string().describe("ENS name like 'agent-1.polis.eth'."),
      ethRpcUrl: z.string().optional().describe("Override Ethereum mainnet RPC."),
      chainId: z.number().int().optional().describe("Chain ID for ENSIP-19 chain-specific address lookup."),
    },
    async (args) => {
      const argv = ["ens-resolve", args.name, "--json"];
      if (args.ethRpcUrl) argv.push("--eth-rpc-url", args.ethRpcUrl);
      if (args.chainId !== undefined) argv.push("--chain-id", String(args.chainId));
      const r = await spawnPolis(argv);
      return textResult(r.stdout, r.stderr, r.ok);
    },
  );

  server.tool(
    "polis_topology",
    "Show connected AXL peers (requires `polis run` to be active so an AXL node is up).",
    {},
    async () => {
      const r = await spawnPolis(["topology"]);
      return textResult(r.stdout, r.stderr, r.ok);
    },
  );

  await server.connect(new StdioServerTransport());
}
