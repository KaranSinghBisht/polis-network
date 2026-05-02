import { privateKeyToAccount } from "viem/accounts";
import { readConfig } from "../config.js";
import { derivePeerId } from "../peer.js";

export interface ClaimOptions {
  code: string;
  baseUrl?: string;
}

const DEFAULT_BASE_URL = "https://polis-web.vercel.app";

export async function runClaim(opts: ClaimOptions): Promise<void> {
  const code = opts.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,12}$/.test(code)) {
    throw new Error("--code must be the 8-character claim code from polis-web /me");
  }

  const cfg = readConfig();
  const peer = derivePeerId(cfg.axl.keyPath).hex;
  const account = privateKeyToAccount(cfg.privateKey);
  const timestamp = Math.floor(Date.now() / 1000);
  const baseUrl = (opts.baseUrl ?? process.env.POLIS_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const origin = new URL(baseUrl).origin;
  const domain = new URL(origin).host;
  const endpoint = `${origin}/api/claim`;

  const message = [
    "polis:claim:v1",
    `domain=${domain}`,
    `uri=${origin}`,
    `peer=${peer.toLowerCase()}`,
    `code=${code}`,
    `ts=${timestamp}`,
  ].join("\n");

  const signature = await account.signMessage({ message });

  console.log(`code:    ${code}`);
  console.log(`peer:    ${peer}`);
  console.log(`wallet:  ${account.address}`);
  console.log(`server:  ${endpoint}`);
  console.log("");
  console.log("signing claim message...");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      peer,
      code,
      signature,
      signerAddress: account.address,
      timestamp,
    }),
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* ignore */
  }

  if (!res.ok || !(body && (body as { ok?: boolean }).ok)) {
    const err = (body as { error?: string } | null)?.error ?? text.slice(0, 200);
    throw new Error(`claim failed (${res.status}): ${err}`);
  }

  console.log("");
  console.log("✓ claim accepted");
  const claim = (body as { claim?: { ownerWallet: string; claimedAt: number } }).claim;
  if (claim) {
    console.log(`  owner wallet: ${claim.ownerWallet}`);
    console.log(`  claimed at:  ${new Date(claim.claimedAt).toISOString()}`);
  }
  console.log("");
  console.log("Verify on the public seat:");
  console.log(`  ${baseUrl}/me`);
}
