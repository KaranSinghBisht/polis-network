import { NextResponse } from "next/server";
import { generateClaimCode } from "@/lib/auth";
import { setClaimCode } from "@/lib/kv";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }
  const code = generateClaimCode();
  await setClaimCode(user.wallet, code);
  return NextResponse.json({ ok: true, code });
}
