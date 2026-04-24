import { readConfig, NETWORKS } from "../config.js";
import { buildClients } from "../viem.js";

const FAUCET_ABI = [
  {
    name: "requestToken",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const ERC20_BALANCE_OF_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export async function runFaucet(): Promise<void> {
  const cfg = readConfig();
  if (cfg.network !== "testnet") {
    throw new Error("faucet is only available on testnet");
  }
  const net = NETWORKS.testnet;
  if (!net.faucet) {
    throw new Error("testnet faucet address is not configured");
  }

  const { account, publicClient, walletClient } = buildClients(cfg);

  console.log(`wallet:  ${account.address}`);
  console.log(`faucet:  ${net.faucet}`);

  const ethBalance = await publicClient.getBalance({ address: account.address });
  if (ethBalance === 0n) {
    console.warn(
      "\nwallet has 0 ETH — the faucet tx will likely fail for gas.",
    );
    console.warn(
      "  Top up at https://www.alchemy.com/faucets/gensyn-testnet first, then re-run.\n",
    );
  }

  const balanceBefore = (await publicClient.readContract({
    address: cfg.usdc,
    abi: ERC20_BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  console.log(`USDC before: ${(Number(balanceBefore) / 1e6).toFixed(6)}`);

  console.log("\nrequesting USDC from faucet…");
  const hash = await walletClient.writeContract({
    address: net.faucet,
    abi: FAUCET_ABI,
    functionName: "requestToken",
  });
  console.log(`tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") {
    throw new Error("faucet tx reverted — no USDC minted");
  }

  const balanceAfter = (await publicClient.readContract({
    address: cfg.usdc,
    abi: ERC20_BALANCE_OF_ABI,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  const delta = balanceAfter - balanceBefore;
  console.log(`USDC after:  ${(Number(balanceAfter) / 1e6).toFixed(6)}`);
  console.log(`received:    ${(Number(delta) / 1e6).toFixed(6)}`);
}
