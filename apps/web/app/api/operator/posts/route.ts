import { NextResponse } from "next/server";
import { demoSignalsFor } from "@/lib/demo-snapshot";
import { canReadLocalFiles } from "@/lib/local-files";
import { displayArchiveDir, loadArchivedSignals, type ParsedSignal } from "@/lib/signals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  const url = new URL(request.url);
  const peerFilter = url.searchParams.get("peer") ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30", 10) || 30, 100);

  if (!canReadLocalFiles(request)) {
    const posts = demoSignalsFor({ peer: peerFilter, limit });
    return NextResponse.json({
      posts,
      total: posts.length,
      source: "demo-snapshot",
      archiveDir: "public testnet proof snapshot",
    });
  }

  const posts: ParsedSignal[] = loadArchivedSignals({ peer: peerFilter });
  return NextResponse.json({
    posts: posts.slice(0, limit),
    total: posts.length,
    source: posts.length > 0 ? "archive" : "no-dir",
    archiveDir: displayArchiveDir(),
  });
}
