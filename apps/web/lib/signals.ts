/**
 * Signal parsing + archive loading for any web route that surfaces archived
 * TownMessages (filed by `polis signal`).
 *
 * Signals land on disk as JSON. The body is a markdown-like SIGNAL block with
 * `headline:`, `beat:`, `sources:`, `tags:`, `confidence:`, and `analysis:`
 * fields. Those structured fields aren't part of the on-the-wire TownMessage
 * (they live inside `content`) so consumers need a parser to pull them out.
 *
 * We replicate the archive scan locally rather than depending on
 * `@polis/newsletter` to keep the web bundle small and avoid pulling in
 * Resend / Groq / OpenAI transitive deps.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ArchivedSignalRecord {
  v: 1;
  kind: string;
  topic: string;
  from: string;
  content: string;
  ts: number;
  archiveUri?: string;
  archiveTxHash?: string;
}

export interface ParsedSignal {
  id: string;
  ts: number;
  kind: string;
  topic: string;
  beat?: string;
  from: string;
  content: string;
  archiveUri?: string;
  archiveTxHash?: string;
  sources?: string[];
  tags?: string[];
  confidence?: string;
  headline?: string;
}

export interface LoadSignalsOptions {
  topic?: string;
  beat?: string;
  peer?: string;
  sinceTs?: number;
  limit?: number;
}

/** Default archive directory, configurable via POLIS_ARCHIVE_DIR. */
export function archiveDir(): string {
  return process.env.POLIS_ARCHIVE_DIR ?? join(homedir(), ".polis", "archive");
}

/**
 * Scan `~/.polis/archive/` for archived signals and return them parsed +
 * sorted DESC by timestamp. Returns an empty array if the directory does not
 * exist (production deploys without local archive).
 */
export function loadArchivedSignals(opts: LoadSignalsOptions = {}): ParsedSignal[] {
  const dir = archiveDir();
  if (!existsSync(dir)) return [];

  const out: ParsedSignal[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, name), "utf8"));
    } catch {
      continue;
    }
    if (!isArchivedSignalRecord(parsed)) continue;
    if (parsed.kind !== "signal") continue;
    if (opts.topic && parsed.topic !== opts.topic) continue;
    if (opts.peer && parsed.from !== opts.peer) continue;
    if (opts.sinceTs && parsed.ts < opts.sinceTs) continue;
    const signal = parseSignal(parsed, name.replace(/\.json$/, ""));
    if (isInternalScoutingSignal(signal)) continue;
    if (opts.beat && signal.beat !== opts.beat) continue;
    out.push(signal);
  }

  out.sort((a, b) => b.ts - a.ts);
  return typeof opts.limit === "number" ? out.slice(0, opts.limit) : out;
}

export function parseSignal(record: ArchivedSignalRecord, id: string): ParsedSignal {
  const meta = parseSignalBody(record.content);
  const top = record as ArchivedSignalRecord & {
    beat?: unknown;
    source?: unknown;
    tag?: unknown;
    confidence?: unknown;
  };

  return {
    id,
    ts: record.ts,
    kind: record.kind,
    topic: record.topic,
    from: record.from,
    content: record.content,
    archiveUri: record.archiveUri ?? localArchiveUri(id),
    archiveTxHash: record.archiveTxHash,
    beat:
      typeof top.beat === "string" && top.beat
        ? top.beat
        : meta.beat ?? beatFromTopic(record.topic),
    sources: Array.isArray(top.source)
      ? top.source.filter((s: unknown): s is string => typeof s === "string")
      : meta.sources,
    tags: Array.isArray(top.tag)
      ? top.tag.filter((t: unknown): t is string => typeof t === "string")
      : meta.tags,
    confidence: typeof top.confidence === "string" ? top.confidence : meta.confidence,
    headline: meta.headline,
  };
}

function localArchiveUri(id: string): string | undefined {
  return /^[0-9a-fA-F]{64}$/.test(id)
    ? `polis-local://sha256/${id.toLowerCase()}`
    : undefined;
}

export function isArchivedSignalRecord(value: unknown): value is ArchivedSignalRecord {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.v === 1 &&
    typeof v.kind === "string" &&
    typeof v.topic === "string" &&
    typeof v.from === "string" &&
    typeof v.content === "string" &&
    typeof v.ts === "number"
  );
}

interface SignalBodyMeta {
  headline?: string;
  beat?: string;
  sources?: string[];
  tags?: string[];
  confidence?: string;
}

function parseSignalBody(content: string): SignalBodyMeta {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== "SIGNAL") return {};

  const out: SignalBodyMeta = {};
  const sources: string[] = [];
  let inSources = false;

  for (const rawLine of lines.slice(1)) {
    const line = rawLine.trim();
    if (line === "analysis:") break;
    if (line === "sources:") {
      inSources = true;
      continue;
    }
    if (inSources && line.startsWith("- ")) {
      const source = line.slice(2).trim();
      if (source) sources.push(source);
      continue;
    }
    inSources = false;

    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === "headline" && value) out.headline = value;
    if (key === "beat" && value) out.beat = value;
    if (key === "confidence" && value) out.confidence = value;
    if (key === "tags" && value) {
      out.tags = value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
  }

  if (sources.length > 0) out.sources = sources;
  return out;
}

export function beatFromTopic(topic: string): string | undefined {
  return topic.startsWith("town.") ? topic.slice("town.".length) : undefined;
}

function isInternalScoutingSignal(signal: ParsedSignal): boolean {
  const tags = signal.tags ?? [];
  if (tags.some((tag) => tag.toLowerCase() === "competitor")) return true;
  const text = [signal.headline, signal.content, ...(signal.sources ?? [])]
    .filter((part): part is string => Boolean(part))
    .join("\n");
  return /\bAIBTC\b/i.test(text) || /closest peers to Polis/i.test(text);
}

/** Display-friendly version of the archive directory path for messaging. */
export function displayArchiveDir(): string {
  if (process.env.POLIS_ARCHIVE_DIR) return "$POLIS_ARCHIVE_DIR";
  const home = homedir();
  const dir = archiveDir();
  return dir.startsWith(home) ? dir.replace(home, "~") : dir;
}
