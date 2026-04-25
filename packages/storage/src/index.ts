import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Wallet, JsonRpcProvider } from "ethers";
import { Indexer, ZgFile } from "@0glabs/0g-ts-sdk";

export type StorageProvider = "local" | "0g" | "none";

export interface PutResult {
  provider: StorageProvider;
  uri: string;
  cid: string;
  txHash?: string;
  path?: string;
}

export interface PutOptions {
  provider: StorageProvider;
  archiveDir: string;
  zeroG?: {
    rpcUrl: string;
    indexerRpcUrl: string;
    privateKey: string;
  };
}

export async function putJson(value: unknown, opts: PutOptions): Promise<PutResult | null> {
  if (opts.provider === "none") return null;

  const payload = stableJson(value);
  if (opts.provider === "local") {
    return putLocal(payload, opts.archiveDir);
  }
  return putZeroG(payload, opts);
}

function putLocal(payload: string, archiveDir: string): PutResult {
  mkdirSync(archiveDir, { recursive: true, mode: 0o700 });
  const cid = sha256Hex(payload);
  const path = join(archiveDir, `${cid}.json`);
  writeFileSync(path, payload, { mode: 0o600 });
  return {
    provider: "local",
    cid,
    uri: `polis-local://sha256/${cid}`,
    path,
  };
}

async function putZeroG(payload: string, opts: PutOptions): Promise<PutResult> {
  if (!opts.zeroG?.rpcUrl || !opts.zeroG.indexerRpcUrl || !opts.zeroG.privateKey) {
    throw new Error(
      "0G storage requires ZERO_G_RPC, ZERO_G_INDEXER_RPC, and a configured private key",
    );
  }

  mkdirSync(opts.archiveDir, { recursive: true, mode: 0o700 });
  const cid = sha256Hex(payload);
  const path = join(tmpdir(), `polis-0g-${cid}.json`);
  writeFileSync(path, payload, { mode: 0o600 });

  const file = await ZgFile.fromFilePath(path);
  try {
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr !== null || tree === null) {
      throw new Error(`0G merkle tree failed: ${String(treeErr)}`);
    }

    const provider = new JsonRpcProvider(opts.zeroG.rpcUrl);
    const signer = new Wallet(opts.zeroG.privateKey, provider);
    const indexer = new Indexer(opts.zeroG.indexerRpcUrl);
    const [tx, uploadErr] = await indexer.upload(
      file,
      opts.zeroG.rpcUrl,
      signer as never,
    );
    if (uploadErr !== null) {
      throw new Error(`0G upload failed: ${String(uploadErr)}`);
    }

    const rootHash = String(tree.rootHash());
    return {
      provider: "0g",
      cid: rootHash,
      uri: `0g://${rootHash}`,
      txHash: String(tx),
      path,
    };
  } finally {
    await file.close();
  }
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value !== "object" || value === null) return value;

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return Object.fromEntries(entries.map(([key, item]) => [key, sortValue(item)]));
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
