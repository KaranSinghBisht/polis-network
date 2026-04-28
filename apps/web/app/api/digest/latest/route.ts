import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DigestSummary {
  id: string;
  title: string;
  subject: string;
  markdown: string;
  generatedAt: string;
  signalCount: number;
  signals: Array<{
    id: string;
    from: string;
    topic: string;
    archiveUri?: string;
    ts: number;
  }>;
}

export function GET(request: Request) {
  if (!canReadLocalFiles(request)) {
    return NextResponse.json({
      digest: null,
      sourceDir: "local file access disabled",
    });
  }

  const dir = process.env.POLIS_DIGEST_DIR ?? join(homedir(), ".polis", "digests");
  const latest = findLatestDigest(dir);
  if (!latest) {
    return NextResponse.json({ digest: null, sourceDir: displayDigestDir() });
  }
  return NextResponse.json({ digest: latest, sourceDir: displayDigestDir() });
}

function displayDigestDir(): string {
  return process.env.POLIS_DIGEST_DIR ? "$POLIS_DIGEST_DIR" : "~/.polis/digests";
}

function canReadLocalFiles(request: Request): boolean {
  if (process.env.POLIS_WEB_EXPOSE_LOCAL_FILES === "1") return true;
  const host = hostnameOnly(request.headers.get("host"));
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
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

function findLatestDigest(dir: string): DigestSummary | null {
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a));

  for (const name of files) {
    try {
      const parsed = JSON.parse(readFileSync(join(dir, name), "utf8")) as Partial<DigestSummary>;
      if (isDigestSummary(parsed)) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

function isDigestSummary(value: Partial<DigestSummary>): value is DigestSummary {
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.subject === "string" &&
    typeof value.markdown === "string" &&
    typeof value.generatedAt === "string" &&
    typeof value.signalCount === "number" &&
    Array.isArray(value.signals)
  );
}
