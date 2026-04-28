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
  const cid = sha256Hex(payload);
  const path = writeArchiveFile(archiveDir, cid, payload);
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
    const [upload, uploadErr] = await indexer.upload(
      file,
      opts.zeroG.rpcUrl,
      signer as never,
    );
    if (uploadErr !== null) {
      throw new Error(`0G upload failed: ${String(uploadErr)}`);
    }

    const txHash = extractUploadTxHash(upload);
    const rootHash = extractUploadRootHash(upload) ?? String(tree.rootHash());
    const uri = `0g://${rootHash}`;
    const archivePath = writeArchiveFile(
      opts.archiveDir,
      safeFileStem(rootHash),
      annotateArchivePayload(payload, uri, txHash),
    );
    return {
      provider: "0g",
      cid: rootHash,
      uri,
      txHash,
      path: archivePath,
    };
  } finally {
    await file.close();
  }
}

function writeArchiveFile(archiveDir: string, fileStem: string, payload: string): string {
  mkdirSync(archiveDir, { recursive: true, mode: 0o700 });
  const path = join(archiveDir, `${fileStem}.json`);
  writeFileSync(path, payload, { mode: 0o600 });
  return path;
}

function safeFileStem(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function extractUploadTxHash(upload: unknown): string {
  if (typeof upload === "string" && upload.length > 0) return upload;
  if (typeof upload === "object" && upload !== null) {
    for (const key of ["txHash", "transactionHash", "hash"]) {
      const value = (upload as Record<string, unknown>)[key];
      if (typeof value === "string" && value.length > 0) return value;
    }
  }
  throw new Error(`0G upload returned no transaction hash: ${JSON.stringify(upload)}`);
}

function extractUploadRootHash(upload: unknown): string | undefined {
  if (typeof upload !== "object" || upload === null) return undefined;
  for (const key of ["rootHash", "root", "merkleRoot"]) {
    const value = (upload as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function annotateArchivePayload(payload: string, archiveUri: string, archiveTxHash: string): string {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return payload;
    }
    return stableJson({
      ...(parsed as Record<string, unknown>),
      archiveTxHash,
      archiveUri,
    });
  } catch {
    return payload;
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
