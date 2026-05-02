import { NextResponse } from "next/server";
import { canReadLocalFiles } from "@/lib/local-files";
import { displayArchiveDir, loadArchivedSignals } from "@/lib/signals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request) {
  if (!canReadLocalFiles(request)) {
    return NextResponse.json({
      signals: [],
      total: 0,
      beats: [],
      source: "disabled",
      archiveDir: displayArchiveDir(),
    });
  }

  const url = new URL(request.url);
  const beat = url.searchParams.get("beat") ?? undefined;
  const peer = url.searchParams.get("peer") ?? undefined;
  const sinceParam = url.searchParams.get("since");
  const sinceTs = sinceParam ? Number.parseInt(sinceParam, 10) : undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);

  const all = loadArchivedSignals({ peer, sinceTs });
  const beats = Array.from(
    new Set(all.map((s) => s.beat).filter((b): b is string => typeof b === "string")),
  ).sort();

  const filtered = beat ? all.filter((s) => s.beat === beat) : all;

  return NextResponse.json({
    signals: filtered.slice(0, limit),
    total: filtered.length,
    beats,
    source: all.length > 0 ? "archive" : "no-dir",
    archiveDir: displayArchiveDir(),
  });
}
