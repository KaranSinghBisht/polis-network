import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { polisDir, readConfig, writeConfig, type PolisConfig } from "../config.js";
import { derivePeerId } from "../peer.js";
import { peerIdFromEns, resolveEnsAgent, verifyEnsIdentity } from "../ens.js";
import { buildClients } from "../viem.js";

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
  {
    name: "isRegistered",
    type: "function",
    inputs: [{ name: "peerId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

export interface EnsVerifyOptions {
  name: string;
  ethRpcUrl?: string;
  requirePeerText: boolean;
  requireChainAddress: boolean;
  requirePrimaryName: boolean;
  json: boolean;
}

export interface EnsResolveOptions {
  name: string;
  ethRpcUrl?: string;
  chainId?: number;
  json: boolean;
}

export interface EnsExportOptions {
  name?: string;
  ethRpcUrl?: string;
  outPath?: string;
  archiveDir?: string;
  json: boolean;
}

export interface EnsProof {
  generatedAt: string;
  ens: {
    name: string;
    resolvedAddress: `0x${string}`;
    chainAddress?: `0x${string}`;
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
    address: `0x${string}`;
    network: PolisConfig["network"];
    chainId: number;
  };
  peer: {
    hex: string;
    bytes32: `0x${string}`;
    matchesEns: boolean;
  };
  registry?: {
    address: `0x${string}`;
    owner: `0x${string}`;
    metadataURI: string;
    registeredAt: number;
    reputation: number;
    matchesWallet: boolean;
  };
  archive?: {
    path: string;
    cid: string;
    uri: string;
    topic: string;
    content: string;
    ts: number;
    archiveTxHash?: string;
  };
  chain: {
    steps: Array<{ label: string; value: string; ok: boolean; detail?: string }>;
  };
}

export async function runEnsVerify(opts: EnsVerifyOptions): Promise<void> {
  const cfg = readConfig();
  const peerId = derivePeerId(cfg.axl.keyPath).hex;
  const verification = await verifyEnsIdentity(cfg, {
    name: opts.name,
    ethRpcUrl: opts.ethRpcUrl,
    chainId: cfg.chainId,
    requirePeerText: opts.requirePeerText,
    requireChainAddress: opts.requireChainAddress,
    requirePrimaryName: opts.requirePrimaryName,
  });

  writeConfig({ ...cfg, ens: verification });

  if (opts.json) {
    console.log(JSON.stringify({ wallet: cfg.address, peerId, ens: verification }, null, 2));
    return;
  }

  console.log(`ENS name:     ${verification.name}`);
  console.log(`wallet:       ${cfg.address}`);
  console.log(`resolved:     ${verification.resolvedAddress}`);
  console.log(`chain addr:   ${verification.chainAddress ?? "(not set)"}`);
  console.log(`primary:      ${verification.primaryName ?? "(not set)"}`);
  console.log(`AXL peer:     ${peerId}`);
  console.log(`text peer:    ${verification.peerText ?? "(not set)"}`);
  console.log(`text agent:   ${verification.agentText ?? "(not set)"}`);
  console.log(`text roles:   ${verification.rolesText ?? "(not set)"}`);
  console.log(`text topics:  ${verification.topicsText ?? "(not set)"}`);
  console.log(`text registry:${verification.registryText ?? "(not set)"}`);
  if (verification.url) console.log(`url:          ${verification.url}`);
  if (verification.avatar) console.log(`avatar:       ${verification.avatar}`);
  console.log("saved ENS identity to ~/.polis/config.json");
}

export async function runEnsResolve(opts: EnsResolveOptions): Promise<void> {
  const cfg = readConfig();
  const resolution = await resolveEnsAgent({
    name: opts.name,
    ethRpcUrl: opts.ethRpcUrl,
    chainId: opts.chainId ?? cfg.chainId,
  });

  if (opts.json) {
    const peerId = resolution.peerText ? peerIdFromEns(resolution) : null;
    console.log(JSON.stringify({ ...resolution, peerId }, null, 2));
    return;
  }

  console.log(`ENS name:     ${resolution.name}`);
  console.log(`address:      ${resolution.resolvedAddress}`);
  console.log(`chain addr:   ${resolution.chainAddress ?? "(not set)"}`);
  console.log(`primary:      ${resolution.primaryName ?? "(not set)"}`);
  console.log(`coinType:     ${resolution.coinType ?? "(not requested)"}`);
  console.log(`text peer:    ${resolution.peerText ?? "(not set)"}`);
  if (resolution.peerText) console.log(`AXL peer:     ${peerIdFromEns(resolution)}`);
  console.log(`text agent:   ${resolution.agentText ?? "(not set)"}`);
  console.log(`text roles:   ${resolution.rolesText ?? "(not set)"}`);
  console.log(`text topics:  ${resolution.topicsText ?? "(not set)"}`);
  console.log(`text registry:${resolution.registryText ?? "(not set)"}`);
  if (resolution.description) console.log(`description:  ${resolution.description}`);
  if (resolution.url) console.log(`url:          ${resolution.url}`);
  if (resolution.avatar) console.log(`avatar:       ${resolution.avatar}`);
}

export async function runEnsExport(opts: EnsExportOptions): Promise<void> {
  const cfg = readConfig();
  const ensName = opts.name ?? cfg.ens?.name;
  if (!ensName) {
    throw new Error(
      "no ENS name — pass `polis ens-export <name>` or run `polis ens <name>` first to cache one",
    );
  }

  const peer = derivePeerId(cfg.axl.keyPath);
  const resolution = await resolveEnsAgent({
    name: ensName,
    ethRpcUrl: opts.ethRpcUrl ?? cfg.ens?.ethRpcUrl,
    chainId: cfg.chainId,
  });

  const peerText = resolution.peerText ? normalizePeerText(resolution.peerText) : undefined;
  const matchesEns = peerText ? peerText === peer.hex : false;

  const proof: EnsProof = {
    generatedAt: new Date().toISOString(),
    ens: {
      name: resolution.name,
      resolvedAddress: resolution.resolvedAddress,
      chainAddress: resolution.chainAddress,
      chainId: resolution.chainId,
      coinType: resolution.coinType,
      primaryName: resolution.primaryName,
      avatar: resolution.avatar,
      description: resolution.description,
      url: resolution.url,
    },
    records: {
      peer: resolution.peerText,
      agent: resolution.agentText,
      roles: resolution.rolesText,
      topics: resolution.topicsText,
      registry: resolution.registryText,
    },
    wallet: {
      address: cfg.address,
      network: cfg.network,
      chainId: cfg.chainId,
    },
    peer: {
      hex: peer.hex,
      bytes32: peer.bytes32,
      matchesEns,
    },
    chain: { steps: [] },
  };

  proof.registry = await readRegistryRecord(cfg, peer.bytes32);
  proof.archive = readLatestArchive(opts.archiveDir ?? cfg.storage?.archiveDir, peer.hex);
  proof.chain.steps = buildProofChainSteps(proof);

  const outPath = opts.outPath ?? join(polisDir(), "ens-proof.json");
  ensureDirFor(outPath);
  writeFileSync(outPath, JSON.stringify(proof, null, 2), { mode: 0o644 });

  if (opts.json) {
    console.log(JSON.stringify(proof, null, 2));
    return;
  }

  console.log(`wrote ${outPath}`);
  console.log(`ENS:         ${proof.ens.name}`);
  console.log(`wallet:      ${proof.wallet.address}`);
  console.log(`AXL peer:    ${proof.peer.hex}`);
  console.log(`peer matches ENS: ${proof.peer.matchesEns ? "yes" : "no"}`);
  if (proof.registry) {
    console.log(`registry:    ${proof.registry.address}`);
    console.log(`metadataURI: ${proof.registry.metadataURI}`);
    console.log(`reputation:  ${proof.registry.reputation}`);
  } else {
    console.log("registry:    (not registered or registryAddress missing)");
  }
  if (proof.archive) {
    console.log(`archive:     ${proof.archive.uri}`);
    console.log(`topic:       ${proof.archive.topic}`);
  } else {
    console.log("archive:     (no local AXL archive found for this peer)");
  }
}

async function readRegistryRecord(
  cfg: PolisConfig,
  peerBytes32: `0x${string}`,
): Promise<EnsProof["registry"] | undefined> {
  if (!cfg.registryAddress) return undefined;
  try {
    const { publicClient } = buildClients(cfg);
    const isRegistered = (await publicClient.readContract({
      address: cfg.registryAddress,
      abi: AGENT_REGISTRY_ABI,
      functionName: "isRegistered",
      args: [peerBytes32],
    })) as boolean;
    if (!isRegistered) return undefined;
    const record = (await publicClient.readContract({
      address: cfg.registryAddress,
      abi: AGENT_REGISTRY_ABI,
      functionName: "agents",
      args: [peerBytes32],
    })) as readonly [`0x${string}`, string, bigint, bigint];
    const [owner, metadataURI, registeredAt, reputation] = record;
    return {
      address: cfg.registryAddress,
      owner,
      metadataURI,
      registeredAt: Number(registeredAt),
      reputation: Number(reputation),
      matchesWallet: owner.toLowerCase() === cfg.address.toLowerCase(),
    };
  } catch (err) {
    console.error(`registry read failed: ${(err as Error).message}`);
    return undefined;
  }
}

interface ArchivedTownMessage {
  topic: string;
  content: string;
  from: string;
  ts: number;
  archiveUri?: string;
  archiveTxHash?: string;
}

function readLatestArchive(
  archiveDir: string | undefined,
  peerHex: string,
): EnsProof["archive"] | undefined {
  const dir = archiveDir ?? join(polisDir(), "archive");
  if (!existsSync(dir)) return undefined;

  let entries: string[];
  try {
    entries = readdirSync(dir).filter((name) => name.endsWith(".json"));
  } catch {
    return undefined;
  }

  type Candidate = { path: string; mtime: number; cid: string; data: ArchivedTownMessage };
  const matches: Candidate[] = [];
  for (const name of entries) {
    const path = join(dir, name);
    try {
      const raw = readFileSync(path, "utf8");
      const data = JSON.parse(raw) as Partial<ArchivedTownMessage>;
      if (!isArchivedMessage(data)) continue;
      if (data.from.toLowerCase() !== peerHex.toLowerCase()) continue;
      matches.push({
        path,
        mtime: statSync(path).mtimeMs,
        cid: name.replace(/\.json$/, ""),
        data,
      });
    } catch {
      continue;
    }
  }

  if (matches.length === 0) return undefined;
  matches.sort((a, b) => b.mtime - a.mtime);
  const latest = matches[0]!;
  return {
    path: latest.path,
    cid: latest.cid,
    uri: latest.data.archiveUri ?? `polis-local://sha256/${latest.cid}`,
    topic: latest.data.topic,
    content: latest.data.content,
    ts: latest.data.ts,
    archiveTxHash: latest.data.archiveTxHash,
  };
}

function isArchivedMessage(value: Partial<ArchivedTownMessage>): value is ArchivedTownMessage {
  return (
    typeof value.topic === "string" &&
    typeof value.content === "string" &&
    typeof value.from === "string" &&
    typeof value.ts === "number"
  );
}

function buildProofChainSteps(proof: EnsProof): EnsProof["chain"]["steps"] {
  const steps: EnsProof["chain"]["steps"] = [];

  steps.push({
    label: "ENS resolves to wallet",
    value: `${proof.ens.name} → ${proof.ens.resolvedAddress}`,
    ok: proof.ens.resolvedAddress.toLowerCase() === proof.wallet.address.toLowerCase(),
    detail:
      proof.ens.resolvedAddress.toLowerCase() === proof.wallet.address.toLowerCase()
        ? `wallet ${proof.wallet.address} matches ENS address record`
        : `wallet ${proof.wallet.address} does NOT match ENS address record`,
  });

  steps.push({
    label: "ENS exposes AXL peer",
    value: proof.records.peer
      ? `com.polis.peer = ${shortHex(proof.records.peer)}`
      : "com.polis.peer not set",
    ok: proof.peer.matchesEns,
    detail: proof.peer.matchesEns
      ? `text record peer matches local AXL peer ${shortHex(proof.peer.hex)}`
      : "ENS does not yet point at this AXL peer",
  });

  if (proof.registry) {
    steps.push({
      label: "AgentRegistry knows the peer",
      value: `${proof.registry.address} → ${proof.registry.metadataURI}`,
      ok: proof.registry.matchesWallet,
      detail: proof.registry.matchesWallet
        ? `owner ${proof.registry.owner} matches wallet`
        : `registry owner ${proof.registry.owner} differs from wallet`,
    });
  } else {
    steps.push({
      label: "AgentRegistry knows the peer",
      value: "no registry entry",
      ok: false,
      detail: "run `polis register --ens <name>` to publish ens:// metadata on-chain",
    });
  }

  if (proof.archive) {
    steps.push({
      label: "AXL message archived",
      value: `${proof.archive.topic} · ${proof.archive.uri}`,
      ok: true,
      detail: proof.archive.archiveTxHash
        ? `0G tx ${shortHex(proof.archive.archiveTxHash)}`
        : `local archive at ${proof.archive.path}`,
    });
  } else {
    steps.push({
      label: "AXL message archived",
      value: "no archive yet",
      ok: false,
      detail: "run `polis post --ens <name> --storage local \"hello\"` to populate the archive",
    });
  }

  return steps;
}

function ensureDirFor(filePath: string): void {
  const idx = filePath.lastIndexOf("/");
  if (idx <= 0) return;
  const dir = filePath.slice(0, idx);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function normalizePeerText(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("0x") ? trimmed.slice(2).toLowerCase() : trimmed.toLowerCase();
}

function shortHex(value: string): string {
  if (value.length <= 14) return value;
  const head = value.startsWith("0x") ? value.slice(0, 8) : value.slice(0, 6);
  return `${head}…${value.slice(-4)}`;
}
