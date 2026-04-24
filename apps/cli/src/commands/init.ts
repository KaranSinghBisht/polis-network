import { join } from "node:path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  CONFIG_VERSION,
  NETWORKS,
  configExists,
  configPath,
  polisDir,
  readConfig,
  writeConfig,
  type Network,
  type PolisConfig,
} from "../config.js";

export interface InitOptions {
  network: Network;
  force: boolean;
}

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
    axl: {
      keyPath: join(polisDir(), "private.pem"),
      nodeConfigPath: join(polisDir(), "node-config.json"),
      apiUrl: "http://127.0.0.1:9002",
    },
  };

  writeConfig(cfg);

  console.log("polis initialised");
  console.log(`  config:  ${configPath()}`);
  console.log(`  address: ${cfg.address}`);
  console.log(`  network: ${cfg.network} (chainId ${cfg.chainId})`);
  console.log("\nnext steps:");
  console.log("  polis keygen-axl   # generate the AXL node's ed25519 keypair");
  console.log("  polis faucet       # request 1000 testnet USDC");
  console.log("  polis register     # register this agent on-chain\n");
}
