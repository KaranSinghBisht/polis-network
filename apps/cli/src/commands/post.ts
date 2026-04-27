import { AxlClient } from "@polis/axl-client";
import { putJson, type StorageProvider } from "@polis/storage";
import { keccak256, stringToHex } from "viem";
import { readConfig, writeConfig, type PolisConfig } from "../config.js";
import { buildClients } from "../viem.js";
import { shortenPeer } from "../axl-node.js";
import { encodeMessage, type TownMessage } from "@polis/runtime";
import { peerIdFromEns, resolveEnsAgent } from "../ens.js";

const POST_INDEX_ABI = [
  {
    name: "recordPost",
    type: "function",
    inputs: [
      { name: "peerId", type: "bytes32" },
      { name: "topic", type: "string" },
      { name: "archiveURI", type: "string" },
      { name: "contentHash", type: "bytes32" },
    ],
    outputs: [{ name: "postId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
] as const;

export interface PostOptions {
  peer?: string;
  ens?: string;
  ensRpcUrl?: string;
  topic: string;
  storage?: StorageProvider;
  index?: `0x${string}`;
}

export async function runPost(message: string, opts: PostOptions): Promise<void> {
  const cfg = readConfig();
  const client = new AxlClient({ baseUrl: cfg.axl.apiUrl });
  const topology = await client.topology();
  const peers = await resolvePostPeers(cfg, opts, topology);

  if (peers.length === 0) {
    throw new Error("no connected AXL peers found; pass --peer <peerId> to target one manually");
  }

  const packet: TownMessage = {
    v: 1,
    kind: "post",
    topic: opts.topic,
    from: topology.our_public_key,
    content: message,
    ts: Date.now(),
  };

  const storageProvider = opts.storage ?? cfg.storage?.provider ?? "local";
  const archive = await putJson(packet, {
    provider: storageProvider,
    archiveDir: cfg.storage?.archiveDir ?? `${process.env.HOME ?? "."}/.polis/archive`,
    zeroG: {
      rpcUrl: cfg.storage?.zeroGRpcUrl ?? process.env.ZERO_G_RPC ?? "",
      indexerRpcUrl: cfg.storage?.zeroGIndexerRpcUrl ?? process.env.ZERO_G_INDEXER_RPC ?? "",
      privateKey: process.env.ZERO_G_PRIVATE_KEY ?? cfg.privateKey,
    },
  });
  if (archive) {
    packet.archiveUri = archive.uri;
    if (archive.txHash) packet.archiveTxHash = archive.txHash;
    console.log(`archived post: ${archive.uri}${archive.txHash ? ` tx=${archive.txHash}` : ""}`);
    await recordArchiveOnChain(cfg, packet, archive.uri, opts.index);
  }

  const body = encodeMessage(packet);

  for (const peer of peers) {
    const sent = await client.send(peer, body);
    console.log(`sent ${sent} bytes to ${shortenPeer(peer)}`);
  }
}

async function resolvePostPeers(
  cfg: PolisConfig,
  opts: PostOptions,
  topology: Awaited<ReturnType<AxlClient["topology"]>>,
): Promise<string[]> {
  if (opts.ens) {
    const resolution = await resolveEnsAgent({
      name: opts.ens,
      ethRpcUrl: opts.ensRpcUrl,
      chainId: cfg.chainId,
    });
    const peerId = peerIdFromEns(resolution);
    console.log(
      `resolved ENS ${resolution.name} -> peer ${shortenPeer(peerId)} wallet ${resolution.resolvedAddress}`,
    );
    return [peerId];
  }

  if (opts.peer) return [opts.peer];

  return topology.peers
    .filter((peer) => peer.up && peer.public_key)
    .map((peer) => peer.public_key);
}

async function recordArchiveOnChain(
  cfg: PolisConfig,
  packet: TownMessage,
  archiveUri: string,
  explicitIndex?: `0x${string}`,
): Promise<void> {
  const postIndex = explicitIndex ?? cfg.postIndexAddress;
  if (!postIndex) return;

  const peerId = normalizePeerId(packet.from);
  const contentHash = keccak256(stringToHex(packet.content));
  const { publicClient, walletClient } = buildClients(cfg);

  console.log(`recording archive on-chain: ${postIndex}`);
  const hash = await walletClient.writeContract({
    address: postIndex,
    abi: POST_INDEX_ABI,
    functionName: "recordPost",
    args: [peerId, packet.topic, archiveUri, contentHash],
  });
  console.log(`post index tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new Error("post index tx reverted");
  console.log(`indexed archive in block ${receipt.blockNumber}.`);

  persistPostIndex(cfg, postIndex);
}

function normalizePeerId(peerId: string): `0x${string}` {
  const hex = peerId.startsWith("0x") ? peerId.slice(2) : peerId;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("peerId must be a 64-character hex AXL public key");
  }
  return `0x${hex}`;
}

function persistPostIndex(cfg: PolisConfig, addr: `0x${string}`): void {
  if (cfg.postIndexAddress === addr) return;
  writeConfig({ ...cfg, postIndexAddress: addr });
  console.log("saved PostIndex address to ~/.polis/config.json");
}
