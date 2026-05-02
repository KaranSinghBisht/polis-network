/**
 * Read-side helpers for the Gensyn `AgentRegistry` contract used by the
 * /api/claim route to verify that the wallet signing the claim is the
 * registered owner of the AXL peer being claimed.
 *
 * No private keys are touched here — only `eth_call` reads.
 */

import { createPublicClient, http, verifyMessage, zeroAddress } from "viem";
import { defineChain } from "viem";

const GENSYN_TESTNET = defineChain({
  id: 685685,
  name: "Gensyn Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        process.env.GENSYN_RPC_URL ?? "https://gensyn-testnet.g.alchemy.com/public",
      ],
    },
  },
});

const REGISTRY_ADDRESS =
  (process.env.POLIS_AGENT_REGISTRY as `0x${string}` | undefined) ??
  "0xAFb77Ad4626b9A2ECA78905F7420102FB5F2A930";

const AGENT_REGISTRY_ABI = [
  {
    name: "agents",
    type: "function",
    inputs: [{ name: "peerId", type: "bytes32" }],
    outputs: [
      { name: "owner", type: "address" },
      { name: "metadataURI", type: "string" },
      { name: "registeredAt", type: "uint64" },
      { name: "reputation", type: "uint64" },
    ],
    stateMutability: "view",
  },
] as const;

const publicClient = createPublicClient({
  chain: GENSYN_TESTNET,
  transport: http(),
});

export function normalizePeerId(peer: string): `0x${string}` {
  const hex = peer.startsWith("0x") ? peer.slice(2) : peer;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("peerId must be a 64-char hex AXL public key");
  }
  return `0x${hex.toLowerCase()}` as `0x${string}`;
}

export async function getRegistryOwner(peer: string): Promise<`0x${string}` | null> {
  const peerBytes = normalizePeerId(peer);
  const agent = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: AGENT_REGISTRY_ABI,
    functionName: "agents",
    args: [peerBytes],
  });
  const owner = agent[0];
  if (owner === zeroAddress) return null;
  return owner;
}

export async function verifyClaimSignature({
  message,
  signature,
  expectedOwner,
}: {
  message: string;
  signature: `0x${string}`;
  expectedOwner: `0x${string}`;
}): Promise<boolean> {
  try {
    return await verifyMessage({
      address: expectedOwner,
      message,
      signature,
    });
  } catch {
    return false;
  }
}
