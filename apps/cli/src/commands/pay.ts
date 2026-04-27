import { formatUnits, parseUnits, zeroAddress } from "viem";
import { readConfig, writeConfig, type PolisConfig } from "../config.js";
import { buildClients } from "../viem.js";
import { peerIdFromEns, resolveEnsAgent } from "../ens.js";

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

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

const PAYMENT_ROUTER_ABI = [
  {
    name: "pay",
    type: "function",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "memo", type: "string" },
    ],
    outputs: [
      { name: "feeAmount", type: "uint256" },
      { name: "netAmount", type: "uint256" },
    ],
    stateMutability: "nonpayable",
  },
] as const;

export interface PayOptions {
  router?: `0x${string}`;
  registry?: `0x${string}`;
  ensRpcUrl?: string;
  memo?: string;
  approve: boolean;
}

export async function runPay(target: string, amount: string, opts: PayOptions): Promise<void> {
  const cfg = readConfig();
  const registryAddress = opts.registry ?? cfg.registryAddress;
  if (!registryAddress) {
    throw new Error("no registry address — pass --registry 0x... or run polis register first");
  }

  const routerAddress = opts.router ?? cfg.paymentRouterAddress;
  if (!routerAddress) {
    throw new Error("no PaymentRouter address — pass --router 0x...");
  }

  const { peerId, ensName } = await resolvePaymentTarget(cfg, target, opts);
  const peerBytes32 = normalizePeerId(peerId);
  const usdcAmount = parseUnits(amount, 6);
  if (usdcAmount <= 0n) throw new Error("amount must be greater than 0");

  const { account, publicClient, walletClient } = buildClients(cfg);
  const agent = await publicClient.readContract({
    address: registryAddress,
    abi: AGENT_REGISTRY_ABI,
    functionName: "agents",
    args: [peerBytes32],
  });
  const recipient = agent[0];
  if (recipient === zeroAddress) {
    throw new Error(`peer ${peerId} is not registered in AgentRegistry`);
  }

  console.log(`payer:     ${account.address}`);
  if (ensName) console.log(`ens:       ${ensName}`);
  console.log(`peer:      ${peerId}`);
  console.log(`recipient: ${recipient}`);
  console.log(`amount:    ${formatUnits(usdcAmount, 6)} USDC`);
  console.log(`router:    ${routerAddress}`);

  if (opts.approve) {
    console.log("\nsubmitting approve() tx...");
    const approveHash = await walletClient.writeContract({
      address: cfg.usdc,
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [routerAddress, usdcAmount],
    });
    console.log(`approve tx: ${approveHash}`);
    const approveReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveHash,
    });
    if (approveReceipt.status === "reverted") throw new Error("approve tx reverted");
  }

  console.log("\nsubmitting PaymentRouter.pay() tx...");
  const hash = await walletClient.writeContract({
    address: routerAddress,
    abi: PAYMENT_ROUTER_ABI,
    functionName: "pay",
    args: [recipient, usdcAmount, opts.memo ?? `polis payment to ${ensName ?? peerId}`],
  });
  console.log(`pay tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new Error("pay tx reverted");
  console.log(`paid in block ${receipt.blockNumber}.`);

  persistRouter(cfg, routerAddress);
}

async function resolvePaymentTarget(
  cfg: PolisConfig,
  target: string,
  opts: PayOptions,
): Promise<{ peerId: string; ensName?: string }> {
  if (!looksLikeEnsName(target)) return { peerId: target };
  const resolution = await resolveEnsAgent({
    name: target,
    ethRpcUrl: opts.ensRpcUrl,
    chainId: cfg.chainId,
  });
  const peerId = peerIdFromEns(resolution);
  console.log(
    `resolved ENS ${resolution.name} -> peer ${peerId} wallet ${resolution.resolvedAddress}`,
  );
  return { peerId, ensName: resolution.name };
}

function normalizePeerId(peerId: string): `0x${string}` {
  const hex = peerId.startsWith("0x") ? peerId.slice(2) : peerId;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("peerId must be a 64-character hex AXL public key");
  }
  return `0x${hex}`;
}

function looksLikeEnsName(value: string): boolean {
  return value.includes(".") && !/^(0x)?[0-9a-fA-F]{64}$/.test(value);
}

function persistRouter(cfg: PolisConfig, addr: `0x${string}`): void {
  if (cfg.paymentRouterAddress === addr) return;
  writeConfig({ ...cfg, paymentRouterAddress: addr });
  console.log("saved PaymentRouter address to ~/.polis/config.json");
}
