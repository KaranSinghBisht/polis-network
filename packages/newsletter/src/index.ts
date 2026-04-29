import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import { Resend } from "resend";
import {
  isTownMessage,
  type LlmClient,
  type LlmResponse,
  type TownMessage,
} from "@polis/runtime";

export interface DigestSignal extends TownMessage {
  id: string;
  archivePath?: string;
}

export interface LoadSignalsOptions {
  topic?: string;
  sinceTs?: number;
  limit?: number;
}

export interface CompileDigestOptions {
  llm: LlmClient;
  signals: DigestSignal[];
  topic?: string;
  generatedAt?: Date;
  model?: string;
  maxTokens?: number;
}

export interface CompiledDigest {
  id: string;
  title: string;
  subject: string;
  markdown: string;
  html: string;
  text: string;
  generatedAt: string;
  topic?: string;
  signalCount: number;
  signals: Array<{
    id: string;
    from: string;
    topic: string;
    archiveUri?: string;
    ts: number;
  }>;
  economics: DigestEconomics;
  llm: {
    provider: string;
    model: string;
    usage?: LlmResponse["usage"];
  };
}

export interface DigestEconomics {
  revenueModel: "paid-brief";
  currency: "USDC";
  splitBps: {
    contributors: number;
    reviewers: number;
    treasury: number;
    referrals: number;
  };
  contributorShares: Array<{
    from: string;
    signalCount: number;
    shareBps: number;
  }>;
}

export interface WriteDigestOptions {
  outDir: string;
}

export interface DigestFilePaths {
  markdown: string;
  html: string;
  json: string;
}

export interface SendDigestEmailOptions {
  apiKey: string;
  from: string;
  to: string[];
  digest: CompiledDigest;
  subject?: string;
  idempotencyKey?: string;
}

export interface SendDigestEmailResult {
  id: string;
}

export function loadSignalsFromArchive(
  archiveDir: string,
  opts: LoadSignalsOptions = {},
): DigestSignal[] {
  if (!existsSync(archiveDir)) return [];

  const signals: DigestSignal[] = [];
  for (const name of readdirSync(archiveDir)) {
    if (!name.endsWith(".json")) continue;
    const path = join(archiveDir, name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      continue;
    }
    if (!isTownMessage(parsed)) continue;
    if (opts.topic && parsed.topic !== opts.topic) continue;
    if (opts.sinceTs && parsed.ts < opts.sinceTs) continue;
    signals.push({
      ...parsed,
      id: basename(name, ".json"),
      archivePath: path,
    });
  }

  signals.sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
  return typeof opts.limit === "number" && opts.limit > 0
    ? signals.slice(-opts.limit)
    : signals;
}

export async function compileDigest(opts: CompileDigestOptions): Promise<CompiledDigest> {
  if (opts.signals.length === 0) {
    throw new Error("cannot compile digest without agent signals");
  }

  const generatedAt = opts.generatedAt ?? new Date();
  const model = opts.model ?? opts.llm.defaultModel;
  const response = await opts.llm.complete({
    model,
    maxTokens: opts.maxTokens ?? 900,
    system: reviewerSystemPrompt(),
    userMessage: reviewerUserPrompt({
      generatedAt,
      topic: opts.topic,
      signals: opts.signals,
    }),
  });

  const markdown = normalizeMarkdown(response.text, generatedAt);
  const title = extractTitle(markdown) ?? `Polis Digest ${isoDate(generatedAt)}`;
  const subject = title.length > 90 ? `${title.slice(0, 87)}...` : title;
  const id = digestId(generatedAt, markdown);
  const digest: CompiledDigest = {
    id,
    title,
    subject,
    markdown,
    html: "",
    text: "",
    generatedAt: generatedAt.toISOString(),
    topic: opts.topic,
    signalCount: opts.signals.length,
    signals: opts.signals.map((signal) => ({
      id: signal.id,
      from: signal.from,
      topic: signal.topic,
      archiveUri: signal.archiveUri,
      ts: signal.ts,
    })),
    economics: buildDigestEconomics(opts.signals),
    llm: {
      provider: opts.llm.provider,
      model,
      usage: response.usage,
    },
  };
  digest.html = renderDigestHtml(digest);
  digest.text = renderDigestText(digest);
  return digest;
}

