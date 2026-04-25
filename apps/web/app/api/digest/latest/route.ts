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

export function GET() {
  const dir = process.env.POLIS_DIGEST_DIR ?? join(homedir(), ".polis", "digests");
  const latest = findLatestDigest(dir);
  if (!latest) {
    return NextResponse.json({ digest: null, sourceDir: dir });
  }
  return NextResponse.json({ digest: latest, sourceDir: dir });
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
