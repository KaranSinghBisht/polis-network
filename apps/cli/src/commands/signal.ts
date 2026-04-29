import type { StorageProvider } from "@polis/storage";
import { runPost } from "./post.js";

export interface SignalOptions {
  beat: string;
  body?: string;
  source?: string[];
  tag?: string[];
  confidence?: string;
  disclosure?: string;
  peer?: string;
  ens?: string;
  ensRpcUrl?: string;
  topic?: string;
  storage?: StorageProvider;
  index?: `0x${string}`;
}

export async function runSignal(headline: string, opts: SignalOptions): Promise<void> {
  const beat = normalizeSlug(opts.beat, "beat");
  const tags = (opts.tag ?? []).map((tag) => normalizeSlug(tag, "tag"));
  const confidence = normalizeConfidence(opts.confidence ?? "medium");
  const topic = opts.topic ?? `town.${beat}`;

  const content = formatSignal({
    headline: headline.trim(),
    beat,
    body: opts.body?.trim(),
    sources: opts.source ?? [],
    tags,
    confidence,
    disclosure: opts.disclosure?.trim(),
  });

  await runPost(content, {
    peer: opts.peer,
    ens: opts.ens,
    ensRpcUrl: opts.ensRpcUrl,
    topic,
    kind: "signal",
    storage: opts.storage,
    index: opts.index,
  });
}

function formatSignal(opts: {
  headline: string;
  beat: string;
  body?: string;
  sources: string[];
  tags: string[];
  confidence: "low" | "medium" | "high";
  disclosure?: string;
}): string {
  if (opts.headline.length === 0) throw new Error("signal headline cannot be empty");
  if (opts.headline.length > 160) throw new Error("signal headline must be 160 chars or less");
  if (opts.body && opts.body.length > 2_000) throw new Error("signal body must be 2000 chars or less");
  if (opts.sources.length > 5) throw new Error("signals support at most 5 sources");

  const lines = [
    "SIGNAL",
    `headline: ${opts.headline}`,
    `beat: ${opts.beat}`,
    `confidence: ${opts.confidence}`,
  ];

  if (opts.tags.length > 0) lines.push(`tags: ${opts.tags.join(", ")}`);
  if (opts.disclosure) lines.push(`disclosure: ${opts.disclosure}`);
  if (opts.sources.length > 0) {
    lines.push("sources:");
    for (const source of opts.sources) lines.push(`- ${source}`);
  }
  lines.push("analysis:");
  lines.push(opts.body ?? opts.headline);
  return lines.join("\n");
}

function normalizeSlug(value: string, label: string): string {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) {
    throw new Error(`${label} must be 3-50 chars: lowercase letters, numbers, hyphens`);
  }
  return slug;
}

function normalizeConfidence(value: string): "low" | "medium" | "high" {
  const normalized = value.trim().toLowerCase();
  if (normalized !== "low" && normalized !== "medium" && normalized !== "high") {
    throw new Error("--confidence must be low, medium, or high");
  }
  return normalized;
}
