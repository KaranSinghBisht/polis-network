import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatUnits, parseUnits, zeroAddress } from "viem";
import { readConfig, writeConfig, type PolisConfig } from "../config.js";
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

export interface PayoutOptions {
  digest: string;
  revenue: string;
  router?: `0x${string}`;
  registry?: `0x${string}`;
  memo?: string;
  approve: boolean;
  dryRun: boolean;
}

interface DigestEconomics {
  revenueModel: "paid-brief";
  currency: "USDC";
  splitBps: {
    contributors: number;
    reviewers: number;
    treasury: number;
    referrals: number;
  };
  contributorShares: Array<{ from: string; signalCount: number; shareBps: number }>;
}

interface DigestSummary {
  id: string;
  economics: DigestEconomics;
}

interface PayoutPlanItem {
  peer: string;
  owner: `0x${string}`;
  amount: bigint;
  shareBps: number;
  signalCount: number;
}

export async function runPayout(opts: PayoutOptions): Promise<void> {
  const cfg = readConfig();
  const registryAddress = opts.registry ?? cfg.registryAddress;
  if (!registryAddress) {
    throw new Error("no registry address — pass --registry 0x... or run polis register first");
  }
  const routerAddress = opts.router ?? cfg.paymentRouterAddress;
  if (!routerAddress) {
    throw new Error("no PaymentRouter address — pass --router 0x...");
  }

  const digest = loadDigest(opts.digest);
  const splits = digest.economics.splitBps;
  const splitSum = splits.contributors + splits.reviewers + splits.treasury + splits.referrals;
  if (splitSum !== 10000) {
    throw new Error(`digest splitBps sums to ${splitSum}, expected 10000`);
  }

  const revenue = parseUnits(opts.revenue, 6);
  if (revenue <= 0n) throw new Error("--revenue must be greater than 0");

  const memoBase = opts.memo ?? `polis digest ${digest.id}`;

  console.log(`digest:    ${digest.id}`);
  console.log(`revenue:   ${formatUnits(revenue, 6)} USDC`);
  console.log(
    `splits:    contributors ${splits.contributors / 100}% / reviewers ${splits.reviewers / 100}% / treasury ${splits.treasury / 100}% / referrals ${splits.referrals / 100}%`,
  );
  console.log(`registry:  ${registryAddress}`);
  console.log(`router:    ${routerAddress}`);
  console.log(`mode:      ${opts.dryRun ? "dry-run" : "live"}`);

  const { account, publicClient, walletClient } = buildClients(cfg);

  const plan: PayoutPlanItem[] = [];
  let totalAmount = 0n;
  for (const share of digest.economics.contributorShares) {
    const peerBytes32 = normalizePeerId(share.from);
    const agent = await publicClient.readContract({
      address: registryAddress,
      abi: AGENT_REGISTRY_ABI,
      functionName: "agents",
      args: [peerBytes32],
    });
    const owner = agent[0];
    if (owner === zeroAddress) {
      console.warn(`  skip ${shortPeer(share.from)} — not registered in AgentRegistry`);
      continue;
    }
    const amount = (revenue * BigInt(share.shareBps)) / 10000n;
    if (amount === 0n) {
      console.warn(`  skip ${shortPeer(share.from)} — payout rounds to 0`);
      continue;
    }
    plan.push({
      peer: share.from,
      owner,
      amount,
      shareBps: share.shareBps,
      signalCount: share.signalCount,
    });
    totalAmount += amount;
  }

  if (plan.length === 0) {
    throw new Error("no payable contributors after filtering — nothing to do");
  }

  console.log(`\npayout plan (${plan.length} contributor${plan.length === 1 ? "" : "s"}):`);
  for (const item of plan) {
    console.log(
      `  ${shortPeer(item.peer)}  ->  ${item.owner}  ${formatUnits(item.amount, 6)} USDC  (${item.shareBps / 100}% of revenue, ${item.signalCount} signal${item.signalCount === 1 ? "" : "s"})`,
    );
  }
  console.log(`  total contributor payouts: ${formatUnits(totalAmount, 6)} USDC`);
  console.log(`  PaymentRouter skims 1% from each pay() to treasury`);

  if (opts.dryRun) {
    console.log("\ndry-run — no transactions submitted.");
    return;
  }

  console.log(`\npayer: ${account.address}`);

  if (opts.approve) {
    console.log(`\napproving ${formatUnits(totalAmount, 6)} USDC for router...`);
    const approveHash = await walletClient.writeContract({
      address: cfg.usdc,
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [routerAddress, totalAmount],
    });
    console.log(`approve tx: ${approveHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: approveHash });
    if (receipt.status === "reverted") throw new Error("approve tx reverted");
  }

  console.log("\nsubmitting payouts...");
  const receipts: Array<{
    peer: string;
    owner: `0x${string}`;
    amount: bigint;
    hash: `0x${string}`;
    block: bigint;
  }> = [];
  for (const item of plan) {
    const hash = await walletClient.writeContract({
      address: routerAddress,
      abi: PAYMENT_ROUTER_ABI,
      functionName: "pay",
      args: [item.owner, item.amount, `${memoBase} -> ${shortPeer(item.peer)}`],
    });
    console.log(`  pay ${shortPeer(item.peer)} -> ${item.owner}: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") throw new Error(`pay tx reverted for ${item.peer}`);
    receipts.push({
      peer: item.peer,
      owner: item.owner,
      amount: item.amount,
      hash,
      block: receipt.blockNumber,
    });
  }

  console.log(`\ndone. ${receipts.length} payout${receipts.length === 1 ? "" : "s"} confirmed.`);
  for (const r of receipts) {
    console.log(
      `  ${shortPeer(r.peer)}  ${formatUnits(r.amount, 6)} USDC  block=${r.block}  tx=${r.hash}`,
    );
  }

  persistRouter(cfg, routerAddress);
}

function loadDigest(path: string): DigestSummary {
  const resolved = resolve(path);
  let raw: string;
  try {
    raw = readFileSync(resolved, "utf8");
  } catch (err) {
    throw new Error(`failed to read digest at ${resolved}: ${(err as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`digest at ${resolved} is not valid JSON: ${(err as Error).message}`);
  }
  if (!isDigestSummary(parsed)) {
    throw new Error(`digest at ${resolved} is missing id or economics`);
  }
  return parsed;
}

function isDigestSummary(value: unknown): value is DigestSummary {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<DigestSummary>;
  if (typeof v.id !== "string") return false;
  if (!v.economics || typeof v.economics !== "object") return false;
  if (!Array.isArray(v.economics.contributorShares)) return false;
  if (!v.economics.splitBps || typeof v.economics.splitBps !== "object") return false;
  return true;
}

function normalizePeerId(peerId: string): `0x${string}` {
  const hex = peerId.startsWith("0x") ? peerId.slice(2) : peerId;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`peerId must be a 64-character hex AXL public key, got "${peerId}"`);
  }
  return `0x${hex}`;
}

function shortPeer(peerId: string): string {
  const hex = peerId.startsWith("0x") ? peerId.slice(2) : peerId;
  return hex.length > 10 ? `${hex.slice(0, 10)}...` : peerId;
}

function persistRouter(cfg: PolisConfig, addr: `0x${string}`): void {
  if (cfg.paymentRouterAddress === addr) return;
  writeConfig({ ...cfg, paymentRouterAddress: addr });
  console.log("saved PaymentRouter address to ~/.polis/config.json");
}
