import { createPublicClient, getAddress, http, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import type { PolisConfig } from "./config.js";
import { derivePeerId } from "./peer.js";

export const DEFAULT_ENS_RPC_URL =
  process.env.ENS_RPC_URL ?? "https://ethereum.publicnode.com";

const POLIS_PEER_TEXT_KEY = "com.polis.peer";
const POLIS_AGENT_TEXT_KEY = "com.polis.agent";

export interface EnsVerification {
  name: string;
  ethRpcUrl: string;
  resolvedAddress: `0x${string}`;
  peerText?: string;
  agentText?: string;
  avatar?: string;
  description?: string;
  url?: string;
  verifiedAt: string;
}

export interface VerifyEnsOptions {
  name: string;
  ethRpcUrl?: string;
  requirePeerText?: boolean;
}

export async function verifyEnsIdentity(
  cfg: PolisConfig,
  opts: VerifyEnsOptions,
): Promise<EnsVerification> {
  const normalizedName = normalize(opts.name);
  const ethRpcUrl = opts.ethRpcUrl ?? DEFAULT_ENS_RPC_URL;
  const client = createPublicClient({
    chain: mainnet,
    transport: http(ethRpcUrl),
  });

  const resolvedAddress = await client.getEnsAddress({ name: normalizedName });
  if (!resolvedAddress) {
    throw new Error(`${normalizedName} does not resolve to an Ethereum address`);
  }
  assertSameAddress(resolvedAddress, cfg.address, normalizedName);

  const [peerText, agentText, avatar, description, url] = await Promise.all([
    getEnsText(client, normalizedName, POLIS_PEER_TEXT_KEY),
    getEnsText(client, normalizedName, POLIS_AGENT_TEXT_KEY),
    getEnsText(client, normalizedName, "avatar"),
    getEnsText(client, normalizedName, "description"),
    getEnsText(client, normalizedName, "url"),
  ]);

  const peerId = derivePeerId(cfg.axl.keyPath).hex;
  if (peerText && normalizePeerText(peerText) !== peerId) {
    throw new Error(
      `${POLIS_PEER_TEXT_KEY} for ${normalizedName} is ${peerText}, expected ${peerId}`,
    );
  }
  if (opts.requirePeerText && !peerText) {
    throw new Error(
      `${normalizedName} is missing ENS text record ${POLIS_PEER_TEXT_KEY}=${peerId}`,
    );
  }

  return {
    name: normalizedName,
    ethRpcUrl,
    resolvedAddress: getAddress(resolvedAddress),
    peerText: peerText ?? undefined,
    agentText: agentText ?? undefined,
    avatar: avatar ?? undefined,
    description: description ?? undefined,
    url: url ?? undefined,
    verifiedAt: new Date().toISOString(),
  };
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
  return value.startsWith("0x") ? value.slice(2).toLowerCase() : value.toLowerCase();
}

async function getEnsText(
  client: ReturnType<typeof createPublicClient>,
  name: string,
  key: string,
): Promise<string | null> {
  try {
    return await client.getEnsText({ name, key });
  } catch {
    return null;
  }
}
