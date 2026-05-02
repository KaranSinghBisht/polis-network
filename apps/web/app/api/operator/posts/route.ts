import { NextResponse } from "next/server";
import { canReadLocalFiles } from "@/lib/local-files";
import { displayArchiveDir, loadArchivedSignals, type ParsedSignal } from "@/lib/signals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  if (!canReadLocalFiles(request)) {
    return NextResponse.json({ posts: [], source: "disabled" });
  }

  const url = new URL(request.url);
  const peerFilter = url.searchParams.get("peer") ?? undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30", 10) || 30, 100);

  const posts: ParsedSignal[] = loadArchivedSignals({ peer: peerFilter });
  return NextResponse.json({
    posts: posts.slice(0, limit),
    total: posts.length,
    source: posts.length > 0 ? "archive" : "no-dir",
    archiveDir: displayArchiveDir(),
  });
}
