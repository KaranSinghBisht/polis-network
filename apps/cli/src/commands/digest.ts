import { join } from "node:path";
import {
  compileDigest,
  loadSignalsFromArchive,
  sendDigestEmail,
  writeDigestFiles,
} from "@polis/newsletter";
import { createLlmClient, replayConfigFromEnv, wrapWithReplay } from "@polis/runtime";
import {
  configExists,
  defaultArchiveDir,
  polisDir,
  readConfig,
} from "../config.js";

export interface DigestOptions {
  topic?: string;
  archiveDir?: string;
  outDir?: string;
  limit: number;
  send: boolean;
  from?: string;
  to?: string;
  subject?: string;
  model?: string;
  maxTokens: number;
  generatedAt?: string;
}

export async function runDigest(opts: DigestOptions): Promise<void> {
  if (!Number.isFinite(opts.limit) || opts.limit < 1) {
    throw new Error("--limit must be a positive integer");
  }
  if (!Number.isFinite(opts.maxTokens) || opts.maxTokens < 128) {
    throw new Error("--max-tokens must be an integer >= 128");
  }

  const cfg = configExists() ? readConfig() : undefined;
  const archiveDir = opts.archiveDir ?? cfg?.storage?.archiveDir ?? defaultArchiveDir();
  const outDir = opts.outDir ?? join(polisDir(), "digests");
  const signals = loadSignalsFromArchive(archiveDir, {
    topic: opts.topic,
    limit: opts.limit,
  });
  if (signals.length === 0) {
    throw new Error(
      `no archived TownMessage signals found in ${archiveDir}; run agents with --storage local or pass --archive-dir`,
    );
  }

  const generatedAt = opts.generatedAt ? new Date(opts.generatedAt) : undefined;
  if (generatedAt && Number.isNaN(generatedAt.getTime())) {
    throw new Error("--generated-at must be a valid ISO date/time");
  }

  const baseLlm = createLlmClient();
  const llm = wrapWithReplay(baseLlm, replayConfigFromEnv());
  console.log(
    `compiling digest from ${signals.length} signals using ${llm.provider}/${opts.model ?? llm.defaultModel}`,
  );
  const digest = await compileDigest({
    llm,
    signals,
    topic: opts.topic,
    generatedAt,
    model: opts.model,
    maxTokens: opts.maxTokens,
  });

  const paths = writeDigestFiles(digest, { outDir });
  console.log(`digest markdown: ${paths.markdown}`);
  console.log(`digest html: ${paths.html}`);
  console.log(`digest json: ${paths.json}`);

  if (!opts.send) {
    console.log("send skipped; pass --send with RESEND_API_KEY, --from, and --to to deliver");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("--send requires RESEND_API_KEY");
  const from = opts.from ?? process.env.POLIS_NEWSLETTER_FROM;
  if (!from) throw new Error("--send requires --from or POLIS_NEWSLETTER_FROM");
  const to = parseRecipients(opts.to ?? process.env.POLIS_NEWSLETTER_TO);
  if (to.length === 0) throw new Error("--send requires --to or POLIS_NEWSLETTER_TO");

  const result = await sendDigestEmail({
    apiKey,
    from,
    to,
    subject: opts.subject,
    digest,
  });
  console.log(`sent digest email: ${result.id}`);
}

function parseRecipients(value?: string): string[] {
  return (value ?? "")
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}
