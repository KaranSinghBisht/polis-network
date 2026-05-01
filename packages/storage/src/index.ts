import { createHash } from "node:crypto";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Wallet, JsonRpcProvider } from "ethers";
import { Indexer, ZgFile } from "@0gfoundation/0g-storage-ts-sdk";

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
    /** Optional 0G replication factor; defaults to SDK default (1) when unset. */
    expectedReplica?: number;
  };
}

export interface GetZeroGOptions {
  indexerRpcUrl: string;
  outPath: string;
  proof?: boolean;
}

export interface GetZeroGResult {
  provider: "0g";
  uri: string;
  cid: string;
  path: string;
  bytes: number;
}

export async function putJson(value: unknown, opts: PutOptions): Promise<PutResult | null> {
  if (opts.provider === "none") return null;

  const payload = stableJson(value);
  if (opts.provider === "local") {
    return putLocal(payload, opts.archiveDir);
  }
  return putZeroG(payload, opts);
}

export async function getZeroG(uriOrRootHash: string, opts: GetZeroGOptions): Promise<GetZeroGResult> {
  if (!opts.indexerRpcUrl) {
    throw new Error("0G download requires ZERO_G_INDEXER_RPC or --indexer-rpc-url");
  }

  const rootHash = parseZeroGRoot(uriOrRootHash);
  mkdirSync(dirname(opts.outPath), { recursive: true, mode: 0o700 });
  const indexer = new Indexer(opts.indexerRpcUrl);
  const err = await indexer.download(rootHash, opts.outPath, opts.proof ?? false);
  if (err !== null) {
    throw new Error(`0G download failed: ${err.message}`);
  }

  return {
    provider: "0g",
    uri: `0g://${rootHash}`,
    cid: rootHash,
    path: opts.outPath,
    bytes: statSync(opts.outPath).size,
  };
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
    const replica =
      typeof opts.zeroG.expectedReplica === "number" && opts.zeroG.expectedReplica > 1
        ? opts.zeroG.expectedReplica
        : undefined;
    const [upload, uploadErr] = replica
      ? await indexer.upload(file, opts.zeroG.rpcUrl, signer as never, { expectedReplica: replica })
      : await indexer.upload(file, opts.zeroG.rpcUrl, signer as never);
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

export function parseZeroGRoot(uriOrRootHash: string): string {
  const raw = uriOrRootHash.startsWith("0g://")
    ? uriOrRootHash.slice("0g://".length)
    : uriOrRootHash;
  const value = raw.startsWith("0X") ? `0x${raw.slice(2)}` : raw;
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("expected a 0g://0x<64-hex> URI or 0x<64-hex> root hash");
  }
  return value.toLowerCase();
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
