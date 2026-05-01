#!/usr/bin/env node
// One-shot script to register a Sepolia ENS name + set address + com.polis.peer
// text record, owned by the Sepolia wallet at ~/.polis-ens-sepolia/wallet.json.
//
// Usage:
//   node scripts/ens-register-sepolia.mjs <name>            # register <name>.eth
//   node scripts/ens-register-sepolia.mjs <name> --check    # only check availability

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { http, createPublicClient, createWalletClient, parseEther } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { addEnsContracts } from "@ensdomains/ensjs";
import { getAvailable, getPrice } from "@ensdomains/ensjs/public";
import { commitName, registerName } from "@ensdomains/ensjs/wallet";

const SEPOLIA_RPC =
  process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const POLIS_MAIN_WALLET = "0x7e3Edad28b4Abe55C8c40d9b1bC82280cC05933D";
const POLIS_AXL_PEER = "8bdcfcdcd6f720beea3759b856c499d61868b76a36fc98ebe63bcb44c916bcb0";
const POLIS_REGISTRY = "0xAFb77Ad4626b9A2ECA78905F7420102FB5F2A930";
const SEPOLIA_PUBLIC_RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";

function loadKey() {
  const path = join(homedir(), ".polis-ens-sepolia", "wallet.json");
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const baseName = args[0];
  const checkOnly = args.includes("--check");
  if (!baseName) {
    console.error("Usage: ens-register-sepolia.mjs <baseName> [--check]");
    process.exit(1);
  }
  if (baseName.endsWith(".eth")) {
    console.error("Pass the base name without the .eth suffix.");
    process.exit(1);
  }
  if (baseName.length < 3) {
    console.error("Name must be at least 3 characters.");
    process.exit(1);
  }
  const fullName = `${baseName}.eth`;

  const chain = addEnsContracts(sepolia);
  const publicClient = createPublicClient({ chain, transport: http(SEPOLIA_RPC) });

  const available = await getAvailable(publicClient, { name: fullName });
  console.log(`name: ${fullName}`);
  console.log(`available on Sepolia: ${available}`);
  if (!available) {
    console.log("→ taken. Try a different base name.");
    process.exit(checkOnly ? 0 : 1);
  }

  const duration = 60 * 60 * 24 * 365; // 1 year in seconds
  const price = await getPrice(publicClient, { nameOrNames: fullName, duration });
  const total = price.base + price.premium;
  console.log(`registration price: ${Number(total) / 1e18} Sepolia ETH (1 year)`);

  if (checkOnly) {
    console.log("--check only; not registering.");
    process.exit(0);
  }

  const key = loadKey();
  const account = privateKeyToAccount(key.privateKey);
  console.log(`registering owner: ${account.address}`);
  console.log(`address record will resolve to: ${POLIS_MAIN_WALLET}`);
  console.log(`com.polis.peer text record: ${POLIS_AXL_PEER}`);

  const balanceHex = await publicClient.request({
    method: "eth_getBalance",
    params: [account.address, "latest"],
  });
  const balance = BigInt(balanceHex);
  console.log(`wallet balance: ${Number(balance) / 1e18} Sepolia ETH`);
  if (balance < total + parseEther("0.02")) {
    throw new Error("insufficient balance — need price + ~0.02 ETH headroom");
  }

  const wallet = createWalletClient({ account, chain, transport: http(SEPOLIA_RPC) });

  const secretBytes = new Uint8Array(32);
  crypto.getRandomValues(secretBytes);
  const secret = `0x${Buffer.from(secretBytes).toString("hex")}`;

  const records = {
    coins: [{ coin: "eth", value: POLIS_MAIN_WALLET }],
    texts: [
      { key: "com.polis.peer", value: POLIS_AXL_PEER },
      {
        key: "com.polis.agent",
        value: JSON.stringify({
          role: "polis",
          beats: ["openagents", "gensyn-infra", "delphi-markets"],
          runtime: "polis-network",
        }),
      },
      { key: "com.polis.registry", value: POLIS_REGISTRY },
      { key: "url", value: "https://github.com/KaranSinghBisht/polis-network" },
      {
        key: "description",
        value: "Polis BYOA agent — files sourced intelligence over Gensyn AXL.",
      },
    ],
  };

  const commitParams = {
    name: fullName,
    owner: account.address,
    duration,
    secret,
    resolverAddress: SEPOLIA_PUBLIC_RESOLVER,
    records,
    reverseRecord: false,
  };

  console.log("\nstep 1/3: committing...");
  const commitHash = await commitName(wallet, commitParams);
  console.log(`commit tx: ${commitHash}`);
  await publicClient.waitForTransactionReceipt({ hash: commitHash });

  console.log("\nstep 2/3: waiting 65 seconds for the ENS commit window...");
  await sleep(65_000);

  console.log("\nstep 3/3: registering + writing records...");
  const registerHash = await registerName(wallet, {
    ...commitParams,
    value: total,
  });
  console.log(`register tx: ${registerHash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: registerHash });
  if (receipt.status === "reverted") throw new Error("register tx reverted");
  console.log(`registered in block ${receipt.blockNumber}.`);

  console.log("\ndone:");
  console.log(`  ENS name:        ${fullName}`);
  console.log(`  owner (Sepolia): ${account.address}`);
  console.log(`  address record:  ${POLIS_MAIN_WALLET}`);
  console.log(`  com.polis.peer:  ${POLIS_AXL_PEER}`);
  console.log(`\nVerify next:`);
  console.log(`  polis ens ${fullName} --eth-rpc-url ${SEPOLIA_RPC} --require-peer-text`);
}

main().catch((err) => {
  console.error("ens-register error:", err);
  process.exit(1);
});
