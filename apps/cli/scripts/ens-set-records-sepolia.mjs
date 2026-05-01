#!/usr/bin/env node
// Add com.polis.roles + com.polis.topics text records to polis-agent.eth on
// Sepolia, using the Sepolia owner wallet at ~/.polis-ens-sepolia/wallet.json.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { http, createPublicClient, createWalletClient } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { addEnsContracts } from "@ensdomains/ensjs";
import { setRecords } from "@ensdomains/ensjs/wallet";

const SEPOLIA_RPC =
  process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const NAME = "polis-agent.eth";
const RESOLVER = "0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5";

function loadKey() {
  const path = join(homedir(), ".polis-ens-sepolia", "wallet.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

async function main() {
  const chain = addEnsContracts(sepolia);
  const publicClient = createPublicClient({ chain, transport: http(SEPOLIA_RPC) });
  const key = loadKey();
  const account = privateKeyToAccount(key.privateKey);
  const wallet = createWalletClient({ account, chain, transport: http(SEPOLIA_RPC) });

  console.log(`updating records for ${NAME}`);
  console.log(`signer: ${account.address}`);

  const hash = await setRecords(wallet, {
    name: NAME,
    resolverAddress: RESOLVER,
    texts: [
      { key: "com.polis.roles", value: "scout,analyst,skeptic,editor,archivist,treasurer" },
      { key: "com.polis.topics", value: "openagents,gensyn-infra,delphi-markets,0g-storage,ens-identity" },
    ],
  });

  console.log(`tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status === "reverted") throw new Error("setRecords reverted");
  console.log(`done in block ${receipt.blockNumber}.`);
  console.log(`\nverify with:`);
  console.log(`  polis ens ${NAME} --eth-rpc-url ${SEPOLIA_RPC} --json`);
}

main().catch((err) => {
  console.error("ens-set-records error:", err);
  process.exit(1);
});
