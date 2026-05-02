import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { AxlClient } from "@polis/axl-client";
import type { PolisConfig } from "./config.js";

const DEFAULT_BOOTSTRAP_PEERS = [
  "tls://34.46.48.224:9001",
  "tls://136.111.135.206:9001",
];

interface AxlNodeConfig {
  PrivateKeyPath: string;
  Peers: string[];
  Listen: string[];
  api_port: number;
  bridge_addr: string;
}

export interface EnsureAxlNodeConfigOptions {
  force?: boolean;
  listen?: string;
}

export function ensureAxlNodeConfig(
  cfg: PolisConfig,
  opts: EnsureAxlNodeConfigOptions = {},
): boolean {
  if (existsSync(cfg.axl.nodeConfigPath) && !opts.force) return false;

  const api = parseAxlApiUrl(cfg.axl.apiUrl);
  const nodeConfig: AxlNodeConfig = {
    PrivateKeyPath: cfg.axl.keyPath,
    Peers: DEFAULT_BOOTSTRAP_PEERS,
    Listen: opts.listen ? [opts.listen] : [],
    api_port: api.port,
    bridge_addr: api.host,
  };

  writeFileSync(cfg.axl.nodeConfigPath, JSON.stringify(nodeConfig, null, 2), {
    mode: 0o600,
  });
  chmodSync(cfg.axl.nodeConfigPath, 0o600);
  return true;
}

export interface StartAxlNodeOptions {
  nodeBin?: string;
  listen?: string;
}

export function startAxlNode(
  cfg: PolisConfig,
  opts: StartAxlNodeOptions = {},
): ChildProcess {
  ensureAxlNodeConfig(cfg, { listen: opts.listen });

  const bin = resolveAxlNodeBinary(opts.nodeBin);
  const args = ["-config", cfg.axl.nodeConfigPath];
  if (opts.listen) args.push("-listen", opts.listen);

  const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(prefixLines("axl", chunk.toString("utf8")));
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(prefixLines("axl", chunk.toString("utf8")));
  });
  return child;
}

export function resolveAxlNodeBinary(explicit?: string): string {
  const candidates = [
    explicit,
    process.env.AXL_NODE_BIN,
    resolve(process.cwd(), "refs/axl/node"),
    resolve(process.cwd(), "../refs/axl/node"),
    resolve(process.cwd(), "../../refs/axl/node"),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const resolved = resolve(candidate);
    if (existsSync(resolved)) return resolved;
  }

  throw new Error(
    "AXL node binary not found. Build gensyn-ai/axl with `git clone https://github.com/gensyn-ai/axl.git refs/axl && make -C refs/axl build`, then run with `AXL_NODE_BIN=/path/to/refs/axl/node polis run`.",
  );
}

export async function waitForAxl(
  client: AxlClient,
  timeoutMs = 20_000,
): Promise<void> {
  const started = Date.now();
  let lastError: unknown;

  while (Date.now() - started < timeoutMs) {
    try {
      await client.topology();
      return;
    } catch (err) {
      lastError = err;
      await sleep(500);
    }
  }

  throw new Error(`AXL API did not become ready: ${String(lastError)}`);
}

export function shortenPeer(peerId: string): string {
  return peerId.length <= 12 ? peerId : `${peerId.slice(0, 8)}…${peerId.slice(-4)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function parseAxlApiUrl(rawUrl: string): { host: string; port: number } {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:") {
    throw new Error(`AXL apiUrl must use http:, got ${rawUrl}`);
  }
  if (!url.port) {
    throw new Error(`AXL apiUrl must include a port, got ${rawUrl}`);
  }
  return { host: url.hostname, port: Number.parseInt(url.port, 10) };
}

function prefixLines(prefix: string, text: string): string {
  return text
    .split(/\r?\n/)
    .map((line, index, lines) =>
      line.length === 0 && index === lines.length - 1 ? "" : `[${prefix}] ${line}`,
    )
    .join("\n");
}
