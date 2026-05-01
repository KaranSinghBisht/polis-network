import { homedir } from "node:os";
import { join } from "node:path";
import { getZeroG, parseZeroGRoot } from "@polis/storage";
import { readConfig } from "../config.js";

export interface ArchiveGetOptions {
  out?: string;
  indexerRpcUrl?: string;
  proof?: boolean;
}

export async function runArchiveGet(uri: string, opts: ArchiveGetOptions): Promise<void> {
  const cfg = readConfig();
  const indexerRpcUrl =
    opts.indexerRpcUrl ?? cfg.storage?.zeroGIndexerRpcUrl ?? process.env.ZERO_G_INDEXER_RPC ?? "";
  const rootHash = parseZeroGRoot(uri);
  const archiveDir = cfg.storage?.archiveDir ?? join(homedir(), ".polis", "archive");
  const outPath = opts.out ?? join(archiveDir, `${rootHash}.download.json`);

  const result = await getZeroG(uri, {
    indexerRpcUrl,
    outPath,
    proof: opts.proof,
  });

  console.log(`archive: ${result.uri}`);
  console.log(`root:    ${result.cid}`);
  console.log(`path:    ${result.path}`);
  console.log(`bytes:   ${result.bytes}`);
}
