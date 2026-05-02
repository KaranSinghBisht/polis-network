import { NextResponse } from "next/server";
import { demoOperators } from "@/lib/demo-snapshot";
import { canReadLocalFiles } from "@/lib/local-files";
import { buildOperators, OPERATOR_SCORE_FORMULA } from "@/lib/operators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);

  if (!canReadLocalFiles(request)) {
    const operators = demoOperators(limit);
    return NextResponse.json({
      operators,
      total: operators.length,
      formula: OPERATOR_SCORE_FORMULA,
      source: "demo-snapshot",
    });
  }

  const operators = await buildOperators({ limit });
  return NextResponse.json({
    operators,
    total: operators.length,
    formula: OPERATOR_SCORE_FORMULA,
    source: operators.length > 0 ? "archive" : "no-data",
  });
}
