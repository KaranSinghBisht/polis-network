import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

export const CONFIG_VERSION = 1;

export type Network = "testnet" | "mainnet";

export interface PolisConfig {
  version: number;
  network: Network;
  privateKey: `0x${string}`;
  address: `0x${string}`;
  chainId: number;
  rpcUrl: string;
  usdc: `0x${string}`;
  /** AgentRegistry deployment address (written by `polis register`). */
  registryAddress?: `0x${string}`;
  /** PaymentRouter deployment address (written by future deploy/pay flows). */
  paymentRouterAddress?: `0x${string}`;
  /** PostIndex deployment address for on-chain archive provenance events. */
  postIndexAddress?: `0x${string}`;
  /** Optional ENS identity verified against the configured wallet. */
  ens?: {
    name: string;
    ethRpcUrl: string;
    resolvedAddress: `0x${string}`;
    peerText?: string;
    agentText?: string;
    avatar?: string;
    description?: string;
    url?: string;
    verifiedAt: string;
  };
  axl: {
    keyPath: string;
    nodeConfigPath: string;
    apiUrl: string;
  };
  storage?: {
    provider: "local" | "0g" | "none";
    archiveDir: string;
    zeroGRpcUrl?: string;
    zeroGIndexerRpcUrl?: string;
  };
}

export const NETWORKS: Record<Network, {
  chainId: number;
  rpcUrl: string;
  usdc: `0x${string}`;
  faucet?: `0x${string}`;
}> = {
  testnet: {
    chainId: 685685,
    rpcUrl: "https://gensyn-testnet.g.alchemy.com/public",
    usdc: "0x0724D6079b986F8e44bDafB8a09B60C0bd6A45a1",
    faucet: "0xB5876320DdA1AEE3eFC03aD02dC2e2CB4b61B7D9",
  },
  mainnet: {
    chainId: 685689,
    rpcUrl: "https://gensyn-mainnet.g.alchemy.com/public",
    usdc: "0x5b32c997211621d55a89Cc5abAF1cC21F3A6ddF5",
  },
};

export function polisDir(): string {
  return join(homedir(), ".polis");
}

export function configPath(): string {
  return join(polisDir(), "config.json");
}

export function ensurePolisDir(): string {
  const dir = polisDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export function defaultArchiveDir(): string {
  return join(polisDir(), "archive");
}

export function configExists(): boolean {
  return existsSync(configPath());
}

export function readConfig(): PolisConfig {
  const raw = readFileSync(configPath(), "utf8");
  const parsed = JSON.parse(raw) as PolisConfig;
  if (parsed.version !== CONFIG_VERSION) {
    throw new Error(
      `unsupported polis config version ${parsed.version}; expected ${CONFIG_VERSION}`,
    );
  }
  return parsed;
}

export function writeConfig(cfg: PolisConfig): void {
  ensurePolisDir();
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2), { mode: 0o600 });
}