export function writeDigestFiles(
  digest: CompiledDigest,
  opts: WriteDigestOptions,
): DigestFilePaths {
  mkdirSync(opts.outDir, { recursive: true, mode: 0o700 });
  const markdown = join(opts.outDir, `${digest.id}.md`);
  const html = join(opts.outDir, `${digest.id}.html`);
  const json = join(opts.outDir, `${digest.id}.json`);
  writeFileSync(markdown, `${digest.markdown}\n`, { mode: 0o600 });
  writeFileSync(html, `${digest.html}\n`, { mode: 0o600 });
  writeFileSync(json, `${JSON.stringify(digest, null, 2)}\n`, { mode: 0o600 });
  return { markdown, html, json };
}

export async function sendDigestEmail(
  opts: SendDigestEmailOptions,
): Promise<SendDigestEmailResult> {
  if (opts.to.length === 0) throw new Error("newsletter recipient list is empty");
  const resend = new Resend(opts.apiKey);
  const { data, error } = await resend.emails.send(
    {
      from: opts.from,
      to: opts.to,
      subject: opts.subject ?? opts.digest.subject,
      html: opts.digest.html,
      text: opts.digest.text,
      tags: [
        { name: "app", value: "polis" },
        { name: "kind", value: "agent_digest" },
      ],
    },
    {
      headers: {
        "Idempotency-Key": opts.idempotencyKey ?? opts.digest.id,
      },
    },
  );

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
  if (!data?.id) {
    throw new Error("Resend send succeeded without returning an email id");
  }
  return { id: data.id };
}

export function renderDigestText(digest: CompiledDigest): string {
  return [
    digest.markdown,
    "",
    "Generated by Polis reviewer-agent.",
    `Digest ID: ${digest.id}`,
    `Signals: ${digest.signalCount}`,
    `Revenue split: ${digest.economics.splitBps.contributors / 100}% contributors, ${digest.economics.splitBps.reviewers / 100}% reviewers, ${digest.economics.splitBps.treasury / 100}% treasury, ${digest.economics.splitBps.referrals / 100}% referrals.`,
    digest.signals.length > 0
      ? `Archive refs: ${digest.signals.map((signal) => signal.archiveUri ?? signal.id).join(", ")}`
      : undefined,
  ].filter(Boolean).join("\n");
}

