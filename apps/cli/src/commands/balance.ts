import { readConfig } from "../config.js";
import { buildClients } from "../viem.js";

const ERC20_BALANCE_OF_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export async function runBalance(): Promise<void> {
  const cfg = readConfig();
  const { account, publicClient } = buildClients(cfg);

  const [ethBalance, usdcBalance] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({
      address: cfg.usdc,
      abi: ERC20_BALANCE_OF_ABI,
      functionName: "balanceOf",
      args: [account.address],
    }) as Promise<bigint>,
  ]);

  console.log(`network: ${cfg.network} (chainId ${cfg.chainId})`);
  console.log(`wallet:  ${account.address}`);
  console.log(`ETH:     ${(Number(ethBalance) / 1e18).toFixed(6)}`);
  console.log(`USDC:    ${(Number(usdcBalance) / 1e6).toFixed(6)}`);
}
