import { readConfig, writeConfig, type PolisConfig } from "../config.js";
import { buildClients } from "../viem.js";
import { derivePeerId } from "../peer.js";

const AGENT_REGISTRY_ABI = [
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
  const metadataURI = opts.metadata ?? `polis://agent/${peerId.hex}`;
  const { account, publicClient, walletClient } = buildClients(cfg);

  console.log(`wallet:   ${account.address}`);
  console.log(`registry: ${registryAddress}`);
  console.log(`peer:     ${peerId.hex}`);
  console.log(`metadata: ${metadataURI}`);

  const alreadyRegistered = (await publicClient.readContract({
    address: registryAddress,
    abi: AGENT_REGISTRY_ABI,
    functionName: "isRegistered",
    args: [peerId.bytes32],
  })) as boolean;

  if (alreadyRegistered) {
    console.log("\nagent is already registered on-chain. nothing to do.");
    persistRegistry(cfg, registryAddress);
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

  persistRegistry(cfg, registryAddress);
}

function persistRegistry(cfg: PolisConfig, addr: `0x${string}`): void {
  if (cfg.registryAddress === addr) return;
  writeConfig({ ...cfg, registryAddress: addr });
  console.log(`saved registry address to ~/.polis/config.json`);
}
