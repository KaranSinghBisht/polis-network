import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface ProofStep {
  label: string;
  value: string;
  ok: boolean;
  detail?: string;
}

interface EnsIdentityPayload {
  generatedAt: string;
  ens: {
    name: string;
    resolvedAddress: string;
    chainAddress?: string;
    chainId?: number;
    coinType?: string;
    primaryName?: string;
    avatar?: string;
    description?: string;
    url?: string;
  };
  records: {
    peer?: string;
    agent?: string;
    roles?: string;
    topics?: string;
    registry?: string;
  };
  wallet: {
    address: string;
    network: string;
    chainId: number;
  };
  peer: {
    hex: string;
    bytes32: string;
    matchesEns: boolean;
  };
  registry?: {
    address: string;
    owner: string;
    metadataURI: string;
    registeredAt: number;
    reputation: number;
    matchesWallet: boolean;
  };
  archive?: {
    cid: string;
    uri: string;
    topic: string;
    content: string;
    ts: number;
    archiveTxHash?: string;
  };
  chain: { steps: ProofStep[] };
}

interface PolisConfigEnsBlock {
  name: string;
  ethRpcUrl: string;
  resolvedAddress: string;
  chainAddress?: string;
  chainId?: number;
  coinType?: string;
  primaryName?: string;
  peerText?: string;
  agentText?: string;
  rolesText?: string;
  topicsText?: string;
  registryText?: string;
  avatar?: string;
  description?: string;
  url?: string;
  verifiedAt: string;
}

interface PolisConfigShape {
  network: string;
  address: string;
  chainId: number;
  registryAddress?: string;
  ens?: PolisConfigEnsBlock;
}

export function GET(request: Request) {
  if (!canReadLocalFiles(request)) {
    return NextResponse.json(
      { identity: null, source: "disabled", sourcePath: "local file access disabled" },
      { status: 200 },
    );
  }

  const polisHome = process.env.POLIS_HOME ?? join(homedir(), ".polis");
  const proofPath = process.env.POLIS_ENS_PROOF ?? join(polisHome, "ens-proof.json");
  const configPath = join(polisHome, "config.json");

  const proof = readProof(proofPath);
  if (proof) {
    return NextResponse.json({
      identity: sanitizeProofForApi(proof),
      source: "proof",
      sourcePath: "~/.polis/ens-proof.json",
    });
  }

  const fallback = readConfigFallback(configPath);
  if (fallback) {
    return NextResponse.json({
      identity: fallback,
      source: "config",
      sourcePath: "~/.polis/config.json",
    });
  }

  return NextResponse.json(
    { identity: null, source: "none", sourcePath: "~/.polis/ens-proof.json" },
    { status: 200 },
  );
}

function readProof(path: string): EnsIdentityPayload | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<EnsIdentityPayload>;
    if (!isProof(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

type ProofWithLocalPath = EnsIdentityPayload & {
  archive?: EnsIdentityPayload["archive"] & { path?: string };
};

function sanitizeProofForApi(proof: EnsIdentityPayload): EnsIdentityPayload {
  const localProof = proof as ProofWithLocalPath;
  const archive = localProof.archive
    ? {
        cid: localProof.archive.cid,
        uri: localProof.archive.uri,
        topic: localProof.archive.topic,
        content: localProof.archive.content,
        ts: localProof.archive.ts,
        archiveTxHash: localProof.archive.archiveTxHash,
      }
    : undefined;

  return {
    ...proof,
    archive,
    chain: {
      steps: proof.chain.steps.map((step) => ({
        ...step,
        detail: step.detail?.startsWith("local archive at ")
          ? "local archive captured in ~/.polis/archive"
          : step.detail,
      })),
    },
  };
}

function readConfigFallback(path: string): EnsIdentityPayload | null {
  if (!existsSync(path)) return null;
  try {
    const cfg = JSON.parse(readFileSync(path, "utf8")) as Partial<PolisConfigShape>;
    if (!cfg.ens || !cfg.address) return null;
    const ens = cfg.ens;
    const peerHex = normalizePeer(ens.peerText);
    return {
      generatedAt: ens.verifiedAt,
      ens: {
        name: ens.name,
        resolvedAddress: ens.resolvedAddress,
        chainAddress: ens.chainAddress,
        chainId: ens.chainId,
        coinType: ens.coinType,
        primaryName: ens.primaryName,
        avatar: ens.avatar,
        description: ens.description,
        url: ens.url,
      },
      records: {
        peer: ens.peerText,
        agent: ens.agentText,
        roles: ens.rolesText,
        topics: ens.topicsText,
        registry: ens.registryText,
      },
      wallet: {
        address: cfg.address,
        network: cfg.network ?? "testnet",
        chainId: cfg.chainId ?? 0,
      },
      peer: {
        hex: peerHex ?? "",
        bytes32: peerHex ? `0x${peerHex}` : "",
        matchesEns: Boolean(peerHex),
      },
      chain: {
        steps: [
          {
            label: "ENS resolves to wallet",
            value: `${ens.name} → ${ens.resolvedAddress}`,
            ok: ens.resolvedAddress.toLowerCase() === cfg.address.toLowerCase(),
          },
          {
            label: "ENS exposes AXL peer",
            value: ens.peerText ? `com.polis.peer = ${ens.peerText}` : "com.polis.peer not set",
            ok: Boolean(ens.peerText),
          },
          {
            label: "AgentRegistry knows the peer",
            value: cfg.registryAddress
              ? "registry address cached — run `polis ens-export` for a live read"
              : "no registry entry",
            ok: false,
          },
          {
            label: "AXL message archived",
            value: "run `polis ens-export` to bundle the latest archive",
            ok: false,
          },
        ],
      },
    };
  } catch {
    return null;
  }
}

function isProof(value: Partial<EnsIdentityPayload>): value is EnsIdentityPayload {
  return (
    typeof value.generatedAt === "string" &&
    !!value.ens &&
    typeof value.ens.name === "string" &&
    typeof value.ens.resolvedAddress === "string" &&
    !!value.wallet &&
    typeof value.wallet.address === "string" &&
    !!value.peer &&
    typeof value.peer.hex === "string" &&
    !!value.chain &&
    Array.isArray(value.chain.steps)
  );
}

function normalizePeer(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.startsWith("0x") ? trimmed.slice(2).toLowerCase() : trimmed.toLowerCase();
}

function canReadLocalFiles(request: Request): boolean {
  const token = process.env.POLIS_WEB_LOCAL_READ_TOKEN;
  if (token) return requestToken(request) === token;
  if (process.env.POLIS_WEB_EXPOSE_LOCAL_FILES === "1") return true;
  const host = hostnameOnly(request.headers.get("host"));
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function requestToken(request: Request): string | undefined {
  return (
    request.headers.get("x-polis-demo-token") ??
    new URL(request.url).searchParams.get("token") ??
    undefined
  );
}

function hostnameOnly(hostHeader: string | null): string | undefined {
  if (!hostHeader) return undefined;
  const host = hostHeader.toLowerCase();
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end > 0 ? host.slice(1, end) : undefined;
  }
  return host.split(":")[0];
}
