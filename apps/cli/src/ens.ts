import { createPublicClient, getAddress, http, isAddress, toCoinType } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import type { PolisConfig } from "./config.js";
import { derivePeerId } from "./peer.js";

export const DEFAULT_ENS_RPC_URL =
  process.env.ENS_RPC_URL ?? "https://ethereum.publicnode.com";

export const POLIS_PEER_TEXT_KEY = "com.polis.peer";
export const POLIS_AGENT_TEXT_KEY = "com.polis.agent";
export const POLIS_TOPICS_TEXT_KEY = "com.polis.topics";
export const POLIS_REGISTRY_TEXT_KEY = "com.polis.registry";

type EnsClient = {
  getEnsAddress(args: { name: string; coinType?: bigint }): Promise<`0x${string}` | null>;
  getEnsName(args: { address: `0x${string}`; coinType?: bigint }): Promise<string | null>;
  getEnsText(args: { name: string; key: string }): Promise<string | null>;
};

export interface EnsVerification {
  name: string;
  ethRpcUrl: string;
  resolvedAddress: `0x${string}`;
  chainAddress?: `0x${string}`;
  chainId?: number;
  coinType?: string;
  primaryName?: string;
  peerText?: string;
  agentText?: string;
  topicsText?: string;
  registryText?: string;
  avatar?: string;
  description?: string;
  url?: string;
  verifiedAt: string;
}

export interface VerifyEnsOptions {
  name: string;
  ethRpcUrl?: string;
  chainId?: number;
  requirePeerText?: boolean;
  requireChainAddress?: boolean;
  requirePrimaryName?: boolean;
}

export interface ResolveEnsOptions {
  name: string;
  ethRpcUrl?: string;
  chainId?: number;
}

export async function verifyEnsIdentity(
  cfg: PolisConfig,
  opts: VerifyEnsOptions,
): Promise<EnsVerification> {
  const resolution = await resolveEnsAgent({
    name: opts.name,
    ethRpcUrl: opts.ethRpcUrl,
    chainId: opts.chainId ?? cfg.chainId,
  });

  assertSameAddress(resolution.resolvedAddress, cfg.address, resolution.name);
  if (resolution.chainAddress) {
    assertSameAddress(resolution.chainAddress, cfg.address, resolution.name);
  }
  if (opts.requireChainAddress && !resolution.chainAddress) {
    throw new Error(
      `${resolution.name} is missing a chain-specific ENS address for chain ${resolution.chainId}`,
    );
  }

  const peerId = derivePeerId(cfg.axl.keyPath).hex;
  if (resolution.peerText && normalizePeerText(resolution.peerText) !== peerId) {
    throw new Error(
      `${POLIS_PEER_TEXT_KEY} for ${resolution.name} is ${resolution.peerText}, expected ${peerId}`,
    );
  }
  if (opts.requirePeerText && !resolution.peerText) {
    throw new Error(
      `${resolution.name} is missing ENS text record ${POLIS_PEER_TEXT_KEY}=${peerId}`,
    );
  }
  if (
    opts.requirePrimaryName &&
    normalizeOptionalName(resolution.primaryName) !== resolution.name
  ) {
    throw new Error(
      `${resolution.resolvedAddress} primary ENS name is ${resolution.primaryName ?? "(not set)"}, expected ${resolution.name}`,
    );
  }

  return resolution;
}

export async function resolveEnsAgent(opts: ResolveEnsOptions): Promise<EnsVerification> {
  const normalizedName = normalize(opts.name);
  const ethRpcUrl = opts.ethRpcUrl ?? DEFAULT_ENS_RPC_URL;
  const client = createPublicClient({
    chain: mainnet,
    transport: http(ethRpcUrl),
  });
  const chainId = opts.chainId;
  const coinType = chainId ? toCoinType(chainId) : undefined;

  const resolvedAddress = await getEnsAddress(client, normalizedName);
  if (!resolvedAddress) {
    throw new Error(`${normalizedName} does not resolve to an Ethereum address`);
  }

  const [chainAddress, primaryName, peerText, agentText, topicsText, registryText, avatar, description, url] =
    await Promise.all([
      coinType ? getEnsAddress(client, normalizedName, coinType) : Promise.resolve(null),
      getEnsName(client, getAddress(resolvedAddress)),
      getEnsText(client, normalizedName, POLIS_PEER_TEXT_KEY),
      getEnsText(client, normalizedName, POLIS_AGENT_TEXT_KEY),
      getEnsText(client, normalizedName, POLIS_TOPICS_TEXT_KEY),
      getEnsText(client, normalizedName, POLIS_REGISTRY_TEXT_KEY),
      getEnsText(client, normalizedName, "avatar"),
      getEnsText(client, normalizedName, "description"),
      getEnsText(client, normalizedName, "url"),
    ]);

  return {
    name: normalizedName,
    ethRpcUrl,
    resolvedAddress: getAddress(resolvedAddress),
    chainAddress: chainAddress ? getAddress(chainAddress) : undefined,
    chainId,
    coinType: coinType?.toString(),
    primaryName: primaryName ?? undefined,
    peerText: peerText ?? undefined,
    agentText: agentText ?? undefined,
    topicsText: topicsText ?? undefined,
    registryText: registryText ?? undefined,
    avatar: avatar ?? undefined,
    description: description ?? undefined,
    url: url ?? undefined,
    verifiedAt: new Date().toISOString(),
  };
}

export function peerIdFromEns(resolution: Pick<EnsVerification, "name" | "peerText">): string {
  if (!resolution.peerText) {
    throw new Error(
      `${resolution.name} is missing ENS text record ${POLIS_PEER_TEXT_KEY}; cannot route AXL messages by ENS`,
    );
  }
  const peerId = normalizePeerText(resolution.peerText);
  if (!/^[0-9a-f]{64}$/.test(peerId)) {
    throw new Error(
      `${POLIS_PEER_TEXT_KEY} for ${resolution.name} must be a 64-character AXL peer hex string`,
    );
  }
  return peerId;
}

export function ensMetadataUri(
  verification: Pick<EnsVerification, "name">,
  peerIdHex: string,
): string {
  return `ens://${verification.name}?peer=${peerIdHex}`;
}

function assertSameAddress(resolved: string, expected: string, name: string): void {
  if (!isAddress(resolved) || !isAddress(expected)) {
    throw new Error(`invalid address while verifying ${name}`);
  }
  if (getAddress(resolved) !== getAddress(expected)) {
    throw new Error(
      `${name} resolves to ${getAddress(resolved)}, but ~/.polis/config.json wallet is ${getAddress(expected)}`,
    );
  }
}

function normalizePeerText(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("0x") ? trimmed.slice(2).toLowerCase() : trimmed.toLowerCase();
}

function normalizeOptionalName(name?: string): string | undefined {
  if (!name) return undefined;
  try {
    return normalize(name);
  } catch {
    return undefined;
  }
}

async function getEnsAddress(
  client: EnsClient,
  name: string,
  coinType?: bigint,
): Promise<`0x${string}` | null> {
  try {
    return await client.getEnsAddress({ name, coinType });
  } catch {
    return null;
  }
}

async function getEnsName(client: EnsClient, address: `0x${string}`): Promise<string | null> {
  try {
    return await client.getEnsName({ address });
  } catch {
    return null;
  }
}

async function getEnsText(
  client: EnsClient,
  name: string,
  key: string,
): Promise<string | null> {
  try {
    return await client.getEnsText({ name, key });
  } catch {
    return null;
  }
}
