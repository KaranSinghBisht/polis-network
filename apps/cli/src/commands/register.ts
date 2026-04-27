import { readConfig, writeConfig, type PolisConfig } from "../config.js";
import { buildClients } from "../viem.js";
import { derivePeerId } from "../peer.js";
import { ensMetadataUri, verifyEnsIdentity } from "../ens.js";

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
    name: "register",
    type: "function",
    inputs: [
      { name: "peerId", type: "bytes32" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "setMetadataURI",
    type: "function",
    inputs: [
      { name: "peerId", type: "bytes32" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "isRegistered",
    type: "function",
    inputs: [{ name: "peerId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
] as const;

export interface RegisterOptions {
  /** AgentRegistry contract address. Required if not in config. */
  registry?: `0x${string}`;
  /** Metadata URI (e.g. 0G CID). Defaults to a placeholder. */
  metadata?: string;
  /** ENS identity to verify and use as metadata. */
  ens?: string;
  /** Ethereum mainnet RPC used for ENS Universal Resolver calls. */
  ensRpcUrl?: string;
  /** Require ENS text record com.polis.peer to match the current AXL peer ID. */
  requireEnsPeerText: boolean;
  /** Require ENS chain-specific address for the current Polis/Gensyn chain. */
  requireEnsChainAddress: boolean;
  /** Require the wallet's primary ENS name to match the agent ENS name. */
  requireEnsPrimaryName: boolean;
}

export async function runRegister(opts: RegisterOptions): Promise<void> {
  const cfg = readConfig();
  const registryAddress = opts.registry ?? cfg.registryAddress;
  if (!registryAddress) {
    throw new Error(
      "no registry address — pass --registry 0x... or set it in ~/.polis/config.json",
    );
  }

  const peerId = derivePeerId(cfg.axl.keyPath);
  const ensName = opts.ens ?? cfg.ens?.name;
  const ens = ensName
    ? await verifyEnsIdentity(cfg, {
        name: ensName,
        ethRpcUrl: opts.ensRpcUrl ?? cfg.ens?.ethRpcUrl,
        chainId: cfg.chainId,
        requirePeerText: opts.requireEnsPeerText || Boolean(cfg.ens?.peerText),
        requireChainAddress: opts.requireEnsChainAddress,
        requirePrimaryName: opts.requireEnsPrimaryName,
      })
    : undefined;
  const metadataURI =
    opts.metadata ??
    (ens ? ensMetadataUri(ens, peerId.hex) : `polis://agent/${peerId.hex}`);
  const { account, publicClient, walletClient } = buildClients(cfg);

  console.log(`wallet:   ${account.address}`);
  console.log(`registry: ${registryAddress}`);
  console.log(`peer:     ${peerId.hex}`);
  if (ens) console.log(`ens:      ${ens.name}`);
  console.log(`metadata: ${metadataURI}`);

  const alreadyRegistered = (await publicClient.readContract({
    address: registryAddress,
    abi: AGENT_REGISTRY_ABI,
    functionName: "isRegistered",
    args: [peerId.bytes32],
  })) as boolean;

  if (alreadyRegistered) {
    const registeredAgent = (await publicClient.readContract({
      address: registryAddress,
      abi: AGENT_REGISTRY_ABI,
      functionName: "agents",
      args: [peerId.bytes32],
    })) as readonly [`0x${string}`, string, bigint, bigint];
    const [owner, currentMetadataURI] = registeredAgent;

    if (owner.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error(
        `peer ${peerId.hex} is already registered to ${owner}, not ${account.address}`,
      );
    }

    if (currentMetadataURI === metadataURI) {
      console.log("\nagent is already registered with matching metadata. nothing to do.");
      persistRegistrationConfig(cfg, registryAddress, ens);
      return;
    }

    console.log("\nagent is already registered. updating metadataURI…");
    const hash = await walletClient.writeContract({
      address: registryAddress,
      abi: AGENT_REGISTRY_ABI,
      functionName: "setMetadataURI",
      args: [peerId.bytes32, metadataURI],
    });
    console.log(`tx: ${hash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      throw new Error("setMetadataURI tx reverted");
    }
    console.log(`metadata updated in block ${receipt.blockNumber}.`);

    persistRegistrationConfig(cfg, registryAddress, ens);
    return;
  }

  console.log("\nsubmitting register() tx…");
  const hash = await walletClient.writeContract({
    address: registryAddress,
    abi: AGENT_REGISTRY_ABI,
    functionName: "register",
    args: [peerId.bytes32, metadataURI],
  });
  console.log(`tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error("register tx reverted");
  }
  console.log(`registered in block ${receipt.blockNumber}.`);

  persistRegistrationConfig(cfg, registryAddress, ens);
}

function persistRegistrationConfig(
  cfg: PolisConfig,
  addr: `0x${string}`,
  ens: PolisConfig["ens"] | undefined,
): void {
  if (cfg.registryAddress === addr && (!ens || cfg.ens?.name === ens.name)) return;
  writeConfig({ ...cfg, registryAddress: addr, ens });
  console.log("saved registry/ENS identity to ~/.polis/config.json");
}
