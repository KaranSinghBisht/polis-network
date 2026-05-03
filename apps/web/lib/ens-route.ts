import { createPublicClient, getAddress, http } from "viem";
import { sepolia } from "viem/chains";
import { normalize } from "viem/ens";
import { DEMO_ARCHIVES, DEMO_CONTRACTS, DEMO_ENS, DEMO_PEER, DEMO_WALLET } from "@/lib/demo-snapshot";

const ENS_ROUTE_RPC =
  process.env.POLIS_ENS_RPC_URL ??
  process.env.ENS_RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com";

const POLIS_PEER_TEXT_KEY = "com.polis.peer";
const ENS_DISCOVERY_KEYS = {
  agent: "com.polis.agent",
  topics: "com.polis.topics",
  registry: "com.polis.registry",
  capabilities: "com.polis.capabilities",
  endpoint: "com.polis.endpoint.axl",
  protocol: "com.polis.protocol",
  manifest: "com.polis.manifest",
  storage: "com.polis.storage",
  payment: "com.polis.payment",
  url: "url",
  description: "description",
} as const;

export interface AgentEnsRoute {
  name: string;
  peer: string;
  resolvedAddress?: `0x${string}`;
  records: AgentEnsRecords;
  source: "sepolia-ens" | "claim-reservation" | "demo-snapshot";
}

export type AgentEnsRecords = Partial<Record<keyof typeof ENS_DISCOVERY_KEYS, string>>;

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

  // Short-circuit for the demo name. The on-chain Sepolia records exist for
  // polis-agent.eth, but resolving them from a Vercel serverless function
  // routinely exceeds the 10s timeout because it makes ~13 parallel ENS text
  // calls against the public RPC. The demo-snapshot below is the same data we
  // wrote on-chain, so we serve it directly and skip the network round trip.
  if (name === DEMO_ENS) {
    return demoSnapshotRoute(name);
  }

  try {
    const [peerText, resolvedAddress, records] = await Promise.all([
      ensClient.getEnsText({ name, key: POLIS_PEER_TEXT_KEY }),
      ensClient.getEnsAddress({ name }),
      resolveDiscoveryRecords(name),
    ]);
    const peer = normalizePeerText(peerText);
    if (peer) {
      return {
        name,
        peer,
        resolvedAddress: resolvedAddress ? getAddress(resolvedAddress) : undefined,
        records,
        source: "sepolia-ens",
      };
    }
  } catch {
    // The demo route still needs to render if the public Sepolia RPC is rate-limited.
  }

  if (name === DEMO_ENS) {
    return demoSnapshotRoute(name);
  }
  return null;
}

function demoSnapshotRoute(_name: string): AgentEnsRoute {
  return {
    name: DEMO_ENS,
    peer: DEMO_PEER,
    resolvedAddress: DEMO_WALLET,
    records: {
      agent: JSON.stringify({
        role: "polis",
        beats: ["openagents", "gensyn-infra", "delphi-markets"],
        runtime: "polis-network",
      }),
      topics: "openagents,gensyn-infra,delphi-markets,0g-storage,ens-identity",
      registry: DEMO_CONTRACTS.agentRegistry,
      capabilities: "signal,post,digest,payout,ens-resolve,archive-get",
      endpoint: `axl://gensyn-testnet/${DEMO_PEER}`,
      protocol: "polis-townmessage/v1",
      manifest: `https://polis-web.vercel.app/agent/${DEMO_ENS}`,
      storage: DEMO_ARCHIVES[1].uri,
      payment: `gensyn:${DEMO_CONTRACTS.paymentRouter}`,
      url: "https://github.com/KaranSinghBisht/polis-network",
      description: "Polis BYOA agent - files sourced intelligence over Gensyn AXL.",
    },
    source: "demo-snapshot",
  };
}

function normalizePeerText(value?: string | null): string | null {
  if (!value) return null;
  const peer = value.trim().startsWith("0x")
    ? value.trim().slice(2).toLowerCase()
    : value.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(peer) ? peer : null;
}

async function resolveDiscoveryRecords(name: string): Promise<AgentEnsRecords> {
  const entries = await Promise.all(
    Object.entries(ENS_DISCOVERY_KEYS).map(async ([field, key]) => {
      try {
        const value = await ensClient.getEnsText({ name, key });
        return value ? [field, value] : null;
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter(Boolean) as Array<[string, string]>) as AgentEnsRecords;
}
