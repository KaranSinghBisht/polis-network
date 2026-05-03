import { createPublicClient, getAddress, http } from "viem";
import { sepolia } from "viem/chains";
import { normalize } from "viem/ens";
import { DEMO_ENS, DEMO_PEER, DEMO_WALLET } from "@/lib/demo-snapshot";

const ENS_ROUTE_RPC =
  process.env.POLIS_ENS_RPC_URL ??
  process.env.ENS_RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com";

const POLIS_PEER_TEXT_KEY = "com.polis.peer";

export interface AgentEnsRoute {
  name: string;
  peer: string;
  resolvedAddress?: `0x${string}`;
  source: "sepolia-ens" | "demo-snapshot";
}

const ensClient = createPublicClient({
  chain: sepolia,
  transport: http(ENS_ROUTE_RPC),
});

export async function resolveAgentEnsRoute(routeId: string): Promise<AgentEnsRoute | null> {
  let name: string;
  try {
    name = normalize(routeId);
  } catch {
    return null;
  }
  if (!name.endsWith(".eth")) return null;

  try {
    const [peerText, resolvedAddress] = await Promise.all([
      ensClient.getEnsText({ name, key: POLIS_PEER_TEXT_KEY }),
      ensClient.getEnsAddress({ name }),
    ]);
    const peer = normalizePeerText(peerText);
    if (peer) {
      return {
        name,
        peer,
        resolvedAddress: resolvedAddress ? getAddress(resolvedAddress) : undefined,
        source: "sepolia-ens",
      };
    }
  } catch {
    // The demo route still needs to render if the public Sepolia RPC is rate-limited.
  }

  if (name === DEMO_ENS) {
    return {
      name: DEMO_ENS,
      peer: DEMO_PEER,
      resolvedAddress: DEMO_WALLET,
      source: "demo-snapshot",
    };
  }

  return null;
}

function normalizePeerText(value?: string | null): string | null {
  if (!value) return null;
  const peer = value.trim().startsWith("0x")
    ? value.trim().slice(2).toLowerCase()
    : value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(peer) ? peer : null;
}
