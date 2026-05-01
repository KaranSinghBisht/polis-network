import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PostEntry {
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
}

export function GET(request: Request) {
  if (!canReadLocalFiles(request)) {
    return NextResponse.json({ posts: [], source: "disabled" });
  }

  const archiveDir = process.env.POLIS_ARCHIVE_DIR ?? join(homedir(), ".polis", "archive");
  if (!existsSync(archiveDir)) {
    return NextResponse.json({ posts: [], source: "no-dir", archiveDir: displayDir(archiveDir) });
  }

  const url = new URL(request.url);
  const peerFilter = url.searchParams.get("peer") ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30", 10) || 30, 100);

  const posts: PostEntry[] = [];
  for (const name of readdirSync(archiveDir)) {
    if (!name.endsWith(".json")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(archiveDir, name), "utf8"));
    } catch {
      continue;
    }
    const entry = toPostEntry(parsed, name);
    if (!entry) continue;
    if (peerFilter && entry.from !== peerFilter) continue;
    posts.push(entry);
  }

  posts.sort((a, b) => b.ts - a.ts);
  return NextResponse.json({
    posts: posts.slice(0, limit),
    total: posts.length,
    source: "archive",
    archiveDir: displayDir(archiveDir),
  });
}

function toPostEntry(value: unknown, fileName: string): PostEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.v !== 1) return null;
  if (typeof v.kind !== "string") return null;
  if (typeof v.topic !== "string") return null;
  if (typeof v.from !== "string") return null;
  if (typeof v.content !== "string") return null;
  if (typeof v.ts !== "number") return null;
  return {
    id: fileName.replace(/\.json$/, ""),
    ts: v.ts,
    kind: v.kind,
    topic: v.topic,
    beat: typeof v.beat === "string" ? v.beat : undefined,
    from: v.from,
    content: v.content,
    archiveUri: typeof v.archiveUri === "string" ? v.archiveUri : undefined,
    archiveTxHash: typeof v.archiveTxHash === "string" ? v.archiveTxHash : undefined,
    sources: Array.isArray(v.source) ? v.source.filter((s): s is string => typeof s === "string") : undefined,
    tags: Array.isArray(v.tag) ? v.tag.filter((t): t is string => typeof t === "string") : undefined,
    confidence: typeof v.confidence === "string" ? v.confidence : undefined,
  };
}

function displayDir(path: string): string {
  if (process.env.POLIS_ARCHIVE_DIR) return "$POLIS_ARCHIVE_DIR";
  const home = homedir();
  return path.startsWith(home) ? path.replace(home, "~") : path;
}

function canReadLocalFiles(request: Request): boolean {
  const token = process.env.POLIS_WEB_LOCAL_READ_TOKEN;
  if (token) return requestToken(request) === token;
  if (process.env.POLIS_WEB_EXPOSE_LOCAL_FILES === "1") return true;
  const host = hostnameOnly(request.headers.get("host"));
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function requestToken(request: Request): string | undefined {
  return (
    request.headers.get("x-polis-demo-token") ??
    new URL(request.url).searchParams.get("token") ??
    undefined
  );
}

function hostnameOnly(hostHeader: string | null): string | undefined {
  if (!hostHeader) return undefined;
  const host = hostHeader.toLowerCase();
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end > 0 ? host.slice(1, end) : undefined;
  }
  return host.split(":")[0];
}
