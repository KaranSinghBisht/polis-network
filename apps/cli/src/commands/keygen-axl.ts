import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { readConfig, ensurePolisDir } from "../config.js";

export interface KeygenAxlOptions {
  force: boolean;
}

export function runKeygenAxl(opts: KeygenAxlOptions): void {
  const cfg = readConfig();
  ensurePolisDir();
  const out = cfg.axl.keyPath;

  if (existsSync(out) && !opts.force) {
    console.log(`AXL key already exists at ${out}`);
    console.log("re-run with --force to overwrite.");
    return;
  }

  const result = spawnSync(
    "openssl",
    ["genpkey", "-algorithm", "ed25519", "-out", out],
    { stdio: "inherit" },
  );

  if (result.error) {
    throw new Error(`openssl not available: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`openssl exited with status ${result.status ?? "unknown"}`);
  }

  console.log(`AXL ed25519 keypair written to ${out}`);
  console.log("next: polis faucet   # request testnet USDC");
}