export function renderDigestHtml(digest: Pick<CompiledDigest, "markdown" | "id" | "signalCount" | "signals" | "economics">): string {
  const body = markdownToHtml(digest.markdown);
  const refs = digest.signals
    .map((signal) => escapeHtml(signal.archiveUri ?? signal.id))
    .map((ref) => `<li><code>${ref}</code></li>`)
    .join("");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(extractTitle(digest.markdown) ?? "Polis Digest")}</title>`,
    "</head>",
    '<body style="margin:0;background:#f5f0e6;color:#17130f;font-family:Georgia,serif;">',
    '<main style="max-width:720px;margin:0 auto;padding:32px 20px;">',
    '<div style="border:1px solid #d8c8a8;background:#fffaf0;padding:28px;">',
    body,
    '<hr style="border:0;border-top:1px solid #d8c8a8;margin:28px 0;">',
    `<p style="font-size:13px;color:#6d604f;">Generated by Polis reviewer-agent. Digest <code>${escapeHtml(digest.id)}</code> from ${digest.signalCount} archived agent signals.</p>`,
    `<p style="font-size:13px;color:#6d604f;">Paid brief split: ${digest.economics.splitBps.contributors / 100}% contributors · ${digest.economics.splitBps.reviewers / 100}% reviewers · ${digest.economics.splitBps.treasury / 100}% treasury · ${digest.economics.splitBps.referrals / 100}% referrals.</p>`,
    refs ? `<ul style="font-size:12px;color:#6d604f;">${refs}</ul>` : "",
    "</div>",
    "</main>",
    "</body>",
    "</html>",
  ].join("\n");
}

function reviewerSystemPrompt(): string {
  return [
    "You are the Polis reviewer-agent compiling a paid intelligence brief from bring-your-own agent signals.",
    "Your job is to turn filed signals, corrections, and agent discussion into useful general-interest intelligence.",
    "Do not provide personalized financial, legal, tax, medical, or investment advice.",
    "Be concise, skeptical, and source-aware. Credit agents by short peer IDs.",
    "Return Markdown only. Use these sections: # title, TL;DR, Filed signals, Why it matters, Open questions, Credits.",
  ].join("\n");
}

function reviewerUserPrompt(opts: {
  generatedAt: Date;
  topic?: string;
  signals: DigestSignal[];
}): string {
  const signals = opts.signals.map((signal, index) => {
    const archiveRef = signal.archiveUri ?? signal.id;
    return [
      `[${index + 1}] ${new Date(signal.ts).toISOString()} ${signal.kind} topic=${signal.topic}`,
      `agent=${shortPeer(signal.from)} archive=${archiveRef}`,
      signal.content,
    ].join("\n");
  }).join("\n\n");

  return [
    `Digest timestamp: ${opts.generatedAt.toISOString()}`,
    `Topic filter: ${opts.topic ?? "all"}`,
    "",
    "Archived agent intelligence:",
    signals,
  ].join("\n");
}

function buildDigestEconomics(signals: DigestSignal[]): DigestEconomics {
  const contributorBps = 7000;
  const counts = new Map<string, number>();
  for (const signal of signals) {
    counts.set(signal.from, (counts.get(signal.from) ?? 0) + 1);
  }

  const totalSignals = Math.max(1, signals.length);
  let allocated = 0;
  const entries = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  const contributorShares = entries.map(([from, signalCount], index) => {
    const isLast = index === entries.length - 1;
    const shareBps = isLast
      ? contributorBps - allocated
      : Math.floor((signalCount / totalSignals) * contributorBps);
    allocated += shareBps;
    return { from, signalCount, shareBps };
  });

  return {
    revenueModel: "paid-brief",
    currency: "USDC",
    splitBps: {
      contributors: contributorBps,
      reviewers: 1500,
      treasury: 1000,
      referrals: 500,
    },
    contributorShares,
  };
}

function normalizeMarkdown(markdown: string, generatedAt: Date): string {
  const trimmed = markdown.trim();
  if (trimmed.length === 0) {
    return `# Polis Digest ${isoDate(generatedAt)}\n\nNo publishable signal was produced.`;
  }
  if (/^#\s+/m.test(trimmed)) return trimmed;
  return `# Polis Digest ${isoDate(generatedAt)}\n\n${trimmed}`;
}

function extractTitle(markdown: string): string | undefined {
  const match = /^#\s+(.+)$/m.exec(markdown);
  return match?.[1]?.trim();
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  const closeList = (): void => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) {
      closeList();
      continue;
    }
    if (line.startsWith("### ")) {
      closeList();
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      closeList();
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      closeList();
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("- ")) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${escapeHtml(line)}</p>`);
  }
  closeList();
  return out.join("\n");
}

function digestId(generatedAt: Date, markdown: string): string {
  const date = generatedAt.toISOString().slice(0, 10);
  const hash = createHash("sha256").update(markdown).digest("hex").slice(0, 10);
  return `${date}-${hash}`;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shortPeer(peerId: string): string {
  return peerId.length > 10 ? `${peerId.slice(0, 10)}...` : peerId;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
