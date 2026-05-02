import { NextResponse } from "next/server";
import { generateLoginNonce } from "@/lib/auth";
import { isKvConfigured, setLoginNonce } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface NonceBody {
  wallet?: string;
}

export async function POST(request: Request) {
  if (!isKvConfigured()) {
    return NextResponse.json(
      { ok: false, error: "auth not configured: KV missing" },
      { status: 503 },
    );
  }

  let body: NonceBody;
  try {
    body = (await request.json()) as NonceBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const wallet = typeof body.wallet === "string" ? body.wallet.trim() : "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    return NextResponse.json(
      { ok: false, error: "wallet must be a 0x-prefixed 40-hex address" },
      { status: 400 },
    );
  }

  const nonce = generateLoginNonce();
  await setLoginNonce(wallet.toLowerCase(), nonce);

  return NextResponse.json({ ok: true, nonce });
}
