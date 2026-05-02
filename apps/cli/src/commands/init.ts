import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  CONFIG_VERSION,
  NETWORKS,
  configExists,
  configPath,
  defaultArchiveDir,
  polisDir,
  readConfig,
  writeConfig,
  type Network,
  type PolisConfig,
} from "../config.js";
import { runKeygenAxl } from "./keygen-axl.js";

export interface InitOptions {
  network: Network;
  force: boolean;
}

const DEMO_DEPLOYMENTS: Partial<Record<Network, {
  registryAddress: `0x${string}`;
  paymentRouterAddress: `0x${string}`;
}>> = {
  testnet: {
    registryAddress: "0xAFb77Ad4626b9A2ECA78905F7420102FB5F2A930",
    paymentRouterAddress: "0x28490ac9B3b8a77F92c4d892BCd5a48eeAd67eD8",
  },
};

export async function runInit(opts: InitOptions): Promise<void> {
  if (configExists() && !opts.force) {
    const existing = readConfig();
    console.log("polis already initialised");
    console.log(`  config:  ${configPath()}`);
    console.log(`  address: ${existing.address}`);
    console.log(`  network: ${existing.network} (chainId ${existing.chainId})`);
    console.log("\nre-run with --force to overwrite.");
    return;
  }

  const net = NETWORKS[opts.network];
  const deployments = DEMO_DEPLOYMENTS[opts.network];
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);

  const cfg: PolisConfig = {
    version: CONFIG_VERSION,
    network: opts.network,
    privateKey,
    address: account.address,
    chainId: net.chainId,
    rpcUrl: net.rpcUrl,
    usdc: net.usdc,
    ...(deployments ?? {}),
    axl: {
      keyPath: join(polisDir(), "private.pem"),
      nodeConfigPath: join(polisDir(), "node-config.json"),
      apiUrl: "http://127.0.0.1:9002",
    },
    storage: {
      provider: "local",
      archiveDir: defaultArchiveDir(),
      zeroGRpcUrl: process.env.ZERO_G_RPC,
      zeroGIndexerRpcUrl: process.env.ZERO_G_INDEXER_RPC,
    },
  };

  writeConfig(cfg);
  runKeygenAxl({ force: true });

  console.log("polis initialised");
  console.log(`  config:  ${configPath()}`);
  console.log(`  address: ${cfg.address}`);
  console.log(`  network: ${cfg.network} (chainId ${cfg.chainId})`);
  if (cfg.registryAddress) console.log(`  registry: ${cfg.registryAddress}`);
  console.log("\nnext steps:");
  console.log("  polis faucet       # request 1000 testnet USDC");
  console.log("  polis register     # register this agent on-chain\n");
}
