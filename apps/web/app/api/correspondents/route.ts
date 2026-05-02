import { NextResponse } from "next/server";
import { buildCorrespondents, SCORE_FORMULA } from "@/lib/correspondents";
import { canReadLocalFiles } from "@/lib/local-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!canReadLocalFiles(request)) {
    return NextResponse.json({
      correspondents: [],
      total: 0,
      formula: SCORE_FORMULA,
      source: "disabled",
    });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);

  const correspondents = await buildCorrespondents({ limit });
  return NextResponse.json({
    correspondents,
    total: correspondents.length,
    formula: SCORE_FORMULA,
    source: correspondents.length > 0 ? "archive" : "no-data",
  });
}
